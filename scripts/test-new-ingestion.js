/**
 * Test the new ingestion pipeline
 * This saves ALL jobs without any deduplication
 */

require('dotenv').config({ path: '.env.local' });

// Import the new service
const { JobIngestionService } = require('../lib/services/jobIngestionService.ts');

async function testNewIngestion() {
  console.log('🧪 TESTING NEW INGESTION PIPELINE\n');
  console.log('This will scrape and save ALL jobs without deduplication');
  console.log('=' .repeat(60));
  
  const ingestionService = new JobIngestionService();
  
  try {
    // Step 1: Check current stats before ingestion
    console.log('\n📊 Current Database Stats:');
    const statsBefore = await ingestionService.getIngestionStats();
    console.log(`  Total ingested jobs: ${statsBefore.totalIngested}`);
    console.log(`  Awaiting deduplication: ${statsBefore.awaitingDeduplication}`);
    
    if (statsBefore.recentRuns.length > 0) {
      console.log(`  Recent runs:`);
      statsBefore.recentRuns.forEach(run => {
        console.log(`    - ${run.runId.substring(0, 8)}... | ${run.searchTerm}`);
      });
    }
    
    // Step 2: Run ingestion for SDR search term
    console.log('\n🚀 Starting ingestion for "SDR" search term...');
    console.log('  This will scrape up to 500 jobs from LinkedIn');
    console.log('  Estimated time: 2-3 minutes\n');
    
    // Countdown
    for (let i = 5; i > 0; i--) {
      process.stdout.write(`  Starting in ${i} seconds... (Ctrl+C to cancel)\r`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log('  Starting now!                                    \n');
    
    // Run the ingestion
    const result = await ingestionService.ingestJobs('SDR', 500);
    
    // Step 3: Verify results
    console.log('\n\n✅ INGESTION COMPLETE!\n');
    console.log('Results:');
    console.log(`  Run ID: ${result.runId}`);
    console.log(`  Jobs scraped: ${result.totalScraped}`);
    console.log(`  Jobs saved: ${result.savedToDatabase}`);
    console.log(`  Failed: ${result.failed}`);
    
    if (result.savedToDatabase === result.totalScraped) {
      console.log('\n🎉 SUCCESS! All jobs were saved to the database!');
      console.log('No jobs were lost in the ingestion process.');
    } else {
      console.log(`\n⚠️  WARNING: ${result.totalScraped - result.savedToDatabase} jobs were not saved`);
    }
    
    // Step 4: Check stats after ingestion
    console.log('\n📊 Updated Database Stats:');
    const statsAfter = await ingestionService.getIngestionStats();
    console.log(`  Total ingested jobs: ${statsAfter.totalIngested}`);
    console.log(`  New jobs added: ${statsAfter.totalIngested - statsBefore.totalIngested}`);
    console.log(`  Awaiting deduplication: ${statsAfter.awaitingDeduplication}`);
    
    // Step 5: Next steps
    console.log('\n📋 NEXT STEPS:');
    console.log('1. Run deduplication service to identify duplicates');
    console.log('2. Mark non-duplicates as ready_for_analysis');
    console.log('3. Start continuous analysis service');
    console.log(`4. Monitor progress with run ID: ${result.runId}`);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
console.log('🚀 Sales Tool Detector - New Ingestion Pipeline Test');
console.log('=' .repeat(60));
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('Apify Token:', process.env.APIFY_TOKEN ? '✅ Set' : '❌ Missing');
console.log('=' .repeat(60));

testNewIngestion().catch(console.error);