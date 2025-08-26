/**
 * Test Script for Scraping Pipeline
 * Tests the sequential job processing pipeline
 */

require('dotenv').config({ path: '.env.local' });

async function testPipeline() {
  console.log('🧪 Testing Scraping Pipeline\n');
  console.log('=' .repeat(50));

  // Test configuration
  const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
  const TEST_SEARCH_TERM = 'SDR Manager'; // Using one of your 33 search terms

  try {
    // Step 1: Check system status
    console.log('\n1️⃣ Checking system status...');
    const statusResponse = await fetch(`${API_URL}/api/scrape/status`);
    const status = await statusResponse.json();
    
    console.log('   ✅ System status retrieved:');
    console.log(`   - Search terms configured: ${status.stats?.totalSearchTerms || 0}`);
    console.log(`   - Companies identified: ${status.stats?.companiesIdentified || 0}`);
    console.log(`   - Active search terms: ${status.stats?.activeSearchTerms || 0}`);

    // Step 2: Test single search term processing
    console.log(`\n2️⃣ Testing single search term: "${TEST_SEARCH_TERM}"`);
    console.log('   ⚠️  This will scrape up to 500 jobs from LinkedIn');
    console.log('   ⏰ Estimated time: 8-10 minutes\n');

    // Confirm before proceeding
    console.log('   Starting test in 5 seconds... (Ctrl+C to cancel)');
    await delay(5000);

    console.log('   📥 Triggering scrape...');
    const scrapeResponse = await fetch(`${API_URL}/api/scrape/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ searchTerm: TEST_SEARCH_TERM })
    });

    if (!scrapeResponse.ok) {
      const error = await scrapeResponse.json();
      throw new Error(`Scraping failed: ${error.error}`);
    }

    const result = await scrapeResponse.json();
    
    console.log('\n   ✅ Scraping completed!');
    console.log('   📊 Results:');
    console.log(`      - Total scraped: ${result.stats.totalScraped} jobs`);
    console.log(`      - New jobs found: ${result.stats.newJobs}`);
    console.log(`      - Successfully analyzed: ${result.stats.analyzed}`);
    console.log(`      - Failed: ${result.stats.failed}`);
    console.log(`      - Duration: ${result.stats.duration} seconds`);

    // Step 3: Verify data was saved
    console.log('\n3️⃣ Verifying data persistence...');
    const finalStatusResponse = await fetch(`${API_URL}/api/scrape/status`);
    const finalStatus = await finalStatusResponse.json();
    
    console.log('   ✅ Updated stats:');
    console.log(`   - Companies identified: ${finalStatus.stats.companiesIdentified}`);
    
    if (finalStatus.stats.lastScrapedTerm) {
      console.log(`   - Last scraped: ${finalStatus.stats.lastScrapedTerm.term}`);
      console.log(`   - Last scrape date: ${new Date(finalStatus.stats.lastScrapedTerm.date).toLocaleString()}`);
    }

    console.log('\n' + '=' .repeat(50));
    console.log('✅ Pipeline test completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Check the dashboard for new companies');
    console.log('2. Review the companies table for detected tools');
    console.log('3. Test the weekly batch processing with all 33 terms');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the test
console.log('🚀 Sales Tool Detector - Pipeline Test');
console.log('=' .repeat(50));
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('API URL:', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001');
console.log('OpenAI Model:', process.env.OPENAI_MODEL);
console.log('Apify Token:', process.env.APIFY_TOKEN ? '✅ Set' : '❌ Missing');
console.log('=' .repeat(50));

testPipeline().catch(console.error);