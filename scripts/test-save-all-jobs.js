/**
 * Test script to save ALL jobs without deduplication
 * This modifies the existing pipeline to skip deduplication
 */

require('dotenv').config({ path: '.env.local' });
const { v4: uuidv4 } = require('uuid');

async function testSaveAllJobs() {
  console.log('🧪 TEST: Save ALL Jobs Without Deduplication\n');
  console.log('=' .repeat(60));
  
  try {
    // Import required modules
    const { ApifyClient } = require('apify-client');
    const { createClient } = require('@supabase/supabase-js');
    const crypto = require('crypto');
    
    // Initialize clients
    const apifyClient = new ApifyClient({
      token: process.env.APIFY_TOKEN,
    });
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    
    const runId = uuidv4();
    const searchTerm = 'SDR';
    const maxItems = 500;
    
    console.log(`Run ID: ${runId}`);
    console.log(`Search Term: "${searchTerm}"`);
    console.log(`Max Items: ${maxItems}\n`);
    
    // Step 1: Scrape jobs from LinkedIn
    console.log('📥 STEP 1: Scraping jobs from LinkedIn...');
    console.log('  Starting Apify actor...\n');
    
    const run = await apifyClient.actor('bebity~linkedin-jobs-scraper').call({
      proxy: {
        useApifyProxy: true,
        apifyProxyGroups: [],
      },
      rows: maxItems,
      title: searchTerm,
    });
    
    console.log(`  Apify run ID: ${run.id}`);
    console.log('  Fetching results...\n');
    
    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    console.log(`✅ Scraped ${items.length} jobs successfully!\n`);
    
    if (items.length === 0) {
      console.log('⚠️  No jobs found');
      return;
    }
    
    // Step 2: Generate job IDs using improved method
    console.log('🔧 STEP 2: Processing jobs with improved ID generation...\n');
    
    const processedJobs = items.map((item, idx) => {
      let jobId;
      
      if (item.id) {
        jobId = `linkedin_${item.id}`;
      } else {
        // Create deterministic ID using MD5 hash
        const company = (item.companyName || 'unknown').trim();
        const title = (item.title || 'unknown').trim();
        const location = (item.location || 'unknown').trim();
        const signature = `${company}|${title}|${location}|${item.jobUrl || ''}`;
        const hash = crypto.createHash('md5').update(signature).digest('hex');
        jobId = `linkedin_gen_${hash.substring(0, 12)}`;
      }
      
      if (idx < 3) {
        console.log(`  Job ${idx + 1}:`);
        console.log(`    Company: ${item.companyName}`);
        console.log(`    Title: ${item.title}`);
        console.log(`    ID: ${jobId}\n`);
      }
      
      return {
        job_type: 'analyze',  // Use existing valid job_type
        status: 'pending',     // Use existing valid status
        payload: {
          scrape_run_id: runId,
          job_id: jobId,
          platform: 'LinkedIn',
          company: item.companyName || '',
          job_title: item.title || '',
          location: item.location || '',
          description: item.description || '',
          job_url: item.jobUrl || '',
          scraped_date: new Date().toISOString(),
          search_term: searchTerm,
          deduplicated: false,
          is_duplicate: false,
          ready_for_analysis: false
        },
        created_at: new Date().toISOString()
      };
    });
    
    // Step 3: Save ALL jobs to database in batches
    console.log('💾 STEP 3: Saving ALL jobs to database (NO deduplication)...\n');
    
    const batchSize = 50;
    let totalSaved = 0;
    let totalFailed = 0;
    
    for (let i = 0; i < processedJobs.length; i += batchSize) {
      const batch = processedJobs.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(processedJobs.length / batchSize);
      
      console.log(`  Batch ${batchNumber}/${totalBatches}: Saving ${batch.length} jobs...`);
      
      const { data, error } = await supabase
        .from('job_queue')
        .insert(batch)
        .select('id');
      
      if (error) {
        console.error(`    ❌ Error: ${error.message}`);
        totalFailed += batch.length;
      } else {
        console.log(`    ✅ Saved ${data?.length || batch.length} jobs`);
        totalSaved += data?.length || batch.length;
      }
    }
    
    // Step 4: Verify data integrity
    console.log('\n🔍 STEP 4: Verifying data integrity...\n');
    
    const { count, error: countError } = await supabase
      .from('job_queue')
      .select('*', { count: 'exact', head: true })
      .eq('payload->>scrape_run_id', runId);
    
    console.log(`  Jobs scraped: ${items.length}`);
    console.log(`  Jobs saved: ${totalSaved}`);
    console.log(`  Jobs in DB with run ID: ${count || 0}`);
    
    if (count === items.length) {
      console.log('\n✅ SUCCESS! All jobs were saved to database!');
    } else {
      console.log(`\n⚠️  WARNING: Data discrepancy detected`);
      console.log(`  Expected: ${items.length}`);
      console.log(`  Found: ${count || 0}`);
      console.log(`  Missing: ${items.length - (count || 0)}`);
    }
    
    // Step 5: Summary
    console.log('\n' + '=' .repeat(60));
    console.log('📊 FINAL SUMMARY');
    console.log('=' .repeat(60));
    console.log(`Run ID: ${runId}`);
    console.log(`Search Term: "${searchTerm}"`);
    console.log(`Jobs Scraped: ${items.length}`);
    console.log(`Jobs Saved: ${totalSaved}`);
    console.log(`Jobs Failed: ${totalFailed}`);
    console.log(`Success Rate: ${Math.round((totalSaved / items.length) * 100)}%`);
    
    console.log('\n📋 NEXT STEPS:');
    console.log(`1. Run deduplication check for run ID: ${runId}`);
    console.log('2. Mark non-duplicates as ready_for_analysis');
    console.log('3. Start continuous analysis service');
    console.log('\nAll jobs are now safely in the database!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
console.log('🚀 Sales Tool Detector - Save ALL Jobs Test');
console.log('No deduplication will be performed during ingestion');
console.log('=' .repeat(60));

testSaveAllJobs().catch(console.error);