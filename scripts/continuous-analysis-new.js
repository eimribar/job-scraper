/**
 * CONTINUOUS ANALYSIS WORKER - NEW CLEAN VERSION
 * Works with the clean 4-table database structure
 * 
 * Flow:
 * 1. Read from raw_jobs WHERE processed = FALSE
 * 2. Analyze with GPT-5
 * 3. Save to identified_companies if tool detected
 * 4. Mark as processed in raw_jobs
 * 5. Add to processed_jobs
 */

require('dotenv').config({ path: '.env.local' });
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

// Initialize services
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

const systemPrompt = `You are an expert at analyzing job descriptions to identify if companies use Outreach.io or SalesLoft.

IMPORTANT: Distinguish between "Outreach" (the tool) and "outreach" (general sales activity).

Valid indicators for Outreach.io:
- "Outreach.io"
- "Outreach platform"
- "Outreach sequences"
- Capitalized "Outreach" listed with other tools
- "experience with Outreach"

Valid indicators for SalesLoft:
- "SalesLoft"
- "Sales Loft"
- "Salesloft"
- "experience with SalesLoft"

NOT valid (just general sales terms):
- "sales outreach"
- "cold outreach"
- "outreach efforts"
- "customer outreach"

You must respond with ONLY valid JSON. No explanation. No markdown. Just the JSON object:

{
  "uses_tool": true,
  "tool_detected": "Outreach.io",
  "signal_type": "required",
  "context": "exact quote mentioning the tool",
  "confidence": "high"
}`;

async function analyzeJobWithGPT(job) {
  const userPrompt = `Company: ${job.company}
Job Title: ${job.job_title}
Job Description: ${job.description}`;

  try {
    // Add timeout protection (30 seconds) and rate limiting delay
    const timeoutMs = 30 * 1000;
    const apiPromise = openai.chat.completions.create({
      model: 'gpt-5-2025-08-07',  // USING GPT-5 AS SPECIFIED!
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_completion_tokens: 500,  // GPT-5 requires this
      reasoning_effort: 'low'  // Use low reasoning effort for efficiency
    });
    
    const response = await Promise.race([
      apiPromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`OpenAI API timeout after ${timeoutMs/1000}s`)), timeoutMs)
      )
    ]);

    const result = response.choices[0].message.content?.trim();
    
    if (!result || result.length === 0) {
      throw new Error('Empty response from GPT-5');
    }
    
    // Parse JSON with better error handling
    try {
      const analysis = JSON.parse(result);
      return analysis;
    } catch (parseError) {
      console.error(`  ❌ JSON parse error for ${job.company}:`, result.substring(0, 100));
      // Return default analysis instead of throwing
      return {
        uses_tool: false,
        tool_detected: "None",
        signal_type: "none",
        confidence: "low",
        context: "Parse error: " + result.substring(0, 50)
      };
    }
    
  } catch (error) {
    console.error(`  ❌ Analysis error for ${job.company}:`, error.message);
    return {
      uses_tool: false,
      tool_detected: "None",
      signal_type: "none",
      confidence: "low",
      context: "API error: " + error.message.substring(0, 50)
    };
  }
}

