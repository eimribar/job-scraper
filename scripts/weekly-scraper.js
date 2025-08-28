/**
 * WEEKLY SCRAPER - Automatically scrapes all search terms weekly
 * This script runs continuously and triggers scraping for all search terms once per week
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Stats tracking
const stats = {
  startTime: new Date(),
  totalScrapes: 0,
  totalJobsFound: 0,
  lastWeeklyScrape: null,
  isRunning: false
};

async function triggerScrapeForTerm(searchTerm) {
  console.log(`🕷️ Scraping: "${searchTerm}"`);
  
  try {
    // Call the scraping API
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/scrape/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        searchTerm: searchTerm,
        maxJobs: 500  // Maximum jobs per term
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`  ✅ Success: ${result.totalScraped} jobs, ${result.newJobs} new`);
      stats.totalScrapes++;
      stats.totalJobsFound += result.newJobs || 0;
      
      // Update search term stats
      await supabase
        .from('search_terms')
        .update({
          last_scraped_date: new Date().toISOString(),
          jobs_found_count: (await getSearchTermJobCount(searchTerm))
        })
        .eq('search_term', searchTerm);
        
      return { success: true, jobs: result.newJobs || 0 };
    } else {
      console.log(`  ❌ Failed: ${result.error}`);
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function getSearchTermJobCount(searchTerm) {
  const { count } = await supabase
    .from('job_queue')
    .select('*', { count: 'exact', head: true })
    .eq('payload->>search_term', searchTerm);
  
  return count || 0;
}

async function runWeeklyScrape() {
  console.log('🚀 STARTING WEEKLY SCRAPE');
  console.log('=' .repeat(60));
  
  stats.lastWeeklyScrape = new Date();
  
  // Get all active search terms
  const { data: searchTerms } = await supabase
    .from('search_terms')
    .select('search_term')
    .order('search_term');
  
  if (!searchTerms || searchTerms.length === 0) {
    console.log('❌ No search terms configured');
    return;
  }
  
  console.log(`📋 Found ${searchTerms.length} search terms to scrape\\n`);
  
  const results = {
    success: 0,
    failed: 0,
    totalJobs: 0
  };
  
  // Scrape each term sequentially (to avoid overwhelming LinkedIn)
  for (let i = 0; i < searchTerms.length; i++) {
    const term = searchTerms[i];
    console.log(`[${i+1}/${searchTerms.length}] Processing: "${term.search_term}"`);
    
    const result = await triggerScrapeForTerm(term.search_term);
    
    if (result.success) {
      results.success++;
      results.totalJobs += result.jobs;
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
  console.log(`📈 Total new jobs: ${results.totalJobs}`);
  console.log(`⏰ Duration: ${Math.round((Date.now() - stats.lastWeeklyScrape) / 1000)} seconds`);
  console.log('\\nNext weekly scrape in 7 days...\\n');
}

async function checkIfTimeForWeeklyScrape() {
  // Check if it's been a week since last scrape
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  
  // Check when we last scraped any search term (get OLDEST, not newest)
  const { data: lastScrape } = await supabase
    .from('search_terms')
    .select('last_scraped_date')
    .not('last_scraped_date', 'is', null)
    .order('last_scraped_date', { ascending: true })
    .limit(1);
  
  if (!lastScrape || lastScrape.length === 0) {
    console.log('🎯 No previous scrapes found - running first weekly scrape');
    return true;
  }
  
  const lastScrapeDate = new Date(lastScrape[0].last_scraped_date);
  
  if (lastScrapeDate < oneWeekAgo) {
    console.log('🎯 Last scrape was', Math.round((Date.now() - lastScrapeDate) / (1000 * 60 * 60 * 24)), 'days ago - time for weekly scrape');
    return true;
  }
  
  const nextScrape = new Date(lastScrapeDate);
  nextScrape.setDate(nextScrape.getDate() + 7);
  
  console.log('⏳ Next weekly scrape scheduled for:', nextScrape.toLocaleDateString());
  return false;
}

async function runScheduler() {
  console.log('📅 WEEKLY SCRAPING SCHEDULER');
  console.log('=' .repeat(60));
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
  console.log('\\n\\nShutting down weekly scheduler...');
  stats.isRunning = false;
  
  const duration = Math.round((Date.now() - stats.startTime) / 1000);
  console.log('\\n📊 SCHEDULER STATS:');
  console.log('Total scrapes run:', stats.totalScrapes);
  console.log('Total jobs found:', stats.totalJobsFound);
  console.log('Runtime:', Math.round(duration / 60), 'minutes');
  
  process.exit(0);
});

// Start the scheduler
console.log('🚀 Sales Tool Detector - Weekly Scraping Scheduler');
console.log('Version: 1.0');
console.log('Started:', new Date().toLocaleString());
console.log('=' .repeat(60) + '\\n');

runScheduler().catch(error => {
  console.error('Fatal scheduler error:', error);
  process.exit(1);
});