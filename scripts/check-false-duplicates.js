require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkFalseDuplicates() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  
  console.log('=== ANALYZING "NEW" NOTIFICATIONS VS ACTUAL NEW COMPANIES ===\n');
  
  // Get recent notifications
  const { data: notifications } = await supabase
    .from('notifications')
    .select('title, message, created_at')
    .ilike('title', 'New company:%')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false });
  
  // Extract companies from notifications
  const notifiedCompanies = new Map();
  notifications?.forEach(n => {
    const match = n.title.match(/New company: (.+)/);
    if (match) {
      const company = match[1].trim();
      const tool = n.message.includes('Outreach') ? 'Outreach.io' : 
                   n.message.includes('SalesLoft') ? 'SalesLoft' : 'Unknown';
      const key = `${company}|${tool}`;
      if (!notifiedCompanies.has(key)) {
        notifiedCompanies.set(key, { 
          company, 
          tool, 
          notificationDate: n.created_at 
        });
      }
    }
  });
  
  console.log(`Found ${notifiedCompanies.size} "new company" notifications in last 7 days\n`);
  
  // Check when each was ACTUALLY first identified
  const falseNewCompanies = [];
  
  for (const [key, info] of notifiedCompanies) {
    const { data: companyRecords } = await supabase
      .from('identified_companies')
      .select('created_at, identified_date')
      .eq('company', info.company)
      .eq('tool_detected', info.tool)
      .order('created_at', { ascending: true });
    
    if (companyRecords && companyRecords.length > 0) {
      const firstIdentified = companyRecords[0].created_at || companyRecords[0].identified_date;
      const notificationDate = new Date(info.notificationDate);
      const firstDate = new Date(firstIdentified);
      
      // If company was identified more than 1 hour before notification, it's not really "new"
      if (firstDate < new Date(notificationDate.getTime() - 60 * 60 * 1000)) {
        falseNewCompanies.push({
          ...info,
          firstIdentified,
          timeDiff: Math.round((notificationDate - firstDate) / (1000 * 60 * 60)) // hours
        });
      }
    }
  }
  
  if (falseNewCompanies.length > 0) {
    console.log(`❌ ${falseNewCompanies.length} companies marked as "new" but were already in database:\n`);
    falseNewCompanies
      .sort((a, b) => b.timeDiff - a.timeDiff)
      .slice(0, 20)
      .forEach(c => {
        console.log(`${c.company} (${c.tool})`);
        console.log(`  First identified: ${c.firstIdentified}`);
        console.log(`  "New" notification: ${c.notificationDate}`);
        console.log(`  Time difference: ${c.timeDiff} hours\n`);
      });
  } else {
    console.log('✅ All "new company" notifications were for actually new companies');
  }
  
  // Check for name variations being treated as new
  console.log('\n=== CHECKING NAME VARIATIONS TREATED AS NEW ===\n');
  
  const { data: allCompanies } = await supabase
    .from('identified_companies')
    .select('company, tool_detected')
    .order('company');
  
  const nameVariations = [];
  
  allCompanies?.forEach((c1, i) => {
    allCompanies.slice(i + 1).forEach(c2 => {
      if (c1.tool_detected === c2.tool_detected) {
        const name1 = c1.company.toLowerCase().replace(/[^a-z0-9]/g, '');
        const name2 = c2.company.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // Check if names are very similar (edit distance or common patterns)
        if (name1 !== name2 && (
          name1.includes(name2) || 
          name2.includes(name1) ||
          Math.abs(name1.length - name2.length) <= 5 && name1.substring(0, 5) === name2.substring(0, 5)
        )) {
          nameVariations.push({
            name1: c1.company,
            name2: c2.company,
            tool: c1.tool_detected
          });
        }
      }
    });
  });
  
  if (nameVariations.length > 0) {
    console.log(`Found ${nameVariations.length} potential name variations:\n`);
    nameVariations.slice(0, 10).forEach(v => {
      console.log(`"${v.name1}" vs "${v.name2}" (${v.tool})`);
    });
  }
}

checkFalseDuplicates().catch(console.error);
