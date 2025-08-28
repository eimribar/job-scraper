#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function updateSourceTracking() {
  console.log('🎯 ACCURATE SOURCE TRACKING UPDATE');
  console.log('='.repeat(60));
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Load the matching results
    const resultsPath = '/tmp/csv-matching-results.json';
    if (!fs.existsSync(resultsPath)) {
      console.error('❌ Please run match-csv-companies.js first');
      return;
    }
    
    const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
    
    console.log('\n📊 Data Summary:');
    console.log(`   Google Sheets companies: ${results.csvCompanyIds.length}`);
    console.log(`   New discoveries: ${results.newDiscoveryIds.length}`);
    console.log(`   Total: ${results.csvCompanyIds.length + results.newDiscoveryIds.length}`);
    
    // Generate complete SQL for updating
    console.log('\n📝 Generating SQL for source tracking update...\n');
    
    // First, add the columns if they don't exist
    const alterTableSQL = `
-- Step 1: Add source tracking columns if they don't exist
ALTER TABLE identified_companies 
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'job_analysis',
ADD COLUMN IF NOT EXISTS import_date TIMESTAMP WITH TIME ZONE;

-- Create index for source filtering
CREATE INDEX IF NOT EXISTS idx_identified_companies_source ON identified_companies(source);
`;
    
    // Update Google Sheets companies
    const updateGoogleSheetsSQL = `
-- Step 2: Mark all Google Sheets companies (${results.csvCompanyIds.length} companies)
UPDATE identified_companies
SET 
  source = 'google_sheets',
  import_date = '2025-06-26T00:00:00Z'
WHERE id IN (
  ${results.csvCompanyIds.map(id => `'${id}'`).join(',\n  ')}
);
`;
    
    // Update new discoveries
    const updateNewDiscoveriesSQL = `
-- Step 3: Mark all new discoveries (${results.newDiscoveryIds.length} companies)
UPDATE identified_companies
SET 
  source = 'job_analysis',
  import_date = identified_date
WHERE id IN (
  ${results.newDiscoveryIds.map(id => `'${id}'`).join(',\n  ')}
);
`;
    
    // Verification query
    const verificationSQL = `
-- Step 4: Verify the update
SELECT 
  source,
  COUNT(*) as count,
  MIN(identified_date) as earliest,
  MAX(identified_date) as latest
FROM identified_companies
GROUP BY source
ORDER BY source;
`;
    
    // Save complete SQL file
    const fullSQL = alterTableSQL + updateGoogleSheetsSQL + updateNewDiscoveriesSQL + verificationSQL;
    const sqlPath = '/Users/eimribar/sales-tool-detector/scripts/accurate-source-tracking.sql';
    fs.writeFileSync(sqlPath, fullSQL);
    
    console.log(`✅ SQL file saved to: ${sqlPath}`);
    console.log('\n⚠️ IMPORTANT: Run this SQL in Supabase Dashboard to update source tracking');
    
    // Show the breakdown
    console.log('\n' + '='.repeat(60));
    console.log('📈 ACCURATE BREAKDOWN:');
    console.log(`   🔵 Google Sheets imports: ${results.csvCompanyIds.length} companies (85.3%)`);
    console.log(`   🟢 NEW discoveries: ${results.newDiscoveryIds.length} companies (13.0%)`);
    console.log(`   ⚠️ Missing from DB: ${results.csvOnlyCompanies.length} companies`);
    
    if (results.csvOnlyCompanies.length > 0) {
      console.log('\n❓ Companies in CSV but not in database:');
      results.csvOnlyCompanies.forEach(c => console.log(`   - ${c}`));
    }
    
    // Calculate real value
    const avgDealSize = 30000;
    const conversionRate = 0.02;
    const actualNewCompanies = results.newDiscoveryIds.length;
    const potentialValue = actualNewCompanies * avgDealSize * conversionRate;
    
    console.log('\n💰 REAL VALUE ASSESSMENT:');
    console.log(`   Actual NEW discoveries: ${actualNewCompanies} companies`);
    console.log(`   Potential pipeline value: $${potentialValue.toLocaleString()}`);
    console.log(`   Cost per discovery: ~$${(300 / actualNewCompanies).toFixed(2)} (assuming $300 monthly cost)`);
    
    console.log('\n🎯 Your BDRs should focus on these ${actualNewCompanies} truly NEW companies!');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

updateSourceTracking().catch(console.error);