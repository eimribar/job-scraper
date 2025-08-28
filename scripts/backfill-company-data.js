/**
 * BACKFILL COMPANY DATA
 * Populate missing job_title, job_url, signal_type, and requirement_level 
 * from job_queue analysis results to companies table
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function backfillCompanyData() {
  console.log('🔄 BACKFILLING COMPANY DATA FROM JOB_QUEUE\n');
  console.log('=' .repeat(60));

  // Get all companies that need data
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name, job_title, job_url, signal_type, requirement_level, uses_outreach, uses_salesloft')
    .order('name');

  if (!companies || companies.length === 0) {
    console.log('❌ No companies found');
    return;
  }

  console.log('📊 Processing', companies.length, 'companies...\n');

  let updated = 0;
  let foundJobData = 0;
  let notFound = 0;

  for (const company of companies) {
    try {
      console.log(`🔍 Processing: ${company.name}`);

      // Find job_queue entries for this company with analysis results
      const { data: jobs } = await supabase
        .from('job_queue')
        .select('payload')
        .eq('payload->>company', company.name)
        .eq('payload->>analyzed', true)
        .limit(5); // Get up to 5 jobs for this company

      if (!jobs || jobs.length === 0) {
        console.log(`  ❌ No analyzed jobs found`);
        notFound++;
        continue;
      }

      // Find the best job data for this company
      let bestJob = null;
      let bestAnalysis = null;

      for (const job of jobs) {
        const analysis = job.payload?.analysis_result;
        
        // Look for a job with tool detection
        if (analysis?.uses_tool === true || 
            (analysis?.tool_detected && analysis.tool_detected !== 'None')) {
          
          // Check if this matches the company's detected tools
          const matchesOutreach = company.uses_outreach && 
            (analysis.tool_detected === 'Outreach.io' || analysis.tool_detected === 'Both');
          const matchesSalesLoft = company.uses_salesloft && 
            (analysis.tool_detected === 'SalesLoft' || analysis.tool_detected === 'Both');
          
          if (matchesOutreach || matchesSalesLoft) {
            bestJob = job.payload;
            bestAnalysis = analysis;
            break; // Found the matching detection job
          }
        }
      }

      // If no tool detection job found, use the first job with data
      if (!bestJob) {
        bestJob = jobs.find(job => 
          job.payload?.job_title || job.payload?.job_url
        )?.payload;
        bestAnalysis = bestJob?.analysis_result;
      }

      if (!bestJob) {
        console.log(`  ❌ No usable job data found`);
        notFound++;
        continue;
      }

      // Prepare update data
      const updateData = {};
      let hasUpdates = false;

      // Update job_title if missing
      if (!company.job_title && bestJob.job_title) {
        updateData.job_title = bestJob.job_title;
        hasUpdates = true;
        console.log(`    ✅ Adding job_title: ${bestJob.job_title}`);
      }

      // Update job_url if missing  
      if (!company.job_url && bestJob.job_url) {
        updateData.job_url = bestJob.job_url;
        hasUpdates = true;
        console.log(`    ✅ Adding job_url: ${bestJob.job_url.substring(0, 50)}...`);
      }

      // Update signal_type if missing
      if (!company.signal_type && bestAnalysis?.signal_type) {
        updateData.signal_type = bestAnalysis.signal_type;
        hasUpdates = true;
        console.log(`    ✅ Adding signal_type: ${bestAnalysis.signal_type}`);
      }

      // Update requirement_level if missing
      if (!company.requirement_level && bestAnalysis?.requirement_level) {
        updateData.requirement_level = bestAnalysis.requirement_level;
        hasUpdates = true;
        console.log(`    ✅ Adding requirement_level: ${bestAnalysis.requirement_level}`);
      }

      // Set defaults for missing analysis fields
      if (!company.signal_type && !bestAnalysis?.signal_type) {
        updateData.signal_type = 'stack_mention'; // Default for older data
        hasUpdates = true;
        console.log(`    📝 Setting default signal_type: stack_mention`);
      }

      if (!company.requirement_level && !bestAnalysis?.requirement_level) {
        updateData.requirement_level = 'mentioned'; // Default for older data
        hasUpdates = true;
        console.log(`    📝 Setting default requirement_level: mentioned`);
      }

      // Update the company if we have changes
      if (hasUpdates) {
        const { error } = await supabase
          .from('companies')
          .update(updateData)
          .eq('id', company.id);

        if (error) {
          console.log(`    ❌ Update failed: ${error.message}`);
        } else {
          updated++;
          foundJobData++;
          console.log(`    ✅ Updated successfully`);
        }
      } else {
        console.log(`    ⭕ No updates needed`);
        foundJobData++;
      }

    } catch (error) {
      console.log(`    ❌ Error processing ${company.name}: ${error.message}`);
    }

    console.log(''); // Empty line between companies
  }

  // Final summary
  console.log('=' .repeat(60));
  console.log('📊 BACKFILL COMPLETE\n');
  console.log(`Total companies processed: ${companies.length}`);
  console.log(`Companies updated: ${updated}`);
  console.log(`Companies with job data found: ${foundJobData}`);
  console.log(`Companies with no job data: ${notFound}`);
  console.log(`Success rate: ${Math.round((foundJobData / companies.length) * 100)}%`);

  // Check final completion status
  console.log('\n🔍 FINAL STATUS CHECK:');
  
  const { count: stillMissingTitles } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true })
    .is('job_title', null);
    
  const { count: stillMissingUrls } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true })
    .is('job_url', null);
    
  const { count: stillMissingSignal } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true })
    .is('signal_type', null);
    
  const { count: stillMissingRequirement } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true })
    .is('requirement_level', null);

  console.log(`Still missing job_title: ${stillMissingTitles}`);
  console.log(`Still missing job_url: ${stillMissingUrls}`);
  console.log(`Still missing signal_type: ${stillMissingSignal}`);
  console.log(`Still missing requirement_level: ${stillMissingRequirement}`);

  const totalFields = companies.length * 4; // 4 fields per company
  const populatedFields = totalFields - (stillMissingTitles + stillMissingUrls + stillMissingSignal + stillMissingRequirement);
  
  console.log(`\n🎯 Overall completion: ${Math.round((populatedFields / totalFields) * 100)}%`);
}

// Run the backfill
console.log('🚀 Sales Tool Detector - Company Data Backfill');
console.log('Starting backfill process...\n');

backfillCompanyData().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});