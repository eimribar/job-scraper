#!/usr/bin/env node

/**
 * Test Job Processing with GPT-5 Responses API
 * Uses the CORRECT Responses API endpoint for GPT-5-mini
 * Date: 2025-09-10
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

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

/**
 * Call GPT-5-mini using Responses API
 */
async function analyzeWithGPT5(job) {
  const input = `Analyze this job description to identify if the company uses Outreach.io or SalesLoft.

IMPORTANT: Distinguish between "Outreach" (the tool) and "outreach" (general sales activity).

Valid indicators for Outreach.io:
- "Outreach.io"
- "Outreach platform"
- "Outreach sequences"
- Capitalized "Outreach" listed with other tools

Valid indicators for SalesLoft:
- "SalesLoft", "Sales Loft", "Salesloft"

Return ONLY a JSON object:
{"uses_tool":true/false,"tool_detected":"Outreach.io"/"SalesLoft"/"Both"/"none","context":"relevant quote"}

Company: ${job.company}
Job Title: ${job.job_title}
Description: ${job.description?.substring(0, 3000)}`;

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        input: input,
        reasoning: { 
          effort: 'minimal'  // Fast detection
        },
        text: { 
          verbosity: 'low'   // Concise response
        }
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`API error: ${data.error?.message || response.status}`);
    }
    
    // Extract output text from response structure
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
    
    if (!outputText) {
      throw new Error('No output text in response');
    }
    
    return JSON.parse(outputText);
    
  } catch (error) {
    console.error(`  ❌ GPT-5 error: ${error.message}`);
    return {
      uses_tool: false,
      tool_detected: 'none',
      context: '',
      error: error.message
    };
  }
}

async function testJobs(limit = 20) {
  console.log('🧪 TESTING GPT-5-MINI WITH RESPONSES API');
  console.log('=' .repeat(60));
  console.log(`Processing ${limit} relevant job postings`);
  console.log('Categories: SDRs, BDRs, AEs, RevOps, Sales Ops');
  console.log('=' .repeat(60));
  
  try {
    // Get unprocessed jobs from relevant categories
    const { data: jobs, error } = await supabase
      .from('raw_jobs')
      .select('*')
      .eq('processed', false)
      .in('search_term', ['sdrs', 'bdrs', 'aes', 'sales operations', 'revops'])
      .limit(limit);
    
    if (error) throw error;
    
    if (!jobs || jobs.length === 0) {
      console.log('❌ No unprocessed jobs found');
      return;
    }
    
    console.log(`\n📋 Processing ${jobs.length} jobs...\n`);
    
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      process.stdout.write(`[${i+1}/${jobs.length}] ${job.company.substring(0, 25).padEnd(25)} | ${job.search_term.padEnd(15)} | `);
      
      const result = await analyzeWithGPT5(job);
      
      if (result.uses_tool && result.tool_detected !== 'none') {
        console.log(`✅ ${result.tool_detected}`);
        stats.detected++;
        stats.companiesFound.push({
          company: job.company,
          tool: result.tool_detected,
          context: result.context?.substring(0, 80)
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
            signal_type: 'explicit_mention',
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
      
      // Small delay between API calls
      await new Promise(r => setTimeout(r, 500));
    }
    
    // Print results
    console.log('\n' + '=' .repeat(60));
    console.log('📊 RESULTS WITH GPT-5 RESPONSES API');
    console.log('=' .repeat(60));
    console.log(`✅ Processed: ${stats.processed} jobs`);
    console.log(`🎯 Detected: ${stats.detected} companies with tools`);
    console.log(`📈 Detection rate: ${Math.round(stats.detected/stats.processed*100)}%`);
    console.log(`\n📊 Tool breakdown:`);
    console.log(`  • Outreach.io: ${stats.outreach}`);
    console.log(`  • SalesLoft: ${stats.salesloft}`);
    console.log(`  • Both tools: ${stats.both}`);
    
    if (stats.companiesFound.length > 0) {
      console.log(`\n🏢 Companies found:`);
      stats.companiesFound.forEach(c => {
        console.log(`  ✅ ${c.company} - ${c.tool}`);
        if (c.context) {
          console.log(`     "${c.context}..."`);
        }
      });
    }
    
    if (stats.detected > 0) {
      console.log(`\n🎉 SUCCESS! GPT-5 Responses API is working correctly!`);
      console.log('The automation is ready to be enabled.');
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Parse command line args
const limit = parseInt(process.argv[2]) || 20;

// Run the test
testJobs(limit).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});