#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });

async function testFullPipeline() {
  console.log('🧪 Testing Full End-to-End Pipeline\n');
  console.log('This will:');
  console.log('1. Scrape 3 jobs from LinkedIn');
  console.log('2. Save them to the database');
  console.log('3. Analyze them with GPT-5');
  console.log('4. Identify companies using Outreach/SalesLoft');
  console.log('5. Create notifications for live activity feed\n');
  
  // Import after dotenv is loaded
  const { JobProcessor } = require('../lib/services/jobProcessor');
  const { createApiSupabaseClient } = require('../lib/supabase');
  
  const jobProcessor = new JobProcessor();
  const supabase = createApiSupabaseClient();
  
  try {
    // Clear any test notifications first
    console.log('🧹 Clearing old test notifications...');
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await supabase
      .from('notifications')
      .delete()
      .lt('created_at', tenMinutesAgo);
    
    // Start the full pipeline
    console.log('\n🚀 Starting full pipeline test...\n');
    const startTime = Date.now();
    
    // Process with just 3 jobs for quick testing
    const result = await jobProcessor.processSearchTerm('Sales Development Representative', 3);
    
    const duration = (Date.now() - startTime) / 1000;
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ PIPELINE TEST COMPLETE');
    console.log('='.repeat(60));
    console.log(`Duration: ${Math.round(duration)} seconds (${Math.round(duration/60)} minutes)`);
    console.log('\nResults:');
    console.log(`- Jobs scraped: ${result.totalScraped}`);
    console.log(`- New jobs: ${result.newJobs}`);
    console.log(`- Jobs analyzed: ${result.jobsAnalyzed || 0}`);
    console.log(`- Companies found: ${result.companiesFound || 0}`);
    console.log(`- Outreach users: ${result.outreachCompanies || 0}`);
    console.log(`- SalesLoft users: ${result.salesloftCompanies || 0}`);
    
    // Check notifications
    console.log('\n📬 Checking notifications...');
    const { data: notifications } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (notifications && notifications.length > 0) {
      console.log(`Found ${notifications.length} recent notifications:`);
      notifications.forEach(n => {
        console.log(`  - ${n.type}: ${n.title}`);
      });
    }
    
    // Verify data in database
    console.log('\n📊 Verifying database...');
    const { count: totalCompanies } = await supabase
      .from('identified_companies')
      .select('*', { count: 'exact', head: true });
    
    const { count: unprocessedJobs } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('processed', false);
    
    console.log(`- Total companies in database: ${totalCompanies}`);
    console.log(`- Unprocessed jobs remaining: ${unprocessedJobs}`);
    
    console.log('\n✨ Pipeline test successful!');
    console.log('Check the dashboard at http://localhost:4001 to see:');
    console.log('- Live activity feed with notifications');
    console.log('- Updated company counts');
    console.log('- Processing statistics');
    
  } catch (error) {
    console.error('\n❌ Pipeline test failed:', error.message);
    console.error('\nError details:', error);
  }
  
  process.exit(0);
}

testFullPipeline();