/**
 * Add truly NEW detected companies to the companies table
 * Only adds companies that don't already exist
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function addNewDetectedCompanies() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  
  console.log('🆕 ADDING NEW DETECTED COMPANIES\n');
  console.log('=' .repeat(60));
  
  // Get all analyzed jobs
  const { data: analyzedJobs } = await supabase
    .from('job_queue')
    .select('*')
    .eq('payload->>analyzed', true);
  
  console.log(`Total analyzed jobs: ${analyzedJobs?.length || 0}\n`);
  
  // Get existing company names
  const { data: existingCompanies } = await supabase
    .from('companies')
    .select('name');
  
  const existingNames = new Set(existingCompanies?.map(c => c.name.toLowerCase()) || []);
  console.log(`Existing companies in database: ${existingNames.size}\n`);
  
  // Find NEW companies with tool detection
  const newCompaniesToAdd = new Map();
  
  analyzedJobs?.forEach(job => {
    const analysis = job.payload?.analysis_result;
    const companyName = job.payload?.company;
    
    if (!companyName || !analysis?.uses_tool) return;
    
    // Skip if company already exists
    if (existingNames.has(companyName.toLowerCase())) return;
    
    // Skip if tool is "None" or undefined
    if (!analysis.tool_detected || analysis.tool_detected === 'None') return;
    
    // This is a NEW company with tool detection!
    if (!newCompaniesToAdd.has(companyName)) {
      newCompaniesToAdd.set(companyName, {
        name: companyName,
        uses_outreach: analysis.tool_detected === 'Outreach.io' || analysis.tool_detected === 'Both',
        uses_salesloft: analysis.tool_detected === 'SalesLoft' || analysis.tool_detected === 'Both',
        uses_both: analysis.tool_detected === 'Both',
        detection_confidence: analysis.confidence,
        context: analysis.context || '',
        signal_type: analysis.signal_type || 'explicit_mention',
        job_title: job.payload?.job_title || '',
        platform: 'LinkedIn',
        identified_date: new Date().toISOString()
      });
    }
  });
  
  console.log(`Found ${newCompaniesToAdd.size} NEW companies to add\n`);
  
  if (newCompaniesToAdd.size === 0) {
    console.log('❌ No new companies with tool detection found.');
    console.log('\nThis means:');
    console.log('1. All detected companies were already in your database');
    console.log('2. Or the new companies detected "None" as tool');
    console.log('\nNeed to analyze more jobs to find new companies!');
    return;
  }
  
  // Add new companies to database
  let added = 0;
  let failed = 0;
  
  for (const [companyName, companyData] of newCompaniesToAdd) {
    console.log(`Adding: ${companyName}`);
    console.log(`  Tool: ${companyData.uses_outreach ? 'Outreach' : ''}${companyData.uses_salesloft ? ' SalesLoft' : ''}`);
    console.log(`  Confidence: ${companyData.detection_confidence}`);
    
    const { error } = await supabase
      .from('companies')
      .insert(companyData);
    
    if (error) {
      console.log(`  ❌ Error: ${error.message}`);
      failed++;
    } else {
      console.log(`  ✅ Added successfully`);
      added++;
    }
    console.log();
  }
  
  // Summary
  console.log('=' .repeat(60));
  console.log('📊 SUMMARY\n');
  console.log(`New companies added: ${added}`);
  console.log(`Failed: ${failed}`);
  
  if (added > 0) {
    // Get new total
    const { count } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true });
    
    console.log(`\nTotal companies now: ${count}`);
    console.log('\n🎉 NEW companies are now in your dashboard!');
  }
}

addNewDetectedCompanies().catch(console.error);