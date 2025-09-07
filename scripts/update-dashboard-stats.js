#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function updateDashboardStats() {
  console.log('📊 Production Dashboard Status Check\n');
  console.log('='.repeat(60));
  
  // Get current stats
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  // Total companies
  const { count: totalCompanies } = await supabase
    .from('identified_companies')
    .select('*', { count: 'exact', head: true });
  
  // Tool breakdown with proper counting
  const { data: toolBreakdown } = await supabase
    .from('identified_companies')
    .select('tool_detected');
  
  let outreachOnly = 0, salesloftOnly = 0, both = 0;
  
  toolBreakdown?.forEach(company => {
    const tool = company.tool_detected;
    if (tool === 'Outreach.io' || tool?.toLowerCase() === 'outreach') {
      outreachOnly++;
    } else if (tool === 'SalesLoft' || tool?.toLowerCase() === 'salesloft') {
      salesloftOnly++;
    } else if (tool === 'Both' || tool?.toLowerCase() === 'both') {
      both++;
    }
  });
  
  const outreachTotal = outreachOnly + both;
  const salesloftTotal = salesloftOnly + both;
  
  // Weekly growth calculation
  const { count: weekCompanies } = await supabase
    .from('identified_companies')
    .select('*', { count: 'exact', head: true })
    .gte('identified_date', weekAgo.toISOString());
  
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  
  const { count: lastWeekCompanies } = await supabase
    .from('identified_companies')
    .select('*', { count: 'exact', head: true })
    .gte('identified_date', twoWeeksAgo.toISOString())
    .lt('identified_date', weekAgo.toISOString());
  
  const growthRate = lastWeekCompanies && lastWeekCompanies > 0 ? 
    ((weekCompanies - lastWeekCompanies) / lastWeekCompanies * 100) : 
    (weekCompanies > 0 ? 100 : 0);
  
  // Processing status
  const { count: jobsAnalyzedToday } = await supabase
    .from('raw_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('processed', true)
    .gte('analyzed_date', today);
  
  const { count: companiesFoundToday } = await supabase
    .from('identified_companies')
    .select('*', { count: 'exact', head: true })
    .gte('identified_date', today);
  
  const { count: unprocessedJobs } = await supabase
    .from('raw_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('processed', false);
  
  const { count: termsProcessedToday } = await supabase
    .from('search_terms')
    .select('*', { count: 'exact', head: true })
    .gte('last_scraped_date', today);
  
  // Display results
  console.log('📈 MAIN STATS:');
  console.log(`- Total Companies: ${totalCompanies}`);
  console.log(`- Outreach Users: ${outreachTotal} (${Math.round((outreachTotal / totalCompanies) * 100)}%)`);
  console.log(`- SalesLoft Users: ${salesloftTotal} (${Math.round((salesloftTotal / totalCompanies) * 100)}%)`);
  console.log(`- Weekly Growth: ${growthRate >= 0 ? '+' : ''}${growthRate.toFixed(1)}%`);
  console.log(`  (This week: ${weekCompanies}, Last week: ${lastWeekCompanies})`);
  
  console.log('\n⚙️ PROCESSING STATUS:');
  console.log(`- Jobs Analyzed Today: ${jobsAnalyzedToday || 0}`);
  console.log(`- Companies Found Today: ${companiesFoundToday || 0}`);
  console.log(`- Terms Processed Today: ${termsProcessedToday || 0}`);
  console.log(`- Unprocessed Jobs Queue: ${unprocessedJobs || 0}`);
  
  if (unprocessedJobs > 0) {
    const estimatedTime = unprocessedJobs * 3; // 3 seconds per job
    console.log(`- Estimated Processing Time: ${Math.round(estimatedTime / 60)} minutes`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Dashboard at http://localhost:4001 should display these values');
  console.log('If not, try refreshing the page or restarting the dev server');
  
  // Check for common issues
  if (totalCompanies === 0) {
    console.log('\n⚠️ WARNING: No companies in database! Run scraping first.');
  }
  if (growthRate === 0 && weekCompanies === 0) {
    console.log('\n⚠️ WARNING: No companies found this week. Check if scraping is running.');
  }
  if (unprocessedJobs > 100) {
    console.log(`\n⚠️ WARNING: Large backlog of ${unprocessedJobs} unprocessed jobs.`);
    console.log('   Consider running: node scripts/simple-processor.js');
  }
}

updateDashboardStats();