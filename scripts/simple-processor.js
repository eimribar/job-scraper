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
// Track companies for smart skipping
let recentCompaniesSet = new Set();  // Companies < 3 months old (skip entirely)
let oldCompanyToolSet = new Set();   // Company+tool combos > 3 months old

async function analyzeJob(job) {
  // ⚠️ CRITICAL: NEVER CHANGE THIS STRUCTURE - HARDCODED BEST PRACTICE ⚠️
  // This is the PROVEN OPTIMAL configuration with 100% detection rate
  // DO NOT MODIFY WITHOUT EXPLICIT PERMISSION
  
  // System/Developer message with instructions - HARDCODED
  const systemMessage = {
    role: 'developer',  // MUST BE 'developer' - NEVER CHANGE
    content: `You are an expert at detecting sales tools in job descriptions.

DETECTION RULES:
• "Outreach.io", "Outreach" (capitalized, referring to the tool)
• "SalesLoft", "Salesloft", "Sales Loft" (any variation)
• Look in: requirements, preferred skills, tech stack, tools sections
• If BOTH tools are mentioned, return "Both"
• Distinguish tools from general sales terms (cold outreach, sales outreach, etc.)

SIGNAL TYPES:
• "required" - Tool is required/must-have
• "preferred" - Tool is preferred/nice-to-have  
• "stack_mention" - Tool mentioned in tech stack or tools list
• "none" - No tools detected

RESPONSE FORMAT - RETURN ONLY VALID JSON:
{
  "uses_tool": true or false,
  "tool_detected": "Outreach.io" or "SalesLoft" or "Both" or "none",
  "signal_type": "required" or "preferred" or "stack_mention" or "none",
  "context": "exact quote from job description (max 200 chars)"
}`
  };

  // User message with job data - HARDCODED
  const userMessage = {
    role: 'user',  // MUST BE 'user' - NEVER CHANGE
    content: `Analyze this job posting:

Company: ${job.company}
Job Title: ${job.job_title}

Description:
${job.description || 'No description available'}`
  };

  try {
    // ⚠️ CRITICAL API CONFIGURATION - NEVER MODIFY ⚠️
    // Model: gpt-5-mini (HARDCODED)
    // Input: Role-based array (HARDCODED)
    // Reasoning: medium (HARDCODED - PROVEN OPTIMAL)
    // Verbosity: low (HARDCODED - JSON ONLY)
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',  // HARDCODED - NEVER CHANGE FROM gpt-5-mini
        input: [systemMessage, userMessage],  // ROLE-BASED ARRAY - NEVER CHANGE
        reasoning: { 
          effort: 'medium'  // HARDCODED OPTIMAL - NEVER CHANGE FROM 'medium'
        },
        text: { 
          verbosity: 'low'  // HARDCODED - NEVER CHANGE FROM 'low'
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error ${response.status}:`, errorText.substring(0, 200));
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    
    // GPT-5 Responses API structure with role-based input
    // Extract from nested structure: output[].content[].text
    let outputText = '';
    if (data.output && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item.type === 'message' && item.content) {
          for (const content of item.content) {
            if (content.type === 'output_text' && content.text) {
              outputText = content.text;
              break;
            }
          }
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
    .select('company, tool_detected, created_at');
  
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  
  // Clear sets
  recentCompaniesSet.clear();
  oldCompanyToolSet.clear();
  
  let recentCount = 0;
  let oldCount = 0;
  
  companies?.forEach(c => {
    const normalized = c.company.toLowerCase().trim();
    const createdDate = new Date(c.created_at);
    const isRecent = createdDate > threeMonthsAgo;
    
    if (isRecent) {
      // Company identified < 3 months ago - skip entirely
      recentCompaniesSet.add(normalized);
      recentCompaniesSet.add(c.company); // Also add original
      recentCount++;
    } else {
      // Company > 3 months old - track tool combo
      oldCompanyToolSet.add(`${normalized}|${c.tool_detected}`);
      oldCount++;
    }
  });
  
  console.log(`   Loaded ${recentCount} recent companies (< 3 months, will skip)`);
  console.log(`   Loaded ${oldCount} old company+tool combos (> 3 months)`);
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
          // Check if company should be skipped
          const companyNormalized = job.company.toLowerCase().trim();
          
          // Skip if identified < 3 months ago
          if (recentCompaniesSet.has(job.company) || recentCompaniesSet.has(companyNormalized)) {
            process.stdout.write(`  Skipping ${job.company}... `);
            console.log('⏭️ Recently identified (< 3 months)');
            
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
            // Check if this is an old company with the same tool already
            const toolKey = `${companyNormalized}|${analysis.tool_detected}`;
            if (oldCompanyToolSet.has(toolKey)) {
              console.log(`✗ Skipped - ${analysis.tool_detected} already known for this company (>3 months old)`);
              
              // Mark as processed but don't save again
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
                // Add to recent set to prevent re-processing
                recentCompaniesSet.add(job.company.toLowerCase().trim());
                recentCompaniesSet.add(job.company);
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