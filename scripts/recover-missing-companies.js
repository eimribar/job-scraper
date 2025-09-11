/**
 * Recovery Script for Missing Companies
 * 
 * This script recovers 20 companies that were detected and notified
 * but failed to save to identified_companies due to signal_type constraint
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Missing companies identified from notifications
const missingCompanies = [
  { company: 'Lattice', tool: 'Outreach.io', date: '2025-09-10T19:30:39.013' },
  { company: 'SentinelOne', tool: 'Outreach.io', date: '2025-09-10T19:27:31.064' },
  { company: 'Swooped', tool: 'SalesLoft', date: '2025-09-10T19:16:39.603' },
  { company: 'Docker, Inc', tool: 'Outreach.io', date: '2025-09-10T19:11:21.723' },
  { company: 'Modern Health', tool: 'Outreach.io', date: '2025-09-10T16:33:00.027' },
  { company: 'Ridgeline', tool: 'Outreach.io', date: '2025-09-10T15:07:37.869' },
  { company: 'HireRight', tool: 'SalesLoft', date: '2025-09-10T14:40:37.838' },
  { company: 'OneImaging', tool: 'SalesLoft', date: '2025-09-10T14:28:03.715' },
  { company: 'AiPrise', tool: 'Outreach.io', date: '2025-09-10T13:42:11.562' },
  { company: 'Finexio', tool: 'Outreach.io', date: '2025-09-10T13:24:33.694' },
  { company: 'Linnworks', tool: 'Outreach.io', date: '2025-09-10T13:23:32.329' },
  { company: 'Kaltura', tool: 'Outreach.io', date: '2025-09-10T13:09:53.697' },
  { company: 'Entrata', tool: 'Outreach.io', date: '2025-09-10T13:09:41.923' },
  { company: 'Charlie Health', tool: 'Outreach.io', date: '2025-09-10T12:56:09.201' },
  { company: 'Anyscale', tool: 'Outreach.io', date: '2025-09-10T12:40:35.276' },
  { company: 'Human Interest', tool: 'Outreach.io', date: '2025-09-10T11:46:38.709' },
  { company: 'Wrapbook', tool: 'SalesLoft', date: '2025-09-10T11:40:04.407' },
  { company: 'Cognitiv', tool: 'SalesLoft', date: '2025-09-10T11:33:40.874' },
  { company: 'Nerdio', tool: 'SalesLoft', date: '2025-09-10T11:18:32.45' },
  { company: 'Lepide', tool: 'Outreach.io', date: '2025-09-10T10:49:35.209' }
];

async function recoverCompanies() {
  console.log('🔄 Starting recovery of missing companies...\n');
  
  let recovered = 0;
  let failed = 0;
  
  for (const missing of missingCompanies) {
    try {
      // Check if company already exists (might have been added manually)
      const { data: existing } = await supabase
        .from('identified_companies')
        .select('id, company, tool_detected')
        .eq('company', missing.company)
        .eq('tool_detected', missing.tool)
        .single();
      
      if (existing) {
        console.log(`⚠️  ${missing.company} already exists (${missing.tool})`);
        continue;
      }
      
      // Insert the missing company
      const { error } = await supabase
        .from('identified_companies')
        .insert({
          company: missing.company,
          tool_detected: missing.tool,
          signal_type: 'required', // Using valid signal_type
          context: `Recovered from notifications - originally detected ${missing.date}`,
          job_title: 'Sales Development Representative',
          job_url: 'https://linkedin.com/jobs/recovered',
          platform: 'LinkedIn',
          identified_date: missing.date,
          created_at: missing.date,
          updated_at: new Date().toISOString()
        });
      
      if (error) {
        console.log(`❌ Failed to recover ${missing.company}: ${error.message}`);
        failed++;
      } else {
        console.log(`✅ Recovered ${missing.company} (${missing.tool})`);
        recovered++;
      }
      
    } catch (error) {
      console.log(`❌ Error processing ${missing.company}: ${error.message}`);
      failed++;
    }
  }
  
  console.log('\n📊 Recovery Summary:');
  console.log(`   ✅ Successfully recovered: ${recovered} companies`);
  console.log(`   ❌ Failed: ${failed} companies`);
  console.log(`   📋 Total processed: ${missingCompanies.length} companies`);
  
  // Verify final count
  const { count } = await supabase
    .from('identified_companies')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n📈 Total companies in database: ${count}`);
}

// Run the recovery
recoverCompanies().catch(console.error);