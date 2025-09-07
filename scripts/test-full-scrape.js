#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });

async function testFullScrape() {
  console.log('Testing full scraping flow with proper error handling...\n');
  
  // Import after dotenv is loaded
  const { JobProcessor } = require('../lib/services/jobProcessor');
  const { createApiSupabaseClient } = require('../lib/supabase');
  
  const jobProcessor = new JobProcessor();
  const supabase = createApiSupabaseClient();
  
  try {
    // First, create a notification that scraping is starting
    console.log('📝 Creating start notification...');
    await supabase
      .from('notifications')
      .insert({
        type: 'scraping_started',
        title: 'Started scraping: Test Run',
        message: 'Manual test of scraping system with 5-minute timeout',
        metadata: {}
      });
    
    // Process a search term with just 5 jobs for testing
    console.log('\n🚀 Starting scrape for "SDR Director" (limited to 5 jobs)...');
    console.log('This may take 1-5 minutes for Apify to complete.\n');
    
    const startTime = Date.now();
    const result = await jobProcessor.processSearchTerm('SDR Director', 5);
    const duration = (Date.now() - startTime) / 1000;
    
    console.log('\n✅ Scraping completed successfully!');
    console.log(`Duration: ${Math.round(duration)} seconds (${Math.round(duration/60)} minutes)`);
    console.log('\nResults:');
    console.log(`- Jobs scraped: ${result.totalScraped}`);
    console.log(`- New jobs: ${result.newJobs}`);
    console.log(`- Jobs saved: ${result.analyzed}`);
    console.log(`- Failed: ${result.failed}`);
    
    // Create success notification
    await supabase
      .from('notifications')
      .insert({
        type: 'scraping_complete',
        title: 'Completed: Test Run',
        message: `Scraped ${result.totalScraped} jobs, found ${result.newJobs} new jobs`,
        metadata: {
          search_term: 'SDR Director',
          jobs_scraped: result.totalScraped,
          new_jobs: result.newJobs,
          duration_seconds: Math.round(duration)
        }
      });
    
    console.log('\n📝 Notifications created successfully');
    console.log('Check the Live Activity feed in the dashboard to see them!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    // Create error notification
    await supabase
      .from('notifications')
      .insert({
        type: 'error',
        title: 'Scraping failed: Test Run',
        message: error.message,
        metadata: {}
      });
    
    if (error.message.includes('timeout')) {
      console.log('\nNote: The 5-minute timeout may still be too short for Apify.');
      console.log('Check your Apify dashboard to see if runs are completing.');
    }
  }
  
  process.exit(0);
}

testFullScrape();