#!/usr/bin/env node

const fs = require('fs');
const { parse } = require('csv-parse/sync');

function parseCSVProperly() {
  console.log('📋 PARSING CSV FILE PROPERLY');
  console.log('='.repeat(60));
  
  const csvPath = '/Users/eimribar/Downloads/_Job Scraper - Outreach & SalesLoft Tracker - Identified_Companies (1).csv';
  
  if (!fs.existsSync(csvPath)) {
    console.error('❌ CSV file not found');
    return;
  }
  
  // Read and parse CSV
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(csvContent, { 
    columns: true, 
    skip_empty_lines: true,
    relaxed: true,
    skip_records_with_error: true
  });
  
  // Extract unique company names
  const companies = new Set();
  const companyList = [];
  
  records.forEach((row, index) => {
    const company = row.Company?.trim();
    if (company && company !== '' && !company.startsWith('*')) {
      // Clean up company name
      const cleanName = company
        .replace(/"/g, '')
        .replace(/^\s+|\s+$/g, '')
        .trim();
      
      // Skip non-company entries
      if (cleanName.includes('Experience with') || 
          cleanName.includes('Knowledge of') ||
          cleanName.includes('CRM') ||
          cleanName.includes('Salesforce') ||
          cleanName.includes('LinkedIn')) {
        return;
      }
      
      if (!companies.has(cleanName.toLowerCase())) {
        companies.add(cleanName.toLowerCase());
        companyList.push({
          name: cleanName,
          original: company,
          row: index + 2 // +2 for header and 0-index
        });
      }
    }
  });
  
  console.log(`\n✅ Found ${companyList.length} unique companies in CSV\n`);
  
  // Show sample
  console.log('Sample companies from CSV:');
  companyList.slice(0, 10).forEach(c => {
    console.log(`  - ${c.name} (row ${c.row})`);
  });
  
  // Save to file
  const outputPath = '/tmp/csv-companies-clean.json';
  fs.writeFileSync(outputPath, JSON.stringify({
    companies: companyList,
    count: companyList.length,
    nameOnly: companyList.map(c => c.name)
  }, null, 2));
  
  console.log(`\n📁 Saved to: ${outputPath}`);
  
  // Check for specific companies we know are there
  console.log('\n🔍 Verification - checking known companies:');
  const testCompanies = ['Okta', 'Vanta', 'Moloco', 'Redis', 'UpGuard', 'Synthesia'];
  
  testCompanies.forEach(test => {
    const found = companyList.some(c => 
      c.name.toLowerCase() === test.toLowerCase()
    );
    console.log(`  ${test}: ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
  });
  
  return companyList;
}

parseCSVProperly();