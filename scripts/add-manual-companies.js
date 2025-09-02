#!/usr/bin/env node

/**
 * Script to manually add companies to identified_companies table
 * Based on manual verification of which tools they use
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Company-tool mapping from manual verification
const companyMappings = [
  { company: 'Uber', tool: 'SalesLoft' },
  { company: 'Xcede', tool: 'Outreach' },
  { company: 'Just Badge', tool: null }, // No tool specified
  { company: 'Mitratech', tool: 'SalesLoft' },
  { company: 'Blue Onion', tool: 'Outreach' },
  { company: 'Fiverr', tool: 'SalesLoft' },
  { company: 'Cohere', tool: null }, // No tool specified
  { company: 'Melio', tool: 'Salesforce' }, // Skip - not our target
  { company: 'Hirewell', tool: 'Outreach' },
  { company: 'Nimble', tool: 'Salesloft' },
  { company: 'NowVertical Group Inc.', tool: 'Outreach' },
  { company: 'Sustainment', tool: 'Outreach' }, // Already exists
  { company: 'DigitalOcean', tool: 'Salesloft' },
  { company: 'Precision Point Staffing', tool: 'Outreach' },
  { company: 'Foundation Health', tool: 'Outreach' },
  { company: 'AppDirect', tool: 'Outreach' },
  { company: 'BlinkOps', tool: 'Outreach' },
  { company: 'Clarify Health Solutions', tool: 'Salesloft' },
  { company: 'Neon One', tool: 'Salesloft' },
  { company: 'Strike Social', tool: '?' }, // Unknown
  { company: 'Modern Campus', tool: 'Salesloft' },
  { company: 'Zendesk', tool: 'Outreach' },
  { company: 'Bynder', tool: 'Salesforce' }, // Skip
  { company: 'Panther', tool: 'Outreach' },
  { company: 'ControlCase', tool: 'Salesforce' }, // Skip
  { company: 'Ironclad', tool: 'Outreach' },
  { company: 'NETSCOUT', tool: 'Outreach' },
  { company: 'Array', tool: 'Outreach' },
  { company: 'Mimica', tool: 'Outreach' },
  { company: 'Value Creed', tool: 'Outreach' },
  { company: 'BlueVoyant', tool: 'Salesforce' }, // Skip
  { company: 'Unanet', tool: 'Salesforce' }, // Skip
  { company: 'Cayuse', tool: 'Salesforce.' }, // Skip (note the dot)
  { company: 'Fullbay', tool: 'Outreach' },
  { company: 'Corpay', tool: 'Outreach' },
  { company: 'Vyne', tool: 'Outreach' },
  { company: 'WaveRez', tool: 'Outreach' },
  { company: 'Lago', tool: 'Salesforce' }, // Skip
  { company: 'Oyster®', tool: 'Salesforce' }, // Skip
  { company: 'HSP Group', tool: 'Outreach' },
  { company: 'Xplor Technologies', tool: 'Outreach' },
  { company: 'Britive', tool: 'Outreach' }, // Already exists
  { company: 'Immuta', tool: 'Outreach' },
  { company: 'Configit', tool: 'Salesloft' }, // Already exists
  { company: 'SheerID', tool: 'SalesLoft' },
  { company: 'Disguise', tool: 'SalesLoft' },
  { company: 'Tavus', tool: 'Outreach' },
  { company: 'Candid Health', tool: 'Outreach' },
  { company: 'Boostlingo', tool: 'Outreach' },
  { company: 'Evidenza', tool: 'Outreach' },
  { company: 'PayJunction', tool: 'Outreach' },
  { company: 'Procore Technologies', tool: 'Outreach' }, // Already exists
  { company: 'BambooHR', tool: 'Outreach' },
  { company: 'Nintex', tool: 'Outreach' },
  { company: 'Criteria Corp', tool: 'Outreach' }
];

// Normalize tool names and filter valid entries
function normalizeToolName(tool) {
  if (!tool || tool === '?' || tool === null) return null;
  
  const toolLower = tool.toLowerCase().trim().replace('.', '');
  
  if (toolLower.includes('salesforce')) return null; // Skip Salesforce
  if (toolLower === 'outreach') return 'Outreach.io';
  if (toolLower === 'salesloft' || toolLower === 'sales loft') return 'SalesLoft';
  
  return null;
}

async function addCompanies() {
  console.log('🚀 Starting manual company insertion...\n');
  
  let added = 0;
  let skipped = 0;
  let errors = 0;
  
  // Filter and prepare valid entries
  const validEntries = companyMappings
    .map(entry => ({
      ...entry,
      tool_detected: normalizeToolName(entry.tool)
    }))
    .filter(entry => entry.tool_detected !== null);
  
  console.log(`📊 Processing ${validEntries.length} valid companies (filtered from ${companyMappings.length} total)\n`);
  
  for (const entry of validEntries) {
    try {
      // Check if company-tool combination already exists
      const { data: existing } = await supabase
        .from('identified_companies')
        .select('id')
        .eq('company', entry.company)
        .eq('tool_detected', entry.tool_detected)
        .single();
      
      if (existing) {
        console.log(`⏭️ Already exists: ${entry.company} - ${entry.tool_detected}`);
        skipped++;
        continue;
      }
      
      // Prepare company data
      const companyData = {
        company: entry.company,
        tool_detected: entry.tool_detected,
        signal_type: 'required',  // Use valid signal_type
        context: 'Manually verified from job postings',
        job_title: 'Various SDR/BDR/Sales roles',
        platform: 'Manual',
        identified_date: new Date().toISOString()
      };
      
      // Insert new entry
      const { data, error } = await supabase
        .from('identified_companies')
        .insert(companyData)
        .select();
      
      if (error) {
        console.error(`❌ Error adding ${entry.company}:`, error.message);
        errors++;
      } else {
        console.log(`✅ Added: ${entry.company} - ${entry.tool_detected}`);
        added++;
      }
      
    } catch (err) {
      console.error(`❌ Unexpected error for ${entry.company}:`, err.message);
      errors++;
    }
  }
  
  // Count skipped entries (Salesforce/unknown) - don't double count already existing
  skipped = (companyMappings.length - validEntries.length) + skipped;
  
  console.log('\n' + '═'.repeat(50));
  console.log('📈 FINAL RESULTS:');
  console.log('═'.repeat(50));
  console.log(`✅ Successfully added: ${added} companies`);
  console.log(`⏭️ Skipped (Salesforce/unknown): ${skipped} companies`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`📊 Total processed: ${companyMappings.length}`);
  
  // Get updated total count
  const { count } = await supabase
    .from('identified_companies')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n🎯 Total companies in database: ${count}`);
}

// Run the script
addCompanies().catch(console.error);