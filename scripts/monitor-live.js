/**
 * LIVE MONITORING - Real-time dashboard of what's happening
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function monitorLive() {
  console.clear();
  console.log('📊 LIVE MONITORING DASHBOARD\n');
  console.log('=' .repeat(60));
  
  while (true) {
    // Get current stats
    const { count: totalJobs } = await supabase
      .from('job_queue')
      .select('*', { count: 'exact', head: true });
    
    const { count: completedJobs } = await supabase
      .from('job_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed');
    
    const { count: companiesCount } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true });
    
    const { count: outreachCount } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .eq('uses_outreach', true);
    
    const { count: salesloftCount } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true })
      .eq('uses_salesloft', true);
    
    // Get recent detections
    const { data: recentCompanies } = await supabase
      .from('companies')
      .select('name, uses_outreach, uses_salesloft, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    // Clear and update display
    console.clear();
    console.log('📊 LIVE MONITORING DASHBOARD');
    console.log('Updated:', new Date().toLocaleTimeString());
    console.log('=' .repeat(60));
    
    console.log('\n📈 PIPELINE STATUS:');
    console.log(`  Total Jobs: ${totalJobs}`);
    console.log(`  Completed: ${completedJobs} (${Math.round((completedJobs/totalJobs)*100)}%)`);
    console.log(`  Remaining: ${totalJobs - completedJobs}`);
    
    console.log('\n🏢 COMPANIES:');
    console.log(`  Total: ${companiesCount}`);
    console.log(`  Using Outreach: ${outreachCount}`);
    console.log(`  Using SalesLoft: ${salesloftCount}`);
    
    console.log('\n🆕 RECENT DETECTIONS:');
    recentCompanies?.forEach(c => {
      const tools = [];
      if (c.uses_outreach) tools.push('Outreach');
      if (c.uses_salesloft) tools.push('SalesLoft');
      console.log(`  - ${c.name}: ${tools.join(' & ')}`);
    });
    
    console.log('\n[Refreshing every 5 seconds... Ctrl+C to stop]');
    
    // Wait 5 seconds
    await new Promise(r => setTimeout(r, 5000));
  }
}

monitorLive().catch(console.error);