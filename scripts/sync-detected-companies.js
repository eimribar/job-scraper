/**
 * Sync detected companies from job_queue to companies table
 * This makes them visible in the dashboard
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function syncDetectedCompanies() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  
  console.log('🔄 SYNCING DETECTED COMPANIES TO DASHBOARD\n');
  console.log('=' .repeat(60));
  
  // Get all analyzed jobs with tool detection
  const { data: analyzedJobs, error } = await supabase
    .from('job_queue')
    .select('*')
    .eq('payload->>analyzed', true);
  
  if (error) {
    console.error('Error fetching analyzed jobs:', error);
    return;
  }
  
  console.log(`Found ${analyzedJobs?.length || 0} analyzed jobs\n`);
  
  // Group by company and aggregate tool detection
  const companyMap = new Map();
  
  analyzedJobs?.forEach(job => {
    const analysis = job.payload?.analysis_result;
    const companyName = job.payload?.company;
    
    if (!companyName || !analysis) return;
    
    if (!companyMap.has(companyName)) {
      companyMap.set(companyName, {
        name: companyName,
        uses_outreach: false,
        uses_salesloft: false,
        uses_both: false,
        detection_confidence: 'low',
        job_titles: new Set(),
        contexts: [],
        platform: 'LinkedIn',
        job_count: 0
      });
    }
    
    const company = companyMap.get(companyName);
    company.job_count++;
    company.job_titles.add(job.payload?.job_title);
    
    if (analysis.uses_tool) {
      // Update tool detection
      if (analysis.tool_detected === 'Outreach.io') {
        company.uses_outreach = true;
      } else if (analysis.tool_detected === 'SalesLoft') {
        company.uses_salesloft = true;
      } else if (analysis.tool_detected === 'Both') {
        company.uses_outreach = true;
        company.uses_salesloft = true;
        company.uses_both = true;
      }
      
      // Update confidence (keep highest)
      if (analysis.confidence === 'high' || 
          (analysis.confidence === 'medium' && company.detection_confidence === 'low')) {
        company.detection_confidence = analysis.confidence;
      }
      
      // Collect context
      if (analysis.context) {
        company.contexts.push(analysis.context);
      }
    }
  });
  
  console.log(`Found ${companyMap.size} unique companies\n`);
  
  // Sync to companies table
  let added = 0;
  let updated = 0;
  let errors = 0;
  
  for (const [companyName, companyData] of companyMap) {
    if (!companyData.uses_outreach && !companyData.uses_salesloft) {
      continue; // Skip companies without tool detection
    }
    
    console.log(`Processing: ${companyName}`);
    console.log(`  Tools: Outreach=${companyData.uses_outreach}, SalesLoft=${companyData.uses_salesloft}`);
    console.log(`  Confidence: ${companyData.detection_confidence}`);
    console.log(`  Jobs analyzed: ${companyData.job_count}`);
    
    // Check if company already exists
    const { data: existing } = await supabase
      .from('companies')
      .select('id')
      .eq('name', companyName)
      .single();
    
    const companyRecord = {
      name: companyName,
      uses_outreach: companyData.uses_outreach,
      uses_salesloft: companyData.uses_salesloft,
      uses_both: companyData.uses_both,
      detection_confidence: companyData.detection_confidence,
      platform: companyData.platform,
      job_title: Array.from(companyData.job_titles).join(', ').substring(0, 255),
      context: companyData.contexts[0] || '',
      signal_type: 'explicit_mention',
      identified_date: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    
    if (existing) {
      // Update existing company
      const { error: updateError } = await supabase
        .from('companies')
        .update({
          uses_outreach: companyData.uses_outreach,
          uses_salesloft: companyData.uses_salesloft,
          uses_both: companyData.uses_both,
          detection_confidence: companyData.detection_confidence,
          context: companyData.contexts[0] || existing.context
        })
        .eq('id', existing.id);
      
      if (updateError) {
        console.log(`  ❌ Error updating: ${updateError.message}`);
        errors++;
      } else {
        console.log(`  ✅ Updated existing company`);
        updated++;
      }
    } else {
      // Insert new company
      const { error: insertError } = await supabase
        .from('companies')
        .insert(companyRecord);
      
      if (insertError) {
        console.log(`  ❌ Error adding: ${insertError.message}`);
        errors++;
      } else {
        console.log(`  ✅ Added to companies table`);
        added++;
      }
    }
    
    console.log();
  }
  
  // Final summary
  console.log('=' .repeat(60));
  console.log('📊 SYNC COMPLETE\n');
  console.log(`Companies processed: ${companyMap.size}`);
  console.log(`New companies added: ${added}`);
  console.log(`Existing updated: ${updated}`);
  console.log(`Errors: ${errors}`);
  
  // Get new total
  const { count: totalCompanies } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n✅ Total companies in database: ${totalCompanies}`);
  console.log('\n🎉 These companies should now appear in your dashboard!');
}

syncDetectedCompanies().catch(console.error);