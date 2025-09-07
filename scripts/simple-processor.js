#!/usr/bin/env node

/**
 * Simple processor to analyze remaining jobs
 * Uses GPT-5 API directly without TypeScript dependencies
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

let jobsProcessed = 0;
let companiesFound = 0;
let errors = 0;
let jobsSkipped = 0;
let identifiedCompaniesSet = new Set();

async function analyzeJob(job) {
  const prompt = `Analyze this job description to identify if the company uses Outreach.io or SalesLoft.

IMPORTANT RULES:
1. Distinguish between "Outreach" (the tool) and "outreach" (general sales activity)
2. Look for explicit tool mentions, not general sales terms
3. Return ONLY valid JSON, no additional text

Valid indicators for Outreach.io:
- "Outreach.io" (explicit mention)
- "Outreach platform"
- "Outreach sequences"
- Capitalized "Outreach" when listed with other tools
- "experience with Outreach" (when clearly referring to the tool)

NOT valid (just general sales terms):
- "sales outreach"
- "cold outreach"
- "outreach efforts"
- "customer outreach"
- lowercase "outreach" in general context

Valid indicators for SalesLoft:
- "SalesLoft" or "Sales Loft"
- "Salesloft platform"
- Listed with other sales tools

Company: ${job.company}
Job Title: ${job.job_title}
Description: ${job.description || 'No description available'}

Return this exact JSON structure:
{
  "uses_tool": true or false,
  "tool_detected": "Outreach.io" or "SalesLoft" or "Both" or "none",
  "signal_type": "required" or "preferred" or "stack_mention" or "none",
  "context": "exact quote from the job description mentioning the tool (max 200 chars)"
}`;

  try {
    // ONLY GPT-5 - NEVER GPT-4!
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-5-mini', // GPT-5 ONLY!!!
        input: prompt,
        reasoning: { 
          effort: 'minimal'
        },
        text: { 
          verbosity: 'low'
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error ${response.status}:`, errorText.substring(0, 200));
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    
    // GPT-5 Responses API structure: output[1].content[0].text
    let outputText = '';
    if (data.output && Array.isArray(data.output) && data.output.length > 1) {
      const messageOutput = data.output[1];
      if (messageOutput && messageOutput.content && Array.isArray(messageOutput.content)) {
        const textContent = messageOutput.content.find(c => c.type === 'output_text');
        if (textContent && textContent.text) {
          outputText = textContent.text;
        }
      }
    }
    
    // Debug: log first analysis to see what GPT-5 returns
    if (jobsProcessed === 0 && outputText) {
      console.log('\n[DEBUG] First GPT-5 response:', outputText.substring(0, 500));
    }
    
    try {
      return outputText ? JSON.parse(outputText) : {
        uses_tool: false,
        tool_detected: 'none',
        signal_type: 'none',
        context: ''
      };
    } catch (parseError) {
      console.error('Failed to parse response:', outputText);
      return {
        uses_tool: false,
        tool_detected: 'none',
        signal_type: 'none',
        context: ''
      };
    }
  } catch (error) {
    console.error('Analysis error:', error.message);
    return {
      uses_tool: false,
      tool_detected: 'none',
      signal_type: 'none',
      context: ''
    };
  }
}

async function loadIdentifiedCompanies() {
  console.log('📋 Loading identified companies...');
  
  const { data: companies } = await supabase
    .from('identified_companies')
    .select('company, tool_detected');
    
  companies?.forEach(c => {
    // Store normalized company name for better matching
    const normalized = c.company.toLowerCase().trim();
    identifiedCompaniesSet.add(normalized);
    // Also store original name
    identifiedCompaniesSet.add(c.company);
  });
  
  console.log(`   Loaded ${identifiedCompaniesSet.size} company variations`);
}

async function processJobs() {
  console.log('🚀 Starting simple processor...');
  
  // Load already identified companies
  await loadIdentifiedCompanies();
  
  // Check initial count
  const { count: unprocessed } = await supabase
    .from('raw_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('processed', false);
    
  console.log(`📊 Unprocessed jobs: ${unprocessed}`);
  console.log('⏳ Processing will continue until all jobs are complete\n');
  
  let shouldStop = false;
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n⏹️ Stopping processor...');
    shouldStop = true;
  });
  
  while (!shouldStop) {
    try {
      // Get batch of unprocessed jobs
      const { data: jobs, error } = await supabase
        .from('raw_jobs')
        .select('*')
        .eq('processed', false)
        .order('created_at', { ascending: true })
        .limit(25); // Smaller batch for stability
        
      if (error) throw error;
      
      if (!jobs || jobs.length === 0) {
        console.log('✅ All jobs processed! No more unprocessed jobs found.');
        break;
      }
      
      console.log(`\n📦 Processing batch of ${jobs.length} jobs...`);
      
      // Process each job
      for (const job of jobs) {
        if (shouldStop) break;
        
        try {
          // Check if company already identified
          const companyNormalized = job.company.toLowerCase().trim();
          if (identifiedCompaniesSet.has(job.company) || identifiedCompaniesSet.has(companyNormalized)) {
            process.stdout.write(`  Skipping ${job.company}... `);
            console.log('⏭️ Already identified');
            
            // Mark as processed but skipped
            await supabase
              .from('raw_jobs')
              .update({ 
                processed: true, 
                analyzed_date: new Date().toISOString() 
              })
              .eq('job_id', job.job_id);
              
            jobsSkipped++;
            continue;
          }
          
          // Double-check if job already processed (safety check)
          const { data: existingJob } = await supabase
            .from('raw_jobs')
            .select('processed')
            .eq('job_id', job.job_id)
            .single();
            
          if (existingJob?.processed) {
            console.log(`  ⚠️ Job ${job.job_id} already processed, skipping`);
            continue;
          }
          
          process.stdout.write(`  Analyzing ${job.company}... `);
          
          // Add to processing queue
          await supabase
            .from('processing_queue')
            .upsert({
              job_id: job.job_id,
              status: 'processing',
              started_at: new Date().toISOString()
            }, {
              onConflict: 'job_id'
            });
          
          // Analyze with OpenAI
          const analysis = await analyzeJob(job);
          
          // If tool detected, save to identified_companies
          if (analysis.uses_tool && analysis.tool_detected !== 'none') {
            // First check if company+tool combination already exists
            const { data: existing } = await supabase
              .from('identified_companies')
              .select('id')
              .eq('company', job.company)
              .eq('tool_detected', analysis.tool_detected)
              .single();
            
            if (existing) {
              // Update existing record
              const { error: updateError } = await supabase
                .from('identified_companies')
                .update({
                  signal_type: analysis.signal_type,
                  context: analysis.context,
                  job_title: job.job_title,
                  job_url: job.job_url,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existing.id);
                
              if (!updateError) {
                console.log(`✓ Updated ${analysis.tool_detected}`);
              } else {
                console.log(`⚠️ Update error: ${updateError.message}`);
              }
            } else {
              // Insert new record
              const { error: insertError } = await supabase
                .from('identified_companies')
                .insert({
                  company: job.company,
                  tool_detected: analysis.tool_detected,
                  signal_type: analysis.signal_type,
                  context: analysis.context,
                  job_title: job.job_title,
                  job_url: job.job_url,
                  platform: job.platform || 'LinkedIn',
                  identified_date: new Date().toISOString()
                });
                
              if (!insertError) {
                console.log(`✓ ${analysis.tool_detected}`);
                companiesFound++;
                // Add to set to prevent re-processing
                identifiedCompaniesSet.add(job.company.toLowerCase().trim());
              } else {
                console.log(`⚠️ Insert error: ${insertError.message}`);
              }
            }
          } else {
            console.log(`✗ No tool`);
          }
          
          // Mark job as processed
          await supabase
            .from('raw_jobs')
            .update({ 
              processed: true, 
              analyzed_date: new Date().toISOString() 
            })
            .eq('job_id', job.job_id);
            
          // Update processing queue
          await supabase
            .from('processing_queue')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString()
            })
            .eq('job_id', job.job_id);
            
          jobsProcessed++;
          
          // Rate limiting
          await sleep(1000); // 1 second between API calls
          
        } catch (jobError) {
          console.log(`❌ Error: ${jobError.message}`);
          errors++;
          
          // Update processing queue with error
          await supabase
            .from('processing_queue')
            .update({
              status: 'error',
              error_message: jobError.message
            })
            .eq('job_id', job.job_id);
        }
      }
      
      // Status update
      console.log(`\n📈 Progress: ${jobsProcessed} processed, ${jobsSkipped} skipped, ${companiesFound} new companies found, ${errors} errors`);
      
    } catch (error) {
      console.error('Batch error:', error.message);
      errors++;
      await sleep(5000);
    }
  }
  
  console.log(`\n🎉 Processing complete!`);
  console.log(`📊 Final stats:`);
  console.log(`   Jobs analyzed: ${jobsProcessed}`);
  console.log(`   Jobs skipped: ${jobsSkipped} (already identified)`);
  console.log(`   New companies found: ${companiesFound}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   API calls saved: ${jobsSkipped}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Start processing
processJobs().catch(console.error);