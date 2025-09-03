#!/usr/bin/env node

/**
 * System monitoring script for Sales Tool Detector
 * Provides real-time statistics and health checks
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

/**
 * Clear console and move cursor to top
 */
function clearScreen() {
  console.clear();
  process.stdout.write('\x1b[0;0H');
}

/**
 * Format number with commas
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Check database health
 */
async function checkDatabaseHealth() {
  try {
    const start = Date.now();
    const { data, error } = await supabase
      .from('raw_jobs')
      .select('job_id')
      .limit(1);
    
    const latency = Date.now() - start;
    
    if (error) throw error;
    
    return {
      status: 'healthy',
      latency: `${latency}ms`,
      color: colors.green
    };
  } catch (error) {
    return {
      status: 'error',
      latency: 'N/A',
      error: error.message,
      color: colors.red
    };
  }
}

/**
 * Check OpenAI API health
 */
async function checkOpenAIHealth() {
  if (!OPENAI_API_KEY) {
    return {
      status: 'not configured',
      color: colors.yellow
    };
  }
  
  try {
    const start = Date.now();
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      }
    });
    
    const latency = Date.now() - start;
    
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    
    return {
      status: 'healthy',
      latency: `${latency}ms`,
      color: colors.green
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      color: colors.red
    };
  }
}

/**
 * Get database statistics
 */
async function getDatabaseStats() {
  const stats = {};
  
  // Total jobs
  const { count: totalJobs } = await supabase
    .from('raw_jobs')
    .select('*', { count: 'exact', head: true });
  stats.totalJobs = totalJobs || 0;
  
  // Processed jobs
  const { count: processedJobs } = await supabase
    .from('raw_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('processed', true);
  stats.processedJobs = processedJobs || 0;
  
  // Unprocessed jobs
  stats.unprocessedJobs = stats.totalJobs - stats.processedJobs;
  
  // Companies by tool
  const { data: companies } = await supabase
    .from('identified_companies')
    .select('tool_detected');
  
  stats.totalCompanies = companies?.length || 0;
  stats.outreachCompanies = companies?.filter(c => c.tool_detected === 'Outreach.io').length || 0;
  stats.salesloftCompanies = companies?.filter(c => c.tool_detected === 'SalesLoft').length || 0;
  stats.bothToolsCompanies = companies?.filter(c => c.tool_detected === 'Both').length || 0;
  
  // Processing queue
  const { data: queueStats } = await supabase
    .from('processing_queue')
    .select('status');
  
  stats.queuePending = queueStats?.filter(q => q.status === 'pending').length || 0;
  stats.queueProcessing = queueStats?.filter(q => q.status === 'processing').length || 0;
  stats.queueCompleted = queueStats?.filter(q => q.status === 'completed').length || 0;
  stats.queueError = queueStats?.filter(q => q.status === 'error').length || 0;
  
  // Recent activity (last 24 hours)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { count: recentJobs } = await supabase
    .from('raw_jobs')
    .select('*', { count: 'exact', head: true })
    .gte('analyzed_date', yesterday);
  stats.jobsLast24h = recentJobs || 0;
  
  const { count: recentCompanies } = await supabase
    .from('identified_companies')
    .select('*', { count: 'exact', head: true })
    .gte('identified_date', yesterday);
  stats.companiesLast24h = recentCompanies || 0;
  
  return stats;
}

/**
 * Display monitoring dashboard
 */
async function displayDashboard() {
  clearScreen();
  
  console.log(colors.cyan + colors.bright);
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         SALES TOOL DETECTOR - SYSTEM MONITOR v1.0             ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(colors.reset);
  
  // Get current timestamp
  const now = new Date().toLocaleString();
  console.log(`${colors.bright}Last Updated:${colors.reset} ${now}\n`);
  
  // Health checks
  console.log(colors.bright + '📡 SYSTEM HEALTH' + colors.reset);
  console.log('─'.repeat(40));
  
  const dbHealth = await checkDatabaseHealth();
  const apiHealth = await checkOpenAIHealth();
  
  console.log(`Database:    ${dbHealth.color}● ${dbHealth.status}${colors.reset} (${dbHealth.latency})`);
  console.log(`OpenAI API:  ${apiHealth.color}● ${apiHealth.status}${colors.reset} ${apiHealth.latency ? `(${apiHealth.latency})` : ''}`);
  
  // Database statistics
  const stats = await getDatabaseStats();
  
  console.log('\n' + colors.bright + '📊 DATABASE STATISTICS' + colors.reset);
  console.log('─'.repeat(40));
  
  // Jobs
  console.log(colors.yellow + 'Jobs:' + colors.reset);
  console.log(`  Total:        ${formatNumber(stats.totalJobs)}`);
  console.log(`  Processed:    ${formatNumber(stats.processedJobs)} (${Math.round(stats.processedJobs / stats.totalJobs * 100)}%)`);
  console.log(`  Unprocessed:  ${formatNumber(stats.unprocessedJobs)}`);
  
  // Companies
  console.log('\n' + colors.yellow + 'Companies Identified:' + colors.reset);
  console.log(`  Total:        ${formatNumber(stats.totalCompanies)}`);
  console.log(`  Outreach.io:  ${formatNumber(stats.outreachCompanies)} (${Math.round(stats.outreachCompanies / stats.totalCompanies * 100)}%)`);
  console.log(`  SalesLoft:    ${formatNumber(stats.salesloftCompanies)} (${Math.round(stats.salesloftCompanies / stats.totalCompanies * 100)}%)`);
  console.log(`  Both Tools:   ${formatNumber(stats.bothToolsCompanies)}`);
  
  // Processing Queue
  console.log('\n' + colors.yellow + 'Processing Queue:' + colors.reset);
  console.log(`  Pending:      ${formatNumber(stats.queuePending)}`);
  console.log(`  Processing:   ${formatNumber(stats.queueProcessing)}`);
  console.log(`  Completed:    ${formatNumber(stats.queueCompleted)}`);
  console.log(`  Errors:       ${formatNumber(stats.queueError)}`);
  
  // Recent Activity
  console.log('\n' + colors.bright + '⏱️  LAST 24 HOURS' + colors.reset);
  console.log('─'.repeat(40));
  console.log(`Jobs Processed:     ${formatNumber(stats.jobsLast24h)}`);
  console.log(`Companies Found:    ${formatNumber(stats.companiesLast24h)}`);
  
  // Processing rate
  if (stats.jobsLast24h > 0) {
    const rate = (stats.jobsLast24h / 24).toFixed(1);
    console.log(`Average Rate:       ${rate} jobs/hour`);
  }
  
  // Footer
  console.log('\n' + colors.cyan + '─'.repeat(60) + colors.reset);
  console.log(colors.bright + 'Press Ctrl+C to exit. Refreshing every 5 seconds...' + colors.reset);
}

/**
 * Main monitoring loop
 */
async function main() {
  // Initial display
  await displayDashboard();
  
  // Refresh every 5 seconds
  const interval = setInterval(async () => {
    await displayDashboard();
  }, 5000);
  
  // Handle graceful exit
  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log('\n\n' + colors.yellow + 'Monitor stopped.' + colors.reset);
    process.exit(0);
  });
}

// Run monitor
main().catch(error => {
  console.error(colors.red + 'Monitor error:', error.message + colors.reset);
  process.exit(1);
});