#!/usr/bin/env node

/**
 * Continuous Job Analysis Script with GPT-5 Responses API
 * ⚠️ CRITICAL: HARDCODED CONFIGURATION - DO NOT MODIFY ⚠️
 * - Uses GPT-5-mini via Responses API (NOT Chat Completions)
 * - Role-based input structure (developer + user messages)
 * - Reasoning effort: 'medium' (PROVEN OPTIMAL)
 * - Verbosity: 'low' (JSON only)
 * NEVER change ANY of these settings without explicit permission
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Stats tracking
const stats = {
  startTime: new Date(),
  totalAnalyzed: 0,
  toolsDetected: 0,
  errors: 0,
  isRunning: false
};

/**
 * Analyze job using GPT-5 Responses API with HARDCODED configuration
 * ⚠️ DO NOT MODIFY THIS FUNCTION WITHOUT EXPLICIT PERMISSION ⚠️
 */
async function analyzeJobWithGPT(job) {
  // HARDCODED SYSTEM MESSAGE - NEVER CHANGE
  const systemMessage = {
    role: 'developer',  // MUST BE 'developer'
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

  // HARDCODED USER MESSAGE - NEVER CHANGE
  const userMessage = {
    role: 'user',  // MUST BE 'user'
    content: `Analyze this job posting:

Company: ${job.company}
Job Title: ${job.job_title}

Description:
${job.description}`
  };

  try {
    // ⚠️ CRITICAL API CONFIGURATION - NEVER MODIFY ⚠️
    const timeoutMs = 30 * 1000;
    const apiPromise = fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',  // HARDCODED - NEVER CHANGE
        input: [systemMessage, userMessage],  // ROLE-BASED ARRAY - NEVER CHANGE
        reasoning: { 
          effort: 'medium'  // HARDCODED OPTIMAL - NEVER CHANGE
        },
        text: { 
          verbosity: 'low'  // HARDCODED - NEVER CHANGE
        }
      })
    });
    
    const response = await Promise.race([
      apiPromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`OpenAI API timeout after ${timeoutMs/1000}s`)), timeoutMs)
      )
    ]);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GPT-5 API error: ${response.status} - ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();
    
    // Extract output from GPT-5 Responses API structure
    let result = '';
    if (data.output && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item.type === 'message' && item.content) {
          for (const content of item.content) {
            if (content.type === 'output_text' && content.text) {
              result = content.text;
              break;
            }
          }
        }
      }
    }
    
    if (!result || result.length === 0) {
      throw new Error('Empty response from GPT-5');
    }
    
    // Parse the response as JSON
    let analysisResult;
    try {
      analysisResult = JSON.parse(result);
    } catch (parseError) {
      console.error('Failed to parse GPT response:', result.substring(0, 100));
      analysisResult = {
        uses_tool: false,
        tool_detected: 'none',
        signal_type: 'none',
        context: ''
      };
    }
    
    return {
      uses_tool: analysisResult.uses_tool || false,
      tool_detected: analysisResult.tool_detected || 'none',
      signal_type: analysisResult.signal_type || 'none',
      context: analysisResult.context || '',
      // Note: confidence field removed from schema
      job_id: job.job_id,
      company: job.company,
      job_title: job.job_title,
      job_url: job.job_url,
      platform: job.platform || 'LinkedIn'
    };
    
  } catch (error) {
    console.error('GPT-5 analysis error:', error.message);
    return {
      uses_tool: false,
      tool_detected: 'none',
      signal_type: 'none',
      context: '',
      job_id: job.job_id,
      company: job.company,
      job_title: job.job_title,
      job_url: job.job_url,
      platform: job.platform || 'LinkedIn',
      error: error.message
    };
  }
}

/**
 * Process a single job
 */
