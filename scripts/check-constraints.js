require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkConstraints() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  
  console.log('=== CHECKING DATABASE CONSTRAINTS ===\n');
  
  // Check for unique constraints on identified_companies
  const { data: constraints, error } = await supabase.rpc('get_table_constraints', {
    table_name: 'identified_companies'
  }).single();
  
  if (error) {
    // Try a simpler query
    console.log('Checking with simpler query...\n');
    
    // Test if unique constraint exists by trying to insert a duplicate
    const testCompany = 'TEST_DUPLICATE_CHECK_' + Date.now();
    
    // Insert first record
    const { error: error1 } = await supabase
      .from('identified_companies')
      .insert({
        company: testCompany,
        tool_detected: 'Outreach.io',
        signal_type: 'required',
        context: 'Test',
        job_title: 'Test',
        job_url: 'https://test.com',
        platform: 'LinkedIn',
        identified_date: new Date().toISOString()
      });
    
    if (!error1) {
      // Try to insert duplicate
      const { error: error2 } = await supabase
        .from('identified_companies')
        .insert({
          company: testCompany,
          tool_detected: 'Outreach.io',
          signal_type: 'required',
          context: 'Test 2',
          job_title: 'Test 2',
          job_url: 'https://test2.com',
          platform: 'LinkedIn',
          identified_date: new Date().toISOString()
        });
      
      if (error2) {
        console.log('✅ UNIQUE CONSTRAINT EXISTS!');
        console.log('Error when inserting duplicate:', error2.message);
      } else {
        console.log('❌ NO UNIQUE CONSTRAINT - duplicates allowed!');
      }
      
      // Clean up test data
      await supabase
        .from('identified_companies')
        .delete()
        .eq('company', testCompany);
    }
  } else {
    console.log('Constraints:', constraints);
  }
  
  // Check recent duplicates by timing
  console.log('\n=== CHECKING RECENT DUPLICATE TIMING ===\n');
  
  const { data: recentDupes } = await supabase
    .from('identified_companies')
    .select('company, tool_detected, created_at')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false });
  
  // Group by company+tool and find those created within 1 second of each other
  const grouped = new Map();
  recentDupes?.forEach(r => {
    const key = `${r.company}|${r.tool_detected}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(r);
  });
  
  const suspiciousDupes = [];
  grouped.forEach((entries, key) => {
    if (entries.length > 1) {
      // Check if created within 1 second
      const times = entries.map(e => new Date(e.created_at).getTime());
      times.sort();
      for (let i = 1; i < times.length; i++) {
        if (times[i] - times[i-1] < 1000) { // Within 1 second
          suspiciousDupes.push({ key, entries });
          break;
        }
      }
    }
  });
  
  if (suspiciousDupes.length > 0) {
    console.log('DUPLICATES CREATED WITHIN 1 SECOND (likely race condition):');
    suspiciousDupes.forEach(({ key, entries }) => {
      const [company, tool] = key.split('|');
      console.log(`\n${company} (${tool}):`);
      entries.forEach(e => {
        console.log(`  - ${e.created_at}`);
      });
    });
  } else {
    console.log('No suspicious timing duplicates found');
  }
}

checkConstraints().catch(console.error);
