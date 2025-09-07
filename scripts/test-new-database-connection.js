#!/usr/bin/env node

/**
 * Test connection to the new Supabase database
 * Verifies that we can connect and lists available tables
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔍 Testing connection to new Supabase database...\n');
console.log('Database URL:', supabaseUrl);
console.log('Project ID:', supabaseUrl?.match(/https:\/\/(.*)\.supabase\.co/)?.[1] || 'unknown');
console.log('Expected: nslcadgicgkncajoyyno\n');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase credentials not found in .env.local');
  console.log('\nPlease update your .env.local file with:');
  console.log('- Your OpenAI API key');
  console.log('- Your Supabase service role key (if needed)');
  process.exit(1);
}

// Verify we're using the new database
if (!supabaseUrl.includes('nslcadgicgkncajoyyno')) {
  console.error('❌ ERROR: Still using old database!');
  console.error('Found URL:', supabaseUrl);
  console.error('Expected: https://nslcadgicgkncajoyyno.supabase.co');
  process.exit(1);
}

console.log('✅ Using correct database (nslcadgicgkncajoyyno)\n');

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  console.log('📊 Testing database tables...\n');
  
  // Tables to test
  const tables = [
    'raw_jobs',
    'identified_companies',
    'processing_queue',
    'sync_status',
    'search_terms'
  ];
  
  let successCount = 0;
  let failureCount = 0;
  
  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`❌ ${table}: Not found or error - ${error.message}`);
        failureCount++;
      } else {
        console.log(`✅ ${table}: Found (${count || 0} records)`);
        successCount++;
      }
    } catch (err) {
      console.log(`❌ ${table}: Connection error - ${err.message}`);
      failureCount++;
    }
  }
  
  console.log('\n📈 Summary:');
  console.log(`- Tables found: ${successCount}/${tables.length}`);
  console.log(`- Tables missing: ${failureCount}/${tables.length}`);
  
  if (successCount === 0) {
    console.log('\n⚠️  No tables found. The database schema needs to be set up.');
    console.log('\n📝 Next steps:');
    console.log('1. Go to: https://supabase.com/dashboard/project/nslcadgicgkncajoyyno/sql/new');
    console.log('2. Execute the migration SQL from migrations/ folder');
    console.log('3. Run this test again to verify');
  } else if (failureCount > 0) {
    console.log('\n⚠️  Some tables are missing. You may need to run migrations.');
  } else {
    console.log('\n🎉 All tables found! Database is properly configured.');
    
    // Get some stats
    try {
      const { count: jobCount } = await supabase
        .from('raw_jobs')
        .select('*', { count: 'exact', head: true });
      
      const { count: companyCount } = await supabase
        .from('identified_companies')
        .select('*', { count: 'exact', head: true });
      
      console.log('\n📊 Current data:');
      console.log(`- Jobs in database: ${jobCount || 0}`);
      console.log(`- Companies identified: ${companyCount || 0}`);
    } catch (err) {
      // Stats are optional
    }
  }
}

testConnection().catch(console.error);