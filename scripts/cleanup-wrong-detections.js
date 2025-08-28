/**
 * Remove companies that were wrongly detected with Salesforce or other tools
 * We ONLY care about Outreach.io and SalesLoft
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function cleanupWrongDetections() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  
  console.log('🧹 CLEANING UP WRONG DETECTIONS\n');
  console.log('=' .repeat(60));
  console.log('Removing companies that DON\'T use Outreach.io or SalesLoft\n');
  
  // Get companies that don't use either tool
  const { data: wrongCompanies } = await supabase
    .from('companies')
    .select('id, name, uses_outreach, uses_salesloft')
    .eq('uses_outreach', false)
    .eq('uses_salesloft', false);
  
  console.log(`Found ${wrongCompanies?.length || 0} companies without Outreach/SalesLoft\n`);
  
  // List companies we added today that are wrong
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const { data: todaysWrong } = await supabase
    .from('companies')
    .select('id, name, created_at')
    .eq('uses_outreach', false)
    .eq('uses_salesloft', false)
    .gte('created_at', today.toISOString());
  
  if (todaysWrong && todaysWrong.length > 0) {
    console.log('Companies added today that DON\'T have Outreach/SalesLoft:');
    todaysWrong.forEach(c => {
      console.log(`  - ${c.name}`);
    });
    
    console.log('\nRemoving these companies...\n');
    
    // Delete them
    for (const company of todaysWrong) {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', company.id);
      
      if (error) {
        console.log(`  ❌ Failed to remove ${company.name}: ${error.message}`);
      } else {
        console.log(`  ✅ Removed ${company.name}`);
      }
    }
  }
  
  // Get updated count
  const { count: totalNow } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true });
  
  const { count: withTools } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true })
    .or('uses_outreach.eq.true,uses_salesloft.eq.true');
  
  console.log('\n' + '=' .repeat(60));
  console.log('📊 CLEANUP COMPLETE\n');
  console.log(`Total companies: ${totalNow}`);
  console.log(`Companies with Outreach/SalesLoft: ${withTools}`);
  console.log(`Removed: ${todaysWrong?.length || 0} wrong detections`);
  
  console.log('\n✅ Only companies using Outreach.io or SalesLoft remain!');
}

cleanupWrongDetections().catch(console.error);