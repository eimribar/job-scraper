#!/usr/bin/env node

/**
 * Import fresh job postings from CSV file - with proper CSV parsing
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// CSV file path
const CSV_FILE = '/Users/eimribar/Desktop/_Job Scraper - Outreach & SalesLoft Tracker - Sheet128.csv';

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last field
  result.push(current);
  
  return result;
}

async function importJobs() {
  console.log('📂 Reading CSV file...');
  
  const csvContent = fs.readFileSync(CSV_FILE, 'utf-8');
  const lines = csvContent.split('\n');
  
  // Parse headers
  const headers = parseCSVLine(lines[0]);
  console.log('Headers:', headers);
  
  // Find indices for required fields
  const jobIdIndex = headers.indexOf('job_id');
  const platformIndex = headers.indexOf('platform');
  const companyIndex = headers.indexOf('company');
  const jobTitleIndex = headers.indexOf('job_title');
  const locationIndex = headers.indexOf('location');
  const descriptionIndex = headers.indexOf('description');
  const jobUrlIndex = headers.indexOf('job_url');
  
  console.log(`\n📊 Processing CSV with ${lines.length} lines...`);
  
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  let currentRow = [];
  let isInDescription = false;
  let currentDescription = '';
  let jobsToImport = [];
  
  // Process lines - handle multi-line descriptions
  for (let i = 1; i < lines.length && i < 1000; i++) { // Limit to first 1000 lines for testing
    const line = lines[i];
    
    // Check if this line starts with a job_id (new record)
    if (line.match(/^linkedin_\d+,/) || line.match(/^indeed_/)) {
      // If we have a previous row, save it
      if (currentRow.length > 0) {
        const job = {
          job_id: currentRow[jobIdIndex],
          platform: currentRow[platformIndex] || 'LinkedIn',
          company: currentRow[companyIndex],
          job_title: currentRow[jobTitleIndex],
          location: currentRow[locationIndex],
          description: currentRow[descriptionIndex],
          job_url: currentRow[jobUrlIndex]
        };
        
        if (job.job_id && job.company) {
          jobsToImport.push(job);
        }
      }
      
      // Start new row
      currentRow = parseCSVLine(line);
      isInDescription = false;
    } else if (currentRow.length > 0) {
      // This is a continuation of the description field
      currentRow[descriptionIndex] = (currentRow[descriptionIndex] || '') + '\n' + line;
    }
  }
  
  // Don't forget the last row
  if (currentRow.length > 0) {
    const job = {
      job_id: currentRow[jobIdIndex],
      platform: currentRow[platformIndex] || 'LinkedIn',
      company: currentRow[companyIndex],
      job_title: currentRow[jobTitleIndex],
      location: currentRow[locationIndex],
      description: currentRow[descriptionIndex],
      job_url: currentRow[jobUrlIndex]
    };
    
    if (job.job_id && job.company) {
      jobsToImport.push(job);
    }
  }
  
  console.log(`\n📋 Found ${jobsToImport.length} valid jobs to import\n`);
  
  // Import jobs in batches
  const batchSize = 10;
  for (let i = 0; i < jobsToImport.length; i += batchSize) {
    const batch = jobsToImport.slice(i, i + batchSize);
    
    for (const job of batch) {
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
            platform: job.platform,
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