#!/usr/bin/env node

/**
 * Import fresh job postings from CSV file
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// CSV file path
const CSV_FILE = '/Users/eimribar/Desktop/_Job Scraper - Outreach & SalesLoft Tracker - Sheet128.csv';

function parseCSV(content) {
  const lines = content.split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    // Handle CSV with potential commas in fields
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }
  
  return rows;
}

async function importJobs() {
  console.log('📂 Reading CSV file...');
  
  const csvContent = fs.readFileSync(CSV_FILE, 'utf-8');
  const jobs = parseCSV(csvContent);
  
  console.log(`📊 Found ${jobs.length} jobs in CSV\n`);
  
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const job of jobs) {
    try {
      // Check if job already exists
      const { data: existing } = await supabase
        .from('raw_jobs')
        .select('job_id')
        .eq('job_id', job.job_id)
        .single();
      
      if (existing) {
        console.log(`⏭️ Skipping ${job.company} - already exists`);
        skipped++;
        continue;
      }
      
      // Insert new job
      const { error } = await supabase
        .from('raw_jobs')
        .insert({
          job_id: job.job_id,
          platform: job.platform || 'LinkedIn',
          company: job.company,
          job_title: job.job_title,
          location: job.location,
          description: job.description,
          job_url: job.job_url,
          processed: false,  // Mark as unprocessed for analysis
          created_at: new Date().toISOString()
        });
      
      if (error) {
        console.error(`❌ Error importing ${job.company}:`, error.message);
        errors++;
      } else {
        console.log(`✅ Imported: ${job.company} - ${job.job_title}`);
        imported++;
      }
      
    } catch (err) {
      console.error(`❌ Unexpected error for ${job.company}:`, err.message);
      errors++;
    }
  }
  
  // Get count of unprocessed jobs
  const { count } = await supabase
    .from('raw_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('processed', false);
  
  console.log('\n' + '═'.repeat(50));
  console.log('📈 IMPORT RESULTS:');
  console.log('═'.repeat(50));
  console.log(`✅ Successfully imported: ${imported} jobs`);
  console.log(`⏭️ Skipped (already exist): ${skipped} jobs`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`\n📋 Total unprocessed jobs ready for analysis: ${count}`);
  console.log('\n🚀 Ready to run processor!');
}

importJobs().catch(console.error);