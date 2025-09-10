#!/usr/bin/env node

/**
 * Test Database Save Functionality
 * Ensures companies are properly saved to database
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testDatabaseSave() {
  console.log('🧪 TESTING DATABASE SAVE FUNCTIONALITY');
  console.log('=' .repeat(50));
  
  // Test companies with known tool usage
  const testCompanies = [
    {
      company: 'HSBC',
      tool_detected: 'Outreach.io',
      signal_type: 'preferred',
      context: 'Experience using Salesforce and other sales tools (Clari, LinkedIn Sales Navigator, Outreach, ZoomInfo, etc)',
      job_title: 'Account Executive',
      job_url: 'https://test.com/hsbc',
      platform: 'LinkedIn'
    },
    {
      company: 'DaySmart',
      tool_detected: 'SalesLoft',
      signal_type: 'required',
      context: 'Experience with SalesLoft required',
      job_title: 'Sales Development Representative',
      job_url: 'https://test.com/daysmart',
      platform: 'LinkedIn'
    },
    {
      company: 'Carrot',
      tool_detected: 'Both',
      signal_type: 'required',
      context: 'Experience with sales tools (SalesLoft/Outreach, Salesforce, SalesNav, etc.)',
      job_title: 'Associate Account Executive',
      job_url: 'https://test.com/carrot',
      platform: 'LinkedIn'
    }
  ];
  
  for (const testCompany of testCompanies) {
    console.log(`\n📋 Testing: ${testCompany.company} - ${testCompany.tool_detected}`);
    
    // Check if exists
    const { data: existing } = await supabase
      .from('identified_companies')
      .select('id')
      .eq('company', testCompany.company)
      .eq('tool_detected', testCompany.tool_detected)
      .single();
    
    if (existing) {
      console.log('  ℹ️  Already exists, updating...');
      
      const { error: updateError } = await supabase
        .from('identified_companies')
        .update({
          signal_type: testCompany.signal_type,
          context: testCompany.context,
          job_title: testCompany.job_title,
          job_url: testCompany.job_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
      
      if (updateError) {
        console.log(`  ❌ Update failed: ${updateError.message}`);
      } else {
        console.log('  ✅ Updated successfully');
      }
    } else {
      console.log('  📝 Creating new entry...');
      
      const { data: insertData, error: insertError } = await supabase
        .from('identified_companies')
        .insert({
          company: testCompany.company,
          tool_detected: testCompany.tool_detected,
          signal_type: testCompany.signal_type,
          context: testCompany.context,
          job_title: testCompany.job_title,
          job_url: testCompany.job_url,
          platform: testCompany.platform,
          identified_date: new Date().toISOString()
        })
        .select();
      
      if (insertError) {
        console.log(`  ❌ Insert failed: ${insertError.message}`);
        console.log('  Error details:', insertError);
      } else {
        console.log('  ✅ Saved successfully!');
        console.log(`  ID: ${insertData[0].id}`);
      }
    }
  }
  
  // Verify they're in the database
  console.log('\n' + '=' .repeat(50));
  console.log('📊 VERIFICATION');
  console.log('=' .repeat(50));
  
  for (const company of ['HSBC', 'DaySmart', 'Carrot']) {
    const { data, error } = await supabase
      .from('identified_companies')
      .select('company, tool_detected, signal_type')
      .eq('company', company);
    
    if (data && data.length > 0) {
      console.log(`✅ ${company}:`);
      data.forEach(d => {
        console.log(`   - ${d.tool_detected} (${d.signal_type})`);
      });
    } else {
      console.log(`❌ ${company}: NOT FOUND`);
    }
  }
  
  // Check total count
  const { count } = await supabase
    .from('identified_companies')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n📊 Total companies in database: ${count}`);
  console.log('\n✅ Test complete!');
}

testDatabaseSave().catch(console.error);