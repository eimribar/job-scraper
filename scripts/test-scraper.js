#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });

const { ScraperService } = require('../lib/services/scraperService');

async function testScraper() {
  console.log('Testing scraper with 5-minute timeout...\n');
  
  const scraper = new ScraperService();
  
  try {
    console.log('Starting scrape for "SDR Director"...');
    console.log('This may take 1-5 minutes based on Apify processing time.\n');
    
    const startTime = Date.now();
    const results = await scraper.scrapeLinkedInJobs('SDR Director', 10); // Just 10 items for testing
    const duration = (Date.now() - startTime) / 1000;
    
    console.log(`\n✅ Scraping completed successfully in ${Math.round(duration)} seconds`);
    console.log(`Found ${results.length} jobs`);
    
    if (results.length > 0) {
      console.log('\nFirst job sample:');
      console.log('- Company:', results[0].company);
      console.log('- Title:', results[0].job_title);
      console.log('- ID:', results[0].job_id);
    }
    
  } catch (error) {
    console.error('\n❌ Scraping failed:', error.message);
    if (error.message.includes('timeout')) {
      console.log('\nNote: If scraping is timing out, the Apify actor might be taking longer than expected.');
      console.log('Check your Apify dashboard to see if the runs are actually completing.');
    }
  }
  
  process.exit(0);
}

testScraper();