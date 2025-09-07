#!/usr/bin/env node

/**
 * Apply search terms migration to create tables and populate data
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function applyMigration() {
  console.log('🚀 Applying search terms migration...\n');
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', 'create-search-terms-table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Migration includes:');
    console.log('- search_terms table with 37 predefined terms');
    console.log('- notifications table for real-time alerts');
    console.log('- processing_runs table for tracking automation\n');
    
    // Note: Supabase doesn't allow direct SQL execution via the client
    // We need to use the SQL editor in the dashboard
    console.log('⚠️  IMPORTANT: Direct SQL execution requires Supabase Dashboard\n');
    console.log('Please follow these steps:');
    console.log('1. Go to: https://supabase.com/dashboard/project/nslcadgicgkncajoyyno/sql/new');
    console.log('2. Copy the contents of: migrations/create-search-terms-table.sql');
    console.log('3. Paste and execute in the SQL editor\n');
    
    // For now, let's check if the tables exist
    console.log('🔍 Checking current database state...\n');
    
    // Check if search_terms table exists
    const { data: searchTerms, error: stError } = await supabase
      .from('search_terms')
      .select('count')
      .limit(1);
    
    if (stError && stError.message.includes('does not exist')) {
      console.log('❌ search_terms table does not exist - needs to be created');
    } else if (searchTerms) {
      const { count } = await supabase
        .from('search_terms')
        .select('*', { count: 'exact', head: true });
      console.log(`✅ search_terms table exists (${count || 0} terms)`);
    }
    
    // Check if notifications table exists
    const { data: notifications, error: notError } = await supabase
      .from('notifications')
      .select('count')
      .limit(1);
    
    if (notError && notError.message.includes('does not exist')) {
      console.log('❌ notifications table does not exist - needs to be created');
    } else if (notifications) {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true });
      console.log(`✅ notifications table exists (${count || 0} notifications)`);
    }
    
    // Check if processing_runs table exists
    const { data: runs, error: runsError } = await supabase
      .from('processing_runs')
      .select('count')
      .limit(1);
    
    if (runsError && runsError.message.includes('does not exist')) {
      console.log('❌ processing_runs table does not exist - needs to be created');
    } else if (runs) {
      const { count } = await supabase
        .from('processing_runs')
        .select('*', { count: 'exact', head: true });
      console.log(`✅ processing_runs table exists (${count || 0} runs)`);
    }
    
    console.log('\n📋 Migration file saved at: migrations/create-search-terms-table.sql');
    console.log('\n✨ Once executed, you will have:');
    console.log('- 37 search terms ready for automated scraping');
    console.log('- Notification system for real-time alerts');
    console.log('- Processing run tracking for monitoring');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

applyMigration();