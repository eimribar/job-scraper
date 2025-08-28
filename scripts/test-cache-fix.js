#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { ContinuousAnalyzerService } = require('../lib/services/continuousAnalyzerService');

async function testCacheFix() {
  console.log('🧪 TESTING FIXED DEDUPLICATION CACHE');
  console.log('='.repeat(60));
  
  const analyzer = new ContinuousAnalyzerService();
  
  console.log('\n1️⃣ Loading cache from database...');
  await analyzer.refreshCompaniesCache();
  
  const status = analyzer.getStatus();
  console.log(`   ✅ Cache loaded: ${status.cachedCompanies} companies`);
  
  console.log('\n2️⃣ Testing companies from Google Sheets:');
  const googleSheetsCompanies = [
    'Vanta',
    'Paragon', 
    'Dandy',
    'Foley',
    'Asana',
    'Zoom',
    'Canva',
    'MX',
    'Sophos'
  ];
  
  let skipped = 0;
  let notFound = 0;
  
  googleSheetsCompanies.forEach(company => {
    const result = analyzer.isCompanyAlreadyIdentified(company);
    if (result) {
      console.log(`   ✅ ${company}: WILL BE SKIPPED`);
      skipped++;
    } else {
      console.log(`   ❌ ${company}: NOT IN CACHE (will analyze)`);
      notFound++;
    }
  });
  
  console.log('\n3️⃣ Testing recently discovered companies:');
  const recentCompanies = [
    'Reddit',
    'Reddit, Inc.',
    'Moloco',
    'Glean',
    'Udemy'
  ];
  
  recentCompanies.forEach(company => {
    const result = analyzer.isCompanyAlreadyIdentified(company);
    if (result) {
      console.log(`   ✅ ${company}: WILL BE SKIPPED`);
      skipped++;
    } else {
      console.log(`   ❌ ${company}: NOT IN CACHE (will analyze)`);
      notFound++;
    }
  });
  
  console.log('\n📊 SUMMARY:');
  console.log(`   Companies that WILL be skipped: ${skipped}`);
  console.log(`   Companies NOT in cache: ${notFound}`);
  console.log(`   Cache effectiveness: ${Math.round(skipped / (skipped + notFound) * 100)}%`);
  
  if (notFound > 0) {
    console.log('\n⚠️ WARNING: Some companies from Google Sheets are not being cached!');
    console.log('   This means they will be re-analyzed unnecessarily.');
  }
}

testCacheFix().catch(console.error);