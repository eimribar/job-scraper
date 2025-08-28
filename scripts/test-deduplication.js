#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createApiSupabaseClient } = require('../lib/supabase');

async function testDeduplication() {
  console.log('🧪 DEDUPLICATION STRESS TEST');
  console.log('='.repeat(60));
  
  const supabase = createApiSupabaseClient();
  
  // 1. Get count of identified companies
  const { count: identifiedCount } = await supabase
    .from('identified_companies')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n📊 Current Status:`);
  console.log(`   Identified Companies: ${identifiedCount}`);
  
  // 2. Get some known companies
  const { data: knownCompanies } = await supabase
    .from('identified_companies')
    .select('company_name')
    .limit(10);
  
  console.log(`\n🏢 Sample Known Companies:`);
  knownCompanies?.forEach(c => console.log(`   - ${c.company_name}`));
  
  // 3. Check unprocessed jobs for these companies
  console.log(`\n🔍 Checking for duplicate jobs from known companies...`);
  
  for (const company of knownCompanies || []) {
    const { count } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('company', company.company_name)
      .eq('processed', false);
    
    if (count > 0) {
      console.log(`   ⚠️ ${company.company_name}: ${count} unprocessed jobs (WILL BE SKIPPED)`);
    }
  }
  
  // 4. Get overall stats
  const { count: totalUnprocessed } = await supabase
    .from('raw_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('processed', false);
  
  // 5. Get unique companies in unprocessed jobs
  const { data: unprocessedJobs } = await supabase
    .from('raw_jobs')
    .select('company')
    .eq('processed', false)
    .limit(1000);
  
  const uniqueCompanies = new Set(unprocessedJobs?.map(j => j.company) || []);
  
  // Count how many are already identified
  let willBeSkipped = 0;
  for (const company of uniqueCompanies) {
    const { count } = await supabase
      .from('identified_companies')
      .select('*', { count: 'exact', head: true })
      .eq('company_name', company);
    
    if (count > 0) willBeSkipped++;
  }
  
  console.log(`\n📈 Deduplication Impact Analysis:`);
  console.log(`   Total Unprocessed Jobs: ${totalUnprocessed}`);
  console.log(`   Unique Companies to Check: ${uniqueCompanies.size}`);
  console.log(`   Companies Already Identified: ${willBeSkipped}`);
  console.log(`   API Calls to be Saved: ${willBeSkipped}`);
  console.log(`   Savings: $${(willBeSkipped * 0.0001).toFixed(2)} (estimated)`);
  
  console.log(`\n✅ Deduplication system will skip ${willBeSkipped} companies!`);
}

testDeduplication().catch(console.error);