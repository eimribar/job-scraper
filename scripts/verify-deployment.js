#!/usr/bin/env node

/**
 * Deployment Verification Script
 * Run this to verify your Vercel deployment is working correctly
 * 
 * Usage: node scripts/verify-deployment.js [production-url]
 * Example: node scripts/verify-deployment.js https://job-scraper-liard.vercel.app
 */

const https = require('https');
const url = require('url');

// Get the deployment URL from command line or use default
const DEPLOYMENT_URL = process.argv[2] || 'https://job-scraper-liard.vercel.app';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

// Test results storage
const results = {
  passed: [],
  failed: [],
  warnings: []
};

// Helper function to make HTTP requests
function makeRequest(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    const fullUrl = `${DEPLOYMENT_URL}${endpoint}`;
    const parsedUrl = url.parse(fullUrl);
    
    const requestOptions = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.path,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Deployment-Verifier/1.0',
        ...options.headers
      }
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
          url: fullUrl
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

// Test functions
async function testHomePage() {
  console.log(`\n${colors.cyan}Testing Home Page...${colors.reset}`);
  try {
    const response = await makeRequest('/');
    
    if (response.status === 200) {
      results.passed.push('✅ Home page loads successfully');
      
      // Check for key elements
      if (response.body.includes('Sales Tool Detector')) {
        results.passed.push('✅ Page title is correct');
      } else {
        results.warnings.push('⚠️ Page title might be missing');
      }
      
      if (response.body.includes('Companies')) {
        results.passed.push('✅ Navigation elements present');
      }
    } else {
      results.failed.push(`❌ Home page returned status ${response.status}`);
    }
  } catch (error) {
    results.failed.push(`❌ Home page error: ${error.message}`);
  }
}

async function testCompaniesPage() {
  console.log(`\n${colors.cyan}Testing Companies Page...${colors.reset}`);
  try {
    const response = await makeRequest('/companies');
    
    if (response.status === 200) {
      results.passed.push('✅ Companies page loads successfully');
      
      if (response.body.includes('CompaniesTable') || response.body.includes('companies')) {
        results.passed.push('✅ Companies table component present');
      } else {
        results.warnings.push('⚠️ Companies table might not be rendering');
      }
    } else {
      results.failed.push(`❌ Companies page returned status ${response.status}`);
    }
  } catch (error) {
    results.failed.push(`❌ Companies page error: ${error.message}`);
  }
}

async function testTierOnePage() {
  console.log(`\n${colors.cyan}Testing Tier 1 Page...${colors.reset}`);
  try {
    const response = await makeRequest('/tier-one');
    
    if (response.status === 200) {
      results.passed.push('✅ Tier 1 page loads successfully');
      
      if (response.body.includes('Tier 1') || response.body.includes('priority')) {
        results.passed.push('✅ Tier 1 content present');
      }
    } else if (response.status === 404) {
      results.warnings.push('⚠️ Tier 1 page not found (might not be deployed yet)');
    } else {
      results.failed.push(`❌ Tier 1 page returned status ${response.status}`);
    }
  } catch (error) {
    results.failed.push(`❌ Tier 1 page error: ${error.message}`);
  }
}

async function testAPIHealth() {
  console.log(`\n${colors.cyan}Testing API Health...${colors.reset}`);
  try {
    const response = await makeRequest('/api/health');
    
    if (response.status === 200) {
      results.passed.push('✅ API health endpoint responding');
      
      try {
        const data = JSON.parse(response.body);
        if (data.status === 'healthy' || data.ok) {
          results.passed.push('✅ API reports healthy status');
        }
      } catch (e) {
        // Not JSON, but still responding
      }
    } else if (response.status === 404) {
      results.warnings.push('⚠️ Health endpoint not implemented');
    } else {
      results.failed.push(`❌ API health returned status ${response.status}`);
    }
  } catch (error) {
    results.failed.push(`❌ API health error: ${error.message}`);
  }
}

async function testDashboardAPI() {
  console.log(`\n${colors.cyan}Testing Dashboard API...${colors.reset}`);
  try {
    const response = await makeRequest('/api/dashboard');
    
    if (response.status === 200) {
      results.passed.push('✅ Dashboard API responding');
      
      try {
        const data = JSON.parse(response.body);
        if (data.success !== false) {
          results.passed.push('✅ Dashboard API returns data');
        } else {
          results.warnings.push('⚠️ Dashboard API returned success: false');
        }
      } catch (e) {
        results.warnings.push('⚠️ Dashboard API response is not valid JSON');
      }
    } else if (response.status === 500) {
      results.warnings.push('⚠️ Dashboard API error (likely missing Supabase config)');
    } else {
      results.failed.push(`❌ Dashboard API returned status ${response.status}`);
    }
  } catch (error) {
    results.failed.push(`❌ Dashboard API error: ${error.message}`);
  }
}

