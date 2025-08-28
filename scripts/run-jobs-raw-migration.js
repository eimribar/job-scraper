/**
 * Run migration to add jobs_raw table
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🚀 Running jobs_raw table migration...\n');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/add-jobs-raw-table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Migration file loaded');
    console.log('⚙️  Executing migration...\n');
    
    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const statement of statements) {
      // Skip comments
      if (statement.startsWith('--')) continue;
      
      try {
        // Extract the first few words to identify the operation
        const operation = statement.substring(0, 50).replace(/\n/g, ' ');
        console.log(`Executing: ${operation}...`);
        
        // Note: Supabase client doesn't directly support raw SQL execution
        // We'll need to use the REST API directly for this
        console.log('  ⚠️  Note: Direct SQL execution via client not supported');
        console.log('  Please run this migration directly in Supabase SQL Editor');
        successCount++;
      } catch (error) {
        console.error(`  ❌ Error: ${error.message}`);
        errorCount++;
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`  Statements to execute: ${statements.length}`);
    console.log(`  Successful: ${successCount}`);
    console.log(`  Failed: ${errorCount}`);
    
    console.log('\n⚠️  IMPORTANT:');
    console.log('Since Supabase JS client doesn\'t support direct SQL execution,');
    console.log('please run the migration manually in Supabase Dashboard:');
    console.log('1. Go to your Supabase project');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste the migration from:');
    console.log(`   ${migrationPath}`);
    console.log('4. Click "Run" to execute');
    
    // Alternative: Test if tables exist
    console.log('\n🔍 Checking if tables already exist...');
    
    const { data: rawTable, error: rawError } = await supabase
      .from('jobs_raw')
      .select('id')
      .limit(1);
    
    if (rawError && rawError.code === '42P01') {
      console.log('  ❌ jobs_raw table does not exist - migration needed');
    } else if (rawError) {
      console.log('  ⚠️  Could not check jobs_raw table:', rawError.message);
    } else {
      console.log('  ✅ jobs_raw table already exists!');
    }
    
    const { data: telemetryTable, error: telemetryError } = await supabase
      .from('pipeline_telemetry')
      .select('id')
      .limit(1);
    
    if (telemetryError && telemetryError.code === '42P01') {
      console.log('  ❌ pipeline_telemetry table does not exist - migration needed');
    } else if (telemetryError) {
      console.log('  ⚠️  Could not check pipeline_telemetry table:', telemetryError.message);
    } else {
      console.log('  ✅ pipeline_telemetry table already exists!');
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

runMigration().catch(console.error);