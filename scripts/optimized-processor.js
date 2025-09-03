#!/usr/bin/env node

/**
 * Optimized processor with improvements:
 * - Better error handling and retry logic
 * - Rate limiting to prevent API overload
 * - Progress tracking with ETA
 * - Memory-efficient batch processing
 * - Improved duplicate detection
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

// Configuration
const CONFIG = {
  BATCH_SIZE: 25,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 2000, // 2 seconds
  API_DELAY: 1000, // 1 second between API calls
  CHECKPOINT_INTERVAL: 50, // Log progress every 50 jobs
  MAX_CONTEXT_LENGTH: 200,
  OPENAI_TIMEOUT: 30000 // 30 seconds
};

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Statistics
const stats = {
  startTime: Date.now(),
  totalJobs: 0,
  processed: 0,
  companiesFound: 0,
  errors: 0,
  skipped: 0,
  apiCalls: 0,
  apiCost: 0 // Estimated cost in dollars
};

// Cache for identified companies
const companyCache = new Map();

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Calculate and display progress with ETA
 */
function showProgress() {
  const elapsed = Date.now() - stats.startTime;
  const rate = stats.processed / (elapsed / 1000); // jobs per second
  const remaining = stats.totalJobs - stats.processed;
  const eta = remaining / rate * 1000; // milliseconds
  
  console.log(`
📊 Progress Report:
   Processed: ${stats.processed}/${stats.totalJobs} (${Math.round(stats.processed / stats.totalJobs * 100)}%)
   Companies Found: ${stats.companiesFound}
   Skipped: ${stats.skipped}
   Errors: ${stats.errors}
   Rate: ${rate.toFixed(1)} jobs/sec
   Elapsed: ${formatDuration(elapsed)}
   ETA: ${formatDuration(eta)}
   Est. API Cost: $${stats.apiCost.toFixed(4)}
  `);
}

/**
 * Load identified companies into cache
 */
async function loadCompanyCache() {
  console.log('📋 Loading company cache...');
  
  const { data: companies, error } = await supabase
    .from('identified_companies')
    .select('company, tool_detected');
  
  if (error) {
    console.error('Error loading companies:', error);
    return;
  }
  
  companies?.forEach(c => {
    const key = `${c.company.toLowerCase().trim()}|${c.tool_detected}`;
    companyCache.set(key, true);
  });
  
  console.log(`   Loaded ${companyCache.size} company-tool combinations\n`);
}

/**
 * Check if company-tool combination exists
 */
function isCompanyIdentified(company, tool) {
  const key = `${company.toLowerCase().trim()}|${tool}`;
  return companyCache.has(key);
}

/**
 * Analyze job with retry logic
 */
async function analyzeJobWithRetry(job, attempts = CONFIG.RETRY_ATTEMPTS) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const result = await analyzeJob(job);
      stats.apiCalls++;
      stats.apiCost += 0.0001; // Estimated cost per GPT-5-mini call
      return result;
    } catch (error) {
      console.error(`   Attempt ${attempt}/${attempts} failed:`, error.message);
      
      if (attempt < attempts) {
        await sleep(CONFIG.RETRY_DELAY * attempt); // Exponential backoff
      } else {
        throw error;
      }
    }
  }
}

/**
 * Analyze single job with GPT-5
 */
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
Description: ${job.description?.substring(0, 5000) || 'No description available'}

