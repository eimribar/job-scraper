#!/usr/bin/env node

/**
 * Remove Irrelevant Jobs from Queue
 * 
 * Marks truly irrelevant jobs as processed to skip them
 * Keeps all sales-related roles for proper GPT-5-mini analysis
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Define what to KEEP (everything else will be trashed)
const KEEP_PATTERNS = [
  // Sales Development
  'sdr', 'sales development',
  
  // Business Development  
  'bdr', 'business development',
  
  // Account Executive
  'account executive', 'ae ',
  
  // Revenue Operations
  'revops', 'revenue operations', 'revenue ops',
  
  // Sales Operations
  'sales operations', 'sales ops',
  
  // Sales Enablement
  'sales enablement',
  
  // Sales Representative
  'sales representative', 'sales rep'
];

// Explicitly TRASH these (even if they contain keep patterns)
const TRASH_TERMS = [
  'CRO',
  'Chief Revenue Officer',
  'Chief Marketing Officer',
  'CMO',
  'Marketing Operations Manager',
  'Marketing Ops',
  'Customer Success',
  'Customer Support',
  'Technical Support'
];

function shouldKeep(searchTerm) {
  if (!searchTerm) return false;
  
  const termLower = searchTerm.toLowerCase();
  
  // Check if it's explicitly in trash list
  if (TRASH_TERMS.some(trash => termLower === trash.toLowerCase())) {
    return false;
  }
  
  // Check if it matches any keep pattern
  return KEEP_PATTERNS.some(pattern => termLower.includes(pattern));
}

async function removeIrrelevantJobs() {
  console.log('========================================');
  console.log('REMOVING IRRELEVANT JOBS FROM QUEUE');
  console.log('========================================\n');

  try {
    // Get all unprocessed jobs
    const { data: jobs, error } = await supabase
      .from('raw_jobs')
      .select('job_id, search_term')
      .eq('processed', false);

    if (error) {
      console.error('Error fetching unprocessed jobs:', error);
      return;
    }

    console.log(`📊 Total unprocessed jobs: ${jobs.length}\n`);

    // Categorize jobs
    const keepJobs = [];
    const trashJobs = [];
    const termStats = {};

    jobs.forEach(job => {
      const term = job.search_term || 'Unknown';
      
      if (!termStats[term]) {
        termStats[term] = { keep: 0, trash: 0 };
      }

      if (shouldKeep(term)) {
        keepJobs.push(job.job_id);
        termStats[term].keep++;
      } else {
        trashJobs.push(job.job_id);
        termStats[term].trash++;
      }
    });

    // Display breakdown
    console.log('JOBS TO KEEP (will be analyzed by GPT-5-mini):');
    console.log('------------------------------------------------');
    Object.entries(termStats)
      .filter(([_, stats]) => stats.keep > 0)
      .sort((a, b) => b[1].keep - a[1].keep)
      .forEach(([term, stats]) => {
        console.log(`  ✅ ${term}: ${stats.keep} jobs`);
      });
    
    console.log('\nJOBS TO TRASH (mark as processed to skip):');
    console.log('------------------------------------------------');
    Object.entries(termStats)
      .filter(([_, stats]) => stats.trash > 0)
      .sort((a, b) => b[1].trash - a[1].trash)
      .forEach(([term, stats]) => {
        console.log(`  ❌ ${term}: ${stats.trash} jobs`);
      });

    console.log('\n========================================');
    console.log(`📊 SUMMARY:`);
    console.log(`  Jobs to KEEP: ${keepJobs.length}`);
    console.log(`  Jobs to TRASH: ${trashJobs.length}`);
    console.log('========================================\n');

    if (trashJobs.length === 0) {
      console.log('✅ No irrelevant jobs to remove. Queue is clean!');
      return;
    }

    // Ask for confirmation
    console.log(`⚠️  This will mark ${trashJobs.length} irrelevant jobs as processed (to skip them).`);
    console.log('Press ENTER to continue (Ctrl+C to cancel)...');
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });

    console.log('\n🗑️  Removing irrelevant jobs from queue...');

    // Mark trash jobs as processed in batches
    const batchSize = 100;
    let trashedCount = 0;

    for (let i = 0; i < trashJobs.length; i += batchSize) {
      const batch = trashJobs.slice(i, i + batchSize);

      const { error: updateError } = await supabase
        .from('raw_jobs')
        .update({ 
          processed: true,
          analyzed_date: new Date().toISOString()
        })
        .in('job_id', batch);

      if (updateError) {
        console.error(`Error trashing batch ${Math.floor(i/batchSize) + 1}:`, updateError);
      } else {
        trashedCount += batch.length;
        console.log(`✅ Trashed batch ${Math.floor(i/batchSize) + 1}: ${batch.length} jobs (${trashedCount}/${trashJobs.length})`);
      }
    }

    // Final verification
    const { count: finalUnprocessed, error: verifyError } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('processed', false);

    if (!verifyError) {
      console.log('\n========================================');
      console.log('✅ CLEANUP COMPLETE');
      console.log('========================================');
      console.log(`📊 Jobs removed from queue: ${trashedCount}`);
      console.log(`📊 Jobs remaining for GPT-5-mini: ${finalUnprocessed}`);
      console.log('\nThe queue now contains ONLY relevant sales-related jobs:');
      console.log('- Sales Development (SDR)');
      console.log('- Business Development (BDR)');
      console.log('- Account Executive');
      console.log('- Revenue Operations');
      console.log('- Sales Operations');
      console.log('- Sales Enablement');
      console.log('- Sales Representative');
      console.log('\nRun scripts/monitor-gpt5.js to monitor processing.');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

// Run the cleanup
console.log('Starting cleanup of irrelevant jobs...\n');
removeIrrelevantJobs();