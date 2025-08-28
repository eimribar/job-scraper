/**
 * CLEANUP FALSE POSITIVES FROM GPT-3.5 DISASTER
 * Remove all wrongly detected companies and reset for re-analysis
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function cleanupFalsePositives() {
  console.log('🧹 CLEANING UP FALSE POSITIVES FROM GPT-3.5 DISASTER\n');
  console.log('=' .repeat(60));
  
  // Step 1: Get all analyzed jobs to check what was detected
  console.log('📊 Analyzing false detections...\n');
  
  const { data: analyzedJobs } = await supabase
    .from('job_queue')
    .select('*')
    .eq('payload->>analyzed', true);
  
  console.log(`Total analyzed jobs: ${analyzedJobs?.length || 0}`);
  
  // Count false positives
  let falsePositives = 0;
  let legitimateDetections = 0;
  const companiesWithFalseDetections = new Set();
  const jobsToReset = [];
  
  analyzedJobs?.forEach(job => {
    const result = job.payload?.analysis_result;
    if (!result) return;
    
    // Check for false positive tools
    if (result.tool_detected && 
        result.tool_detected !== 'None' && 
        result.tool_detected !== 'Outreach.io' && 
        result.tool_detected !== 'SalesLoft' &&
        result.tool_detected !== 'Both') {
      // This is a FALSE POSITIVE (HubSpot, Salesforce, Notion, etc.)
      falsePositives++;
      companiesWithFalseDetections.add(job.payload.company);
      jobsToReset.push(job.id);
      console.log(`  FALSE: ${job.payload.company} - detected "${result.tool_detected}"`);
    } else if (result.tool_detected === 'Outreach.io' || 
               result.tool_detected === 'SalesLoft' || 
               result.tool_detected === 'Both') {
      legitimateDetections++;
    }
  });
  
  console.log(`\n📈 Detection Analysis:`);
  console.log(`  Legitimate (Outreach/SalesLoft): ${legitimateDetections}`);
  console.log(`  FALSE POSITIVES: ${falsePositives}`);
  console.log(`  Companies with false detections: ${companiesWithFalseDetections.size}`);
  
  // Step 2: Reset all job analysis flags
  console.log('\n🔄 Resetting analysis flags on ALL jobs...');
  
  let resetCount = 0;
  for (const job of analyzedJobs || []) {
    // Reset the analysis flag
    job.payload.analyzed = false;
    delete job.payload.analysis_result;
    delete job.payload.analysis_date;
    
    await supabase
      .from('job_queue')
      .update({ 
        payload: job.payload,
        status: 'pending',
        completed_at: null
      })
      .eq('id', job.id);
    
    resetCount++;
    
    if (resetCount % 50 === 0) {
      console.log(`  Reset ${resetCount}/${analyzedJobs.length} jobs...`);
    }
  }
  
  console.log(`  ✅ Reset ${resetCount} jobs for re-analysis`);
  
  // Step 3: Clean up companies table
  console.log('\n🗑️  Cleaning companies table...');
  
  // Get companies added recently (likely from false detections)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  const { data: recentCompanies } = await supabase
    .from('companies')
    .select('*')
    .gte('created_at', yesterday.toISOString());
  
  console.log(`  Recent companies (last 24h): ${recentCompanies?.length || 0}`);
  
  // Delete companies that shouldn't be there
  let deletedCount = 0;
  for (const company of recentCompanies || []) {
    // Keep only if they truly use Outreach or SalesLoft
    // For now, delete all recent additions since they were from GPT-3.5
    if (company.created_at > yesterday.toISOString()) {
      await supabase
        .from('companies')
        .delete()
        .eq('id', company.id);
      deletedCount++;
    }
  }
  
  console.log(`  ✅ Removed ${deletedCount} potentially false companies`);
  
  // Step 4: Get current counts
  const { count: totalJobs } = await supabase
    .from('job_queue')
    .select('*', { count: 'exact', head: true });
    
  const { count: pendingJobs } = await supabase
    .from('job_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
    
  const { count: companiesCount } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true });
  
  console.log('\n' + '=' .repeat(60));
  console.log('✅ CLEANUP COMPLETE!\n');
  console.log('Current Status:');
  console.log(`  Total jobs: ${totalJobs}`);
  console.log(`  Jobs ready for re-analysis: ${pendingJobs}`);
  console.log(`  Companies in database: ${companiesCount}`);
  
  console.log('\n🎯 NEXT STEP:');
  console.log('Run the analysis with GPT-5-mini-2025-08-07 to get REAL results!');
  console.log('Command: node scripts/process-all-pending.js');
}

cleanupFalsePositives().catch(console.error);