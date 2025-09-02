#!/usr/bin/env node

/**
 * Script to add remaining companies that were initially skipped
 * These are companies that use other tools or have unclear tool usage
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Remaining companies from the original list
const remainingCompanies = [
  // Companies marked as Salesforce users - we'll add them as "Other" since they were in the list
  { company: 'Melio', tool: 'Other', originalTool: 'Salesforce' },
  { company: 'Bynder', tool: 'Other', originalTool: 'Salesforce' },
  { company: 'ControlCase', tool: 'Other', originalTool: 'Salesforce' },
  { company: 'BlueVoyant', tool: 'Other', originalTool: 'Salesforce' },
  { company: 'Unanet', tool: 'Other', originalTool: 'Salesforce' },
  { company: 'Cayuse', tool: 'Other', originalTool: 'Salesforce' },
  { company: 'Lago', tool: 'Other', originalTool: 'Salesforce' },
  { company: 'Oyster®', tool: 'Other', originalTool: 'Salesforce' },
  
  // Companies with unknown/missing tools - mark as "Other"
  { company: 'Just Badge', tool: 'Other', originalTool: 'Unknown' },
  { company: 'Cohere', tool: 'Other', originalTool: 'Unknown' },
  { company: 'Strike Social', tool: 'Other', originalTool: 'Unknown' }
];

async function addRemainingCompanies() {
  console.log('🚀 Adding remaining companies that were initially skipped...\n');
  
  let added = 0;
  let skipped = 0;
  let errors = 0;
  
  console.log(`📊 Processing ${remainingCompanies.length} remaining companies\n`);
  
  for (const entry of remainingCompanies) {
    try {
      // Check if company already exists with "Other" tool
      const { data: existing } = await supabase
        .from('identified_companies')
        .select('id')
        .eq('company', entry.company)
        .eq('tool_detected', entry.tool)
        .single();
      
      if (existing) {
        console.log(`⏭️ Already exists: ${entry.company} - ${entry.tool}`);
        skipped++;
        continue;
      }
      
      // Prepare company data
      const companyData = {
        company: entry.company,
        tool_detected: entry.tool,
        signal_type: 'none',  // Using 'none' since these don't use our target tools
        context: `Originally listed as ${entry.originalTool} user`,
        job_title: 'Various sales roles',
        platform: 'Manual',
        identified_date: new Date().toISOString()
      };
      
      // Insert new entry
      const { data, error } = await supabase
        .from('identified_companies')
        .insert(companyData)
        .select();
      
      if (error) {
        // If error is about "Other" not being valid, try with a different approach
        if (error.message.includes('tool_detected')) {
          // Try adding as Outreach.io with a special note
          companyData.tool_detected = 'none';  // Use 'none' if 'Other' doesn't work
          companyData.context = `Uses ${entry.originalTool} (not Outreach/SalesLoft)`;
          
          const { data: retryData, error: retryError } = await supabase
            .from('identified_companies')
            .insert(companyData)
            .select();
          
          if (retryError) {
            console.error(`❌ Error adding ${entry.company}:`, retryError.message);
            errors++;
          } else {
            console.log(`✅ Added: ${entry.company} - marked as 'none' (uses ${entry.originalTool})`);
            added++;
          }
        } else {
          console.error(`❌ Error adding ${entry.company}:`, error.message);
          errors++;
        }
      } else {
        console.log(`✅ Added: ${entry.company} - ${entry.tool} (originally: ${entry.originalTool})`);
        added++;
      }
      
    } catch (err) {
      console.error(`❌ Unexpected error for ${entry.company}:`, err.message);
      errors++;
    }
  }
  
  console.log('\n' + '═'.repeat(50));
  console.log('📈 FINAL RESULTS:');
  console.log('═'.repeat(50));
  console.log(`✅ Successfully added: ${added} companies`);
  console.log(`⏭️ Already existed: ${skipped} companies`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`📊 Total processed: ${remainingCompanies.length}`);
  
  // Get updated total count
  const { count } = await supabase
    .from('identified_companies')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n🎯 Total companies in database: ${count}`);
}

// Run the script
addRemainingCompanies().catch(console.error);