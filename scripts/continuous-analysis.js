/**
 * Continuous Analysis Service - Phase 3 of the pipeline
 * This service continuously analyzes jobs marked as ready_for_analysis
 * It NEVER waits - always processing jobs as soon as they're ready
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Statistics tracking
const stats = {
  startTime: new Date(),
  totalAnalyzed: 0,
  toolsDetected: 0,
  errors: 0,
  currentBatch: 0,
  isRunning: false
};

async function analyzeJob(job) {
  const systemPrompt = `You are an expert at analyzing job postings to detect if companies use Outreach.io or SalesLoft ONLY.

IMPORTANT: ONLY detect Outreach.io or SalesLoft. DO NOT detect Salesforce, HubSpot, or any other CRM/tool!

Analyze the job description and return a JSON response with:
- uses_tool: boolean (true ONLY if Outreach.io or SalesLoft is detected)
- tool_detected: string ("Outreach.io", "SalesLoft", "Both", or "None")
- signal_type: string ("explicit_mention", "integration_requirement", "process_indicator", or "none")
- requirement_level: string ("required", "preferred", "mentioned", or "none")
- confidence: string ("high", "medium", or "low")
- context: string (relevant quote from job description, max 200 chars)

Look for ONLY:
1. Direct mentions of "Outreach.io" or "Outreach" (the sales engagement tool)
2. Direct mentions of "SalesLoft" or "Salesloft"
3. Requirements for experience with these SPECIFIC tools
4. DO NOT detect: Salesforce, HubSpot, Gong, ZoomInfo, or other tools
5. If only Salesforce/HubSpot/other CRMs are mentioned, return tool_detected: "None"`;

  const userPrompt = `Analyze this job posting:

Company: ${job.payload.company}
Title: ${job.payload.job_title}
Location: ${job.payload.location}

Description:
${job.payload.description?.substring(0, 4000) || 'No description available'}

Return only valid JSON.`;

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
      console.error(`  ❌ JSON parse error for ${job.payload.company}:`, result.substring(0, 100));
      // Return default analysis instead of throwing
      return {
        uses_tool: false,
        tool_detected: "None",
        signal_type: "none",
        requirement_level: "none",
        confidence: "low",
        context: "Failed to parse analysis"
      };
    }
    
  } catch (error) {
    console.error(`  ❌ Analysis error for ${job.payload.company}:`, error.message);
    // Return default analysis instead of throwing
    return {
      uses_tool: false,
      tool_detected: "None",
      signal_type: "none",
      requirement_level: "none",
      confidence: "low",
      context: "API error: " + error.message.substring(0, 50)
    };
  }
}

async function processNextBatch() {
  try {
    // Fetch jobs ready for analysis
    // First get all jobs marked as ready, then filter in memory
    const { data: allReadyJobs, error } = await supabase
      .from('job_queue')
      .select('*')
      .eq('payload->>ready_for_analysis', true)
      .limit(100);  // Get more to filter
    
    if (error) {
      console.error('Error fetching jobs:', error);
      return 0;
    }
    
    // Filter out already analyzed jobs in JavaScript
    const jobs = allReadyJobs?.filter(job => 
      job.payload?.analyzed !== true  // This handles undefined, null, false
    ).slice(0, 10);  // Take first 10 unanalyzed
    
    if (!jobs || jobs.length === 0) {
      return 0;
    }
    
    stats.currentBatch++;
    console.log(`\n📦 Batch ${stats.currentBatch}: Processing ${jobs.length} jobs...`);
    
    for (const job of jobs) {
      try {
        console.log(`  Analyzing: ${job.payload.company} - ${job.payload.job_title}`);
        
        // Analyze the job
        const analysis = await analyzeJob(job);
        
        // Update job with analysis results
        job.payload.analyzed = true;
        job.payload.analysis_date = new Date().toISOString();
        job.payload.analysis_result = analysis;
        
        // If tool detected, save/update in companies table
        if (analysis.uses_tool) {
          stats.toolsDetected++;
          if (analysis.tool_detected === 'Outreach.io' || analysis.tool_detected === 'SalesLoft' || analysis.tool_detected === 'Both') {
            console.log(`    🎯 DETECTED: ${analysis.tool_detected} (${analysis.confidence} confidence)`);
            
            // Check if company already exists
            const { data: existingCompany } = await supabase
              .from('companies')
              .select('id')
              .eq('name', job.payload.company)
              .single();
            
            const companyData = {
              uses_outreach: analysis.tool_detected === 'Outreach.io' || analysis.tool_detected === 'Both',
              uses_salesloft: analysis.tool_detected === 'SalesLoft' || analysis.tool_detected === 'Both',
              uses_both: analysis.tool_detected === 'Both',
              detection_confidence: analysis.confidence,
              job_title: job.payload.job_title,
              job_url: job.payload.job_url,
              signal_type: analysis.signal_type || 'explicit_mention',
              requirement_level: analysis.requirement_level || 'mentioned',
              context: analysis.context,
              platform: job.payload.platform || 'LinkedIn',
              identified_date: new Date().toISOString()
            };
            
            if (existingCompany) {
              // Update existing company
              const { error: updateError } = await supabase
                .from('companies')
                .update(companyData)
                .eq('id', existingCompany.id);
              
              if (updateError) {
                console.error('    Failed to update company:', updateError.message);
              } else {
                console.log(`    ✅ Updated existing company in database`);
              }
            } else {
              // Insert new company
              const { error: insertError } = await supabase
                .from('companies')
                .insert({
                  name: job.payload.company,
                  ...companyData
                });
              
              if (insertError) {
                console.error('    Failed to insert company:', insertError.message);
              } else {
                console.log(`    ✅ Added new company to database`);
              }
            }
            
          } else {
            console.log(`    ❌ Wrong tool detected: ${analysis.tool_detected} - IGNORING`);
            // Don't count this as a tool detection
            stats.toolsDetected--;
            analysis.uses_tool = false;
            analysis.tool_detected = 'None';
          }
        } else {
          console.log(`    ✓ No tools detected`);
        }
        
        // Update job in database
        const { error: updateError } = await supabase
          .from('job_queue')
          .update({ 
            payload: job.payload,
            status: 'completed'
          })
          .eq('id', job.id);
        
        if (updateError) {
          console.error('    Failed to update job:', updateError.message);
        }
        
        stats.totalAnalyzed++;
        
        // Rate limiting - avoid hitting API limits
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (jobError) {
        console.error(`  ❌ Failed to process ${job.payload.company}:`, jobError.message);
        stats.errors++;
        
        // Mark job as having error
        job.payload.analysis_error = jobError.message;
        await supabase
          .from('job_queue')
          .update({ payload: job.payload })
          .eq('id', job.id);
      }
    }
    
    return jobs.length;
    
  } catch (error) {
    console.error('Batch processing error:', error);
    return 0;
  }
}

async function startContinuousAnalysis() {
  console.log('🤖 PHASE 3: CONTINUOUS ANALYSIS SERVICE');
  console.log('=' .repeat(60));
  console.log('This service will continuously analyze jobs marked as ready');
  console.log('Press Ctrl+C to stop\n');
  
  stats.isRunning = true;
  
  // Check initial job count - get all ready jobs and count unanalyzed
  const { data: readyJobs, error: countError } = await supabase
    .from('job_queue')
    .select('payload')
    .eq('payload->>ready_for_analysis', true);
  
  const totalReady = readyJobs?.filter(job => 
    job.payload?.analyzed !== true
  ).length || 0;
  
  console.log(`📊 Initial Status:`);
  console.log(`  Jobs ready for analysis: ${totalReady || 0}`);
  console.log(`  Starting continuous processing...\n`);
  
  // Main loop - runs forever
  while (stats.isRunning) {
    const processedCount = await processNextBatch();
    
    if (processedCount === 0) {
      // No jobs to process, wait a bit
      process.stdout.write(`\r⏳ Waiting for jobs... (Analyzed: ${stats.totalAnalyzed}, Tools found: ${stats.toolsDetected})  `);
      await new Promise(resolve => setTimeout(resolve, 5000));
    } else {
      // Show progress
      const elapsed = Math.round((Date.now() - stats.startTime) / 1000);
      console.log(`  ✅ Batch complete. Total: ${stats.totalAnalyzed} analyzed, ${stats.toolsDetected} tools found (${elapsed}s elapsed)`);
    }
    
    // Check remaining jobs periodically
    if (stats.currentBatch % 5 === 0) {
      const { data: remainingJobs } = await supabase
        .from('job_queue')
        .select('payload')
        .eq('payload->>ready_for_analysis', true);
      
      const remaining = remainingJobs?.filter(job => 
        job.payload?.analyzed !== true
      ).length || 0;
      
      if (remaining && remaining > 0) {
        console.log(`\n📊 Status Update: ${remaining} jobs remaining\n`);
      }
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down...');
  stats.isRunning = false;
  
  const duration = Math.round((Date.now() - stats.startTime) / 1000);
  
  console.log('\n' + '=' .repeat(60));
  console.log('📊 FINAL STATISTICS');
  console.log('=' .repeat(60));
  console.log(`Total Analyzed: ${stats.totalAnalyzed}`);
  console.log(`Tools Detected: ${stats.toolsDetected}`);
  console.log(`Detection Rate: ${stats.totalAnalyzed > 0 ? Math.round((stats.toolsDetected/stats.totalAnalyzed)*100) : 0}%`);
  console.log(`Errors: ${stats.errors}`);
  console.log(`Total Duration: ${duration} seconds`);
  console.log(`Average Speed: ${stats.totalAnalyzed > 0 ? (stats.totalAnalyzed / duration).toFixed(2) : 0} jobs/second`);
  
  process.exit(0);
});

// Start the service
console.log('🚀 Sales Tool Detector - Continuous Analysis Service');
console.log('=' .repeat(60));

startContinuousAnalysis().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});