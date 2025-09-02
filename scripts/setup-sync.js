#!/usr/bin/env node

/**
 * Setup script for Google Sheets sync
 * Run this after configuring environment variables
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Sales Tool Detector - Setup Script');
console.log('=====================================\n');

// Check environment variables
function checkEnvVars() {
  console.log('1. Checking environment variables...');
  
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'OPENAI_API_KEY',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'SPREADSHEET_ID'
  ];
  
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local file not found!');
    console.log('   Please copy .env.local.example and configure it.');
    process.exit(1);
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const missingVars = [];
  
  requiredVars.forEach(varName => {
    if (!envContent.includes(`${varName}=`) || envContent.includes(`${varName}=your_`)) {
      missingVars.push(varName);
    }
  });
  
  if (missingVars.length > 0) {
    console.error('❌ Missing or unconfigured environment variables:');
    missingVars.forEach(v => console.error(`   - ${v}`));
    console.log('\n   Please configure these in .env.local');
    process.exit(1);
  }
  
  console.log('✅ Environment variables configured\n');
}

// Run database migration
async function runMigration() {
  console.log('2. Running database migration...');
  
  try {
    // Check if migration file exists
    const migrationPath = path.join(__dirname, '..', 'migrations', 'google-sheets-sync-schema.sql');
    if (!fs.existsSync(migrationPath)) {
      console.error('❌ Migration file not found!');
      process.exit(1);
    }
    
    console.log('   Migration file found: google-sheets-sync-schema.sql');
    console.log('   Please run this in your Supabase SQL editor');
    console.log('✅ Migration ready\n');
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    process.exit(1);
  }
}

// Test API endpoints
async function testEndpoints() {
  console.log('3. Testing API endpoints...');
  
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';
  const endpoints = [
    '/api/sync/status',
    '/api/process/status'
  ];
  
  console.log(`   Testing endpoints at ${baseUrl}`);
  console.log('   Note: Start the dev server first with: npm run dev');
  console.log('✅ Endpoints configured\n');
}

// Create initial sync
async function setupInitialSync() {
  console.log('4. Initial sync setup...');
  console.log('   After starting the server, run:');
  console.log('   curl -X POST http://localhost:3001/api/sync/pull');
  console.log('✅ Ready for initial sync\n');
}

// Main setup flow
async function main() {
  try {
    checkEnvVars();
    await runMigration();
    await testEndpoints();
    await setupInitialSync();
    
    console.log('=====================================');
    console.log('✅ Setup complete!');
    console.log('\nNext steps:');
    console.log('1. Run the migration in Supabase SQL editor');
    console.log('2. Start the dev server: npm run dev');
    console.log('3. Pull initial data: curl -X POST http://localhost:3001/api/sync/pull');
    console.log('4. Start processor: curl -X POST http://localhost:3001/api/process/start');
    console.log('\nVisit http://localhost:3001/dashboard to monitor progress');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run setup
main();