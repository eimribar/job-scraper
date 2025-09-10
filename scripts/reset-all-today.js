#!/usr/bin/env node

/**
 * Reset ALL Jobs Processed Today
 * 
 * This script resets ALL jobs marked as processed today back to unprocessed state
 * because they weren't actually analyzed properly due to API credit issues.
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function resetAllJobsToday() {
  console.log('========================================');
  console.log('RESETTING ALL JOBS PROCESSED TODAY');
  console.log('========================================\n');

  try {
    const today = new Date().toISOString().split('T')[0];
    
    // First, get count of ALL jobs marked as processed today
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
    
    // Get current unprocessed count
    const { count: currentUnprocessed, error: unprocessedError } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('processed', false);

    console.log(`📊 Current unprocessed jobs: ${currentUnprocessed}`);
    console.log(`📊 After reset will have: ${(currentUnprocessed || 0) + (totalProcessedToday || 0)} unprocessed jobs\n`);

    // Get breakdown by search term for visibility
    const { data: jobsByTerm, error: termError } = await supabase
      .from('raw_jobs')
      .select('search_term')
      .eq('processed', true)
      .gte('analyzed_date', `${today}T00:00:00`)
      .lte('analyzed_date', `${today}T23:59:59`);

    if (!termError && jobsByTerm) {
      const termCounts = {};
      jobsByTerm.forEach(job => {
        const term = job.search_term || 'Unknown';
        termCounts[term] = (termCounts[term] || 0) + 1;
      });

      console.log('Jobs to reset by search term:');
      console.log('------------------------------');
      Object.entries(termCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([term, count]) => {
          console.log(`  ${term}: ${count} jobs`);
        });
      console.log('');
    }

    // Ask for confirmation
    console.log(`⚠️  This will reset ${totalProcessedToday} jobs back to unprocessed state.`);
    console.log('Press ENTER to continue (Ctrl+C to cancel)...');
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });

    console.log('\n🔄 Resetting all jobs processed today...');
    
    // Get all job IDs to reset
    const { data: jobsToReset, error: fetchError } = await supabase
      .from('raw_jobs')
      .select('job_id')
      .eq('processed', true)
      .gte('analyzed_date', `${today}T00:00:00`)
      .lte('analyzed_date', `${today}T23:59:59`);

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
        console.error(`Error resetting batch ${Math.floor(i/batchSize) + 1}:`, updateError);
      } else {
        resetCount += batch.length;
        console.log(`✅ Reset batch ${Math.floor(i/batchSize) + 1}: ${batch.length} jobs (${resetCount}/${jobsToReset.length})`);
      }
    }

    // Clean up processed_jobs tracking table
    console.log('\n🧹 Cleaning processed_jobs tracking table...');
    const { error: deleteError } = await supabase
      .from('processed_jobs')
      .delete()
      .gte('analyzed_date', `${today}T00:00:00`)
      .lte('analyzed_date', `${today}T23:59:59`);

    if (deleteError) {
      console.error('Error cleaning processed_jobs table:', deleteError);
    } else {
      console.log('✅ Cleaned processed_jobs table');
    }

    // Final verification
    const { count: finalUnprocessed, error: verifyError } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('processed', false);

    const { count: remainingProcessedToday, error: remainError } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('processed', true)
      .gte('analyzed_date', `${today}T00:00:00`)
      .lte('analyzed_date', `${today}T23:59:59`);

    if (!verifyError) {
      console.log('\n========================================');
      console.log('✅ RESET COMPLETE');
      console.log('========================================');
      console.log(`📊 Jobs reset: ${resetCount}`);
      console.log(`📊 Total unprocessed jobs now: ${finalUnprocessed}`);
      console.log(`📊 Jobs still marked as processed today: ${remainingProcessedToday || 0} (should be 0)`);
      console.log('\nNext steps:');
      console.log('1. Run scripts/remove-irrelevant.js to filter out non-relevant jobs');
      console.log('2. Monitor processing with scripts/monitor-gpt5.js');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

// Run the reset
console.log('Starting reset of ALL jobs processed today...\n');
resetAllJobsToday();