/**
 * WEEKLY SCRAPER - NEW CLEAN VERSION
 * Works with the clean 4-table database structure
 * 
 * Flow:
 * 1. Check search_terms_clean for terms that need scraping
 * 2. Scrape jobs and save to raw_jobs with processed=FALSE
 * 3. Update search_terms_clean with last_scraped_date
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { ApifyClient } = require('apify-client');
const { createHash } = require('crypto');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const apifyClient = new ApifyClient({
  token: process.env.APIFY_TOKEN,
});

// Stats tracking
const stats = {
  startTime: new Date(),
  totalScrapes: 0,
  totalJobsFound: 0,
  lastWeeklyScrape: null,
  isRunning: false
};

async function scrapeLinkedInJobs(searchTerm, maxItems = 500) {
  console.log(`🕷️ Scraping LinkedIn for: "${searchTerm}" (max ${maxItems} jobs)`);
  
  try {
    const run = await apifyClient.actor('bebity~linkedin-jobs-scraper').call({
      proxy: {
        useApifyProxy: true,
        apifyProxyGroups: [], // Standard proxy as per requirements
      },
      rows: maxItems,
      title: searchTerm,
    });

    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    
    return items.map((item) => {
      // Generate unique job ID
      let jobId;
      
      if (item.id) {
        // Use LinkedIn's provided ID if available
        jobId = `linkedin_${item.id}`;
      } else {
        // Create deterministic ID using MD5 hash of key fields
        const company = (item.companyName || 'unknown').trim();
        const title = (item.title || 'unknown').trim();
        const location = (item.location || 'unknown').trim();
        
        const signature = `${company}|${title}|${location}|${item.jobUrl || ''}`;
        const hash = createHash('md5').update(signature).digest('hex');
        jobId = `linkedin_gen_${hash.substring(0, 12)}`;
      }
      
      return {
        job_id: jobId,
        platform: 'LinkedIn',
        company: item.companyName || '',
        job_title: item.title || '',
        location: item.location || '',
        description: item.description || '',
        job_url: item.jobUrl || '',
        scraped_date: new Date().toISOString(),
        search_term: searchTerm,
      };
    });
  } catch (error) {
    console.error(`  ❌ Error scraping LinkedIn:`, error.message);
    throw error;
  }
}

async function saveJobsToDatabase(jobs, searchTerm) {
  if (jobs.length === 0) {
    console.log('  No jobs to save');
    return { newJobs: 0, duplicates: 0 };
  }

  console.log(`  💾 Saving ${jobs.length} jobs to raw_jobs table...`);
  
  // Check for existing jobs to count duplicates
  const existingJobIds = new Set();
  const { data: existingJobs } = await supabase
    .from('raw_jobs')
    .select('job_id')
    .in('job_id', jobs.map(j => j.job_id));
  
  if (existingJobs) {
    existingJobs.forEach(job => existingJobIds.add(job.job_id));
  }
  
  const newJobs = jobs.filter(job => !existingJobIds.has(job.job_id));
  const duplicates = jobs.length - newJobs.length;
  
  console.log(`  📊 ${newJobs.length} new jobs, ${duplicates} duplicates`);
  
  if (newJobs.length > 0) {
    // Save new jobs with processed = FALSE (ready for analysis)
    const { error } = await supabase
      .from('raw_jobs')
      .insert(newJobs.map(job => ({
        ...job,
        processed: false,
        processed_date: null
      })));

    if (error) {
      console.error('  ❌ Error saving jobs:', error.message);
      throw error;
    }
    
    console.log(`  ✅ Successfully saved ${newJobs.length} new jobs to database`);
  }
  
  return { newJobs: newJobs.length, duplicates };
}

async function scrapeSearchTerm(searchTerm) {
  console.log(`\\n[SCRAPING] "${searchTerm}"`);
  console.log('─'.repeat(50));
  
  try {
    // Step 1: Scrape jobs from LinkedIn
    const jobs = await scrapeLinkedInJobs(searchTerm, 500);
    console.log(`  🔍 Scraped ${jobs.length} jobs from LinkedIn`);
    
    // Step 2: Save to database
    const results = await saveJobsToDatabase(jobs, searchTerm);
    
    // Step 3: Update search term status
    const { error: updateError } = await supabase
      .from('search_terms_clean')
      .update({
        last_scraped_date: new Date().toISOString(),
        jobs_found_count: jobs.length,
      })
      .eq('search_term', searchTerm);
    
    if (updateError) {
      console.error('  ❌ Failed to update search term status:', updateError.message);
    }
    
    console.log(`  ✅ Scraping complete: ${results.newJobs} new, ${results.duplicates} duplicates`);
    
    stats.totalScrapes++;
    stats.totalJobsFound += results.newJobs;
    
    return { 
      success: true, 
      totalScraped: jobs.length, 
      newJobs: results.newJobs,
      duplicates: results.duplicates 
    };
    
  } catch (error) {
    console.log(`  ❌ Scraping failed: ${error.message}`);
    return { 
      success: false, 
      error: error.message,
      totalScraped: 0,
      newJobs: 0 
    };
  }
}

async function checkIfTimeForWeeklyScrape() {
  // Check if it's been a week since last scrape (get OLDEST, not newest)
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  
  const { data: lastScrape } = await supabase
    .from('search_terms_clean')
    .select('search_term, last_scraped_date')
    .not('last_scraped_date', 'is', null)
    .order('last_scraped_date', { ascending: true })  // OLDEST first
    .limit(1);
  
  if (!lastScrape || lastScrape.length === 0) {
    console.log('🎯 No previous scrapes found - running first weekly scrape');
    return true;
  }
  
  const lastScrapeDate = new Date(lastScrape[0].last_scraped_date);
  const daysSinceOldest = Math.round((Date.now() - lastScrapeDate) / (1000 * 60 * 60 * 24));
  
  if (lastScrapeDate < oneWeekAgo) {
    console.log(`🎯 Oldest scrape was ${daysSinceOldest} days ago - time for weekly scrape`);
    return true;
  }
  
  const nextScrape = new Date(lastScrapeDate);
  nextScrape.setDate(nextScrape.getDate() + 7);
  
  console.log(`⏳ Next weekly scrape scheduled for: ${nextScrape.toLocaleDateString()}`);
  return false;
}

async function runWeeklyScrape() {
  console.log('🚀 STARTING WEEKLY SCRAPE');
  console.log('=' .repeat(60));
  
  stats.lastWeeklyScrape = new Date();
  
  // Get all active search terms
  const { data: searchTerms } = await supabase
    .from('search_terms_clean')
    .select('search_term')
    .eq('is_active', true)
    .order('search_term');
  
  if (!searchTerms || searchTerms.length === 0) {
    console.log('❌ No active search terms found');
    return;
  }
  
  console.log(`📋 Found ${searchTerms.length} active search terms to scrape\\n`);
  
  const results = {
    success: 0,
    failed: 0,
    totalJobs: 0,
    totalNew: 0
  };
  
  // Process each search term
  for (let i = 0; i < searchTerms.length; i++) {
    const term = searchTerms[i];
    console.log(`[${i+1}/${searchTerms.length}] Processing: "${term.search_term}"`);
    
    const result = await scrapeSearchTerm(term.search_term);
    
    if (result.success) {
      results.success++;
      results.totalJobs += result.totalScraped;
      results.totalNew += result.newJobs;
    } else {
      results.failed++;
    }
    
    // Wait 10 seconds between terms to avoid rate limits
    if (i < searchTerms.length - 1) {
      console.log('  ⏳ Waiting 10 seconds...');
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
  
  // Summary
  console.log('\\n' + '=' .repeat(60));
  console.log('📊 WEEKLY SCRAPE COMPLETE');
  console.log('=' .repeat(60));
  console.log(`✅ Successful: ${results.success}/${searchTerms.length}`);
  console.log(`❌ Failed: ${results.failed}/${searchTerms.length}`);
  console.log(`📈 Total jobs scraped: ${results.totalJobs}`);
  console.log(`🆕 New jobs added: ${results.totalNew}`);
  console.log(`⏰ Duration: ${Math.round((Date.now() - stats.lastWeeklyScrape) / 1000)} seconds`);
  console.log('\\nNext weekly scrape in 7 days...\\n');
}

async function runScheduler() {
  console.log('📅 WEEKLY SCRAPING SCHEDULER - NEW CLEAN VERSION');
  console.log('=' .repeat(60));
  console.log('Database: Clean search_terms_clean table');
  console.log('Target: raw_jobs with processed=FALSE');
  console.log('This scheduler runs weekly scraping automatically');
  console.log('Checking every hour for schedule...');
  console.log('Press Ctrl+C to stop\\n');
  
  stats.isRunning = true;
  
  while (stats.isRunning) {
    try {
      const shouldScrape = await checkIfTimeForWeeklyScrape();
      
      if (shouldScrape) {
        await runWeeklyScrape();
      }
      
      // Check every hour
      console.log(`[${new Date().toISOString()}] Scheduler running - next check in 1 hour`);
      await new Promise(resolve => setTimeout(resolve, 60 * 60 * 1000)); // 1 hour
      
    } catch (error) {
      console.error('Scheduler error:', error);
      console.log('Retrying in 10 minutes...');
      await new Promise(resolve => setTimeout(resolve, 10 * 60 * 1000)); // 10 minutes
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\\n\\n🛑 Shutting down weekly scheduler...');
  stats.isRunning = false;
  
  const duration = Math.round((Date.now() - stats.startTime) / 1000);
  console.log('\\n📊 SCHEDULER STATS:');
  console.log('Total scrapes run:', stats.totalScrapes);
  console.log('Total new jobs found:', stats.totalJobsFound);
  console.log('Runtime:', Math.round(duration / 60), 'minutes');
  
  process.exit(0);
});

// Start the scheduler
console.log('🚀 Sales Tool Detector - Weekly Scraping Scheduler (Clean DB Version)');
console.log('Version: 2.0 - Clean Database Structure');
console.log('Started:', new Date().toLocaleString());
console.log('=' .repeat(60) + '\\n');

runScheduler().catch(error => {
  console.error('Fatal scheduler error:', error);
  process.exit(1);
});