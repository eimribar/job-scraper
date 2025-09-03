#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

// Initialize Supabase client with service role key for admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🔧 Running database migration to add unique constraint...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', 'add-unique-constraint.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    
    console.log('📋 Migration SQL loaded from:', migrationPath);
    
    // Note: Supabase doesn't directly support running raw SQL through the JS client
    // We'll need to run this through the Supabase SQL editor or use a different approach
    
    console.log('\n⚠️  IMPORTANT: Supabase JS client doesn't support running raw SQL migrations directly.');
    console.log('\n📝 To apply this migration, you have two options:\n');
    console.log('Option 1: Use Supabase Dashboard');
    console.log('1. Go to https://supabase.com/dashboard');
    console.log('2. Select your project');
    console.log('3. Navigate to SQL Editor');
    console.log('4. Copy and paste the following SQL:\n');
    console.log('----------------------------------------');
    console.log(migrationSQL);
    console.log('----------------------------------------\n');
    
    console.log('Option 2: Use psql command line');
    console.log('Run the following command with your database connection string:');
    console.log(`psql "${process.env.DATABASE_URL || 'your-database-connection-string'}" < migrations/add-unique-constraint.sql\n`);
    
    // Let's at least check if the constraint already exists
    console.log('🔍 Checking current database state...\n');
    
    const { data: companies, error: checkError } = await supabase
      .from('identified_companies')
      .select('id')
      .limit(1);
    
    if (checkError) {
      console.error('❌ Error connecting to database:', checkError);
    } else {
      console.log('✅ Successfully connected to database');
      
      // Check for duplicates that would prevent the constraint
      const { data: duplicates, error: dupError } = await supabase.rpc('check_duplicates', {
        table_name: 'identified_companies'
      }).catch(() => null);
      
      if (!dupError && duplicates && duplicates.length > 0) {
        console.log('\n⚠️  WARNING: Found duplicate entries that need to be resolved before adding constraint:');
        duplicates.forEach(dup => {
          console.log(`  - Company: ${dup.company}, Tool: ${dup.tool_detected}, Count: ${dup.count}`);
        });
      }
    }
    
    // Create a helper script to check for duplicates
    await createDuplicateCheckScript();
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
}

async function createDuplicateCheckScript() {
  const scriptContent = `
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkDuplicates() {
  console.log('🔍 Checking for duplicate companies...');
  
  const { data: allCompanies, error } = await supabase
    .from('identified_companies')
    .select('company, tool_detected')
    .order('company');
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  const duplicates = {};
  allCompanies.forEach(item => {
    const key = \`\${item.company}|\${item.tool_detected}\`;
    duplicates[key] = (duplicates[key] || 0) + 1;
  });
  
  const dupsFound = Object.entries(duplicates)
    .filter(([_, count]) => count > 1)
    .map(([key, count]) => {
      const [company, tool] = key.split('|');
      return { company, tool, count };
    });
  
  if (dupsFound.length > 0) {
    console.log('\\n⚠️  Found duplicates:');
    dupsFound.forEach(dup => {
      console.log(\`  - \${dup.company} with \${dup.tool}: \${dup.count} entries\`);
    });
    console.log('\\nThese need to be resolved before adding the unique constraint.');
  } else {
    console.log('✅ No duplicates found! Safe to add unique constraint.');
  }
  
  console.log(\`\\nTotal companies: \${allCompanies.length}\`);
}

checkDuplicates();
`;

  const checkScriptPath = path.join(__dirname, 'check-duplicates.js');
  await fs.writeFile(checkScriptPath, scriptContent.trim());
  console.log(`\n📝 Created duplicate check script: ${checkScriptPath}`);
  console.log('Run it with: node scripts/check-duplicates.js\n');
}

// Run the migration
runMigration();