/**
 * AGGRESSIVE PROCESSING - Analyze ALL pending jobs NOW
 * No waiting, maximum speed, get all companies detected
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

// Statistics
const stats = {
  startTime: new Date(),
  processed: 0,
  detected: 0,
  errors: 0,
  companiesFound: new Set()
};

async function analyzeJob(job) {
  const systemPrompt = `You are an expert at detecting if companies use Outreach.io or SalesLoft.

IMPORTANT: ONLY detect Outreach.io or SalesLoft. IGNORE Salesforce, HubSpot, etc.

Return JSON:
- uses_tool: boolean (true ONLY if Outreach.io or SalesLoft detected)
- tool_detected: "Outreach.io", "SalesLoft", "Both", or "None"
- confidence: "high", "medium", or "low"
- context: relevant quote (max 200 chars)`;

  const userPrompt = `Company: ${job.payload.company}
Title: ${job.payload.job_title}
Description: ${job.payload.description?.substring(0, 3000) || 'No description'}

Return ONLY valid JSON.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 200,
      temperature: 0
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error(`Error analyzing ${job.payload.company}:`, error.message);
    return null;
  }
}

async function processAllPending() {
  console.log('🚀 AGGRESSIVE PROCESSING - ANALYZING ALL PENDING JOBS\n');
  console.log('=' .repeat(60));
  
  // Get ALL pending jobs
  const { data: pendingJobs, error } = await supabase
    .from('job_queue')
    .select('*')
    .or('status.eq.pending,status.is.null')
    .limit(1000);
  
  if (error) {
    console.error('Error fetching jobs:', error);
    return;
  }
  
  // Filter to only unanalyzed
  const unanalyzedJobs = pendingJobs?.filter(job => 
    !job.payload?.analyzed && job.payload?.job_id
  ) || [];
  
  console.log(`Found ${unanalyzedJobs.length} jobs to analyze\n`);
  
  if (unanalyzedJobs.length === 0) {
    console.log('No pending jobs found!');
    return;
  }
  
  console.log('Processing configuration:');
  console.log('  Batch size: 5 concurrent');
  console.log('  Rate limit: 500ms between batches');
  console.log('  Expected time: ~' + Math.round(unanalyzedJobs.length * 0.5 / 60) + ' minutes\n');
  
  console.log('Starting aggressive processing...\n');
  
  // Process in batches of 5 for speed
  const batchSize = 5;
  for (let i = 0; i < unanalyzedJobs.length; i += batchSize) {
    const batch = unanalyzedJobs.slice(i, i + batchSize);
    const batchPromises = [];
    
    console.log(`\nBatch ${Math.floor(i/batchSize) + 1}/${Math.ceil(unanalyzedJobs.length/batchSize)}:`);
    
    for (const job of batch) {
      batchPromises.push(processSingleJob(job));
    }
    
    // Wait for batch to complete
    await Promise.all(batchPromises);
    
    // Small delay between batches to avoid rate limits
    if (i + batchSize < unanalyzedJobs.length) {
      await new Promise(r => setTimeout(r, 500));
    }
    
    // Progress update every 10 batches
    if ((i/batchSize + 1) % 10 === 0 || i + batchSize >= unanalyzedJobs.length) {
      const elapsed = (Date.now() - stats.startTime) / 1000;
      const rate = stats.processed / elapsed;
      const remaining = unanalyzedJobs.length - stats.processed;
      const eta = remaining / rate;
      
      console.log(`\n📊 PROGRESS UPDATE:`);
      console.log(`  Processed: ${stats.processed}/${unanalyzedJobs.length}`);
      console.log(`  Companies found: ${stats.companiesFound.size}`);
      console.log(`  Detection rate: ${Math.round((stats.detected/stats.processed)*100)}%`);
      console.log(`  Speed: ${rate.toFixed(1)} jobs/sec`);
      console.log(`  ETA: ${Math.round(eta/60)} minutes\n`);
    }
  }
  
  // Final summary
  const duration = (Date.now() - stats.startTime) / 1000;
  
  console.log('\n' + '=' .repeat(60));
  console.log('✅ PROCESSING COMPLETE!\n');
  console.log(`Total processed: ${stats.processed}`);
  console.log(`Companies detected: ${stats.companiesFound.size}`);
  console.log(`Detection rate: ${Math.round((stats.detected/stats.processed)*100)}%`);
  console.log(`Errors: ${stats.errors}`);
  console.log(`Duration: ${Math.round(duration)} seconds (${Math.round(duration/60)} minutes)`);
  console.log(`Speed: ${(stats.processed/duration).toFixed(1)} jobs/sec`);
  
  // Sync new companies to companies table
  console.log('\n📤 Syncing detected companies to dashboard...');
  await syncCompaniesToDashboard();
  
  console.log('\n🎉 ALL DONE! Check your dashboard for new companies!');
}

async function processSingleJob(job) {
  try {
    console.log(`  Processing: ${job.payload.company} - ${job.payload.job_title}`);
    
    // Analyze job
    const analysis = await analyzeJob(job);
    
    if (!analysis) {
      stats.errors++;
      return;
    }
    
    // Update job with analysis
    job.payload.analyzed = true;
    job.payload.analysis_result = analysis;
    job.payload.analysis_date = new Date().toISOString();
    
    // Track detection
    if (analysis.uses_tool && analysis.tool_detected !== 'None') {
      stats.detected++;
      stats.companiesFound.add(job.payload.company);
      console.log(`    🎯 DETECTED: ${analysis.tool_detected} (${analysis.confidence})`);
    }
    
    // Update in database
    await supabase
      .from('job_queue')
      .update({ 
        payload: job.payload,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', job.id);
    
    stats.processed++;
    
  } catch (error) {
    console.error(`    ❌ Error: ${error.message}`);
    stats.errors++;
  }
}

async function syncCompaniesToDashboard() {
  // Get all analyzed jobs
  const { data: analyzedJobs } = await supabase
    .from('job_queue')
    .select('payload')
    .eq('payload->>analyzed', true);
  
  // Group by company
  const companyMap = new Map();
  
  analyzedJobs?.forEach(job => {
    const analysis = job.payload?.analysis_result;
    if (!analysis?.uses_tool || analysis.tool_detected === 'None') return;
    
    const company = job.payload?.company;
    if (!company) return;
    
    if (!companyMap.has(company)) {
      companyMap.set(company, {
        name: company,
        uses_outreach: false,
        uses_salesloft: false,
        confidence: 'low',
        contexts: []
      });
    }
    
    const data = companyMap.get(company);
    
    if (analysis.tool_detected === 'Outreach.io' || analysis.tool_detected === 'Both') {
      data.uses_outreach = true;
    }
    if (analysis.tool_detected === 'SalesLoft' || analysis.tool_detected === 'Both') {
      data.uses_salesloft = true;
    }
    if (analysis.confidence === 'high' || 
        (analysis.confidence === 'medium' && data.confidence === 'low')) {
      data.confidence = analysis.confidence;
    }
    if (analysis.context) {
      data.contexts.push(analysis.context);
    }
  });
  
  // Sync to companies table
  let added = 0;
  let updated = 0;
  
  for (const [company, data] of companyMap) {
    // Check if exists
    const { data: existing } = await supabase
      .from('companies')
      .select('id')
      .eq('name', company)
      .single();
    
    if (existing) {
      // Update
      await supabase
        .from('companies')
        .update({
          uses_outreach: data.uses_outreach,
          uses_salesloft: data.uses_salesloft,
          detection_confidence: data.confidence
        })
        .eq('id', existing.id);
      updated++;
    } else {
      // Insert
      await supabase
        .from('companies')
        .insert({
          name: company,
          uses_outreach: data.uses_outreach,
          uses_salesloft: data.uses_salesloft,
          uses_both: data.uses_outreach && data.uses_salesloft,
          detection_confidence: data.confidence,
          context: data.contexts[0] || '',
          platform: 'LinkedIn',
          identified_date: new Date().toISOString()
        });
      added++;
    }
  }
  
  console.log(`  Added: ${added} new companies`);
  console.log(`  Updated: ${updated} existing companies`);
  
  // Get new total
  const { count } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true });
  
  console.log(`  Total companies now: ${count}`);
}

// Run it!
processAllPending().catch(console.error);