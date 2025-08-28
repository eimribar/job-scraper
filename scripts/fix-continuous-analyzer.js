#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function createMasterNeverAnalyzeList() {
  console.log('🛡️ CREATING MASTER "NEVER ANALYZE" LIST');
  console.log('='.repeat(60));
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // 1. Load CSV companies
  const csvData = JSON.parse(fs.readFileSync('/tmp/csv-companies-clean.json', 'utf-8'));
  const neverAnalyze = new Set(csvData.nameOnly.map(c => c.toLowerCase().trim()));
  
  console.log(`\n📋 Added ${neverAnalyze.size} companies from CSV to never-analyze list`);
  
  // 2. Add ALL companies already in database
  const { data: existingCompanies, error } = await supabase
    .from('identified_companies')
    .select('company_name');
  
  if (error) {
    console.error('Error fetching companies:', error);
    return;
  }
  
  let addedFromDB = 0;
  existingCompanies.forEach(company => {
    const normalized = company.company_name.toLowerCase().trim();
    if (!neverAnalyze.has(normalized)) {
      neverAnalyze.add(normalized);
      addedFromDB++;
    }
  });
  
  console.log(`📊 Added ${addedFromDB} additional companies from database`);
  console.log(`\n✅ TOTAL NEVER-ANALYZE LIST: ${neverAnalyze.size} companies`);
  
  // Save the list
  const listArray = Array.from(neverAnalyze).sort();
  const outputPath = '/Users/eimribar/sales-tool-detector/never-analyze-companies.json';
  fs.writeFileSync(outputPath, JSON.stringify({
    companies: listArray,
    count: listArray.length,
    lastUpdated: new Date().toISOString(),
    sources: {
      csv: csvData.nameOnly.length,
      database: addedFromDB
    }
  }, null, 2));
  
  console.log(`\n📁 Master list saved to: ${outputPath}`);
  
  // Test with known problematic companies
  console.log('\n🔍 Testing deduplication:');
  const testCompanies = ['Okta', 'Vanta', 'Moloco', 'Redis', 'Synthesia', 'RandomNewCompany123'];
  
  testCompanies.forEach(test => {
    const shouldSkip = neverAnalyze.has(test.toLowerCase().trim());
    console.log(`   ${test}: ${shouldSkip ? '✅ WILL SKIP' : '❌ Will analyze'}`);
  });
  
  return neverAnalyze;
}

createMasterNeverAnalyzeList().catch(console.error);