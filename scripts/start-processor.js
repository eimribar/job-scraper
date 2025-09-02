#!/usr/bin/env node

/**
 * Start the continuous processor
 * Processes all unprocessed jobs until complete
 */

const { createClient } = require('@supabase/supabase-js');
const { gpt5AnalysisService } = require('../lib/services/gpt5AnalysisService');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

let isRunning = false;
let shouldStop = false;
let jobsProcessed = 0;
let errors = 0;

async function processJobs() {
  console.log('🚀 Starting continuous processor...');
  
  // Check initial count
  const { count: unprocessed } = await supabase
    .from('raw_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('processed', false);
    
  console.log(`📊 Unprocessed jobs: ${unprocessed}`);
  console.log('⏳ Processing will continue until all jobs are complete\n');
  
  isRunning = true;
  
  while (!shouldStop) {
    try {
      // Get batch of unprocessed jobs
      const { data: jobs, error } = await supabase
        .from('raw_jobs')
        .select('*')
        .eq('processed', false)
        .order('created_at', { ascending: true })
        .limit(50);
        
      if (error) throw error;
      
      if (!jobs || jobs.length === 0) {
        console.log('✅ All jobs processed! No more unprocessed jobs found.');
        break;
      }
      
      console.log(`📦 Processing batch of ${jobs.length} jobs...`);
      
      // Process each job
      for (const job of jobs) {
        if (shouldStop) break;
        
        try {
          console.log(`  Analyzing job ${job.job_id} from ${job.company}...`);
          
          // Analyze with GPT-5
          const analysis = await gpt5AnalysisService.analyzeJob(job);
          
          // If tool detected, save to identified_companies
          if (analysis.uses_tool && analysis.tool_detected !== 'none') {
            await supabase
              .from('identified_companies')
              .insert({
                company: job.company,
                tool_detected: analysis.tool_detected,
                signal_type: analysis.signal_type,
                context: analysis.context,
                confidence: analysis.confidence,
                job_title: job.job_title,
                job_url: job.job_url,
                platform: job.platform || 'LinkedIn',
                identified_date: new Date().toISOString()
              });
              
            console.log(`  ✓ Tool detected: ${job.company} uses ${analysis.tool_detected}`);
          } else {
            console.log(`  ✗ No tool detected for ${job.company}`);
          }
          
          // Mark job as processed
          await supabase
            .from('raw_jobs')
            .update({ 
              processed: true, 
              analyzed_date: new Date().toISOString() 
            })
            .eq('job_id', job.job_id);
            
          jobsProcessed++;
          
          // Rate limiting
          await sleep(500);
          
        } catch (jobError) {
          console.error(`  ❌ Error processing job ${job.job_id}:`, jobError.message);
          errors++;
        }
      }
      
      // Status update
      if (jobsProcessed % 100 === 0) {
        console.log(`\n📈 Progress: ${jobsProcessed} jobs processed, ${errors} errors\n`);
      }
      
    } catch (error) {
      console.error('Batch error:', error);
      errors++;
      await sleep(5000);
    }
  }
  
  isRunning = false;
  console.log(`\n🎉 Processing complete!`);
  console.log(`📊 Final stats: ${jobsProcessed} jobs processed, ${errors} errors`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⏹️ Stopping processor...');
  shouldStop = true;
});

// Start processing
processJobs().catch(console.error);