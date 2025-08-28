/**
 * Check analyzed jobs and their results
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkAnalyzedJobs() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  
  console.log('🔍 CHECKING ANALYZED JOBS\n');
  console.log('=' .repeat(60));
  
  // Get jobs that have been analyzed
  const { data: analyzedJobs, error } = await supabase
    .from('job_queue')
    .select('*')
    .eq('payload->>analyzed', true)
    .limit(20);
  
  if (error) {
    console.error('Error fetching analyzed jobs:', error);
    return;
  }
  
  console.log(`Found ${analyzedJobs?.length || 0} analyzed jobs\n`);
  
  if (!analyzedJobs || analyzedJobs.length === 0) {
    console.log('No analyzed jobs found yet.');
    return;
  }
  
  // Count tools detected
  let toolsDetected = 0;
  const companiesWithTools = [];
  
  analyzedJobs.forEach(job => {
    const analysis = job.payload?.analysis_result;
    if (analysis?.uses_tool) {
      toolsDetected++;
      companiesWithTools.push({
        company: job.payload.company,
        title: job.payload.job_title,
        tool: analysis.tool_detected,
        confidence: analysis.confidence,
        context: analysis.context
      });
    }
  });
  
  console.log(`📊 ANALYSIS RESULTS:`);
  console.log(`  Total analyzed: ${analyzedJobs.length}`);
  console.log(`  Tools detected: ${toolsDetected}`);
  console.log(`  Detection rate: ${Math.round((toolsDetected/analyzedJobs.length)*100)}%\n`);
  
  if (companiesWithTools.length > 0) {
    console.log('🎯 COMPANIES USING SALES TOOLS:\n');
    companiesWithTools.forEach((company, idx) => {
      console.log(`${idx + 1}. ${company.company}`);
      console.log(`   Job: ${company.title}`);
      console.log(`   Tool: ${company.tool} (${company.confidence} confidence)`);
      console.log(`   Context: "${company.context?.substring(0, 100)}..."`);
      console.log();
    });
  }
  
  // Check if these are in the companies table
  console.log('=' .repeat(60));
  console.log('CHECKING IF SAVED TO COMPANIES TABLE...\n');
  
  for (const company of companiesWithTools.slice(0, 3)) {
    const { data: existingCompany } = await supabase
      .from('companies')
      .select('*')
      .ilike('name', `%${company.company}%`)
      .single();
    
    if (existingCompany) {
      console.log(`✅ ${company.company} exists in companies table`);
      console.log(`   Uses Outreach: ${existingCompany.uses_outreach}`);
      console.log(`   Uses SalesLoft: ${existingCompany.uses_salesloft}`);
    } else {
      console.log(`❌ ${company.company} NOT in companies table`);
    }
  }
  
  console.log('\n⚠️  NOTE: The detected companies are stored in job_queue');
  console.log('but NOT being added to the companies table for dashboard display.');
  console.log('We need to sync them to the companies table!');
}

checkAnalyzedJobs().catch(console.error);