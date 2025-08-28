/**
 * UNSTOPPABLE WORKER - Continuously processes jobs FOREVER
 * Auto-restarts, never sleeps, always processing
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

// Worker state
const worker = {
  isRunning: true,
  startTime: new Date(),
  stats: {
    processed: 0,
    detected: 0,
    errors: 0,
    lastProcessed: null
  }
};

async function analyzeJob(job) {
  const systemPrompt = `Detect if company uses Outreach.io or SalesLoft ONLY.
Return JSON: uses_tool, tool_detected, confidence, context`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5-2025-08-07',  // USING GPT-5 AS SPECIFIED!
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${job.payload.company}\n${job.payload.job_title}\n${job.payload.description?.substring(0, 2000)}` }
      ],
      max_completion_tokens: 300,  // GPT-5 requires this
      reasoning_effort: 'low'  // Use low reasoning effort for efficiency
    });
    
    const result = response.choices[0].message.content?.trim();
    if (!result) return null;
    
    try {
      return JSON.parse(result);
    } catch (parseError) {
      return {
        uses_tool: false,
        tool_detected: "None",
        confidence: "low",
        context: "Parse error"
      };
    }
  } catch (error) {
    return null;
  }
}

async function processNextBatch() {
  // Get next batch of unprocessed jobs
  const { data: jobs } = await supabase
    .from('job_queue')
    .select('*')
    .or('status.eq.pending,status.is.null')
    .limit(10);
  
  const unanalyzedJobs = jobs?.filter(j => !j.payload?.analyzed) || [];
  
  if (unanalyzedJobs.length === 0) {
    return 0; // No jobs to process
  }
  
  // Process jobs
  for (const job of unanalyzedJobs) {
    const analysis = await analyzeJob(job);
    if (analysis) {
      job.payload.analyzed = true;
      job.payload.analysis_result = analysis;
      
      await supabase
        .from('job_queue')
        .update({ 
          payload: job.payload,
          status: 'completed'
        })
        .eq('id', job.id);
      
      worker.stats.processed++;
      if (analysis.uses_tool) {
        worker.stats.detected++;
      }
      worker.stats.lastProcessed = new Date();
    }
  }
  
  return unanalyzedJobs.length;
}

async function runForever() {
  console.log('🤖 UNSTOPPABLE WORKER STARTED\n');
  console.log('This worker will run FOREVER, processing jobs continuously.');
  console.log('Press Ctrl+C to stop (but it will auto-restart in production)\n');
  
  while (worker.isRunning) {
    try {
      const processed = await processNextBatch();
      
      if (processed > 0) {
        const uptime = Math.round((Date.now() - worker.startTime) / 1000);
        console.log(`[${new Date().toISOString()}] Processed ${processed} jobs | Total: ${worker.stats.processed} | Detected: ${worker.stats.detected} | Uptime: ${uptime}s`);
      } else {
        // No jobs, wait 10 seconds
        process.stdout.write(`\r⏳ Waiting for jobs... (Processed: ${worker.stats.processed}, Detected: ${worker.stats.detected})  `);
        await new Promise(r => setTimeout(r, 10000));
      }
      
      // Small delay between batches
      await new Promise(r => setTimeout(r, 1000));
      
    } catch (error) {
      console.error('Worker error:', error.message);
      worker.stats.errors++;
      // Wait 5 seconds and continue
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down worker...');
  worker.isRunning = false;
  console.log('Final stats:', worker.stats);
  process.exit(0);
});

// Auto-restart on crash
process.on('uncaughtException', (error) => {
  console.error('Fatal error:', error);
  console.log('Restarting in 5 seconds...');
  setTimeout(() => runForever(), 5000);
});

// Start the unstoppable worker
runForever().catch(error => {
  console.error('Worker crashed:', error);
  console.log('Restarting...');
  setTimeout(() => runForever(), 5000);
});