/**
 * CLEANUP DATABASE - Remove unnecessary tables
 * Keep only: job_queue, companies, search_terms
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function cleanupDatabase() {
  console.log('🧹 DATABASE CLEANUP - REMOVING UNNECESSARY TABLES\n');
  console.log('=' .repeat(60));
  
  // Tables to DELETE
  const tablesToDelete = [
    'raw_jobs',           // Duplicate of job_queue
    'processed_jobs',     // Old data, not used
    'processing_runs',    // Empty, not needed
    'analysis_cache',     // Empty, not used
    'companies_enriched', // Empty, redundant
    'company_duplicates', // Empty, not needed
    'daily_metrics',      // Can be calculated
    'high_value_companies', // Can be filtered
    'import_history'      // One-time use
  ];
  
  // Tables to KEEP
  const tablesToKeep = [
    'job_queue',     // Main job storage
    'companies',     // Dashboard data
    'search_terms',  // Search configuration
    'audit_log',     // Keep for debugging
    'metrics'        // Keep for stats
  ];
  
  console.log('TABLES TO DELETE:');
  tablesToDelete.forEach(t => console.log(`  ❌ ${t}`));
  
  console.log('\nTABLES TO KEEP:');
  tablesToKeep.forEach(t => console.log(`  ✅ ${t}`));
  
  console.log('\n' + '-'.repeat(60));
  console.log('⚠️  WARNING: This will permanently delete tables!');
  console.log('Starting deletion in 3 seconds... (Ctrl+C to cancel)\n');
  
  await new Promise(r => setTimeout(r, 3000));
  
  // Since we can't drop tables via JS client, create SQL statements
  console.log('Since Supabase JS client cannot drop tables directly,');
  console.log('please run these SQL commands in Supabase SQL Editor:\n');
  
  console.log('-- CLEANUP UNNECESSARY TABLES');
  console.log('-- Run this in Supabase SQL Editor');
  console.log('-'.repeat(40));
  
  tablesToDelete.forEach(table => {
    console.log(`DROP TABLE IF EXISTS ${table} CASCADE;`);
  });
  
  console.log('\n-- Verify remaining tables');
  console.log(`SELECT tablename FROM pg_tables WHERE schemaname = 'public';`);
  
  console.log('\n' + '=' .repeat(60));
  console.log('NEXT STEPS:');
  console.log('1. Go to Supabase Dashboard > SQL Editor');
  console.log('2. Copy and run the DROP commands above');
  console.log('3. Run the processing script to analyze 595 pending jobs');
  
  // Check current status
  const { count: jobCount } = await supabase
    .from('job_queue')
    .select('*', { count: 'exact', head: true });
    
  const { data: pendingJobs } = await supabase
    .from('job_queue')
    .select('payload')
    .neq('status', 'completed')
    .limit(1000);
    
  let pendingAnalysis = 0;
  pendingJobs?.forEach(job => {
    if (!job.payload?.analyzed) {
      pendingAnalysis++;
    }
  });
  
  console.log('\n📊 CURRENT STATUS:');
  console.log(`  Total jobs: ${jobCount}`);
  console.log(`  Pending analysis: ${pendingAnalysis}`);
  console.log(`  Expected new companies: ~${Math.round(pendingAnalysis * 0.85 * 0.3)}`);
}

cleanupDatabase().catch(console.error);