async function processNextBatch() {
  try {
    // Fetch unprocessed jobs from clean raw_jobs table
    const { data: jobs, error } = await supabase
      .from('raw_jobs')
      .select('*')
      .eq('processed', false)
      .order('scraped_date', { ascending: true })
      .limit(10);  // Process 10 at a time
    
    if (error) {
      console.error('Error fetching unprocessed jobs:', error);
      return 0;
    }
    
    if (!jobs || jobs.length === 0) {
      return 0;
    }
    
    console.log(`\\n📋 Processing ${jobs.length} unprocessed jobs...`);
    
    let processed = 0;
    let toolsFound = 0;
    
    // Process jobs sequentially to avoid overwhelming OpenAI
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      
      console.log(`\\n[${i+1}/${jobs.length}] Analyzing: ${job.company} - ${job.job_title}`);
      console.log(`  Job ID: ${job.job_id}`);
      console.log(`  Platform: ${job.platform}`);
      
      // Analyze with GPT-5
      const analysis = await analyzeJobWithGPT(job);
      
      if (analysis.uses_tool) {
        // Only process Outreach.io and SalesLoft
        if (analysis.tool_detected === 'Outreach.io' || analysis.tool_detected === 'SalesLoft' || analysis.tool_detected === 'Both') {
          console.log(`  🎯 DETECTED: ${analysis.tool_detected} (${analysis.confidence} confidence)`);
          toolsFound++;
          
          // Save to identified_companies
          const { error: companyError } = await supabase
            .from('identified_companies')
            .upsert({
              company_name: job.company,
              tool_detected: analysis.tool_detected,
              signal_type: analysis.signal_type || 'explicit_mention',
              context: analysis.context || '',
              confidence: analysis.confidence || 'medium',
              job_title: job.job_title,
              job_url: job.job_url,
              linkedin_url: '', // For BDR manual entry
              platform: job.platform,
              identified_date: new Date().toISOString()
            }, { 
              onConflict: 'company_name,tool_detected',
              ignoreDuplicates: false 
            });
          
          if (companyError) {
            console.error('  ❌ Failed to save company:', companyError.message);
          } else {
            console.log(`  ✅ Saved ${job.company} to identified_companies`);
          }
        } else {
          console.log(`  ❌ Wrong tool detected: ${analysis.tool_detected} - IGNORING`);
        }
      } else {
        console.log(`  ✓ No tools detected`);
      }
      
      // Mark job as processed
      const { error: updateError } = await supabase
        .from('raw_jobs')
        .update({ 
          processed: true,
          processed_date: new Date().toISOString()
        })
        .eq('job_id', job.job_id);
      
      if (updateError) {
        console.error('  ❌ Failed to mark job as processed:', updateError.message);
      }
      
      // Add to processed_jobs tracking
      await supabase
        .from('processed_jobs')
        .upsert({ 
          job_id: job.job_id, 
          processed_date: new Date().toISOString() 
        }, { onConflict: 'job_id' });
      
      processed++;
      stats.totalAnalyzed++;
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    stats.toolsDetected += toolsFound;
    console.log(`\\n✅ Batch complete: ${processed} analyzed, ${toolsFound} tools detected`);
    
    return processed;
    
  } catch (error) {
    console.error('❌ Error in batch processing:', error);
    stats.errors++;
    return 0;
  }
}

async function runContinuousAnalysis() {
  console.log('🤖 CONTINUOUS ANALYSIS WORKER - NEW CLEAN VERSION');
  console.log('=' .repeat(60));
  console.log('Database: Clean 4-table structure');
  console.log('Source: raw_jobs WHERE processed = FALSE');
  console.log('Model: GPT-5-2025-08-07');
  console.log('Press Ctrl+C to stop\\n');
  
  stats.isRunning = true;
  let consecutiveEmpty = 0;
  
  while (stats.isRunning) {
    try {
      const processed = await processNextBatch();
      
      if (processed > 0) {
        consecutiveEmpty = 0;
        console.log(`\\n📊 RUNNING TOTALS:`);
        console.log(`   Total analyzed: ${stats.totalAnalyzed}`);
        console.log(`   Tools detected: ${stats.toolsDetected}`);
        console.log(`   Errors: ${stats.errors}`);
        console.log(`   Runtime: ${Math.round((Date.now() - stats.startTime) / 1000 / 60)} minutes`);
      } else {
        consecutiveEmpty++;
        const waitTime = Math.min(consecutiveEmpty * 5, 30); // Max 30 seconds
        console.log(`⏳ No jobs to process... waiting ${waitTime}s (${consecutiveEmpty} empty cycles)`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      }
      
    } catch (error) {
      console.error('💥 Worker error:', error);
      stats.errors++;
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s on error
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\\n\\n🛑 Shutting down continuous analysis worker...');
  stats.isRunning = false;
  
  const duration = Math.round((Date.now() - stats.startTime) / 1000);
  console.log('\\n📊 FINAL STATS:');
  console.log('Total jobs analyzed:', stats.totalAnalyzed);
  console.log('Tools detected:', stats.toolsDetected);
  console.log('Errors encountered:', stats.errors);
  console.log('Runtime:', Math.round(duration / 60), 'minutes');
  
  process.exit(0);
});

// Start the worker
console.log('🚀 Sales Tool Detector - Continuous Analysis Worker (Clean DB Version)');
console.log('Version: 2.0 - Clean Database Structure');
console.log('Started:', new Date().toLocaleString());
console.log('=' .repeat(60) + '\\n');

runContinuousAnalysis().catch(error => {
  console.error('Fatal analysis error:', error);
  process.exit(1);
});