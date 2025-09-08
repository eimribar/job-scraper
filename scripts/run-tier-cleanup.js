const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nslcadgicgkncajoyyno.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zbGNhZGdpY2drbmNham95eW5vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjgxMTI1MSwiZXhwIjoyMDcyMzg3MjUxfQ.TaRBcVGLr61yr1gEEPBfPqntpZj3GTaJsNMwla-I2Y4';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTierCleanup() {
  console.log('🧹 Starting comprehensive tier classification cleanup...\n');

  try {
    // Step 1: Show current tier distribution
    console.log('📊 BEFORE CLEANUP - Current tier distribution:');
    const { data: beforeData, error: beforeError } = await supabase
      .from('identified_companies')
      .select('tier')
      .not('tier', 'is', null);

    if (beforeError) {
      console.error('Error fetching before data:', beforeError);
    } else {
      const tierCounts = {};
      beforeData.forEach(row => {
        tierCounts[row.tier || 'NULL'] = (tierCounts[row.tier || 'NULL'] || 0) + 1;
      });
      
      const totalCompanies = Object.values(tierCounts).reduce((a, b) => a + b, 0);
      Object.entries(tierCounts)
        .sort(([,a], [,b]) => b - a)
        .forEach(([tier, count]) => {
          const percentage = ((count / totalCompanies) * 100).toFixed(2);
          console.log(`   ${tier}: ${count} companies (${percentage}%)`);
        });
    }

    // Get companies with NULL tiers
    const { data: nullTierData } = await supabase
      .from('identified_companies')
      .select('tier')
      .is('tier', null);
    
    const nullCount = nullTierData?.length || 0;
    console.log(`   NULL: ${nullCount} companies\n`);

    // Step 2: Set all invalid/NULL tiers to Tier 2
    console.log('🔄 Step 1: Setting all invalid/NULL tiers to Tier 2...');
    
    const { data: updateData, error: updateError } = await supabase.rpc('update_invalid_tiers');
    
    if (updateError) {
      // Fallback to direct update if RPC doesn't exist
      const { count, error: directUpdateError } = await supabase
        .from('identified_companies')
        .update({ tier: 'Tier 2' })
        .or('tier.is.null,tier.not.in.(Tier 1,Tier 2)')
        .select('*', { count: 'exact', head: true });
        
      if (directUpdateError) {
        console.error('❌ Error updating invalid tiers:', directUpdateError);
      } else {
        console.log(`✅ Updated ${count || 'unknown number of'} companies with invalid/NULL tiers to Tier 2`);
      }
    }

    // Step 3: Update Tier 1 companies based on tier_one_companies table
    console.log('\n🎯 Step 2: Updating companies that match Tier 1 list...');
    
    // Get all tier_one_companies
    const { data: tier1Companies, error: tier1Error } = await supabase
      .from('tier_one_companies')
      .select('company_name');

    if (tier1Error) {
      console.error('❌ Error fetching tier_one_companies:', tier1Error);
      return;
    }

    console.log(`📋 Found ${tier1Companies.length} companies in tier_one_companies table`);
    
    let tier1UpdateCount = 0;
    
    // Process in batches to avoid overwhelming the database
    const batchSize = 10;
    for (let i = 0; i < tier1Companies.length; i += batchSize) {
      const batch = tier1Companies.slice(i, i + batchSize);
      
      for (const tier1Company of batch) {
        const companyName = tier1Company.company_name.trim();
        
        // Try exact match first
        const { count: exactCount, error: exactError } = await supabase
          .from('identified_companies')
          .update({ tier: 'Tier 1' })
          .ilike('company', companyName)
          .select('*', { count: 'exact', head: true });
          
        if (!exactError && exactCount > 0) {
          tier1UpdateCount += exactCount;
          continue;
        }
        
        // Try partial match
        const { count: partialCount, error: partialError } = await supabase
          .from('identified_companies')
          .update({ tier: 'Tier 1' })
          .or(`company.ilike.%${companyName}%,company.ilike.${companyName}%`)
          .select('*', { count: 'exact', head: true });
          
        if (!partialError && partialCount > 0) {
          tier1UpdateCount += partialCount;
        }
      }
      
      console.log(`   Processed ${Math.min(i + batchSize, tier1Companies.length)}/${tier1Companies.length} tier 1 companies...`);
    }

    console.log(`✅ Updated ${tier1UpdateCount} companies to Tier 1 based on tier_one_companies table`);

    // Step 4: Show final distribution
    console.log('\n📊 AFTER CLEANUP - Final tier distribution:');
    const { data: afterData, error: afterError } = await supabase
      .from('identified_companies')
      .select('tier');

    if (afterError) {
      console.error('Error fetching after data:', afterError);
    } else {
      const finalTierCounts = {};
      afterData.forEach(row => {
        finalTierCounts[row.tier || 'NULL'] = (finalTierCounts[row.tier || 'NULL'] || 0) + 1;
      });
      
      const finalTotalCompanies = afterData.length;
      Object.entries(finalTierCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([tier, count]) => {
          const percentage = ((count / finalTotalCompanies) * 100).toFixed(2);
          console.log(`   ${tier}: ${count} companies (${percentage}%)`);
        });
    }

    // Step 5: Show some Tier 1 examples
    console.log('\n🏆 TIER 1 COMPANIES (Sample):');
    const { data: sampleTier1, error: sampleError } = await supabase
      .from('identified_companies')
      .select('company, tier')
      .eq('tier', 'Tier 1')
      .order('company')
      .limit(10);

    if (sampleError) {
      console.error('Error fetching sample data:', sampleError);
    } else {
      sampleTier1.forEach(company => {
        console.log(`   • ${company.company}`);
      });
    }

    // Step 6: Final summary
    const { data: summaryData } = await supabase
      .from('identified_companies')
      .select('tier');
      
    const summary = {
      total: summaryData.length,
      tier1: summaryData.filter(c => c.tier === 'Tier 1').length,
      tier2: summaryData.filter(c => c.tier === 'Tier 2').length,
      invalid: summaryData.filter(c => c.tier && !['Tier 1', 'Tier 2'].includes(c.tier)).length,
      nullTiers: summaryData.filter(c => !c.tier).length
    };

    console.log('\n🎉 CLEANUP SUMMARY:');
    console.log(`   📈 Total companies: ${summary.total}`);
    console.log(`   🥇 Tier 1 companies: ${summary.tier1}`);
    console.log(`   🥈 Tier 2 companies: ${summary.tier2}`);
    console.log(`   ❌ Invalid tiers: ${summary.invalid}`);
    console.log(`   ⚪ NULL tiers: ${summary.nullTiers}`);
    
    if (summary.invalid === 0 && summary.nullTiers === 0) {
      console.log('\n✅ Tier cleanup completed successfully! All companies now have valid tier classifications.');
    } else {
      console.log('\n⚠️  Some issues remain that may need manual attention.');
    }

  } catch (error) {
    console.error('❌ Unexpected error during tier cleanup:', error);
    throw error;
  }
}

// Run the cleanup
if (require.main === module) {
  runTierCleanup()
    .then(() => {
      console.log('\n✅ Tier cleanup process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Tier cleanup process failed:', error);
      process.exit(1);
    });
}

module.exports = { runTierCleanup };