async function processJob(job) {
  try {
    console.log(`[${stats.totalAnalyzed + 1}] Analyzing ${job.company} - ${job.job_title}`);
    
    // Analyze with GPT-5
    const analysis = await analyzeJobWithGPT(job);
    stats.totalAnalyzed++;
    
    if (analysis.uses_tool && analysis.tool_detected !== 'none') {
      stats.toolsDetected++;
      console.log(`  ✅ Tool detected: ${analysis.tool_detected} (${analysis.signal_type})`);
      
      // Save to identified_companies
      const { error: insertError } = await supabase
        .from('identified_companies')
        .upsert({
          company: job.company,
          tool_detected: analysis.tool_detected,
          signal_type: analysis.signal_type,
          context: analysis.context,
          job_title: job.job_title,
          job_url: job.job_url,
          platform: job.platform || 'LinkedIn',
          identified_date: new Date().toISOString()
        }, {
          onConflict: 'company,tool_detected',
          ignoreDuplicates: false
        });
      
      if (insertError) {
        console.error('  ❌ Failed to save detection:', insertError.message);
      }
    } else {
      console.log('  ⚪ No tools detected');
    }
    
    // Mark job as processed
    const { error: updateError } = await supabase
      .from('raw_jobs')
      .update({ 
        processed: true,
        analyzed_date: new Date().toISOString()
      })
      .eq('job_id', job.job_id);
    
    if (updateError) {
      console.error('  ❌ Failed to mark as processed:', updateError.message);
    }
    
    // Add to processed_jobs table
    await supabase
      .from('processed_jobs')
      .insert({
        job_id: job.job_id,
        processed_date: new Date().toISOString(),
        tool_detected: analysis.tool_detected !== 'none',
        tool_name: analysis.tool_detected
      });
    
  } catch (error) {
    stats.errors++;
    console.error(`  ❌ Error processing job:`, error.message);
  }
}

/**
 * Main continuous processing loop
 */
async function continuousAnalysis() {
  console.log('🚀 Starting Continuous Job Analysis');
  console.log('=' .repeat(60));
  console.log('⚠️  Using HARDCODED GPT-5-mini configuration');
  console.log('Model: gpt-5-mini');
  console.log('API: Responses API');
  console.log('Structure: Role-based (developer + user)');
  console.log('Reasoning: medium');
  console.log('Verbosity: low');
  console.log('=' .repeat(60));
  
  stats.isRunning = true;
  
  while (stats.isRunning) {
    try {
      // Get unprocessed jobs (batch of 10)
      const { data: jobs, error } = await supabase
        .from('raw_jobs')
        .select('*')
        .eq('processed', false)
        .limit(10)
        .order('scraped_date', { ascending: true });
      
      if (error) {
        console.error('Failed to fetch jobs:', error.message);
        await sleep(10000);
        continue;
      }
      
      if (!jobs || jobs.length === 0) {
        console.log('📭 No unprocessed jobs found. Waiting 30 seconds...');
        await sleep(30000);
        continue;
      }
      
      console.log(`\n📋 Processing batch of ${jobs.length} jobs...`);
      
      // Process jobs sequentially
      for (const job of jobs) {
        await processJob(job);
        await sleep(2000); // 2 second delay between API calls
      }
      
      // Print stats
      const runtime = Math.floor((Date.now() - stats.startTime) / 1000 / 60);
      console.log(`\n📊 Stats: ${stats.totalAnalyzed} analyzed | ${stats.toolsDetected} detected | ${stats.errors} errors | Runtime: ${runtime}m`);
      
    } catch (error) {
      console.error('Fatal error in main loop:', error.message);
      await sleep(10000);
    }
  }
}

/**
 * Helper function for delays
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Graceful shutdown
 */
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Shutting down gracefully...');
  stats.isRunning = false;
  
  console.log('📊 Final Stats:');
  console.log(`  Total analyzed: ${stats.totalAnalyzed}`);
  console.log(`  Tools detected: ${stats.toolsDetected}`);
  console.log(`  Detection rate: ${Math.round(stats.toolsDetected / stats.totalAnalyzed * 100)}%`);
  console.log(`  Errors: ${stats.errors}`);
  
  process.exit(0);
});

// Start the processor
continuousAnalysis().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});