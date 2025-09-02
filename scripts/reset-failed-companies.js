#!/usr/bin/env node

/**
 * Reset jobs for companies that failed to save due to schema mismatch
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Companies that had upsert errors in the last run
const failedCompanies = [
  'Onity Group Inc.',
  'Salesloft',
  'Buckeye Business Products',
  'XTEL',
  'Chalk', 
  'Array',
  'MetTel',
  'Wander',
  'Sprout',
  'Nimble',
  'Uber',
  'WorkSpan',
  'WaveRez',
  'Conversica',
  'Fullbay',
  'Framework',
  'Clarify Health Solutions',
  'Disguise',
  'Criteria Corp',
  'BlinkOps',
  'Agilesoft',
  'Cayuse',
  'Nintex'
];

async function resetFailedJobs() {
  console.log('🔄 Resetting jobs for companies with schema errors...\n');
  
  let resetCount = 0;
  
  for (const company of failedCompanies) {
    // Reset all jobs for this company to unprocessed
    const { data, error } = await supabase
      .from('raw_jobs')
      .update({ 
        processed: false,
        analyzed_date: null
      })
      .eq('company', company);
      
    if (error) {
      console.error(`❌ Error resetting ${company}:`, error.message);
    } else {
      console.log(`✅ Reset jobs for: ${company}`);
      resetCount++;
    }
  }
  
  // Get count of unprocessed jobs
  const { count } = await supabase
    .from('raw_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('processed', false);
  
  console.log('\n' + '═'.repeat(50));
  console.log(`📊 Reset ${resetCount} companies`);
  console.log(`📋 Total unprocessed jobs now: ${count}`);
  console.log('═'.repeat(50));
  console.log('\n✨ Ready to reprocess with fixed schema!');
}

resetFailedJobs().catch(console.error);