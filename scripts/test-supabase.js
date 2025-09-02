#!/usr/bin/env node

/**
 * Test Supabase connection
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Testing Supabase connection...');
console.log('URL:', supabaseUrl);
console.log('Key (first 20 chars):', supabaseKey?.substring(0, 20) + '...');

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  try {
    // Test query
    const { data, error, count } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ Error:', error);
    } else {
      console.log('✅ Connection successful!');
      console.log('Total jobs in database:', count);
    }
    
    // Test unprocessed jobs
    const { count: unprocessedCount } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('processed', false);
    
    console.log('Unprocessed jobs:', unprocessedCount);
    
  } catch (err) {
    console.error('❌ Connection failed:', err);
  }
}

test();