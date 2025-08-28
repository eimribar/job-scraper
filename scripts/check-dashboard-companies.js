/**
 * Check what companies with tools are visible for dashboard
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function checkDashboardCompanies() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  
  console.log('📊 COMPANIES WITH DETECTED TOOLS (Dashboard View)\n');
  console.log('=' .repeat(60));
  
  // Get companies using Outreach
  const { data: outreachCompanies } = await supabase
    .from('companies')
    .select('name, detection_confidence, context')
    .eq('uses_outreach', true)
    .limit(10);
  
  console.log(`\n🎯 Companies using Outreach.io: ${outreachCompanies?.length || 0}`);
  if (outreachCompanies && outreachCompanies.length > 0) {
    outreachCompanies.forEach(c => {
      console.log(`  - ${c.name} (${c.detection_confidence} confidence)`);
      if (c.context) {
        console.log(`    "${c.context.substring(0, 80)}..."`);
      }
    });
  }
  
  // Get companies using SalesLoft
  const { data: salesloftCompanies } = await supabase
    .from('companies')
    .select('name, detection_confidence, context')
    .eq('uses_salesloft', true)
    .limit(10);
  
  console.log(`\n🎯 Companies using SalesLoft: ${salesloftCompanies?.length || 0}`);
  if (salesloftCompanies && salesloftCompanies.length > 0) {
    salesloftCompanies.forEach(c => {
      console.log(`  - ${c.name} (${c.detection_confidence} confidence)`);
      if (c.context) {
        console.log(`    "${c.context.substring(0, 80)}..."`);
      }
    });
  }
  
  // Get companies using both
  const { data: bothCompanies } = await supabase
    .from('companies')
    .select('name, detection_confidence')
    .eq('uses_both', true);
  
  console.log(`\n🎯 Companies using BOTH tools: ${bothCompanies?.length || 0}`);
  if (bothCompanies && bothCompanies.length > 0) {
    bothCompanies.forEach(c => {
      console.log(`  - ${c.name} (${c.detection_confidence} confidence)`);
    });
  }
  
  // Get total counts
  const { count: totalCompanies } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true });
  
  const { count: toolCompanies } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true })
    .or('uses_outreach.eq.true,uses_salesloft.eq.true');
  
  console.log('\n' + '=' .repeat(60));
  console.log('📈 SUMMARY');
  console.log(`Total companies: ${totalCompanies}`);
  console.log(`Companies with tools detected: ${toolCompanies}`);
  console.log(`Detection rate: ${Math.round((toolCompanies/totalCompanies)*100)}%`);
  
  console.log('\n✅ These companies ARE visible in your dashboard!');
  console.log('Check: http://localhost:3001/companies');
}

checkDashboardCompanies().catch(console.error);