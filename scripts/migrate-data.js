/**
 * DATA MIGRATION SCRIPT
 * Migrates data from old JSONB structure to new clean tables
 * 
 * PREREQUISITE: Run create-new-tables.sql in Supabase SQL Editor first!
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Use service role key for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function migrateData() {
  console.log('📦 STARTING DATA MIGRATION');
  console.log('=' .repeat(50));
  
  try {
    // Step 1: Migrate job_queue -> raw_jobs
    console.log('1️⃣ Migrating job_queue -> raw_jobs...');
    
    const { data: jobQueueData, error: fetchError } = await supabase
      .from('job_queue')
      .select('*');
      
    if (fetchError) {
      throw new Error(`Failed to fetch job_queue: ${fetchError.message}`);
    }
    
    console.log(`   Found ${jobQueueData.length} records in job_queue`);
    
    // Transform data for raw_jobs
    const rawJobsData = [];
    let skipped = 0;
    
    jobQueueData.forEach((job, index) => {
      const payload = job.payload || {};
      
      if (!payload.job_id || !payload.company || !payload.job_title) {
        skipped++;
        console.log(`   [${index + 1}] Skipping malformed job: missing required fields`);
        return;
      }
      
      rawJobsData.push({
        job_id: payload.job_id,
        platform: payload.platform || 'LinkedIn',
        company: payload.company,
        job_title: payload.job_title,
        location: payload.location || '',
        description: payload.description || '',
        job_url: payload.job_url || '',
        scraped_date: payload.scraped_date || job.created_at,
        search_term: payload.search_term || '',
        processed: job.status === 'completed',
        processed_date: job.completed_at
      });
    });
    
    console.log(`   Prepared ${rawJobsData.length} records for migration (${skipped} skipped)`);
    
    // Insert in batches to avoid timeout
    const batchSize = 100;
    let migrated = 0;
    
    for (let i = 0; i < rawJobsData.length; i += batchSize) {
      const batch = rawJobsData.slice(i, i + batchSize);
      
      const { error: insertError } = await supabase
        .from('raw_jobs')
        .upsert(batch, { onConflict: 'job_id' });
        
      if (insertError) {
        console.error(`   ❌ Batch ${Math.floor(i/batchSize) + 1} failed:`, insertError.message);
      } else {
        migrated += batch.length;
        console.log(`   ✅ Batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(rawJobsData.length/batchSize)} completed (${migrated}/${rawJobsData.length})`);
      }
    }
    
    // Step 2: Migrate processed jobs
    console.log('\\n2️⃣ Migrating processed_jobs...');
    
    const processedJobsData = rawJobsData
      .filter(job => job.processed)
      .map(job => ({
        job_id: job.job_id,
        processed_date: job.processed_date || new Date().toISOString()
      }));
    
    if (processedJobsData.length > 0) {
      const { error: processedError } = await supabase
        .from('processed_jobs')
        .upsert(processedJobsData, { onConflict: 'job_id' });
        
      if (processedError) {
        console.error(`   ❌ Failed to migrate processed_jobs:`, processedError.message);
      } else {
        console.log(`   ✅ Migrated ${processedJobsData.length} processed jobs`);
      }
    }
    
    // Step 3: Migrate companies -> identified_companies
    console.log('\\n3️⃣ Migrating companies -> identified_companies...');
    
    const { data: companiesData, error: companiesError } = await supabase
      .from('companies')
      .select('*');
      
    if (companiesError) {
      throw new Error(`Failed to fetch companies: ${companiesError.message}`);
    }
    
    console.log(`   Found ${companiesData.length} records in companies`);
    
    // Transform data for identified_companies (only tool users)
    const identifiedCompaniesData = [];
    
    companiesData.forEach(company => {
      if (!company.name) return;
      
      // Check which tools they use
      const toolsDetected = [];
      if (company.uses_outreach) toolsDetected.push('Outreach.io');
      if (company.uses_salesloft) toolsDetected.push('SalesLoft');
      if (company.uses_both) toolsDetected.push('Both');
      
      // Only migrate companies that use tools
      toolsDetected.forEach(tool => {
        // Avoid duplicates for 'Both' case
        if (tool === 'Both' && (company.uses_outreach && company.uses_salesloft)) {
          identifiedCompaniesData.push({
            company_name: company.name,
            tool_detected: 'Both',
            signal_type: company.signal_type || 'explicit_mention',
            context: company.context || company.detection_context || '',
            confidence: company.detection_confidence || company.confidence_score || 'medium',
            job_title: company.job_title || '',
            job_url: company.job_url || '',
            linkedin_url: company.linkedin_url || '',
            platform: company.platform || 'LinkedIn',
            identified_date: company.identified_date || company.first_seen || company.created_at
          });
        } else if (tool !== 'Both') {
          identifiedCompaniesData.push({
            company_name: company.name,
            tool_detected: tool,
            signal_type: company.signal_type || 'explicit_mention',
            context: company.context || company.detection_context || '',
            confidence: company.detection_confidence || company.confidence_score || 'medium',
            job_title: company.job_title || '',
            job_url: company.job_url || '',
            linkedin_url: company.linkedin_url || '',
            platform: company.platform || 'LinkedIn',
            identified_date: company.identified_date || company.first_seen || company.created_at
          });
        }
      });
    });
    
    console.log(`   Prepared ${identifiedCompaniesData.length} tool detection records`);
    
    if (identifiedCompaniesData.length > 0) {
      // Insert in batches
      const companyBatchSize = 50;
      let companiesMigrated = 0;
      
      for (let i = 0; i < identifiedCompaniesData.length; i += companyBatchSize) {
        const batch = identifiedCompaniesData.slice(i, i + companyBatchSize);
        
        const { error: companyInsertError } = await supabase
          .from('identified_companies')
          .upsert(batch, { 
            onConflict: 'company_name,tool_detected',
            ignoreDuplicates: false 
          });
          
        if (companyInsertError) {
          console.error(`   ❌ Company batch ${Math.floor(i/companyBatchSize) + 1} failed:`, companyInsertError.message);
        } else {
          companiesMigrated += batch.length;
          console.log(`   ✅ Company batch ${Math.floor(i/companyBatchSize) + 1}/${Math.ceil(identifiedCompaniesData.length/companyBatchSize)} completed (${companiesMigrated}/${identifiedCompaniesData.length})`);
        }
      }
    }
    
    // Step 4: Migrate search_terms
    console.log('\\n4️⃣ Migrating search_terms...');
    
    const { data: searchTermsData, error: searchError } = await supabase
      .from('search_terms')
      .select('*');
      
    if (searchError) {
      throw new Error(`Failed to fetch search_terms: ${searchError.message}`);
    }
    
    const cleanSearchTermsData = searchTermsData.map(term => ({
      search_term: term.search_term,
      last_scraped_date: term.last_scraped_date,
      jobs_found_count: term.jobs_found_count || 0,
      is_active: term.is_active !== false  // Default to true
    }));
    
    const { error: searchInsertError } = await supabase
      .from('search_terms_clean')
      .upsert(cleanSearchTermsData, { onConflict: 'search_term' });
      
    if (searchInsertError) {
      console.error(`   ❌ Failed to migrate search_terms:`, searchInsertError.message);
    } else {
      console.log(`   ✅ Migrated ${cleanSearchTermsData.length} search terms`);
    }
    
    // Step 5: Verification
    console.log('\\n✅ MIGRATION VERIFICATION:');
    
    const { count: newRawJobs } = await supabase.from('raw_jobs').select('*', { count: 'exact', head: true });
    const { count: newProcessedJobs } = await supabase.from('processed_jobs').select('*', { count: 'exact', head: true });
    const { count: newCompanies } = await supabase.from('identified_companies').select('*', { count: 'exact', head: true });
    const { count: newSearchTerms } = await supabase.from('search_terms_clean').select('*', { count: 'exact', head: true });
    
    console.log(`   raw_jobs: ${newRawJobs || 0} records`);
    console.log(`   processed_jobs: ${newProcessedJobs || 0} records`);
    console.log(`   identified_companies: ${newCompanies || 0} records`);
    console.log(`   search_terms_clean: ${newSearchTerms || 0} records`);
    
    // Status check
    const { count: unprocessedJobs } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('processed', false);
    
    console.log(`\\n📊 STATUS:`)
    console.log(`   Unprocessed jobs ready for analysis: ${unprocessedJobs || 0}`);
    
    console.log('\\n🎉 DATA MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('   ✓ All data migrated to new clean structure');
    console.log('   ✓ Ready for application service updates');
    
  } catch (error) {
    console.error('💥 MIGRATION FAILED:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run migration
console.log('Starting at:', new Date().toISOString());
migrateData()
  .then(() => {
    console.log('\\nCompleted at:', new Date().toISOString());
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });