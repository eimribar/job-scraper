#!/usr/bin/env node

/**
 * Updates the master never-analyze list with all companies that should never be analyzed again
 * This should run periodically to ensure new discoveries are added to the list
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const { parse } = require('csv-parse/sync');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function updateNeverAnalyzeList() {
  console.log('🔄 UPDATING NEVER-ANALYZE LIST');
  console.log('='.repeat(60));
  console.log(`Time: ${new Date().toISOString()}\n`);
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  const neverAnalyze = new Set();
  let stats = {
    fromCSV: 0,
    fromDatabase: 0,
    total: 0
  };
  
  // 1. Parse CSV if it exists
  const csvPath = '/Users/eimribar/Downloads/_Job Scraper - Outreach & SalesLoft Tracker - Identified_Companies (1).csv';
  if (fs.existsSync(csvPath)) {
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(csvContent, { 
      columns: true, 
      skip_empty_lines: true,
      relaxed: true,
      skip_records_with_error: true
    });
    
    records.forEach((row) => {
      const company = row.Company?.trim();
      if (company && company !== '' && !company.startsWith('*')) {
        const cleanName = company
          .replace(/"/g, '')
          .replace(/^\s+|\s+$/g, '')
          .trim();
        
        // Skip non-company entries
        if (!cleanName.includes('Experience with') && 
            !cleanName.includes('Knowledge of') &&
            !cleanName.includes('CRM') &&
            !cleanName.includes('Salesforce') &&
            !cleanName.includes('LinkedIn')) {
          neverAnalyze.add(cleanName.toLowerCase().trim());
        }
      }
    });
    
    stats.fromCSV = neverAnalyze.size;
    console.log(`✅ Loaded ${stats.fromCSV} companies from CSV`);
  }
  
  // 2. Add ALL companies from database
  const { data: dbCompanies, error } = await supabase
    .from('identified_companies')
    .select('company_name');
  
  if (error) {
    console.error('❌ Error fetching companies:', error);
    return;
  }
  
  const initialSize = neverAnalyze.size;
  dbCompanies.forEach(row => {
    if (row.company_name) {
      neverAnalyze.add(row.company_name.toLowerCase().trim());
    }
  });
  
  stats.fromDatabase = neverAnalyze.size - initialSize;
  stats.total = neverAnalyze.size;
  
  // 3. Save the updated list
  const listArray = Array.from(neverAnalyze).sort();
  const outputPath = '/Users/eimribar/sales-tool-detector/never-analyze-companies.json';
  
  const listData = {
    companies: listArray,
    count: listArray.length,
    lastUpdated: new Date().toISOString(),
    sources: {
      csv: stats.fromCSV,
      database: stats.fromDatabase
    },
    metadata: {
      version: '2.0',
      purpose: 'Prevent re-analysis of known companies',
      updateFrequency: 'Run hourly or after batch processing'
    }
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(listData, null, 2));
  
  console.log(`\n📊 Update Summary:`);
  console.log(`   From CSV: ${stats.fromCSV} companies`);
  console.log(`   From Database (additional): ${stats.fromDatabase} companies`);
  console.log(`   Total in list: ${stats.total} companies`);
  console.log(`\n✅ Updated list saved to: ${outputPath}`);
  
  // 4. Log some verification
  console.log('\n🔍 Verification checks:');
  const testCompanies = ['Okta', 'Vanta', 'Bolt', 'Moloco', 'Redis'];
  testCompanies.forEach(test => {
    const inList = neverAnalyze.has(test.toLowerCase());
    console.log(`   ${test}: ${inList ? '✅ Will skip' : '❌ Not in list'}`);
  });
  
  return listData;
}

// Run the update
updateNeverAnalyzeList()
  .then(result => {
    console.log('\n✅ Never-analyze list successfully updated!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Failed to update list:', err);
    process.exit(1);
  });