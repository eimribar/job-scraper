/**
 * Check what NEW companies were detected from today's analysis
 * Not the ones that were already in the database
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkNewDetections() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  
  console.log('🔍 CHECKING FOR TRULY NEW COMPANY DETECTIONS\n');
  console.log('=' .repeat(60));
  
  // Get all analyzed jobs from today's run
  const { data: analyzedJobs } = await supabase
    .from('job_queue')
    .select('*')
    .eq('payload->>scrape_run_id', '722ee08b-96e7-4033-acf3-75f09003eb9c')
    .eq('payload->>analyzed', true);
  
  console.log(`Analyzed jobs from today's run: ${analyzedJobs?.length || 0}\n`);
  
  // Get unique companies with tool detection from today's analysis
  const todaysDetections = new Map();
  
  analyzedJobs?.forEach(job => {
    const analysis = job.payload?.analysis_result;
    const company = job.payload?.company;
    
    if (analysis?.uses_tool && analysis.tool_detected !== 'None') {
      if (!todaysDetections.has(company)) {
        todaysDetections.set(company, {
          tool: analysis.tool_detected,
          confidence: analysis.confidence,
          context: analysis.context
        });
      }
    }
  });
  
  console.log(`Companies detected with tools today: ${todaysDetections.size}`);
  console.log('\nCompanies detected:');
  for (const [company, data] of todaysDetections) {
    console.log(`  - ${company}: ${data.tool} (${data.confidence})`);
  }
  
  // Now check which of these were already in the database BEFORE today
  console.log('\n' + '-'.repeat(60));
  console.log('Checking which were already in database...\n');
  
  // Get companies that existed before today
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  const { data: oldCompanies } = await supabase
    .from('companies')
    .select('name, created_at, uses_outreach, uses_salesloft')
    .lt('created_at', yesterday.toISOString());
  
  const oldCompanyNames = new Set(oldCompanies?.map(c => c.name) || []);
  
  console.log(`Companies that existed before today: ${oldCompanyNames.size}`);
  
  // Find truly NEW detections
  const newDetections = [];
  const alreadyExisted = [];
  
  for (const [company, data] of todaysDetections) {
    if (oldCompanyNames.has(company)) {
      alreadyExisted.push(company);
    } else {
      newDetections.push({ company, ...data });
    }
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('📊 RESULTS:\n');
  
  if (alreadyExisted.length > 0) {
    console.log(`⚠️  Already existed in database (not new):`)
    alreadyExisted.forEach(c => console.log(`  - ${c}`));
  }
  
  if (newDetections.length > 0) {
    console.log(`\n✅ TRULY NEW COMPANIES DETECTED TODAY:`);
    newDetections.forEach(d => {
      console.log(`  - ${d.company}: ${d.tool} (${d.confidence})`);
      console.log(`    Context: "${d.context?.substring(0, 80)}..."`);
    });
  } else {
    console.log('\n❌ NO NEW COMPANIES DETECTED!');
    console.log('All detected companies were already in the database.');
  }
  
  // Check if these new ones are in companies table now
  if (newDetections.length > 0) {
    console.log('\n' + '-'.repeat(60));
    console.log('Checking if new detections are saved to companies table...\n');
    
    for (const detection of newDetections) {
      const { data: inTable } = await supabase
        .from('companies')
        .select('name')
        .eq('name', detection.company)
        .single();
      
      if (inTable) {
        console.log(`  ✅ ${detection.company} is now in companies table`);
      } else {
        console.log(`  ❌ ${detection.company} NOT in companies table yet`);
      }
    }
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('CONCLUSION:');
  console.log(`- Analyzed ${analyzedJobs?.length} jobs from today's scraping`);
  console.log(`- Found ${todaysDetections.size} companies using tools`);
  console.log(`- ${alreadyExisted.length} were already in database (like Foley)`);
  console.log(`- ${newDetections.length} are TRULY NEW detections`);
  
  if (newDetections.length === 0) {
    console.log('\n⚠️  The analysis is detecting tools, but only in companies');
    console.log('that were already imported from your Google Sheets!');
    console.log('\nTo find NEW companies, we need to:');
    console.log('1. Continue analyzing all 476 jobs');
    console.log('2. Sync any truly new companies to the companies table');
  }
}

checkNewDetections().catch(console.error);