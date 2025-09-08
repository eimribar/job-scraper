const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nslcadgicgkncajoyyno.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zbGNhZGdpY2drbmNham95eW5vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjgxMTI1MSwiZXhwIjoyMDcyMzg3MjUxfQ.TaRBcVGLr61yr1gEEPBfPqntpZj3GTaJsNMwla-I2Y4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyTierAssignments() {
  console.log('🔍 Verifying tier assignments across the system...\n');

  try {
    // 1. Get overall statistics
    const { data: allCompanies } = await supabase
      .from('identified_companies')
      .select('company, tier, tool_detected, identified_date');

    const { data: tier1List } = await supabase
      .from('tier_one_companies')
      .select('company_name');

    console.log('📊 OVERALL STATISTICS:');
    console.log(`   • Total companies in database: ${allCompanies.length}`);
    console.log(`   • Total Tier 1 target companies: ${tier1List.length}`);
    
    const tierStats = {};
    allCompanies.forEach(company => {
      tierStats[company.tier] = (tierStats[company.tier] || 0) + 1;
    });
    
    Object.entries(tierStats).forEach(([tier, count]) => {
      const percentage = (count / allCompanies.length * 100).toFixed(1);
      console.log(`   • ${tier}: ${count} companies (${percentage}%)`);
    });

    // 2. Show current Tier 1 companies
    const tier1Companies = allCompanies.filter(c => c.tier === 'Tier 1');
    console.log('\n🏆 CURRENT TIER 1 COMPANIES:');
    tier1Companies.forEach(company => {
      console.log(`   • ${company.company} (${company.tool_detected})`);
    });

    // 3. Find which Tier 1 target companies are in our database
    console.log('\n🎯 TIER 1 TARGET COMPANIES STATUS:');
    let foundInDb = 0;
    let correctlyTagged = 0;
    let incorrectlyTagged = 0;
    let notFound = 0;
    
    const foundCompanies = [];
    const incorrectlyTaggedCompanies = [];
    const notFoundCompanies = [];

    for (const tier1Target of tier1List) {
      const targetName = tier1Target.company_name.toLowerCase().trim();
      
      // Look for this company in our database (case-insensitive)
      const matchingCompany = allCompanies.find(company => 
        company.company.toLowerCase().trim() === targetName ||
        company.company.toLowerCase().trim().includes(targetName) ||
        targetName.includes(company.company.toLowerCase().trim())
      );

      if (matchingCompany) {
        foundInDb++;
        foundCompanies.push({
          target: tier1Target.company_name,
          found: matchingCompany.company,
          tier: matchingCompany.tier,
          tool: matchingCompany.tool_detected
        });
        
        if (matchingCompany.tier === 'Tier 1') {
          correctlyTagged++;
        } else {
          incorrectlyTagged++;
          incorrectlyTaggedCompanies.push({
            target: tier1Target.company_name,
            found: matchingCompany.company,
            tier: matchingCompany.tier
          });
        }
      } else {
        notFound++;
        notFoundCompanies.push(tier1Target.company_name);
      }
    }

    console.log(`   ✅ Found in database: ${foundInDb}/${tier1List.length} (${(foundInDb / tier1List.length * 100).toFixed(1)}%)`);
    console.log(`   🏷️  Correctly tagged as Tier 1: ${correctlyTagged}`);
    console.log(`   🚨 Incorrectly tagged as Tier 2: ${incorrectlyTagged}`);
    console.log(`   ❌ Not found in database: ${notFound}`);

    // 4. Show incorrectly tagged companies (should be Tier 1 but marked as Tier 2)
    if (incorrectlyTaggedCompanies.length > 0) {
      console.log('\n🚨 COMPANIES THAT SHOULD BE TIER 1 BUT ARE TIER 2:');
      incorrectlyTaggedCompanies.forEach(company => {
        console.log(`   • "${company.target}" found as "${company.found}" (currently ${company.tier})`);
      });
    }

    // 5. Show sample of companies not found in database
    if (notFoundCompanies.length > 0) {
      console.log('\n❌ TIER 1 COMPANIES NOT YET DISCOVERED (Sample):');
      notFoundCompanies.slice(0, 10).forEach(company => {
        console.log(`   • ${company}`);
      });
      if (notFoundCompanies.length > 10) {
        console.log(`   ... and ${notFoundCompanies.length - 10} more`);
      }
    }

    // 6. Validate data integrity
    console.log('\n🔍 DATA INTEGRITY CHECK:');
    const invalidTiers = allCompanies.filter(c => !['Tier 1', 'Tier 2'].includes(c.tier));
    const nullTiers = allCompanies.filter(c => !c.tier);
    
    console.log(`   ✅ Valid tier assignments: ${allCompanies.length - invalidTiers.length - nullTiers.length}/${allCompanies.length}`);
    
    if (invalidTiers.length > 0) {
      console.log(`   ❌ Invalid tier values: ${invalidTiers.length}`);
      invalidTiers.slice(0, 5).forEach(company => {
        console.log(`      • ${company.company}: "${company.tier}"`);
      });
    }
    
    if (nullTiers.length > 0) {
      console.log(`   ⚪ NULL tier values: ${nullTiers.length}`);
    }

    // 7. Summary and recommendations
    console.log('\n📋 SUMMARY & RECOMMENDATIONS:');
    console.log(`   🎯 Target state: ${tier1List.length} Tier 1 companies`);
    console.log(`   📍 Current state: ${tier1Companies.length} Tier 1 companies`);
    console.log(`   📈 Coverage: ${(foundInDb / tier1List.length * 100).toFixed(1)}% of target companies discovered`);
    
    if (incorrectlyTaggedCompanies.length > 0) {
      console.log(`\n   🔧 Action needed: Fix ${incorrectlyTaggedCompanies.length} companies incorrectly tagged as Tier 2`);
    }
    
    if (notFoundCompanies.length > 0) {
      console.log(`   🔍 Missing: ${notFoundCompanies.length} target companies not yet discovered by job scraper`);
      console.log('      → These companies need job postings to be scraped first');
    }

    // 8. Test API endpoints
    console.log('\n🧪 TESTING API ENDPOINTS:');
    
    try {
      const tier1Response = await fetch('http://localhost:4001/api/companies?limit=5&tier=Tier%201');
      const tier1Data = await tier1Response.json();
      console.log(`   ✅ Tier 1 API: Returns ${tier1Data.companies?.length || 0} companies`);
      
      const tier2Response = await fetch('http://localhost:4001/api/companies?limit=5&tier=Tier%202');
      const tier2Data = await tier2Response.json();
      console.log(`   ✅ Tier 2 API: Returns ${tier2Data.companies?.length || 0} companies`);
    } catch (error) {
      console.log('   ⚠️  API testing skipped (server might not be running)');
    }

    console.log('\n🎉 Tier assignment verification completed!');

  } catch (error) {
    console.error('❌ Unexpected error during verification:', error);
    throw error;
  }
}

// Run the verification
if (require.main === module) {
  verifyTierAssignments()
    .then(() => {
      console.log('\n✅ Verification process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Verification process failed:', error);
      process.exit(1);
    });
}

module.exports = { verifyTierAssignments };