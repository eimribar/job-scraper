/**
 * Debug Script: Investigate Missing Jobs
 * This script helps identify why scraped jobs aren't appearing in the database
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { ApifyClient } = require('apify-client');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const apifyClient = new ApifyClient({
  token: process.env.APIFY_TOKEN,
});

async function analyzeJobLoss() {
  console.log('🔍 JOB LOSS INVESTIGATION TOOL\n');
  console.log('=' .repeat(60));
  
  try {
    // Step 1: Check recent Apify runs
    console.log('\n📊 STEP 1: Checking Recent Apify Runs');
    console.log('-'.repeat(40));
    
    const actor = apifyClient.actor('bebity~linkedin-jobs-scraper');
    const runs = await actor.runs().list({ limit: 5 });
    
    console.log(`Found ${runs.items.length} recent Apify runs:\n`);
    
    let totalApifyJobs = 0;
    const recentRuns = [];
    
    for (const run of runs.items) {
      const dataset = await apifyClient.dataset(run.defaultDatasetId).get();
      const itemCount = dataset?.itemCount || 0;
      totalApifyJobs += itemCount;
      
      const runInfo = {
        id: run.id,
        status: run.status,
        startedAt: new Date(run.startedAt).toLocaleString(),
        finishedAt: run.finishedAt ? new Date(run.finishedAt).toLocaleString() : 'Not finished',
        itemCount: itemCount,
        searchTerm: run.input?.title || 'Unknown'
      };
      
      recentRuns.push(runInfo);
      
      console.log(`Run ID: ${run.id}`);
      console.log(`  Status: ${run.status}`);
      console.log(`  Started: ${runInfo.startedAt}`);
      console.log(`  Items scraped: ${itemCount}`);
      console.log(`  Search term: ${runInfo.searchTerm}`);
      console.log('');
    }
    
    console.log(`📌 Total jobs scraped (all runs): ${totalApifyJobs}\n`);
    
    // Step 2: Check database job counts
    console.log('\n💾 STEP 2: Checking Database Records');
    console.log('-'.repeat(40));
    
    // Get total jobs in database
    const { count: totalDbJobs, error: countError } = await supabase
      .from('job_queue')
      .select('*', { count: 'exact', head: true });
    
    console.log(`Total jobs in database: ${totalDbJobs || 0}`);
    
    // Get jobs from today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data: todayJobs, count: todayCount } = await supabase
      .from('job_queue')
      .select('id, payload, created_at', { count: 'exact' })
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false })
      .limit(10);
    
    console.log(`Jobs added today: ${todayCount || 0}`);
    
    if (todayJobs && todayJobs.length > 0) {
      console.log('\nSample of today\'s jobs:');
      todayJobs.slice(0, 3).forEach(job => {
        console.log(`  - ${job.payload?.company || 'Unknown'} | ${job.payload?.job_title || 'Unknown'}`);
        console.log(`    ID: ${job.payload?.job_id || job.id}`);
        console.log(`    Added: ${new Date(job.created_at).toLocaleTimeString()}`);
      });
    }
    
    // Step 3: Analyze the discrepancy
    console.log('\n⚠️  STEP 3: Discrepancy Analysis');
    console.log('-'.repeat(40));
    
    const discrepancy = totalApifyJobs - (totalDbJobs || 0);
    console.log(`🚨 Missing jobs: ${discrepancy}`);
    console.log(`   Apify total: ${totalApifyJobs}`);
    console.log(`   Database total: ${totalDbJobs || 0}`);
    
    // Step 4: Check for duplicate detection patterns
    console.log('\n🔍 STEP 4: Checking Job ID Patterns');
    console.log('-'.repeat(40));
    
    const { data: sampleJobs } = await supabase
      .from('job_queue')
      .select('id, payload')
      .limit(20);
    
    if (sampleJobs && sampleJobs.length > 0) {
      const jobIdPatterns = new Map();
      
      sampleJobs.forEach(job => {
        const jobId = job.payload?.job_id || '';
        // Extract pattern from job ID
        const pattern = jobId.replace(/[0-9]/g, '#').substring(0, 30);
        jobIdPatterns.set(pattern, (jobIdPatterns.get(pattern) || 0) + 1);
      });
      
      console.log('Job ID patterns found:');
      Array.from(jobIdPatterns.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([pattern, count]) => {
          console.log(`  ${pattern}... (${count} occurrences)`);
        });
    }
    
    // Step 5: Get the most recent Apify run details
    console.log('\n📝 STEP 5: Most Recent Run Deep Dive');
    console.log('-'.repeat(40));
    
    if (runs.items.length > 0) {
      const mostRecentRun = runs.items[0];
      const dataset = await apifyClient.dataset(mostRecentRun.defaultDatasetId);
      const { items: recentItems } = await dataset.listItems({ limit: 5 });
      
      console.log(`Analyzing run: ${mostRecentRun.id}`);
      console.log(`Total items: ${recentItems.length} (showing first 5)\n`);
      
      for (let i = 0; i < Math.min(5, recentItems.length); i++) {
        const item = recentItems[i];
        console.log(`Job ${i + 1}:`);
        console.log(`  Company: ${item.companyName}`);
        console.log(`  Title: ${item.title}`);
        console.log(`  Location: ${item.location}`);
        console.log(`  LinkedIn ID: ${item.id || 'NOT PROVIDED'}`);
        
        // Show what job_id would be generated
        const company = (item.companyName || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '');
        const title = (item.title || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '');
        const location = (item.location || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '');
        const generatedId = `linkedin_${item.id || `${company}_${title}_${location}`.substring(0, 50)}`;
        
        console.log(`  Generated ID: ${generatedId}`);
        
        // Check if this job exists in DB
        const { data: existingJob } = await supabase
          .from('job_queue')
          .select('id')
          .eq('payload->>job_id', generatedId)
          .single();
        
        console.log(`  In Database: ${existingJob ? '✅ YES' : '❌ NO'}`);
        console.log('');
      }
    }
    
    // Step 6: Recommendations
    console.log('\n💡 RECOMMENDATIONS');
    console.log('-'.repeat(40));
    console.log('Based on the analysis:\n');
    
    if (discrepancy > 100) {
      console.log('❌ CRITICAL: Large number of jobs missing from database');
      console.log('   Likely causes:');
      console.log('   1. Job ID collision (duplicates being rejected)');
      console.log('   2. Silent failures in save operation');
      console.log('   3. Deduplication too aggressive\n');
    }
    
    console.log('Suggested fixes:');
    console.log('1. Implement better job ID generation (use MD5 hash)');
    console.log('2. Add transaction safety for batch saves');
    console.log('3. Log every duplicate detection with details');
    console.log('4. Create jobs_raw table to save ALL scraped data first');
    
  } catch (error) {
    console.error('\n❌ Error during investigation:', error);
  }
}

// Run the analysis
console.log('🚀 Starting Job Loss Investigation...\n');
analyzeJobLoss().catch(console.error);