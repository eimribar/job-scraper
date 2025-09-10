#!/usr/bin/env node

/**
 * Reset Falsely Processed Jobs
 * 
 * This script resets jobs that were marked as processed but not actually analyzed by GPT-5
 * due to API credit issues. It preserves CRO search term jobs as requested.
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function resetFalselyProcessedJobs() {
  console.log('========================================');
  console.log('RESETTING FALSELY PROCESSED JOBS');
  console.log('========================================\n');

  try {
    // First, get count of jobs to reset
    const today = new Date().toISOString().split('T')[0];
    
    // Count jobs processed today
    const { count: totalProcessedToday, error: countError } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('processed', true)
      .gte('analyzed_date', `${today}T00:00:00`)
      .lte('analyzed_date', `${today}T23:59:59`);

    if (countError) {
      console.error('Error counting processed jobs:', countError);
      return;
    }

    console.log(`📊 Jobs marked as processed today: ${totalProcessedToday}`);

    // Count CRO jobs to preserve
    const { count: croJobs, error: croError } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('processed', true)
      .eq('search_term', 'CRO')
      .gte('analyzed_date', `${today}T00:00:00`)
      .lte('analyzed_date', `${today}T23:59:59`);

    if (croError) {
      console.error('Error counting CRO jobs:', croError);
      return;
    }

    console.log(`🛡️  CRO jobs to preserve: ${croJobs}`);
    console.log(`🔄 Jobs to reset: ${totalProcessedToday - croJobs}\n`);

    // Check if any companies were actually detected today
    const { count: companiesDetectedToday, error: compError } = await supabase
      .from('identified_companies')
      .select('*', { count: 'exact', head: true })
      .gte('identified_date', `${today}T00:00:00`)
      .lte('identified_date', `${today}T23:59:59`);

    if (!compError) {
      console.log(`⚠️  Companies detected today: ${companiesDetectedToday}`);
      if (companiesDetectedToday === 0) {
        console.log('❌ WARNING: No companies detected despite processing jobs!');
        console.log('   This confirms GPT-5 was not actually analyzing jobs.\n');
      }
    }

    // Ask for confirmation
    console.log('Press ENTER to reset these jobs (Ctrl+C to cancel)...');
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });

    // Reset jobs (excluding CRO)
    console.log('\n🔄 Resetting jobs...');
    
    // Get all job IDs to reset
    const { data: jobsToReset, error: fetchError } = await supabase
      .from('raw_jobs')
      .select('job_id, search_term, company, job_title')
      .eq('processed', true)
      .gte('analyzed_date', `${today}T00:00:00`)
      .lte('analyzed_date', `${today}T23:59:59`)
      .neq('search_term', 'CRO');

    if (fetchError) {
      console.error('Error fetching jobs to reset:', fetchError);
      return;
    }

    // Reset in batches of 100
    const batchSize = 100;
    let resetCount = 0;

    for (let i = 0; i < jobsToReset.length; i += batchSize) {
      const batch = jobsToReset.slice(i, i + batchSize);
      const jobIds = batch.map(j => j.job_id);

      const { error: updateError } = await supabase
        .from('raw_jobs')
        .update({ 
          processed: false,
          analyzed_date: null 
        })
        .in('job_id', jobIds);

      if (updateError) {
        console.error(`Error resetting batch ${i/batchSize + 1}:`, updateError);
      } else {
        resetCount += batch.length;
        console.log(`✅ Reset batch ${i/batchSize + 1}: ${batch.length} jobs (${resetCount}/${jobsToReset.length})`);
      }
    }

    // Also remove from processed_jobs table
    console.log('\n🧹 Cleaning processed_jobs tracking table...');
    const jobIdsToClean = jobsToReset.map(j => j.job_id);
    
    for (let i = 0; i < jobIdsToClean.length; i += batchSize) {
      const batch = jobIdsToClean.slice(i, i + batchSize);
      
      const { error: deleteError } = await supabase
        .from('processed_jobs')
        .delete()
        .in('job_id', batch);

      if (deleteError) {
        console.error(`Error cleaning batch ${i/batchSize + 1}:`, deleteError);
      }
    }

    // Final verification
    const { count: remainingProcessed, error: verifyError } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('processed', true)
      .gte('analyzed_date', `${today}T00:00:00`)
      .lte('analyzed_date', `${today}T23:59:59`);

    if (!verifyError) {
      console.log('\n========================================');
      console.log('✅ RESET COMPLETE');
      console.log('========================================');
      console.log(`📊 Jobs still marked as processed today: ${remainingProcessed} (should be CRO jobs)`);
      console.log(`🔄 Jobs reset and ready for reprocessing: ${resetCount}`);
      console.log('\nNext steps:');
      console.log('1. Fix GPT-5 configuration');
      console.log('2. Test with single job');
      console.log('3. Process jobs one at a time');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

// Run the reset
console.log('Starting reset process...\n');
resetFalselyProcessedJobs();