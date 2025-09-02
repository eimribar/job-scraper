#!/usr/bin/env node

/**
 * Script to remove companies that were added with tool_detected='none'
 * These are the Salesforce and unknown companies that shouldn't be in our database
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function removeNoneCompanies() {
  console.log('🗑️ Removing companies with tool_detected="none"...\n');
  
  // First, get the list of companies to be removed
  const { data: toRemove, error: fetchError } = await supabase
    .from('identified_companies')
    .select('company')
    .eq('tool_detected', 'none');
    
  if (fetchError) {
    console.error('Error fetching companies:', fetchError);
    return;
  }
  
  console.log(`Found ${toRemove.length} companies to remove:`);
  toRemove.forEach(c => console.log(`  • ${c.company}`));
  
  // Now delete them
  const { data, error } = await supabase
    .from('identified_companies')
    .delete()
    .eq('tool_detected', 'none');
    
  if (error) {
    console.error('❌ Error removing companies:', error.message);
    return;
  }
  
  console.log(`\n✅ Successfully removed ${toRemove.length} companies`);
  
  // Get updated total count
  const { count } = await supabase
    .from('identified_companies')
    .select('*', { count: 'exact', head: true });
  
  // Get breakdown by tool
  const { data: breakdown } = await supabase
    .from('identified_companies')
    .select('tool_detected');
    
  const toolCounts = {};
  breakdown?.forEach(d => {
    toolCounts[d.tool_detected] = (toolCounts[d.tool_detected] || 0) + 1;
  });
  
  console.log('\n' + '═'.repeat(50));
  console.log('📊 UPDATED DATABASE STATUS');
  console.log('═'.repeat(50));
  console.log(`Total companies: ${count}`);
  console.log('\nBreakdown by tool:');
  Object.entries(toolCounts).forEach(([tool, cnt]) => {
    console.log(`  • ${tool}: ${cnt}`);
  });
  console.log('\n🎯 Database cleaned: Now only contains Outreach.io and SalesLoft users');
}

// Run the script
removeNoneCompanies().catch(console.error);