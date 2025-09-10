#!/usr/bin/env node

/**
 * Monitor GPT-5 Analysis
 * 
 * This script monitors the GPT-5-mini analysis to ensure:
 * 1. Jobs are being analyzed one at a time
 * 2. GPT-5-mini is actually responding
 * 3. Companies are being detected when they should be
 * 4. No jobs are marked as processed without actual analysis
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function monitorAnalysis() {
  console.log('========================================');
  console.log('GPT-5-MINI ANALYSIS MONITOR');
  console.log('========================================\n');

  try {
    // Get processing stats for last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const today = new Date().toISOString().split('T')[0];

    // Jobs processed in last hour
    const { count: jobsProcessedHour, error: hourError } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('processed', true)
      .gte('analyzed_date', oneHourAgo.toISOString());

    // Jobs processed today
    const { count: jobsProcessedToday, error: todayError } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('processed', true)
      .gte('analyzed_date', `${today}T00:00:00`)
      .lte('analyzed_date', `${today}T23:59:59`);

    // Companies detected today
    const { count: companiesDetectedToday, error: compError } = await supabase
      .from('identified_companies')
      .select('*', { count: 'exact', head: true })
      .gte('identified_date', `${today}T00:00:00`)
      .lte('identified_date', `${today}T23:59:59`);

    // Unprocessed backlog
    const { count: unprocessedJobs, error: backlogError } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('processed', false);

    // Get recent companies detected
    const { data: recentCompanies, error: recentError } = await supabase
      .from('identified_companies')
      .select('company, tool_detected, identified_date')
      .order('identified_date', { ascending: false })
      .limit(5);

    // Calculate detection rate
    const detectionRate = jobsProcessedToday > 0 
      ? ((companiesDetectedToday / jobsProcessedToday) * 100).toFixed(2)
      : 0;

    // Display results
    console.log('📊 PROCESSING STATS');
    console.log('-------------------');
    console.log(`Jobs processed (last hour): ${jobsProcessedHour || 0}`);
    console.log(`Jobs processed (today): ${jobsProcessedToday || 0}`);
    console.log(`Companies detected (today): ${companiesDetectedToday || 0}`);
    console.log(`Detection rate: ${detectionRate}%`);
    console.log(`Unprocessed backlog: ${unprocessedJobs || 0}`);

    // Check for issues
    console.log('\n⚠️  HEALTH CHECKS');
    console.log('-------------------');
    
    if (jobsProcessedToday > 100 && companiesDetectedToday === 0) {
      console.log('❌ CRITICAL: No companies detected despite processing jobs!');
      console.log('   Likely issue: GPT-5-mini not responding or API credits exhausted');
    } else if (detectionRate < 5 && jobsProcessedToday > 50) {
      console.log('⚠️  WARNING: Very low detection rate (<5%)');
      console.log('   Possible issue: GPT-5-mini responses not being parsed correctly');
    } else {
      console.log('✅ Detection rate looks normal');
    }

    if (jobsProcessedHour === 0 && unprocessedJobs > 100) {
      console.log('❌ CRITICAL: No jobs processed in last hour with large backlog!');
      console.log('   Likely issue: Analyzer cron job not running');
    } else if (jobsProcessedHour < 20 && unprocessedJobs > 500) {
      console.log('⚠️  WARNING: Processing too slow for backlog size');
      console.log('   Consider increasing batch size or frequency');
    } else {
      console.log('✅ Processing rate adequate');
    }

    // Show recent detections
    if (recentCompanies && recentCompanies.length > 0) {
      console.log('\n🎯 RECENT DETECTIONS');
      console.log('-------------------');
      recentCompanies.forEach(c => {
        const time = new Date(c.identified_date).toLocaleTimeString();
        console.log(`${time}: ${c.company} → ${c.tool_detected}`);
      });
    } else {
      console.log('\n⚠️  No recent company detections');
    }

    // Processing rate calculation
    const hoursToday = new Date().getHours() || 1;
    const avgPerHour = Math.round(jobsProcessedToday / hoursToday);
    const projectedDaily = avgPerHour * 24;

    console.log('\n📈 PERFORMANCE METRICS');
    console.log('-------------------');
    console.log(`Average per hour: ${avgPerHour} jobs`);
    console.log(`Projected daily: ${projectedDaily} jobs`);
    console.log(`Time to clear backlog: ${unprocessedJobs > 0 ? Math.round(unprocessedJobs / (avgPerHour || 1)) + ' hours' : 'No backlog'}`);

    // Check CRO jobs (that were preserved)
    const { count: croJobsProcessed } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('processed', true)
      .eq('search_term', 'CRO')
      .gte('analyzed_date', `${today}T00:00:00`);

    console.log(`\n📌 CRO Jobs (preserved): ${croJobsProcessed || 0}`);

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS');
    console.log('-------------------');
    if (detectionRate < 5) {
      console.log('1. Check OpenAI API credits');
      console.log('2. Verify GPT-5-mini model is accessible');
      console.log('3. Check error logs for API failures');
    }
    if (unprocessedJobs > 1000) {
      console.log('1. Consider temporary batch size increase');
      console.log('2. Run manual processing to clear backlog');
    }
    if (avgPerHour < 50 && unprocessedJobs > 100) {
      console.log('1. Check if analyzer cron is running every 5 minutes');
      console.log('2. Verify no rate limiting from OpenAI');
    }

  } catch (error) {
    console.error('❌ Error monitoring analysis:', error);
  }
}

// Run monitoring
console.log(`Monitoring at ${new Date().toISOString()}\n`);
monitorAnalysis();

// Optional: Run continuously
if (process.argv.includes('--watch')) {
  console.log('\n👁️  Watching mode enabled - refreshing every 60 seconds...\n');
  setInterval(() => {
    console.clear();
    console.log(`Monitoring at ${new Date().toISOString()}\n`);
    monitorAnalysis();
  }, 60000);
}