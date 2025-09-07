#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Parse CSV line handling quoted fields properly
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

async function importLeadData() {
  console.log('📊 Starting Lead Data Import\n');
  console.log('='.repeat(60));
  
  // Read the CSV file
  const csvPath = '/Users/eimribar/Desktop/_Job Scraper - Outreach & SalesLoft Tracker - Identified_Companies (3).csv';
  
  if (!fs.existsSync(csvPath)) {
    console.error('❌ CSV file not found:', csvPath);
    return;
  }
  
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const lines = csvContent.split('\n').filter(line => line.trim());
  
  // Parse header
  const header = parseCSVLine(lines[0]);
  const columnIndices = {
    company: header.indexOf('Company'),
    tool: header.indexOf('tool_detected'),
    leadsUploaded: header.indexOf('Leads Uploaded?'),
    tier: header.indexOf('Tier 2 leads Uploaded?'),
    sponsor1: header.indexOf('SPONSOR 1'),
    sponsor1Url: header.indexOf('SPONSOR 1 - LI URL'),
    sponsor2: header.indexOf('SPONSOR 2'),
    sponsor2Url: header.indexOf('SPONSOR 2 - LI URL'),
    repSdr: header.indexOf('Rep (SDR/BDR)'),
    repSdrUrl: header.indexOf('REP - LI URL'),
    tags: header.indexOf('tags on the dashboard')
  };
  
  console.log('Found columns:', Object.keys(columnIndices).map(k => `${k}:${columnIndices[k]}`).join(', '));
  console.log('\nProcessing companies...\n');
  
  let updated = 0;
  let notFound = 0;
  let errors = 0;
  
  // Process each row
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    
    if (!row[columnIndices.company]) continue;
    
    const companyName = row[columnIndices.company].replace(/^"|"$/g, '').trim();
    const leadsGenerated = row[columnIndices.leadsUploaded]?.toUpperCase() === 'TRUE';
    const tier = row[columnIndices.tier] || null;
    const sponsor1 = row[columnIndices.sponsor1] || null;
    const sponsor1Url = row[columnIndices.sponsor1Url] || null;
    const sponsor2 = row[columnIndices.sponsor2] || null;
    const sponsor2Url = row[columnIndices.sponsor2Url] || null;
    const repSdr = row[columnIndices.repSdr] || null;
    const repSdrUrl = row[columnIndices.repSdrUrl] || null;
    const tags = row[columnIndices.tags] || null;
    
    try {
      // Find the company in the database
      const { data: companies, error: searchError } = await supabase
        .from('identified_companies')
        .select('id, company')
        .ilike('company', `%${companyName}%`)
        .limit(1);
      
      if (searchError) {
        console.error(`❌ Error searching for ${companyName}:`, searchError.message);
        errors++;
        continue;
      }
      
      if (!companies || companies.length === 0) {
        console.log(`⚠️  Company not found: ${companyName}`);
        notFound++;
        continue;
      }
      
      // Update the company with lead data
      const updateData = {
        leads_generated: leadsGenerated
      };
      
      // Only add non-null values
      if (leadsGenerated) {
        updateData.leads_generated_date = new Date().toISOString();
        updateData.leads_generated_by = 'CSV Import';
      }
      
      if (tier) updateData.tier = tier;
      if (sponsor1) updateData.sponsor_1 = sponsor1;
      if (sponsor1Url) updateData.sponsor_1_url = sponsor1Url;
      if (sponsor2) updateData.sponsor_2 = sponsor2;
      if (sponsor2Url) updateData.sponsor_2_url = sponsor2Url;
      if (repSdr) updateData.rep_sdr_bdr = repSdr;
      if (repSdrUrl) updateData.rep_sdr_bdr_url = repSdrUrl;
      if (tags) updateData.tags = tags;
      
      const { error: updateError } = await supabase
        .from('identified_companies')
        .update(updateData)
        .eq('id', companies[0].id);
      
      if (updateError) {
        console.error(`❌ Error updating ${companyName}:`, updateError.message);
        errors++;
      } else {
        console.log(`✅ Updated: ${companyName} ${leadsGenerated ? '(Leads Generated)' : '(No Leads)'}`);
        updated++;
      }
      
    } catch (error) {
      console.error(`❌ Error processing ${companyName}:`, error.message);
      errors++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Import Summary:');
  console.log(`✅ Updated: ${updated} companies`);
  console.log(`⚠️  Not found: ${notFound} companies`);
  console.log(`❌ Errors: ${errors}`);
  
  // Get final statistics
  const { count: totalCompanies } = await supabase
    .from('identified_companies')
    .select('*', { count: 'exact', head: true });
    
  const { count: companiesWithLeads } = await supabase
    .from('identified_companies')
    .select('*', { count: 'exact', head: true })
    .eq('leads_generated', true);
  
  console.log('\n📈 Lead Coverage:');
  console.log(`Total companies: ${totalCompanies}`);
  console.log(`Companies with leads: ${companiesWithLeads}`);
  console.log(`Coverage: ${Math.round((companiesWithLeads / totalCompanies) * 100)}%`);
}

// Run the import
importLeadData().catch(console.error);