#!/usr/bin/env node

/**
 * Test Automation Pipeline
 * Tests each component of the automation system to ensure everything works
 * Date: 2025-09-10
 * Model: gpt-5-mini-2025-08-07 (NEVER CHANGE)
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Test results tracking
const testResults = {
  passed: [],
  failed: [],
  warnings: []
};

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testEnvironmentVariables() {
  log('\n📋 Testing Environment Variables...', 'cyan');
  
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'OPENAI_API_KEY'
  ];
  
  const optional = [
    'APIFY_TOKEN',
    'CRON_SECRET'
  ];
  
  for (const key of required) {
    if (process.env[key]) {
      log(`  ✅ ${key} is set`, 'green');
      testResults.passed.push(`Environment: ${key}`);
    } else {
      log(`  ❌ ${key} is MISSING`, 'red');
      testResults.failed.push(`Environment: ${key} missing`);
    }
  }
  
  for (const key of optional) {
    if (process.env[key]) {
      log(`  ✅ ${key} is set (optional)`, 'green');
    } else {
      log(`  ⚠️  ${key} not set (optional)`, 'yellow');
      testResults.warnings.push(`Optional: ${key} not set`);
    }
  }
}

async function testDatabaseConnection() {
  log('\n🗄️  Testing Database Connection...', 'cyan');
  
  try {
    // Test raw_jobs table
    const { data: rawJobs, error: rawError } = await supabase
      .from('raw_jobs')
      .select('job_id')
      .limit(1);
    
    if (rawError) throw rawError;
    log('  ✅ raw_jobs table accessible', 'green');
    testResults.passed.push('Database: raw_jobs accessible');
    
    // Test identified_companies table
    const { data: companies, error: compError } = await supabase
      .from('identified_companies')
      .select('company')
      .limit(1);
    
    if (compError) throw compError;
    log('  ✅ identified_companies table accessible', 'green');
    testResults.passed.push('Database: identified_companies accessible');
    
    // Test notifications table
    const { data: notifications, error: notifError } = await supabase
      .from('notifications')
      .select('notification_type')
      .limit(1);
    
    if (notifError) throw notifError;
    log('  ✅ notifications table accessible (using notification_type field)', 'green');
    testResults.passed.push('Database: notifications accessible');
    
    // Test search_terms table
    const { data: terms, error: termsError } = await supabase
      .from('search_terms')
      .select('search_term')
      .limit(1);
    
    if (termsError) {
      log('  ⚠️  search_terms table not accessible', 'yellow');
      testResults.warnings.push('Database: search_terms not accessible');
    } else {
      log('  ✅ search_terms table accessible', 'green');
      testResults.passed.push('Database: search_terms accessible');
    }
    
  } catch (error) {
    log(`  ❌ Database error: ${error.message}`, 'red');
    testResults.failed.push(`Database: ${error.message}`);
  }
}

async function testGPTConfiguration() {
  log('\n🤖 Testing GPT-5-mini Configuration...', 'cyan');
  
  try {
    const testJob = {
      company: 'Test Company',
      job_title: 'Sales Development Representative',
      description: 'Looking for SDR with experience in Outreach.io for managing sequences.'
    };
    
    log('  📝 Sending test job to GPT-5-mini-2025-08-07...', 'blue');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-5-mini-2025-08-07', // MUST USE THIS EXACT MODEL
      messages: [
        {
          role: 'system',
          content: `Analyze if the company uses Outreach.io or SalesLoft. Return JSON only:
{
  "uses_tool": true/false,
  "tool_detected": "Outreach.io"/"SalesLoft"/"Both"/"none"
}`
        },
        {
          role: 'user',
          content: `Company: ${testJob.company}\nTitle: ${testJob.job_title}\nDescription: ${testJob.description}`
        }
      ],
      max_completion_tokens: 200
    });
    
    const result = response.choices[0].message.content;
    log(`  📤 Response received: ${result.substring(0, 100)}...`, 'blue');
    
    // Try to parse the response
    const analysis = JSON.parse(result);
    
    if (analysis.uses_tool === true && analysis.tool_detected === 'Outreach.io') {
      log('  ✅ GPT-5-mini-2025-08-07 correctly detected Outreach.io', 'green');
      testResults.passed.push('GPT: Correct detection');
    } else {
      log('  ⚠️  GPT-5-mini detected: ' + JSON.stringify(analysis), 'yellow');
      testResults.warnings.push('GPT: Unexpected detection result');
    }
    
    log(`  ✅ GPT-5-mini-2025-08-07 API working`, 'green');
    testResults.passed.push('GPT: API connection successful');
    
  } catch (error) {
    log(`  ❌ GPT error: ${error.message}`, 'red');
    testResults.failed.push(`GPT: ${error.message}`);
  }
}

async function testProcessingPipeline() {
  log('\n⚙️  Testing Processing Pipeline...', 'cyan');
  
  try {
    // Check for unprocessed jobs
    const { count: unprocessedCount, error: countError } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('processed', false);
    
    if (countError) throw countError;
    
    log(`  📊 Found ${unprocessedCount || 0} unprocessed jobs in backlog`, 'blue');
    
    if (unprocessedCount > 0) {
      testResults.warnings.push(`Pipeline: ${unprocessedCount} jobs in backlog`);
    } else {
      testResults.passed.push('Pipeline: No backlog');
    }
    
    // Test unique constraint
    log('  🔍 Checking unique constraints...', 'blue');
    const { data: constraint } = await supabase.rpc('check_unique_constraint', {
      table_name: 'identified_companies',
      constraint_name: 'unique_company_tool'
    }).single();
    
    if (constraint) {
      log('  ✅ Unique constraint exists on identified_companies', 'green');
      testResults.passed.push('Pipeline: Unique constraint exists');
    } else {
      log('  ⚠️  Unique constraint may not exist', 'yellow');
      testResults.warnings.push('Pipeline: Check unique constraint');
    }
    
  } catch (error) {
    // RPC might not exist, that's ok
    if (error.message.includes('check_unique_constraint')) {
      log('  ℹ️  Cannot verify unique constraint (RPC not available)', 'yellow');
    } else {
      log(`  ❌ Pipeline error: ${error.message}`, 'red');
      testResults.failed.push(`Pipeline: ${error.message}`);
    }
  }
}

async function testAutomationEndpoints() {
  log('\n🌐 Testing Automation Endpoints...', 'cyan');
  
  const endpoints = [
    '/api/health',
    '/api/dashboard/stats',
    '/api/companies'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const url = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4001'}${endpoint}`;
      log(`  🔗 Testing ${endpoint}...`, 'blue');
      
      const response = await fetch(url);
      
      if (response.ok) {
        log(`  ✅ ${endpoint} responded with ${response.status}`, 'green');
        testResults.passed.push(`Endpoint: ${endpoint}`);
      } else {
        log(`  ⚠️  ${endpoint} returned ${response.status}`, 'yellow');
        testResults.warnings.push(`Endpoint: ${endpoint} (${response.status})`);
      }
    } catch (error) {
      log(`  ❌ ${endpoint} failed: ${error.message}`, 'red');
      testResults.failed.push(`Endpoint: ${endpoint}`);
    }
  }
}

async function printSummary() {
  log('\n' + '='.repeat(60), 'cyan');
  log('📊 TEST SUMMARY', 'cyan');
  log('='.repeat(60), 'cyan');
  
  log(`\n✅ PASSED: ${testResults.passed.length}`, 'green');
  testResults.passed.forEach(test => log(`  • ${test}`, 'green'));
  
  if (testResults.warnings.length > 0) {
    log(`\n⚠️  WARNINGS: ${testResults.warnings.length}`, 'yellow');
    testResults.warnings.forEach(test => log(`  • ${test}`, 'yellow'));
  }
  
  if (testResults.failed.length > 0) {
    log(`\n❌ FAILED: ${testResults.failed.length}`, 'red');
    testResults.failed.forEach(test => log(`  • ${test}`, 'red'));
  }
  
  log('\n' + '='.repeat(60), 'cyan');
  
  if (testResults.failed.length === 0) {
    log('🎉 AUTOMATION PIPELINE IS READY!', 'green');
    log('You can safely re-enable the cron jobs.', 'green');
  } else {
    log('⚠️  CRITICAL ISSUES FOUND - DO NOT ENABLE AUTOMATION', 'red');
    log('Fix the failed tests before re-enabling cron jobs.', 'red');
  }
}

async function runTests() {
  log('🔍 AUTOMATION PIPELINE TEST SUITE', 'cyan');
  log('Testing Date: ' + new Date().toISOString(), 'cyan');
  log('Model: gpt-5-mini-2025-08-07 (NEVER CHANGE)', 'cyan');
  log('='.repeat(60), 'cyan');
  
  await testEnvironmentVariables();
  await testDatabaseConnection();
  await testGPTConfiguration();
  await testProcessingPipeline();
  await testAutomationEndpoints();
  await printSummary();
}

// Run the tests
runTests().catch(error => {
  log(`\n❌ FATAL ERROR: ${error.message}`, 'red');
  process.exit(1);
});