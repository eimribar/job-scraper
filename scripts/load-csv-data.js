#!/usr/bin/env node

/**
 * Load initial data from CSV files into Supabase
 * This bypasses Google Sheets API for initial setup
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function loadRawJobs() {
  console.log('📁 Loading Raw Jobs from CSV...');
  
  const csvPath = '/Users/eimribar/Downloads/_Job Scraper - Outreach & SalesLoft Tracker - Raw_Jobs.csv';
  
  if (!fs.existsSync(csvPath)) {
    console.error('❌ CSV file not found:', csvPath);
    return;
  }
  
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true
  });
  
  console.log(`Found ${records.length} jobs in CSV`);
  
  // Transform CSV data to match database schema
  const jobs = records.map((row, index) => ({
    job_id: row.job_id || `job_${Date.now()}_${index}`,
    platform: row.platform || 'LinkedIn',
    company: row.company || '',
    job_title: row.job_title || '',
    location: row.location || '',
    description: row.description || '',
    job_url: row.job_url || '',
    scraped_date: row.scraped_date ? new Date(row.scraped_date) : new Date(),
    search_term: row.search_term || '',
    processed: row.processed === 'TRUE' || row.processed === 'true',
    analyzed_date: row.analyzed_date ? new Date(row.analyzed_date) : null,
    _stats: row._stats || '',
    sheet_row: index + 2 // Row number in sheet (accounting for header)
  }));
  
  // Insert in batches
  const batchSize = 100;
  for (let i = 0; i < jobs.length; i += batchSize) {
    const batch = jobs.slice(i, i + batchSize);
    const { error } = await supabase
      .from('raw_jobs')
      .upsert(batch, { onConflict: 'job_id' });
    
    if (error) {
      console.error('❌ Error inserting batch:', error);
    } else {
      console.log(`✅ Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(jobs.length/batchSize)}`);
    }
  }
  
  console.log(`✅ Loaded ${jobs.length} jobs into raw_jobs table`);
}

async function loadIdentifiedCompanies() {
  console.log('📁 Loading Identified Companies from CSV...');
  
  const csvPath = '/Users/eimribar/Downloads/_Job Scraper - Outreach & SalesLoft Tracker - Identified_Companies (2).csv';
  
  if (!fs.existsSync(csvPath)) {
    console.error('❌ CSV file not found:', csvPath);
    return;
  }
  
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true
  });
  
  console.log(`Found ${records.length} companies in CSV`);
  
  // Transform CSV data to match database schema
  const companies = records.map((row, index) => ({
    company: row.Company || row.company || '',
    tool_detected: row.tool_detected || '',
    signal_type: row.signal_type || '',
    context: row.context || '',
    job_title: row.job_title || '',
    job_url: row.job_url || '',
    linkedin_url: row['LinkedIn URL'] || row.linkedin_url || '',
    platform: row.platform || 'LinkedIn',
    identified_date: row.identified_date ? new Date(row.identified_date) : new Date(),
    leads_uploaded: row['Leads Uploaded?'] || row.leads_uploaded || '',
    tier_2_leads_uploaded: row['Tier 2 leads Uploaded?'] || row.tier_2_leads_uploaded || '',
    sponsor_1: row['SPONSOR 1'] || row.sponsor_1 || '',
    sponsor_1_li_url: row['SPONSOR 1 - LI URL'] || row.sponsor_1_li_url || '',
    sponsor_2: row['SPONSOR 2'] || row.sponsor_2 || '',
    sponsor_2_li_url: row['SPONSOR 2 - LI URL'] || row.sponsor_2_li_url || '',
    rep_sdr_bdr: row['Rep (SDR/BDR)'] || row.rep_sdr_bdr || '',
    rep_li_url: row['REP - LI URL'] || row.rep_li_url || '',
    tags_on_dashboard: row['tags on the dashboard'] || row.tags_on_dashboard || '',
    sheet_row: index + 2 // Row number in sheet (accounting for header)
  }));
  
  // Insert in batches
  const batchSize = 50;
  for (let i = 0; i < companies.length; i += batchSize) {
    const batch = companies.slice(i, i + batchSize);
    const { error } = await supabase
      .from('identified_companies')
      .upsert(batch, { onConflict: 'sheet_row' });
    
    if (error) {
      console.error('❌ Error inserting batch:', error);
    } else {
      console.log(`✅ Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(companies.length/batchSize)}`);
    }
  }
  
  console.log(`✅ Loaded ${companies.length} companies into identified_companies table`);
}

async function main() {
  console.log('🚀 Starting CSV data import to Supabase...\n');
  
  try {
    await loadRawJobs();
    console.log('');
    await loadIdentifiedCompanies();
    
    // Update sync status
    await supabase
      .from('sync_status')
      .upsert([
        {
          table_name: 'raw_jobs',
          sync_status: 'completed',
          last_sync_from_sheets: new Date(),
          rows_synced: await supabase.from('raw_jobs').select('*', { count: 'exact', head: true }).then(r => r.count)
        },
        {
          table_name: 'identified_companies', 
          sync_status: 'completed',
          last_sync_from_sheets: new Date(),
          rows_synced: await supabase.from('identified_companies').select('*', { count: 'exact', head: true }).then(r => r.count)
        }
      ], { onConflict: 'table_name' });
    
    console.log('\n✅ Data import completed successfully!');
    console.log('📊 You can now start the continuous processor to analyze unprocessed jobs.');
    
  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    process.exit(1);
  }
}

// Run import
main();