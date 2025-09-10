#!/usr/bin/env node

/**
 * Upload New Job Postings
 * Processes JSON files and uploads to raw_jobs table
 * Date: 2025-09-10
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Statistics
const stats = {
  totalRead: 0,
  totalUploaded: 0,
  duplicatesSkipped: 0,
  errors: 0,
  byFile: {}
};

/**
 * Generate unique job ID
 */
function generateJobId(job) {
  const company = (job.companyName || 'unknown').trim();
  const title = (job.title || 'unknown').trim();
  const location = (job.location || 'unknown').trim();
  const url = job.jobUrl || '';
  
  // Create deterministic ID
  const signature = `${company}|${title}|${location}|${url}`;
  const hash = crypto.createHash('md5').update(signature).digest('hex');
  
  return `linkedin_${hash.substring(0, 12)}`;
}

/**
 * Transform job to raw_jobs format
 */
function transformJob(job, searchTerm) {
  return {
    job_id: generateJobId(job),
    platform: 'LinkedIn',
    company: job.companyName || '',
    job_title: job.title || '',
    location: job.location || '',
    description: job.description || '',
    job_url: job.jobUrl || '',
    scraped_date: job.publishedAt ? new Date(job.publishedAt).toISOString() : new Date().toISOString(),
    search_term: searchTerm,
    processed: false // Ready for analysis
  };
}

/**
 * Process a single JSON file
 */
async function processFile(filePath, fileName) {
  console.log(`\n📁 Processing ${fileName}...`);
  
  const searchTerm = fileName.replace('.json', '').toLowerCase();
  stats.byFile[fileName] = { read: 0, uploaded: 0, duplicates: 0, errors: 0 };
  
  try {
    // Read and parse JSON
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const jobs = JSON.parse(fileContent);
    
    console.log(`  📋 Found ${jobs.length} jobs`);
    stats.byFile[fileName].read = jobs.length;
    stats.totalRead += jobs.length;
    
    // Transform jobs
    const transformedJobs = jobs.map(job => transformJob(job, searchTerm));
    
    // Process in batches of 100
    const batchSize = 100;
    for (let i = 0; i < transformedJobs.length; i += batchSize) {
      const batch = transformedJobs.slice(i, i + batchSize);
      
      console.log(`  ⏳ Uploading batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(transformedJobs.length/batchSize)}...`);
      
      // Check for existing job_ids
      const jobIds = batch.map(j => j.job_id);
      const { data: existingJobs } = await supabase
        .from('raw_jobs')
        .select('job_id')
        .in('job_id', jobIds);
      
      const existingIds = new Set((existingJobs || []).map(j => j.job_id));
      const newJobs = batch.filter(j => !existingIds.has(j.job_id));
      const duplicateCount = batch.length - newJobs.length;
      
      if (duplicateCount > 0) {
        console.log(`    ⏭️  Skipping ${duplicateCount} duplicates`);
        stats.byFile[fileName].duplicates += duplicateCount;
        stats.duplicatesSkipped += duplicateCount;
      }
      
      if (newJobs.length > 0) {
        // Upload new jobs
        const { error } = await supabase
          .from('raw_jobs')
          .insert(newJobs);
        
        if (error) {
          console.error(`    ❌ Error uploading batch: ${error.message}`);
          stats.byFile[fileName].errors += newJobs.length;
          stats.errors += newJobs.length;
        } else {
          console.log(`    ✅ Uploaded ${newJobs.length} new jobs`);
          stats.byFile[fileName].uploaded += newJobs.length;
          stats.totalUploaded += newJobs.length;
        }
      }
      
      // Small delay between batches
      await new Promise(r => setTimeout(r, 100));
    }
    
    console.log(`  ✅ Completed: ${stats.byFile[fileName].uploaded} uploaded, ${stats.byFile[fileName].duplicates} duplicates skipped`);
    
  } catch (error) {
    console.error(`  ❌ Error processing ${fileName}: ${error.message}`);
    stats.errors++;
  }
}

/**
 * Main upload function
 */
async function uploadAllJobs() {
  console.log('🚀 UPLOADING NEW JOB POSTINGS');
  console.log('=' .repeat(60));
  
  const jobsDir = '/Users/eimribar/Desktop/new jobs';
  
  // Get all JSON files
  const files = fs.readdirSync(jobsDir)
    .filter(f => f.endsWith('.json'))
    .sort();
  
  console.log(`📋 Found ${files.length} JSON files to process:`);
  files.forEach(f => console.log(`  • ${f}`));
  
  // Process each file
  for (const file of files) {
    const filePath = path.join(jobsDir, file);
    await processFile(filePath, file);
  }
  
  // Print summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 UPLOAD COMPLETE');
  console.log('=' .repeat(60));
  console.log(`✅ Total jobs read: ${stats.totalRead}`);
  console.log(`✅ Total jobs uploaded: ${stats.totalUploaded}`);
  console.log(`⏭️  Duplicates skipped: ${stats.duplicatesSkipped}`);
  if (stats.errors > 0) {
    console.log(`❌ Errors: ${stats.errors}`);
  }
  
  console.log('\n📁 By File:');
  Object.entries(stats.byFile).forEach(([file, data]) => {
    console.log(`  ${file}:`);
    console.log(`    • Read: ${data.read}`);
    console.log(`    • Uploaded: ${data.uploaded}`);
    console.log(`    • Duplicates: ${data.duplicates}`);
    if (data.errors > 0) {
      console.log(`    • Errors: ${data.errors}`);
    }
  });
  
  // Check final status
  const { count: unprocessedCount } = await supabase
    .from('raw_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('processed', false);
  
  console.log('\n🎯 READY FOR PROCESSING');
  console.log(`📦 Jobs in queue: ${unprocessedCount}`);
  console.log('\n✅ Ready to enable automation!');
}

// Run the upload
uploadAllJobs().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});