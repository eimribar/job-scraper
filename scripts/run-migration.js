#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function runMigration() {
  console.log('🔄 Starting database migration...');
  
  // Check if environment variables are set
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Read the schema file
    const schemaPath = path.join(__dirname, '..', 'supabase-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📋 Reading schema from:', schemaPath);
    
    // Split the schema into individual statements
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📊 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      console.log(`  [${i + 1}/${statements.length}] Executing statement...`);
      
      try {
        // Use Supabase's SQL execution via RPC or direct query
        const { data, error } = await supabase.rpc('exec_sql', { 
          sql: statement 
        }).catch(async (rpcError) => {
          // If RPC doesn't exist, try direct execution via REST API
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`,
            {
              method: 'POST',
              headers: {
                'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ sql: statement })
            }
          );
          
          if (!response.ok) {
            // If direct SQL execution is not available, we'll need to handle this differently
            console.warn('    ⚠️  Direct SQL execution not available, skipping statement');
            return { data: null, error: null, skipped: true };
          }
          
          return response.json();
        });

        if (error) {
          // Check if it's a "already exists" error which we can ignore
          if (error.message && (
            error.message.includes('already exists') ||
            error.message.includes('duplicate key')
          )) {
            console.log('    ℹ️  Already exists, skipping');
          } else {
            console.error('    ❌ Error:', error.message);
          }
        } else if (!data?.skipped) {
          console.log('    ✅ Success');
        }
      } catch (err) {
        console.warn(`    ⚠️  Statement ${i + 1} failed:`, err.message);
        // Continue with next statement
      }
    }

    console.log('\n🎉 Migration completed!');
    console.log('\n📝 Next steps:');
    console.log('1. Check your Supabase dashboard to verify tables were created');
    console.log('2. Tables should include: jobs, identified_companies, search_terms, etc.');
    console.log('3. If tables are missing, you can run the SQL directly in Supabase SQL Editor');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('\n💡 Alternative: Copy the contents of supabase-schema.sql and run it in:');
    console.log('   Supabase Dashboard → SQL Editor → New Query');
    process.exit(1);
  }
}

// Alternative simple approach if RPC doesn't work
async function checkTablesExist() {
  console.log('\n🔍 Checking if tables exist...');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const tables = ['jobs', 'identified_companies', 'search_terms', 'processed_ids', 'scraping_runs'];
  const existingTables = [];

  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('id')
        .limit(1);
      
      if (!error) {
        existingTables.push(table);
        console.log(`  ✅ Table '${table}' exists`);
      } else {
        console.log(`  ❌ Table '${table}' not found`);
      }
    } catch (e) {
      console.log(`  ❌ Table '${table}' not found`);
    }
  }

  if (existingTables.length === 0) {
    console.log('\n⚠️  No tables found. Please run the migration manually:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste the contents of supabase-schema.sql');
    console.log('4. Click "Run" to execute the SQL');
  } else if (existingTables.length < tables.length) {
    console.log('\n⚠️  Some tables are missing. Please check your Supabase dashboard.');
  } else {
    console.log('\n✅ All tables exist! Database is ready.');
  }
}

// Run the migration
runMigration().then(() => {
  // After migration attempt, check what tables exist
  checkTablesExist();
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});