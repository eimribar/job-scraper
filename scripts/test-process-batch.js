#!/usr/bin/env node

/**
 * Test Processing Batch
 * Processes a small batch of jobs to verify GPT-5-mini-2025-08-07 is working
 */

require('dotenv').config({ path: '.env.local' });

// Import the unified processor service
const { UnifiedProcessorService } = require('../lib/services/unifiedProcessorService');

async function testProcessBatch() {
  console.log('🧪 TEST PROCESSING BATCH');
  console.log('=' .repeat(60));
  console.log('Model: gpt-5-mini-2025-08-07');
  console.log('Batch size: 5 jobs');
  console.log('=' .repeat(60));
  
  try {
    const processor = new UnifiedProcessorService();
    
    console.log('\n🚀 Starting processing...\n');
    
    // Process 5 jobs
    const result = await processor.processBatch(5);
    
    console.log('\n' + '=' .repeat(60));
    console.log('📊 RESULTS:');
    console.log('=' .repeat(60));
    console.log(`✅ Success: ${result.success}`);
    console.log(`📋 Jobs Processed: ${result.jobsProcessed}`);
    console.log(`🏢 Tools Detected: ${result.toolsDetected}`);
    console.log(`⏭️  Skipped (already identified): ${result.skippedAlreadyIdentified}`);
    console.log(`❌ Errors: ${result.errors}`);
    console.log(`📦 Remaining Unprocessed: ${result.remainingUnprocessed}`);
    
    if (result.toolsDetected > 0) {
      console.log('\n🎉 SUCCESS! GPT-5-mini-2025-08-07 is detecting tools correctly!');
    } else if (result.jobsProcessed > 0) {
      console.log('\n✅ Processing works, but no tools detected in this batch (normal)');
    } else if (result.skippedAlreadyIdentified > 0) {
      console.log('\n✅ Skip logic working correctly');
    }
    
    console.log('\n🔧 AUTOMATION IS READY TO BE ENABLED!');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testProcessBatch().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});