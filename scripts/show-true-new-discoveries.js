#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function showTrueNewDiscoveries() {
  console.log('🎯 TRUE NEW DISCOVERIES - NOT IN GOOGLE SHEETS');
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
    
    // Get details for all new discoveries
    const { data: newCompanies, error } = await supabase
      .from('identified_companies')
      .select('*')
      .in('id', results.newDiscoveryIds)
      .order('identified_date', { ascending: false });
    
    if (error) {
      console.error('Error fetching new companies:', error);
      return;
    }
    
    console.log(`\n✨ Found ${newCompanies.length} TRUE NEW DISCOVERIES\n`);
    
    // Group by tool
    const byTool = {
      'Outreach.io': [],
      'SalesLoft': [],
      'Both': [],
      'Other': []
    };
    
    newCompanies.forEach(company => {
      const tool = company.tool_detected || 'Other';
      if (byTool[tool]) {
        byTool[tool].push(company);
      } else {
        byTool['Other'].push(company);
      }
    });
    
    // Show breakdown by tool
    console.log('📊 Breakdown by Tool:');
    Object.entries(byTool).forEach(([tool, companies]) => {
      if (companies.length > 0) {
        console.log(`   ${tool}: ${companies.length} companies`);
      }
    });
    
    // Group by confidence
    const byConfidence = { high: [], medium: [], low: [] };
    newCompanies.forEach(company => {
      const confidence = company.confidence || 'low';
      byConfidence[confidence].push(company);
    });
    
    console.log('\n📊 Breakdown by Confidence:');
    Object.entries(byConfidence).forEach(([level, companies]) => {
      if (companies.length > 0) {
        const percentage = ((companies.length / newCompanies.length) * 100).toFixed(1);
        console.log(`   ${level}: ${companies.length} companies (${percentage}%)`);
      }
    });
    
    // Group by date
    const byMonth = {};
    newCompanies.forEach(company => {
      const month = company.identified_date.substring(0, 7);
      byMonth[month] = (byMonth[month] || 0) + 1;
    });
    
    console.log('\n📊 Discovery Timeline:');
    Object.entries(byMonth).sort().forEach(([month, count]) => {
      console.log(`   ${month}: ${count} companies`);
    });
    
    // Show all new discoveries with details
    console.log('\n🆕 ALL TRUE NEW DISCOVERIES:');
    console.log('='.repeat(60));
    
    newCompanies.forEach((company, index) => {
      const date = new Date(company.identified_date).toLocaleDateString();
      console.log(`\n${index + 1}. ${company.company_name}`);
      console.log(`   Tool: ${company.tool_detected}`);
      console.log(`   Confidence: ${company.confidence}`);
      console.log(`   Date: ${date}`);
      console.log(`   Job: ${company.job_title}`);
      if (company.context) {
        console.log(`   Context: "${company.context.substring(0, 100)}..."`);
      }
    });
    
    // Save to CSV for easy sharing
    const csvContent = [
      'Company,Tool,Confidence,Date,Job Title',
      ...newCompanies.map(c => 
        `"${c.company_name}","${c.tool_detected}","${c.confidence}","${new Date(c.identified_date).toLocaleDateString()}","${c.job_title}"`
      )
    ].join('\n');
    
    const csvPath = '/Users/eimribar/sales-tool-detector/true-new-discoveries.csv';
    fs.writeFileSync(csvPath, csvContent);
    
    console.log(`\n✅ Exported to CSV: ${csvPath}`);
    
    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('💎 SUMMARY OF TRUE VALUE:');
    console.log(`   Total NEW discoveries: ${newCompanies.length} companies`);
    console.log(`   High confidence: ${byConfidence.high.length} companies`);
    console.log(`   Outreach.io users: ${byTool['Outreach.io'].length}`);
    console.log(`   SalesLoft users: ${byTool['SalesLoft'].length}`);
    console.log(`   Both tools: ${byTool['Both'].length}`);
    
    // ROI calculation
    const avgDealSize = 30000;
    const conversionRate = 0.02;
    const potentialValue = newCompanies.length * avgDealSize * conversionRate;
    const monthlyDiscoveryRate = newCompanies.length / 2; // Assuming 2 months of operation
    
    console.log('\n💰 ROI Analysis:');
    console.log(`   Discovery rate: ~${Math.round(monthlyDiscoveryRate)} new companies/month`);
    console.log(`   Potential pipeline: $${potentialValue.toLocaleString()}`);
    console.log(`   Break-even: ${Math.ceil(300 / (avgDealSize * conversionRate))} conversions needed`);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

showTrueNewDiscoveries().catch(console.error);