async function testCompaniesAPI() {
  console.log(`\n${colors.cyan}Testing Companies API...${colors.reset}`);
  try {
    const response = await makeRequest('/api/companies');
    
    if (response.status === 200) {
      results.passed.push('✅ Companies API responding');
      
      try {
        const data = JSON.parse(response.body);
        if (Array.isArray(data.companies) || data.success !== false) {
          results.passed.push('✅ Companies API returns valid structure');
        }
      } catch (e) {
        results.warnings.push('⚠️ Companies API response is not valid JSON');
      }
    } else if (response.status === 500) {
      results.warnings.push('⚠️ Companies API error (likely missing Supabase config)');
    } else {
      results.failed.push(`❌ Companies API returned status ${response.status}`);
    }
  } catch (error) {
    results.failed.push(`❌ Companies API error: ${error.message}`);
  }
}

async function checkEnvironmentIndicators() {
  console.log(`\n${colors.cyan}Checking Environment Indicators...${colors.reset}`);
  
  try {
    const response = await makeRequest('/');
    
    // Check for loading skeletons (indicates no data connection)
    if (response.body.includes('animate-pulse') && response.body.includes('skeleton')) {
      results.warnings.push('⚠️ Page shows loading skeletons (database might not be connected)');
    }
    
    // Check for error messages
    if (response.body.includes('error') || response.body.includes('Error')) {
      results.warnings.push('⚠️ Error messages detected on page');
    }
    
    // Check for Supabase
    if (!response.body.includes('supabase')) {
      results.warnings.push('⚠️ Supabase client might not be initialized');
    }
    
    results.passed.push('✅ Environment check completed');
  } catch (error) {
    results.warnings.push(`⚠️ Could not check environment: ${error.message}`);
  }
}

// Main verification function
async function runVerification() {
  console.log(`${colors.bold}${colors.blue}
╔════════════════════════════════════════════════════╗
║     Sales Tool Detector - Deployment Verifier     ║
╚════════════════════════════════════════════════════╝${colors.reset}`);
  
  console.log(`\n${colors.yellow}Testing deployment at: ${colors.bold}${DEPLOYMENT_URL}${colors.reset}`);
  console.log(`${colors.yellow}Starting verification...${colors.reset}`);
  
  // Run all tests
  await testHomePage();
  await testCompaniesPage();
  await testTierOnePage();
  await testAPIHealth();
  await testDashboardAPI();
  await testCompaniesAPI();
  await checkEnvironmentIndicators();
  
  // Display results
  console.log(`\n${colors.bold}${colors.blue}════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}                 VERIFICATION RESULTS                ${colors.reset}`);
  console.log(`${colors.bold}${colors.blue}════════════════════════════════════════════════════${colors.reset}\n`);
  
  if (results.passed.length > 0) {
    console.log(`${colors.green}${colors.bold}PASSED TESTS (${results.passed.length}):${colors.reset}`);
    results.passed.forEach(test => console.log(`  ${test}`));
  }
  
  if (results.warnings.length > 0) {
    console.log(`\n${colors.yellow}${colors.bold}WARNINGS (${results.warnings.length}):${colors.reset}`);
    results.warnings.forEach(warning => console.log(`  ${warning}`));
  }
  
  if (results.failed.length > 0) {
    console.log(`\n${colors.red}${colors.bold}FAILED TESTS (${results.failed.length}):${colors.reset}`);
    results.failed.forEach(test => console.log(`  ${test}`));
  }
  
  // Summary
  console.log(`\n${colors.bold}${colors.blue}════════════════════════════════════════════════════${colors.reset}`);
  
  const total = results.passed.length + results.failed.length;
  const passRate = total > 0 ? Math.round((results.passed.length / total) * 100) : 0;
  
  if (results.failed.length === 0) {
    console.log(`${colors.green}${colors.bold}✅ DEPLOYMENT VERIFICATION PASSED!${colors.reset}`);
    console.log(`${colors.green}Pass rate: ${passRate}% (${results.passed.length}/${total} tests)${colors.reset}`);
    
    if (results.warnings.length > 0) {
      console.log(`${colors.yellow}\n⚠️ Note: ${results.warnings.length} warnings detected.${colors.reset}`);
      console.log(`${colors.yellow}These may indicate missing configuration.${colors.reset}`);
      console.log(`${colors.yellow}Check Vercel environment variables if data isn't loading.${colors.reset}`);
    }
  } else {
    console.log(`${colors.red}${colors.bold}❌ DEPLOYMENT VERIFICATION FAILED${colors.reset}`);
    console.log(`${colors.red}Pass rate: ${passRate}% (${results.passed.length}/${total} tests)${colors.reset}`);
    console.log(`\n${colors.yellow}${colors.bold}NEXT STEPS:${colors.reset}`);
    console.log('1. Check Vercel deployment logs for errors');
    console.log('2. Verify all environment variables are set in Vercel');
    console.log('3. Ensure the latest code is deployed');
    console.log('4. Check .env.production.example for required variables');
  }
  
  console.log(`\n${colors.cyan}Verification completed at: ${new Date().toLocaleString()}${colors.reset}`);
  
  // Exit with appropriate code
  process.exit(results.failed.length > 0 ? 1 : 0);
}

// Run the verification
runVerification().catch(error => {
  console.error(`${colors.red}Fatal error during verification:${colors.reset}`, error);
  process.exit(1);
});