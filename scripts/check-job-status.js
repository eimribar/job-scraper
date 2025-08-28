/**
 * Check the status of jobs in the database
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkJobStatus() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  
  console.log('📊 JOB STATUS CHECK\n');
  console.log('=' .repeat(60));
  
  // Get total jobs
  const { count: totalJobs } = await supabase
    .from('job_queue')
    .select('*', { count: 'exact', head: true });
  
  console.log(`Total jobs in database: ${totalJobs}\n`);
  
  // Get recent jobs with their payload structure
  const { data: sampleJobs } = await supabase
    .from('job_queue')
    .select('*')
    .eq('payload->>scrape_run_id', '722ee08b-96e7-4033-acf3-75f09003eb9c')
    .limit(5);
  
  console.log('Sample job structure:');
  if (sampleJobs && sampleJobs.length > 0) {
    const job = sampleJobs[0];
    console.log('Job ID:', job.id);
    console.log('Status:', job.status);
    console.log('Job Type:', job.job_type);
    console.log('\nPayload fields:');
    console.log('  - job_id:', job.payload?.job_id);
    console.log('  - company:', job.payload?.company);
    console.log('  - ready_for_analysis:', job.payload?.ready_for_analysis);
    console.log('  - deduplicated:', job.payload?.deduplicated);
    console.log('  - analyzed:', job.payload?.analyzed);
    console.log('  - is_duplicate:', job.payload?.is_duplicate);
  }
  
  // Count jobs by ready_for_analysis status
  console.log('\n' + '-'.repeat(60));
  console.log('Checking ready_for_analysis field...\n');
  
  // Try different query approaches
  const { data: readyJobs1, count: count1 } = await supabase
    .from('job_queue')
    .select('*', { count: 'exact' })
    .eq('payload->>ready_for_analysis', 'true')
    .limit(1);
  
  console.log(`Jobs with ready_for_analysis = "true" (string): ${count1 || 0}`);
  
  const { data: readyJobs2, count: count2 } = await supabase
    .from('job_queue')
    .select('*', { count: 'exact' })
    .eq('payload->>ready_for_analysis', true)
    .limit(1);
  
  console.log(`Jobs with ready_for_analysis = true (boolean): ${count2 || 0}`);
  
  // Check how many have the field at all
  const { data: allWithField } = await supabase
    .from('job_queue')
    .select('payload')
    .eq('payload->>scrape_run_id', '722ee08b-96e7-4033-acf3-75f09003eb9c')
    .limit(100);
  
  let readyCount = 0;
  let notReadyCount = 0;
  let missingFieldCount = 0;
  
  if (allWithField) {
    allWithField.forEach(job => {
      if (job.payload?.ready_for_analysis === true) {
        readyCount++;
      } else if (job.payload?.ready_for_analysis === false) {
        notReadyCount++;
      } else if (!('ready_for_analysis' in (job.payload || {}))) {
        missingFieldCount++;
      }
    });
  }
  
  console.log(`\nDirect payload check (first 100 jobs):`)
  console.log(`  - ready_for_analysis = true: ${readyCount}`);
  console.log(`  - ready_for_analysis = false: ${notReadyCount}`);
  console.log(`  - field missing: ${missingFieldCount}`);
  
  // Get counts for analyzed field
  console.log('\n' + '-'.repeat(60));
  console.log('Analysis status:\n');
  
  const { data: analyzedCheck } = await supabase
    .from('job_queue')
    .select('payload')
    .eq('payload->>scrape_run_id', '722ee08b-96e7-4033-acf3-75f09003eb9c');
  
  let analyzedCount = 0;
  let notAnalyzedCount = 0;
  
  if (analyzedCheck) {
    analyzedCheck.forEach(job => {
      if (job.payload?.analyzed === true) {
        analyzedCount++;
      } else {
        notAnalyzedCount++;
      }
    });
  }
  
  console.log(`Jobs analyzed: ${analyzedCount}`);
  console.log(`Jobs not analyzed: ${notAnalyzedCount}`);
  
  console.log('\n' + '=' .repeat(60));
  console.log('RECOMMENDATION:');
  console.log('The ready_for_analysis field appears to be', readyCount > 0 ? 'SET' : 'NOT SET');
  console.log('We need to update the deduplication script to properly set this field.');
}

checkJobStatus().catch(console.error);