Return this exact JSON structure:
{
  "uses_tool": true or false,
  "tool_detected": "Outreach.io" or "SalesLoft" or "Both" or "none",
  "signal_type": "required" or "preferred" or "stack_mention" or "none",
  "context": "exact quote from the job description mentioning the tool (max 200 chars)"
}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.OPENAI_TIMEOUT);

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        input: prompt,
        reasoning: { effort: 'minimal' },
        text: { verbosity: 'low' }
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();
    
    // Extract response from GPT-5 structure
    let outputText = '';
    if (data.output?.[1]?.content?.[0]?.text) {
      outputText = data.output[1].content[0].text;
    } else if (data.output?.[1]?.content?.find(c => c.type === 'output_text')?.text) {
      outputText = data.output[1].content.find(c => c.type === 'output_text').text;
    }

    try {
      const parsed = JSON.parse(outputText);
      // Validate and sanitize response
      return {
        uses_tool: Boolean(parsed.uses_tool),
        tool_detected: parsed.tool_detected || 'none',
        signal_type: parsed.signal_type || 'none',
        context: (parsed.context || '').substring(0, CONFIG.MAX_CONTEXT_LENGTH)
      };
    } catch (parseError) {
      console.error('   Failed to parse JSON:', outputText?.substring(0, 100));
      return {
        uses_tool: false,
        tool_detected: 'none',
        signal_type: 'none',
        context: ''
      };
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timeout after 30 seconds');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Process a single job
 */
async function processSingleJob(job) {
  try {
    // Check cache first
    if (job.tool_detected && isCompanyIdentified(job.company, job.tool_detected)) {
      stats.skipped++;
      await markJobProcessed(job.job_id, true);
      return { status: 'skipped', reason: 'already_identified' };
    }

    // Analyze with GPT-5
    const analysis = await analyzeJobWithRetry(job);
    
    // Save if tool detected
    if (analysis.uses_tool && analysis.tool_detected !== 'none') {
      // Check again to prevent race conditions
      if (isCompanyIdentified(job.company, analysis.tool_detected)) {
        stats.skipped++;
        await markJobProcessed(job.job_id, true);
        return { status: 'skipped', reason: 'race_condition' };
      }

      // Save to database
      const saved = await saveCompany(job, analysis);
      if (saved) {
        stats.companiesFound++;
        // Update cache
        const key = `${job.company.toLowerCase().trim()}|${analysis.tool_detected}`;
        companyCache.set(key, true);
      }
    }

    // Mark as processed
    await markJobProcessed(job.job_id, true);
    stats.processed++;
    
    return { status: 'processed', analysis };
    
  } catch (error) {
    stats.errors++;
    await markJobProcessed(job.job_id, false, error.message);
    return { status: 'error', error: error.message };
  }
}

/**
 * Save company to database
 */
async function saveCompany(job, analysis) {
  try {
    // Check if exists
    const { data: existing } = await supabase
      .from('identified_companies')
      .select('id')
      .eq('company', job.company)
      .eq('tool_detected', analysis.tool_detected)
      .single();

    if (existing) {
      // Update existing
      await supabase
        .from('identified_companies')
        .update({
          signal_type: analysis.signal_type,
          context: analysis.context,
          job_title: job.job_title,
          job_url: job.job_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
      return false; // Not a new company
    } else {
      // Insert new
      const { error } = await supabase
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
      
      return !error;
    }
  } catch (error) {
    console.error('   Error saving company:', error.message);
    return false;
  }
}

/**
 * Mark job as processed
 */
async function markJobProcessed(jobId, success, errorMessage = null) {
  await supabase
    .from('raw_jobs')
    .update({
      processed: true,
      analyzed_date: new Date().toISOString(),
      error_message: errorMessage
    })
    .eq('job_id', jobId);
    
  // Update processing queue
  await supabase
    .from('processing_queue')
    .update({
      status: success ? 'completed' : 'error',
      completed_at: new Date().toISOString(),
      error_message: errorMessage
    })
    .eq('job_id', jobId);
}

/**
 * Main processing loop
 */
async function main() {
  console.log('🚀 Starting Optimized Processor v2.0\n');
  
  // Check environment
  if (!OPENAI_API_KEY) {
    console.error('❌ Missing OPENAI_API_KEY in environment');
    process.exit(1);
  }
  
  // Load cache
  await loadCompanyCache();
  
  // Get total count
  const { count: totalCount } = await supabase
    .from('raw_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('processed', false);
    
  stats.totalJobs = totalCount || 0;
  
  if (stats.totalJobs === 0) {
    console.log('✅ No unprocessed jobs found!');
    return;
  }
  
  console.log(`📊 Found ${stats.totalJobs} unprocessed jobs\n`);
  console.log('Processing will continue until all jobs are complete.');
  console.log('Press Ctrl+C to stop gracefully.\n');
  
  let shouldStop = false;
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n⏹️  Stopping processor gracefully...');
    shouldStop = true;
  });
  
  // Process in batches
  while (!shouldStop && stats.processed < stats.totalJobs) {
    // Get batch
    const { data: jobs, error } = await supabase
      .from('raw_jobs')
      .select('*')
      .eq('processed', false)
      .order('created_at', { ascending: true })
      .limit(CONFIG.BATCH_SIZE);
    
    if (error) {
      console.error('Error fetching jobs:', error);
      break;
    }
    
    if (!jobs || jobs.length === 0) {
      console.log('✅ All jobs processed!');
      break;
    }
    
    console.log(`\n📦 Processing batch of ${jobs.length} jobs...\n`);
    
    // Process each job
    for (const job of jobs) {
      if (shouldStop) break;
      
      process.stdout.write(`  [${stats.processed + 1}/${stats.totalJobs}] ${job.company.substring(0, 30).padEnd(30)}... `);
      
      const result = await processSingleJob(job);
      
      // Log result
      if (result.status === 'processed' && result.analysis?.uses_tool) {
        console.log(`✅ Found ${result.analysis.tool_detected}`);
      } else if (result.status === 'skipped') {
        console.log('⏭️  Skipped');
      } else if (result.status === 'error') {
        console.log(`❌ Error`);
      } else {
        console.log('✓ No tool');
      }
      
      // Rate limiting
      await sleep(CONFIG.API_DELAY);
      
      // Show progress periodically
      if (stats.processed % CONFIG.CHECKPOINT_INTERVAL === 0) {
        showProgress();
      }
    }
  }
  
  // Final report
  console.log('\n' + '='.repeat(60));
  console.log('📊 FINAL REPORT');
  console.log('='.repeat(60));
  showProgress();
  console.log('='.repeat(60));
  
  if (shouldStop) {
    console.log('\n⚠️  Processing stopped by user');
  } else {
    console.log('\n✅ All jobs processed successfully!');
  }
}

// Run the processor
main().catch(console.error);