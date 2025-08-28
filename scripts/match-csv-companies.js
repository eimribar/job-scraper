#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const { parse } = require('csv-parse/sync');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function matchCSVCompanies() {
  console.log('🔍 MATCHING CSV COMPANIES WITH DATABASE');
  console.log('='.repeat(60));
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Step 1: Parse CSV file
    console.log('\n1️⃣ Parsing CSV file...');
    const csvPath = '/Users/eimribar/Downloads/_Job Scraper - Outreach & SalesLoft Tracker - Identified_Companies (1).csv';
    
    if (!fs.existsSync(csvPath)) {
      console.error('❌ CSV file not found:', csvPath);
      return;
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(csvContent, { 
      columns: true, 
      skip_empty_lines: true,
      relaxed: true,
      skip_records_with_error: true
    });
    
    // Extract unique company names from CSV
    const csvCompanies = new Map(); // Map to store company -> earliest date
    records.forEach(row => {
      const company = row.Company?.trim();
      if (company && company !== '' && !company.startsWith('*') && !company.includes('Experience with')) {
        // Clean up company name
        const cleanName = company.replace(/"/g, '').trim();
        
        // Store with earliest date
        const date = row.identified_date;
        if (!csvCompanies.has(cleanName) || (date && date < csvCompanies.get(cleanName))) {
          csvCompanies.set(cleanName, date || '2025-06-01');
        }
      }
    });
    
    console.log(`   ✅ Found ${csvCompanies.size} unique companies in CSV`);
    
    // Step 2: Get all companies from database
    console.log('\n2️⃣ Fetching companies from database...');
    const { data: dbCompanies, error: dbError } = await supabase
      .from('identified_companies')
      .select('id, company_name, identified_date')
      .order('company_name');
    
    if (dbError) {
      console.error('❌ Error fetching companies:', dbError);
      return;
    }
    
    console.log(`   ✅ Found ${dbCompanies.length} companies in database`);
    
    // Step 3: Match companies
    console.log('\n3️⃣ Matching companies...');
    
    const matchedCompanies = [];
    const csvOnlyCompanies = [];
    const dbOnlyCompanies = [];
    
    // Normalize for comparison
    const csvNormalized = new Map();
    for (const [company, date] of csvCompanies) {
      csvNormalized.set(company.toLowerCase().trim(), { original: company, date });
    }
    
    const dbNormalized = new Map();
    dbCompanies.forEach(c => {
      dbNormalized.set(c.company_name.toLowerCase().trim(), c);
    });
    
    // Find matches and CSV-only companies
    for (const [normalized, csvData] of csvNormalized) {
      if (dbNormalized.has(normalized)) {
        matchedCompanies.push({
          csv: csvData.original,
          db: dbNormalized.get(normalized),
          csvDate: csvData.date
        });
      } else {
        csvOnlyCompanies.push(csvData.original);
      }
    }
    
    // Find DB-only companies
    for (const [normalized, dbCompany] of dbNormalized) {
      if (!csvNormalized.has(normalized)) {
        dbOnlyCompanies.push(dbCompany);
      }
    }
    
    console.log(`\n📊 MATCHING RESULTS:`);
    console.log(`   ✅ Matched (in both CSV and DB): ${matchedCompanies.length}`);
    console.log(`   📝 In CSV but not in DB: ${csvOnlyCompanies.length}`);
    console.log(`   🆕 In DB but not in CSV (NEW DISCOVERIES): ${dbOnlyCompanies.length}`);
    
    // Step 4: Show sample of each category
    if (csvOnlyCompanies.length > 0) {
      console.log(`\n📝 Sample companies in CSV but not in DB (first 10):`);
      csvOnlyCompanies.slice(0, 10).forEach(c => console.log(`   - ${c}`));
    }
    
    if (dbOnlyCompanies.length > 0) {
      console.log(`\n🆕 Sample NEW DISCOVERIES not in CSV (first 10):`);
      dbOnlyCompanies.slice(0, 10).forEach(c => {
        const date = new Date(c.identified_date).toLocaleDateString();
        console.log(`   - ${c.company_name} (discovered ${date})`);
      });
    }
    
    // Step 5: Generate SQL to update source field
    console.log('\n4️⃣ Generating SQL to update source tracking...');
    
    const csvCompanyIds = matchedCompanies.map(m => m.db.id);
    const newDiscoveryIds = dbOnlyCompanies.map(c => c.id);
    
    console.log('\n-- SQL to properly mark Google Sheets companies:');
    console.log(`UPDATE identified_companies`);
    console.log(`SET source = 'google_sheets', import_date = '2025-06-26T00:00:00Z'`);
    console.log(`WHERE id IN (${csvCompanyIds.slice(0, 10).map(id => `'${id}'`).join(', ')}${csvCompanyIds.length > 10 ? ', ...' : ''});`);
    console.log(`-- This will update ${csvCompanyIds.length} companies`);
    
    console.log('\n-- SQL to mark new discoveries:');
    console.log(`UPDATE identified_companies`);
    console.log(`SET source = 'job_analysis', import_date = identified_date`);
    console.log(`WHERE id IN (${newDiscoveryIds.slice(0, 10).map(id => `'${id}'`).join(', ')}${newDiscoveryIds.length > 10 ? ', ...' : ''});`);
    console.log(`-- This will update ${newDiscoveryIds.length} companies`);
    
    // Step 6: Save results for further processing
    const results = {
      csvCompanies: Array.from(csvCompanies.keys()),
      matchedCompanies: matchedCompanies.map(m => m.csv),
      csvOnlyCompanies,
      dbOnlyCompanies: dbOnlyCompanies.map(c => c.company_name),
      csvCompanyIds,
      newDiscoveryIds,
      summary: {
        totalInCSV: csvCompanies.size,
        totalInDB: dbCompanies.length,
        matched: matchedCompanies.length,
        csvOnly: csvOnlyCompanies.length,
        newDiscoveries: dbOnlyCompanies.length
      }
    };
    
    fs.writeFileSync('/tmp/csv-matching-results.json', JSON.stringify(results, null, 2));
    console.log('\n✅ Results saved to /tmp/csv-matching-results.json');
    
    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 FINAL ANALYSIS:');
    console.log(`   Google Sheets companies (from CSV): ${matchedCompanies.length}`);
    console.log(`   NEW discoveries (not in CSV): ${dbOnlyCompanies.length}`);
    console.log(`   Discovery rate: ${((dbOnlyCompanies.length / dbCompanies.length) * 100).toFixed(1)}%`);
    
    // Value calculation
    const avgDealSize = 30000;
    const conversionRate = 0.02;
    const potentialValue = dbOnlyCompanies.length * avgDealSize * conversionRate;
    console.log(`   💰 Potential value from NEW discoveries: $${potentialValue.toLocaleString()}`);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

matchCSVCompanies().catch(console.error);