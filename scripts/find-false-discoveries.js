#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function findFalseDiscoveries() {
  console.log('🔍 FINDING FALSE "NEW DISCOVERIES"');
  console.log('='.repeat(60));
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Load CSV companies
  const csvData = JSON.parse(fs.readFileSync('/tmp/csv-companies-clean.json', 'utf-8'));
  const csvCompanies = new Set(csvData.nameOnly.map(c => c.toLowerCase().trim()));
  
  console.log(`\n📋 CSV contains ${csvCompanies.size} unique companies`);
  
  // Get all companies marked as 'job_analysis' or with source='job_analysis'
  const { data: dbCompanies, error } = await supabase
    .from('identified_companies')
    .select('id, company_name, identified_date, source')
    .order('company_name');
  
  if (error) {
    console.error('Error fetching companies:', error);
    return;
  }
  
  console.log(`📊 Database has ${dbCompanies.length} total companies`);
  
  // Check each database company against CSV
  const falseNewDiscoveries = [];
  const trueNewDiscoveries = [];
  const csvMatches = [];
  
  dbCompanies.forEach(company => {
    const normalized = company.company_name.toLowerCase().trim();
    
    if (csvCompanies.has(normalized)) {
      // This company IS in the CSV
      csvMatches.push(company);
      
      // If it's marked as job_analysis, it's a FALSE discovery
      if (company.source === 'job_analysis') {
        falseNewDiscoveries.push(company);
      }
    } else {
      // Not in CSV - could be a true discovery
      if (company.source === 'job_analysis' || !company.source) {
        trueNewDiscoveries.push(company);
      }
    }
  });
  
  console.log('\n📈 ANALYSIS RESULTS:');
  console.log(`   Companies in CSV: ${csvMatches.length}`);
  console.log(`   Companies NOT in CSV: ${trueNewDiscoveries.length}`);
  console.log(`   FALSE "new discoveries" (in CSV but marked as job_analysis): ${falseNewDiscoveries.length}`);
  
  if (falseNewDiscoveries.length > 0) {
    console.log('\n❌ FALSE NEW DISCOVERIES (actually from CSV):');
    falseNewDiscoveries.slice(0, 20).forEach(c => {
      console.log(`   - ${c.company_name} (${c.source || 'no source'})`);
    });
    
    if (falseNewDiscoveries.length > 20) {
      console.log(`   ... and ${falseNewDiscoveries.length - 20} more`);
    }
  }
  
  console.log('\n✅ TRUE NEW DISCOVERIES (not in CSV):');
  console.log(`   Total: ${trueNewDiscoveries.length} companies`);
  if (trueNewDiscoveries.length > 0) {
    trueNewDiscoveries.slice(0, 10).forEach(c => {
      console.log(`   - ${c.company_name}`);
    });
  }
  
  // Generate SQL to fix the false discoveries
  if (falseNewDiscoveries.length > 0) {
    console.log('\n📝 SQL to fix false discoveries:');
    const ids = falseNewDiscoveries.map(c => `'${c.id}'`).join(',\n    ');
    console.log(`
UPDATE identified_companies
SET source = 'google_sheets'
WHERE id IN (
    ${ids}
);
-- This will fix ${falseNewDiscoveries.length} falsely marked companies
`);
  }
  
  // Save results
  const results = {
    csvCompanies: csvData.nameOnly,
    falseNewDiscoveries: falseNewDiscoveries.map(c => c.company_name),
    trueNewDiscoveries: trueNewDiscoveries.map(c => c.company_name),
    stats: {
      totalInCSV: csvCompanies.size,
      totalInDB: dbCompanies.length,
      matchedWithCSV: csvMatches.length,
      falseDiscoveries: falseNewDiscoveries.length,
      trueDiscoveries: trueNewDiscoveries.length
    }
  };
  
  fs.writeFileSync('/tmp/discovery-analysis.json', JSON.stringify(results, null, 2));
  console.log('\n📁 Full results saved to: /tmp/discovery-analysis.json');
}

findFalseDiscoveries().catch(console.error);