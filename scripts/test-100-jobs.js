#!/usr/bin/env node

/**
 * Test 100 Job Postings
 * Process 100 relevant jobs to check detection rate
 * Date: 2025-09-10
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
  processed: 0,
  detected: 0,
  outreach: 0,
  salesloft: 0,
  both: 0,
  errors: 0,
  companiesFound: []
};

async function processJobs() {
  console.log('🧪 TESTING 100 RELEVANT JOB POSTINGS');
  console.log('=' .repeat(60));
  console.log('Model: gpt-5-mini-2025-08-07');
  console.log('Categories: SDRs, BDRs, AEs, RevOps, Sales Ops');
  console.log('=' .repeat(60));
  
  try {
    // Get 100 unprocessed jobs
    const { data: jobs, error } = await supabase
      .from('raw_jobs')
      .select('*')
      .eq('processed', false)
      .limit(100);
    
    if (error) throw error;
    
    if (!jobs || jobs.length === 0) {
      console.log('❌ No unprocessed jobs found');
      return;
    }
    
    console.log(`\n📋 Processing ${jobs.length} jobs...\n`);
    
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      process.stdout.write(`[${i+1}/100] ${job.company.substring(0, 30).padEnd(30)} | ${job.search_term.padEnd(15)} | `);
      
      try {
        // Call GPT-5-mini
        const response = await openai.chat.completions.create({
          model: 'gpt-5-mini-2025-08-07', // EXACT MODEL NAME
          messages: [
            {
              role: 'system',
              content: `You are an expert at analyzing job descriptions to identify if companies use Outreach.io or SalesLoft.

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
  "context": "exact quote mentioning the tool"
}`
            },
            {
              role: 'user',
              content: `Company: ${job.company}
Job Title: ${job.job_title}
Job Description: ${job.description?.substring(0, 3000)}`
            }
          ],
          max_completion_tokens: 200
        });
        
        const content = response.choices[0].message.content || '{}';
        let result;
        
        try {
          result = JSON.parse(content);
        } catch (parseErr) {
          console.log('❌ Parse error');
          stats.errors++;
          continue;
        }
        
        if (result.uses_tool && result.tool_detected !== 'none') {
          console.log(`✅ ${result.tool_detected}`);
          stats.detected++;
          stats.companiesFound.push({
            company: job.company,
            tool: result.tool_detected,
            context: result.context?.substring(0, 50)
          });
          
          if (result.tool_detected === 'Outreach.io') stats.outreach++;
          else if (result.tool_detected === 'SalesLoft') stats.salesloft++;
          else if (result.tool_detected === 'Both') {
            stats.both++;
            stats.outreach++;
            stats.salesloft++;
          }
          
          // Save to identified_companies
          await supabase
            .from('identified_companies')
            .upsert({
              company: job.company,
              tool_detected: result.tool_detected,
              signal_type: result.signal_type || 'explicit_mention',
              context: result.context || '',
              job_title: job.job_title,
              job_url: job.job_url,
              platform: job.platform,
              identified_date: new Date().toISOString()
            }, { 
              onConflict: 'company,tool_detected',
              ignoreDuplicates: false 
            });
        } else {
          console.log('❌ No tools');
        }
        
        // Mark as processed
        await supabase
          .from('raw_jobs')
          .update({ 
            processed: true,
            analyzed_date: new Date().toISOString()
          })
          .eq('job_id', job.job_id);
        
        stats.processed++;
        
      } catch (err) {
        console.log(`ERROR: ${err.message}`);
        stats.errors++;
      }
      
      // Small delay between API calls
      await new Promise(r => setTimeout(r, 500));
    }
    
    // Print results
    console.log('\n' + '=' .repeat(60));
    console.log('📊 TEST RESULTS');
    console.log('=' .repeat(60));
    console.log(`✅ Processed: ${stats.processed} jobs`);
    console.log(`🎯 Detected: ${stats.detected} companies with tools`);
    console.log(`📈 Detection rate: ${Math.round(stats.detected/stats.processed*100)}%`);
    console.log(`\n📊 Tool breakdown:`);
    console.log(`  • Outreach.io: ${stats.outreach}`);
    console.log(`  • SalesLoft: ${stats.salesloft}`);
    console.log(`  • Both tools: ${stats.both}`);
    
    if (stats.companiesFound.length > 0) {
      console.log(`\n🏢 Companies found (first 10):`);
      stats.companiesFound.slice(0, 10).forEach(c => {
        console.log(`  • ${c.company} - ${c.tool}`);
        if (c.context) {
          console.log(`    "${c.context}..."`);
        }
      });
    }
    
    if (stats.errors > 0) {
      console.log(`\n⚠️  Errors: ${stats.errors}`);
    }
    
    // Compare to expected rate
    const expectedRate = 15; // 15% for relevant jobs
    if (stats.detected/stats.processed*100 >= expectedRate) {
      console.log(`\n🎉 EXCELLENT! Detection rate (${Math.round(stats.detected/stats.processed*100)}%) exceeds expected (${expectedRate}%)`);
    } else if (stats.detected > 0) {
      console.log(`\n✅ Good! Found ${stats.detected} companies using sales tools`);
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the test
processJobs().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});