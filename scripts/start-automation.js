/**
 * MASTER AUTOMATION STARTER
 * Starts all background services for complete automation
 */

require('dotenv').config({ path: '.env.local' });
const { spawn } = require('child_process');

const processes = [];

function startService(name, script, description) {
  console.log(`🚀 Starting ${name}...`);
  console.log(`   ${description}`);
  
  const process = spawn('node', [script], {
    cwd: process.cwd(),
    stdio: 'pipe',
    env: process.env
  });
  
  process.stdout.on('data', (data) => {
    console.log(`[${name}] ${data.toString().trim()}`);
  });
  
  process.stderr.on('data', (data) => {
    console.error(`[${name}] ERROR: ${data.toString().trim()}`);
  });
  
  process.on('close', (code) => {
    console.log(`[${name}] Process exited with code ${code}`);
    if (code !== 0) {
      console.log(`[${name}] Restarting in 5 seconds...`);
      setTimeout(() => startService(name, script, description), 5000);
    }
  });
  
  process.on('error', (error) => {
    console.error(`[${name}] Failed to start: ${error.message}`);
  });
  
  processes.push({ name, process });
  console.log(`✅ ${name} started (PID: ${process.pid})\\n`);
}

function startAllServices() {
  console.log('🤖 SALES TOOL DETECTOR - COMPLETE AUTOMATION');
  console.log('=' .repeat(60));
  console.log('Starting all background services...');
  console.log('Press Ctrl+C to stop all services\\n');
  
  // 1. Continuous Analysis Worker (processes jobs as they arrive)
  startService(
    'ANALYZER', 
    'scripts/continuous-analysis.js',
    'Continuously analyzes jobs with GPT-5-mini'
  );
  
  // 2. Weekly Scraping Scheduler (scrapes all search terms weekly)  
  startService(
    'SCRAPER',
    'scripts/weekly-scraper.js', 
    'Automatically scrapes LinkedIn jobs weekly'
  );
  
  console.log('🎯 ALL SERVICES STARTED');
  console.log('=' .repeat(60));
  console.log('Your Sales Tool Detector is now fully automated:');
  console.log('• Jobs will be scraped weekly for all 37 search terms');
  console.log('• New jobs will be analyzed immediately with GPT-5-mini');
  console.log('• Companies using Outreach.io/SalesLoft will be detected');
  console.log('• Dashboard will update in real-time');
  console.log('• Everything runs 24/7 without intervention');
  console.log('\\n👀 Monitor the logs above for activity...');
}

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\\n\\n🛑 SHUTTING DOWN ALL SERVICES...');
  console.log('=' .repeat(60));
  
  processes.forEach(({ name, process }) => {
    console.log(`Stopping ${name}...`);
    process.kill('SIGINT');
  });
  
  setTimeout(() => {
    console.log('\\n✅ All services stopped');
    console.log('Sales Tool Detector automation is now offline');
    process.exit(0);
  }, 3000);
});

// Start everything
startAllServices();