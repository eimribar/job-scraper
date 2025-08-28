#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function createApiSupabaseClient() {
  return createClient(supabaseUrl, supabaseKey);
}

async function deduplicateCompanies() {
  console.log('🔍 DEDUPLICATING COMPANY RECORDS');
  console.log('='.repeat(60));
  
  const supabase = createApiSupabaseClient();
  
  try {
    // Step 1: Find duplicate companies
    console.log('\n1️⃣ Finding duplicate companies...');
    
    const { data: allCompanies, error: fetchError } = await supabase
      .from('identified_companies')
      .select('*')
      .order('identified_date', { ascending: true });
    
    if (fetchError) {
      console.error('Error fetching companies:', fetchError);
      return;
    }
    
    console.log(`Total records: ${allCompanies.length}`);
    
    // Group by normalized company name
    const companyGroups = {};
    allCompanies.forEach(company => {
      const normalized = company.company_name.toLowerCase().trim();
      if (!companyGroups[normalized]) {
        companyGroups[normalized] = [];
      }
      companyGroups[normalized].push(company);
    });
    
    // Find duplicates
    const duplicates = Object.entries(companyGroups).filter(([_, companies]) => companies.length > 1);
    
    console.log(`\n📊 Found ${duplicates.length} companies with duplicates`);
    
    if (duplicates.length === 0) {
      console.log('✅ No duplicates found!');
      return;
    }
    
    // Step 2: Show duplicate analysis
    console.log('\n2️⃣ Duplicate Analysis:');
    
    let totalDuplicateRecords = 0;
    const mergePlan = [];
    
    duplicates.forEach(([normalizedName, companies]) => {
      totalDuplicateRecords += companies.length - 1;
      
      // Sort by date to keep the earliest
      companies.sort((a, b) => new Date(a.identified_date) - new Date(b.identified_date));
      
      const keeper = companies[0];
      const toDelete = companies.slice(1);
      
      // Collect all unique tools detected
      const allTools = new Set();
      companies.forEach(c => {
        if (c.tool_detected) allTools.add(c.tool_detected);
      });
      
      // Determine the best confidence level
      const confidenceLevels = ['high', 'medium', 'low'];
      let bestConfidence = 'low';
      companies.forEach(c => {
        const idx = confidenceLevels.indexOf(c.confidence);
        const bestIdx = confidenceLevels.indexOf(bestConfidence);
        if (idx < bestIdx) {
          bestConfidence = c.confidence;
        }
      });
      
      console.log(`\n   📦 ${companies[0].company_name}:`);
      console.log(`      - ${companies.length} records found`);
      console.log(`      - Keeping: ${keeper.identified_date} (${keeper.tool_detected})`);
      console.log(`      - Deleting: ${toDelete.length} duplicate(s)`);
      
      mergePlan.push({
        normalizedName,
        keeper,
        toDelete,
        allTools: Array.from(allTools),
        bestConfidence
      });
    });
    
    console.log(`\n📊 Summary:`);
    console.log(`   - Total duplicate records to remove: ${totalDuplicateRecords}`);
    console.log(`   - Records after cleanup: ${allCompanies.length - totalDuplicateRecords}`);
    
    // Step 3: Execute deduplication
    console.log('\n3️⃣ Execute deduplication? (Simulating for safety)');
    console.log('   To actually execute, uncomment the deletion code below');
    
    // UNCOMMENT TO ACTUALLY DELETE DUPLICATES
    /*
    console.log('\n🗑️ Removing duplicates...');
    
    for (const plan of mergePlan) {
      // Update keeper with best data if needed
      if (plan.allTools.length > 1 && plan.keeper.tool_detected !== 'Both') {
        const { error: updateError } = await supabase
          .from('identified_companies')
          .update({
            tool_detected: 'Both',
            confidence: plan.bestConfidence
          })
          .eq('id', plan.keeper.id);
        
        if (updateError) {
          console.error(`Error updating ${plan.keeper.company_name}:`, updateError);
        }
      }
      
      // Delete duplicates
      for (const duplicate of plan.toDelete) {
        const { error: deleteError } = await supabase
          .from('identified_companies')
          .delete()
          .eq('id', duplicate.id);
        
        if (deleteError) {
          console.error(`Error deleting duplicate for ${duplicate.company_name}:`, deleteError);
        }
      }
      
      console.log(`   ✅ Cleaned up ${plan.keeper.company_name}`);
    }
    
    console.log('\n✅ Deduplication complete!');
    */
    
    // Step 4: Generate SQL for manual execution (safer)
    console.log('\n4️⃣ SQL for manual deduplication:');
    console.log('\n-- Run this in Supabase SQL Editor to deduplicate:\n');
    
    const deleteIds = [];
    mergePlan.forEach(plan => {
      plan.toDelete.forEach(dup => {
        deleteIds.push(dup.id);
      });
    });
    
    if (deleteIds.length > 0) {
      console.log(`DELETE FROM identified_companies`);
      console.log(`WHERE id IN (${deleteIds.map(id => `'${id}'`).join(', ')});`);
      console.log(`\n-- This will delete ${deleteIds.length} duplicate records`);
    }
    
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

deduplicateCompanies().catch(console.error);