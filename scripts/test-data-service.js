/**
 * Test Data Service directly
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

async function testDataService() {
  console.log('Testing Data Service Connection\n');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  console.log('Supabase URL:', supabaseUrl);
  console.log('Supabase Key:', supabaseKey ? '✅ Set' : '❌ Missing');
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Test 1: Get search terms
    console.log('\n1. Testing search_terms table...');
    const { data: searchTerms, error: searchError } = await supabase
      .from('search_terms')
      .select('*')
      .limit(5);
    
    if (searchError) {
      console.error('Error fetching search terms:', searchError);
    } else {
      console.log(`   ✅ Found ${searchTerms?.length || 0} search terms`);
      if (searchTerms && searchTerms.length > 0) {
        console.log(`   First term: ${searchTerms[0].search_term}`);
      }
    }
    
    // Test 2: Get companies count
    console.log('\n2. Testing companies table...');
    const { count, error: countError } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('Error counting companies:', countError);
    } else {
      console.log(`   ✅ Total companies: ${count || 0}`);
    }
    
    // Test 3: Check job_queue table
    console.log('\n3. Testing job_queue table...');
    const { data: jobs, error: jobsError } = await supabase
      .from('job_queue')
      .select('id, status, job_type')
      .limit(5);
    
    if (jobsError) {
      console.error('Error fetching jobs:', jobsError);
    } else {
      console.log(`   ✅ Found ${jobs?.length || 0} jobs in queue`);
    }
    
    console.log('\n✅ Data service test complete!');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testDataService();