#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkDashboardStats() {
  console.log('📊 Checking Dashboard Statistics\n');
  console.log('='.repeat(60));
  
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  
  // Total companies
  const { count: totalCompanies } = await supabase
    .from('identified_companies')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n📈 TOTAL COMPANIES: ${totalCompanies}`);
  
  // Today's discoveries
  const { count: todayCompanies } = await supabase
    .from('identified_companies')
    .select('*', { count: 'exact', head: true })
    .gte('identified_date', today);
  
  console.log(`📅 Companies found today: ${todayCompanies || 0}`);
  
  // This week's discoveries
  const { count: weekCompanies } = await supabase
    .from('identified_companies')
    .select('*', { count: 'exact', head: true })
    .gte('identified_date', weekAgo.toISOString());
  
  console.log(`📅 Companies found this week: ${weekCompanies || 0}`);
  
  // Last week's discoveries (for growth calculation)
  const { count: lastWeekCompanies } = await supabase
    .from('identified_companies')
    .select('*', { count: 'exact', head: true })
    .gte('identified_date', twoWeeksAgo.toISOString())
    .lt('identified_date', weekAgo.toISOString());
  
  console.log(`📅 Companies found last week: ${lastWeekCompanies || 0}`);
  
  // Calculate growth
  const growthRate = lastWeekCompanies && lastWeekCompanies > 0 ? 
    ((weekCompanies - lastWeekCompanies) / lastWeekCompanies * 100) : 
    (weekCompanies > 0 ? 100 : 0);
  
  console.log(`\n📈 WEEKLY GROWTH: ${growthRate.toFixed(1)}%`);
  
  // Processing status
  console.log('\n' + '='.repeat(60));
  console.log('⚙️  PROCESSING STATUS\n');
  
  // Jobs analyzed today
  const { count: jobsAnalyzedToday } = await supabase
    .from('raw_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('processed', true)
    .gte('analyzed_date', today);
  
  console.log(`Jobs analyzed today: ${jobsAnalyzedToday || 0}`);
  
  // Companies found today
  const { count: companiesFoundToday } = await supabase
    .from('identified_companies')
    .select('*', { count: 'exact', head: true })
    .gte('identified_date', today);
  
  console.log(`Companies found today: ${companiesFoundToday || 0}`);
  
  // Unprocessed jobs
  const { count: unprocessedJobs } = await supabase
    .from('raw_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('processed', false);
  
  console.log(`Unprocessed jobs remaining: ${unprocessedJobs || 0}`);
  
  // Search terms processed today
  const { count: termsProcessedToday } = await supabase
    .from('search_terms')
    .select('*', { count: 'exact', head: true })
    .gte('last_scraped_date', today);
  
  console.log(`Search terms processed today: ${termsProcessedToday || 0}`);
  
  // Tool breakdown
  console.log('\n' + '='.repeat(60));
  console.log('🔧 TOOL BREAKDOWN\n');
  
  const { data: toolBreakdown } = await supabase
    .from('identified_companies')
    .select('tool_detected');
  
  const counts = {
    'Outreach.io': 0,
    'SalesLoft': 0,
    'Both': 0,
    'other': 0
  };
  
  toolBreakdown?.forEach(company => {
    const tool = company.tool_detected;
    if (tool === 'Outreach.io' || tool?.toLowerCase() === 'outreach') {
      counts['Outreach.io']++;
    } else if (tool === 'SalesLoft' || tool?.toLowerCase() === 'salesloft') {
      counts['SalesLoft']++;
    } else if (tool === 'Both' || tool?.toLowerCase() === 'both') {
      counts['Both']++;
    } else {
      counts['other']++;
    }
  });
  
  const outreachTotal = counts['Outreach.io'] + counts['Both'];
  const salesloftTotal = counts['SalesLoft'] + counts['Both'];
  
  console.log(`Outreach.io users (including Both): ${outreachTotal}`);
  console.log(`SalesLoft users (including Both): ${salesloftTotal}`);
  console.log(`Using both tools: ${counts['Both']}`);
  
  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Dashboard should show:');
  console.log(`- Total Companies: ${totalCompanies}`);
  console.log(`- Outreach Users: ${outreachTotal} (${Math.round((outreachTotal / totalCompanies) * 100)}%)`);
  console.log(`- SalesLoft Users: ${salesloftTotal} (${Math.round((salesloftTotal / totalCompanies) * 100)}%)`);
  console.log(`- Weekly Growth: ${growthRate >= 0 ? '+' : ''}${growthRate.toFixed(1)}%`);
  console.log(`- Jobs Today: ${jobsAnalyzedToday || 0}`);
  console.log(`- Companies Today: ${companiesFoundToday || 0}`);
}

checkDashboardStats();