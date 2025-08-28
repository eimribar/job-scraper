#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createApiSupabaseClient } = require('../lib/supabase');

async function findDuplicateJobs() {
  const supabase = createApiSupabaseClient();
  
  console.log('🔍 Finding unprocessed jobs from already-identified companies...\n');
  
  // Get some identified companies
  const { data: identifiedCompanies } = await supabase
    .from('identified_companies')
    .select('company_name')
    .limit(20);
  
  const companyNames = identifiedCompanies.map(c => c.company_name);
  
  // Check for unprocessed jobs from these companies
  const { data: unprocessedJobs } = await supabase
    .from('raw_jobs')
    .select('company, job_title, job_id')
    .in('company', companyNames)
    .eq('processed', false)
    .limit(10);
  
  if (unprocessedJobs && unprocessedJobs.length > 0) {
    console.log('⚠️ FOUND UNPROCESSED JOBS FROM KNOWN COMPANIES:');
    console.log('These will be SKIPPED by the analyzer:\n');
    
    unprocessedJobs.forEach(job => {
      console.log(`🚫 ${job.company}`);
      console.log(`   Job: ${job.job_title}`);
      console.log(`   ID: ${job.job_id}`);
      console.log(`   Status: WILL BE SKIPPED (company already identified)\n`);
    });
    
    console.log(`\n✅ PROOF: ${unprocessedJobs.length} jobs will be skipped!`);
  } else {
    console.log('No duplicate jobs found in current batch.');
  }
}

findDuplicateJobs().catch(console.error);