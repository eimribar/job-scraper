/**
 * Small Batch Test - Verify the pipeline works with 5-10 jobs
 */

require('dotenv').config({ path: '.env.local' });

async function testSmallBatch() {
  console.log('🧪 Testing Small Batch (5 jobs)\n');
  
  const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
  
  try {
    console.log('📥 Triggering scrape for 5 jobs...');
    const response = await fetch(`${API_URL}/api/scrape/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        searchTerm: 'SDR Manager', 
        maxItems: 5  // Small batch for quick testing
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Scraping failed: ${error.error}`);
    }

    const result = await response.json();
    
    console.log('\n✅ Test completed successfully!');
    console.log('📊 Results:');
    console.log(`   - Total scraped: ${result.stats.totalScraped} jobs`);
    console.log(`   - New jobs found: ${result.stats.newJobs}`);
    console.log(`   - Successfully analyzed: ${result.stats.analyzed}`);
    console.log(`   - Failed: ${result.stats.failed}`);
    console.log(`   - Duration: ${result.stats.duration} seconds`);
    
    if (result.companiesFound && result.companiesFound.length > 0) {
      console.log(`\n🏢 Companies using sales tools:`);
      result.companiesFound.forEach(company => {
        console.log(`   - ${company.name}: ${company.tool}`);
      });
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

console.log('🚀 Sales Tool Detector - Small Batch Test');
console.log('=' .repeat(50));
testSmallBatch().catch(console.error);