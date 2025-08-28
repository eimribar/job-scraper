/**
 * Production Monitoring Script
 * Checks system health and performance
 */

require('dotenv').config({ path: '.env.local' });

const PRODUCTION_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://sales-tool-detector.vercel.app';
const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL;

async function checkSystemHealth() {
  console.log('🏥 Production Health Check');
  console.log('=' .repeat(40));
  console.log('URL:', PRODUCTION_URL);
  console.log('Time:', new Date().toISOString());
  
  const results = {
    timestamp: new Date().toISOString(),
    url: PRODUCTION_URL,
    checks: {}
  };

  // Test 1: API Connectivity
  try {
    console.log('\n🔌 Testing API connectivity...');
    const response = await fetch(`${PRODUCTION_URL}/api/test`);
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ API: Connected');
      console.log(`   - Search Terms: ${data.data.searchTermsCount}`);
      console.log(`   - Companies: ${data.data.companiesCount}`);
      results.checks.api = { status: 'healthy', data };
    } else {
      throw new Error('API returned error');
    }
  } catch (error) {
    console.log('❌ API: Failed');
    console.log('   Error:', error.message);
    results.checks.api = { status: 'failed', error: error.message };
  }

  // Test 2: Scraping Status
  try {
    console.log('\n📊 Checking scraping status...');
    const response = await fetch(`${PRODUCTION_URL}/api/scrape/status`);
    const data = await response.json();
    
    console.log('✅ Scraping Status: Available');
    console.log(`   - Total Search Terms: ${data.stats.totalSearchTerms}`);
    console.log(`   - Active Terms: ${data.stats.activeSearchTerms}`);
    console.log(`   - Companies Found: ${data.stats.companiesIdentified}`);
    
    if (data.stats.lastScrapedTerm) {
      console.log(`   - Last Scraped: ${data.stats.lastScrapedTerm.term}`);
      console.log(`   - Last Date: ${new Date(data.stats.lastScrapedTerm.date).toLocaleString()}`);
    }
    
    results.checks.scraping = { status: 'healthy', data };
  } catch (error) {
    console.log('❌ Scraping Status: Failed');
    console.log('   Error:', error.message);
    results.checks.scraping = { status: 'failed', error: error.message };
  }

  // Test 3: Weekly Scheduler Status
  try {
    console.log('\n⏰ Checking scheduler status...');
    const response = await fetch(`${PRODUCTION_URL}/api/scrape/weekly`);
    const data = await response.json();
    
    console.log('✅ Scheduler: Available');
    if (data.currentRun) {
      console.log(`   - Current Run: ${data.currentRun.status}`);
      console.log(`   - Started: ${new Date(data.currentRun.startTime).toLocaleString()}`);
    } else {
      console.log('   - Status: Idle');
    }
    
    results.checks.scheduler = { status: 'healthy', data };
  } catch (error) {
    console.log('❌ Scheduler: Failed');
    console.log('   Error:', error.message);
    results.checks.scheduler = { status: 'failed', error: error.message };
  }

  // Test 4: Cron Endpoint
  try {
    console.log('\n🕐 Checking cron endpoint...');
    const response = await fetch(`${PRODUCTION_URL}/api/cron/weekly`);
    const data = await response.json();
    
    console.log('✅ Cron Endpoint: Available');
    console.log(`   - Message: ${data.message}`);
    console.log(`   - Schedule: ${data.nextSchedule}`);
    
    results.checks.cron = { status: 'healthy', data };
  } catch (error) {
    console.log('❌ Cron Endpoint: Failed');
    console.log('   Error:', error.message);
    results.checks.cron = { status: 'failed', error: error.message };
  }

  // Summary
  const healthyChecks = Object.values(results.checks).filter(c => c.status === 'healthy').length;
  const totalChecks = Object.keys(results.checks).length;
  
  console.log('\n' + '=' .repeat(40));
  console.log('📋 HEALTH SUMMARY');
  console.log('=' .repeat(40));
  console.log(`Overall Health: ${healthyChecks}/${totalChecks} checks passed`);
  
  if (healthyChecks === totalChecks) {
    console.log('🟢 System Status: HEALTHY');
    results.overall = 'healthy';
  } else if (healthyChecks > 0) {
    console.log('🟡 System Status: PARTIAL');
    results.overall = 'partial';
  } else {
    console.log('🔴 System Status: UNHEALTHY');
    results.overall = 'unhealthy';
  }

  // Send to Slack if webhook is configured
  if (SLACK_WEBHOOK && results.overall !== 'healthy') {
    await sendSlackAlert(results);
  }

  return results;
}

async function sendSlackAlert(results) {
  try {
    const message = {
      text: `🚨 Sales Tool Detector Health Alert`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Sales Tool Detector Health Alert*\n\n*Status:* ${results.overall.toUpperCase()}\n*Time:* ${results.timestamp}\n*URL:* ${results.url}`
          }
        },
        {
          type: 'section',
          fields: Object.entries(results.checks).map(([name, check]) => ({
            type: 'mrkdwn',
            text: `*${name}:* ${check.status === 'healthy' ? '✅' : '❌'} ${check.status}`
          }))
        }
      ]
    };

    await fetch(SLACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });

    console.log('📢 Slack alert sent');
  } catch (error) {
    console.error('Failed to send Slack alert:', error);
  }
}

// Export for use in other scripts
module.exports = { checkSystemHealth };

// Run if called directly
if (require.main === module) {
  checkSystemHealth().catch(console.error);
}