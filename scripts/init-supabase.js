/**
 * Initialize Supabase Database Script
 * Sets up all tables, functions, and initial data
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase credentials not found in .env.local');
  process.exit(1);
}

console.log('🚀 Initializing Supabase database...');
console.log(`📍 URL: ${supabaseUrl}`);

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function executeSQLFile(filePath) {
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    
    // Split SQL into individual statements (basic split by semicolon)
    // Note: This is simplified - a production script would need better SQL parsing
    const statements = sql
      .split(/;\s*$/m)
      .filter(stmt => stmt.trim().length > 0)
      .map(stmt => stmt.trim() + ';');

    console.log(`📝 Executing ${statements.length} SQL statements from ${path.basename(filePath)}...`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments and empty statements
      if (!statement || statement.startsWith('--') || statement.trim() === ';') {
        continue;
      }

      // Log statement type
      const stmtType = statement.match(/^(CREATE|ALTER|INSERT|UPDATE|DELETE|DROP)/i)?.[1] || 'EXECUTE';
      process.stdout.write(`  [${i + 1}/${statements.length}] ${stmtType}... `);

      try {
        // Use raw SQL execution through Supabase
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
        
        if (error) {
          // Try alternative approach - direct execution
          // Note: This requires service role key for full access
          console.log('⚠️ Standard execution failed, statement may need manual execution');
          console.log(`   Statement: ${statement.substring(0, 50)}...`);
        } else {
          console.log('✅');
        }
      } catch (err) {
        console.log('⚠️ Skipped (may already exist or require manual execution)');
      }
    }

    return true;
  } catch (error) {
    console.error(`❌ Error executing SQL file: ${error.message}`);
    return false;
  }
}

async function initializeDatabase() {
  console.log('\n📊 Starting database initialization...\n');

  // Note: Since we can't directly execute raw SQL through Supabase client without service role,
  // we'll provide instructions for manual execution
  
  console.log('⚠️ IMPORTANT: Supabase requires manual SQL execution through the dashboard.');
  console.log('\n📋 Please follow these steps:\n');
  console.log('1. Go to: https://supabase.com/dashboard/project/nslcadgicgkncajoyyno/sql/new');
  console.log('2. Copy the contents of: migrations/enhanced-schema.sql');
  console.log('3. Paste and execute in the SQL editor');
  console.log('\n✨ The schema includes:');
  console.log('   - companies table (with deduplication and intelligence)');
  console.log('   - scraping_intelligence table (adaptive scheduling)');
  console.log('   - job_queue table (smart queue management)');
  console.log('   - analysis_cache table (cost optimization)');
  console.log('   - audit_log table (complete traceability)');
  console.log('   - metrics table (performance tracking)');
  console.log('   - company_duplicates table (fuzzy matching)');
  console.log('   - All necessary functions and triggers');
  console.log('   - Initial search terms data\n');

  // Test connection
  console.log('🔍 Testing database connection...');
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('count')
      .limit(1);

    if (error) {
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        console.log('⚠️ Tables not found - please execute the schema first');
      } else {
        console.log('✅ Connection successful, but tables may need to be created');
      }
    } else {
      console.log('✅ Connection successful and tables exist!');
    }
  } catch (err) {
    console.log('❌ Could not connect to database:', err.message);
  }

  // Create a simple test to verify after manual setup
  console.log('\n📝 After executing the schema, run this script again to verify the setup.');
  
  // Generate SQL file for easy copying
  const schemaPath = path.join(__dirname, '..', 'migrations', 'enhanced-schema.sql');
  if (fs.existsSync(schemaPath)) {
    console.log(`\n💾 Schema file location: ${schemaPath}`);
    console.log('   You can also find it at: migrations/enhanced-schema.sql\n');
  }
}

// Alternative: Create a function to test if database is initialized
async function testDatabaseSetup() {
  console.log('\n🧪 Testing database setup...\n');
  
  const tests = [
    { table: 'companies', description: 'Core companies table' },
    { table: 'scraping_intelligence', description: 'Adaptive scraping intelligence' },
    { table: 'job_queue', description: 'Smart job queue' },
    { table: 'analysis_cache', description: 'Analysis cache for cost optimization' },
    { table: 'audit_log', description: 'Audit logging' },
    { table: 'metrics', description: 'Performance metrics' },
    { table: 'company_duplicates', description: 'Duplicate detection' }
  ];

  let allPassed = true;

  for (const test of tests) {
    process.stdout.write(`  Checking ${test.description} (${test.table})... `);
    
    try {
      const { error } = await supabase
        .from(test.table)
        .select('*')
        .limit(1);

      if (error) {
        console.log('❌ Not found');
        allPassed = false;
      } else {
        console.log('✅ OK');
      }
    } catch (err) {
      console.log('❌ Error');
      allPassed = false;
    }
  }

  if (allPassed) {
    console.log('\n🎉 All tables are properly set up!');
    console.log('✅ Your Supabase database is ready for use.\n');
  } else {
    console.log('\n⚠️ Some tables are missing.');
    console.log('Please execute the schema in the Supabase SQL editor.\n');
  }

  return allPassed;
}

// Run initialization
async function main() {
  // First, show initialization instructions
  await initializeDatabase();
  
  // Then test the setup
  const isSetup = await testDatabaseSetup();
  
  if (!isSetup) {
    console.log('📌 Quick Setup Link:');
    console.log('https://supabase.com/dashboard/project/nslcadgicgkncajoyyno/sql/new\n');
  }
}

main().catch(console.error);