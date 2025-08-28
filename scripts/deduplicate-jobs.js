/**
 * Deduplication Service - Phase 2 of the pipeline
 * This identifies duplicates among the ingested jobs
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function deduplicateJobs(runId) {
  console.log('🔍 PHASE 2: DEDUPLICATION SERVICE\n');
  console.log('=' .repeat(60));
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  
  try {
    // Step 1: Get all jobs from this run
    console.log(`📥 Fetching jobs for run ID: ${runId}\n`);
    
    const { data: runJobs, error: fetchError } = await supabase
      .from('job_queue')
      .select('*')
      .eq('payload->>scrape_run_id', runId)
      .order('created_at');
    
    if (fetchError) {
      throw fetchError;
    }
    
    console.log(`✅ Found ${runJobs.length} jobs from this run\n`);
    
    // Step 2: Get ALL existing job IDs from database (before this run)
    console.log('📊 Loading existing job IDs for comparison...');
    
    const { data: existingJobs, error: existingError } = await supabase
      .from('job_queue')
      .select('id, payload')
      .neq('payload->>scrape_run_id', runId)
      .order('created_at');
    
    if (existingError) {
      throw existingError;
    }
    
    console.log(`  Found ${existingJobs.length} existing jobs in database\n`);
    
    // Create a Set of existing job IDs for fast lookup
    const existingJobIds = new Set();
    const companyTitleMap = new Map(); // For fuzzy matching
    
    existingJobs.forEach(job => {
      const jobId = job.payload?.job_id;
      if (jobId) {
        existingJobIds.add(jobId);
      }
      
      // Also track company+title combinations
      const company = (job.payload?.company || '').toLowerCase().trim();
      const title = (job.payload?.job_title || '').toLowerCase().trim();
      if (company && title) {
        const key = `${company}|${title}`;
        if (!companyTitleMap.has(key)) {
          companyTitleMap.set(key, []);
        }
        companyTitleMap.get(key).push(jobId);
      }
    });
    
    // Step 3: Check each job from the run for duplicates
    console.log('🔍 Checking for duplicates...\n');
    
    let newJobsCount = 0;
    let duplicatesCount = 0;
    const duplicateDetails = [];
    const newJobs = [];
    
    for (let i = 0; i < runJobs.length; i++) {
      const job = runJobs[i];
      const jobId = job.payload?.job_id;
      const company = (job.payload?.company || '').toLowerCase().trim();
      const title = (job.payload?.job_title || '').toLowerCase().trim();
      
      let isDuplicate = false;
      let duplicateOf = null;
      let confidence = 0;
      
      // Check 1: Exact job ID match
      if (existingJobIds.has(jobId)) {
        isDuplicate = true;
        duplicateOf = jobId;
        confidence = 100;
      }
      // Check 2: Company + Title match (fuzzy)
      else if (company && title) {
        const key = `${company}|${title}`;
        if (companyTitleMap.has(key)) {
          isDuplicate = true;
          duplicateOf = companyTitleMap.get(key)[0];
          confidence = 85;
        }
      }
      
      if (isDuplicate) {
        duplicatesCount++;
        duplicateDetails.push({
          jobId,
          company: job.payload?.company,
          title: job.payload?.job_title,
          duplicateOf,
          confidence
        });
        
        // Update job to mark as duplicate
        job.payload.is_duplicate = true;
        job.payload.duplicate_of = duplicateOf;
        job.payload.duplicate_confidence = confidence;
        job.payload.deduplicated = true;
        job.payload.ready_for_analysis = false;
      } else {
        newJobsCount++;
        newJobs.push({
          jobId,
          company: job.payload?.company,
          title: job.payload?.job_title
        });
        
        // Update job to mark as new
        job.payload.is_duplicate = false;
        job.payload.deduplicated = true;
        job.payload.ready_for_analysis = true;
      }
      
      // Progress indicator
      if ((i + 1) % 50 === 0 || i === runJobs.length - 1) {
        console.log(`  Progress: ${i + 1}/${runJobs.length} jobs checked`);
      }
    }
    
    // Step 4: Update all jobs in database
    console.log('\n💾 Updating job statuses in database...\n');
    
    // Update in batches
    const batchSize = 50;
    for (let i = 0; i < runJobs.length; i += batchSize) {
      const batch = runJobs.slice(i, i + batchSize);
      
      for (const job of batch) {
        const { error: updateError } = await supabase
          .from('job_queue')
          .update({ payload: job.payload })
          .eq('id', job.id);
        
        if (updateError) {
          console.error(`  ❌ Failed to update job ${job.id}:`, updateError.message);
        }
      }
      
      console.log(`  Updated batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(runJobs.length/batchSize)}`);
    }
    
    // Step 5: Summary
    console.log('\n' + '=' .repeat(60));
    console.log('📊 DEDUPLICATION COMPLETE');
    console.log('=' .repeat(60));
    console.log(`Total jobs processed: ${runJobs.length}`);
    console.log(`New jobs found: ${newJobsCount} (${Math.round((newJobsCount/runJobs.length)*100)}%)`);
    console.log(`Duplicates found: ${duplicatesCount} (${Math.round((duplicatesCount/runJobs.length)*100)}%)`);
    
    if (duplicatesCount > 0 && duplicateDetails.length <= 10) {
      console.log('\nDuplicate examples:');
      duplicateDetails.slice(0, 5).forEach(dup => {
        console.log(`  - ${dup.company} | ${dup.title}`);
        console.log(`    Confidence: ${dup.confidence}%`);
      });
    }
    
    if (newJobsCount > 0) {
      console.log('\nNew job examples:');
      newJobs.slice(0, 5).forEach(job => {
        console.log(`  - ${job.company} | ${job.title}`);
      });
    }
    
    console.log('\n✅ NEXT STEP: Run continuous analysis on the', newJobsCount, 'new jobs');
    console.log(`These jobs are now marked with ready_for_analysis = true`);
    
    return {
      totalProcessed: runJobs.length,
      newJobs: newJobsCount,
      duplicates: duplicatesCount
    };
    
  } catch (error) {
    console.error('❌ Deduplication failed:', error);
    throw error;
  }
}

// Check if run ID was provided
const runId = process.argv[2];

if (!runId) {
  console.log('Usage: node deduplicate-jobs.js <run-id>');
  console.log('\nRecent run IDs you can use:');
  console.log('  722ee08b-96e7-4033-acf3-75f09003eb9c  (476 jobs)');
  console.log('  b8b00541-aaea-44ab-908c-2b7ab9aeebfb  (attempted earlier)');
  process.exit(1);
}

console.log('🚀 Sales Tool Detector - Deduplication Service');
console.log('=' .repeat(60));

deduplicateJobs(runId).catch(console.error);