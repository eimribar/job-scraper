#!/usr/bin/env node

/**
 * Test with HIGH reasoning effort for better detection
 * Uses GPT-5-mini Responses API with thorough analysis
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function analyzeWithHighReasoning(job) {
  const input = `You are an expert at detecting sales tools in job descriptions.

Carefully analyze this job posting to identify if the company uses Outreach.io or SalesLoft.

Look for:
- Direct mentions of "Outreach.io" or "Outreach" as a tool (not general outreach)
- Any variation of "SalesLoft", "Salesloft", "Sales Loft"
- Tool names in requirements, preferred skills, or tech stack sections
- References to sales engagement platforms that match these tools

Company: ${job.company}
Job Title: ${job.job_title}
Search Category: ${job.search_term}

Full Description:
${job.description}

Analyze thoroughly and return ONLY a JSON object:
{"uses_tool":true/false,"tool_detected":"Outreach.io"/"SalesLoft"/"Both"/"none","context":"exact quote mentioning the tool"}`;

  try {
    console.log(`  🔍 Analyzing with HIGH reasoning...`);
    
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
          effort: 'high'  // THOROUGH REASONING for better detection
        },
        text: { 
          verbosity: 'low'  // Just the JSON result
        }
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`API error: ${data.error?.message || response.status}`);
    }
    
    // Extract output text
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
    
    return JSON.parse(outputText || '{}');
    
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return { uses_tool: false, tool_detected: 'none' };
  }
}

async function testWithHighReasoning() {
  console.log('🚀 TESTING WITH HIGH REASONING EFFORT');
  console.log('=' .repeat(60));
  console.log('Using GPT-5-mini with Responses API');
  console.log('Reasoning: HIGH (thorough analysis)');
  console.log('Verbosity: LOW (concise JSON output)');
  console.log('=' .repeat(60));
  
  // Get a mix of job categories
  const { data: jobs, error } = await supabase
    .from('raw_jobs')
    .select('*')
    .eq('processed', false)
    .order('random()')
    .limit(50);  // Test 50 random jobs
  
  if (error || !jobs || jobs.length === 0) {
    console.log('❌ No jobs found');
    return;
  }
  
  console.log(`\n📋 Processing ${jobs.length} jobs to find tool users...\n`);
  
  const found = [];
  let processed = 0;
  
  for (const job of jobs) {
    processed++;
    process.stdout.write(`[${processed}/${jobs.length}] ${job.company.substring(0, 30).padEnd(30)} | `);
    
    const result = await analyzeWithHighReasoning(job);
    
    if (result.uses_tool && result.tool_detected !== 'none') {
      console.log(`✅ FOUND: ${result.tool_detected}`);
      console.log(`     Context: "${result.context?.substring(0, 100)}..."`);
      
      found.push({
        company: job.company,
        title: job.job_title,
        tool: result.tool_detected,
        context: result.context,
        category: job.search_term
      });
      
      // Save to database - using proper logic
      // First check if company+tool combination already exists
      const { data: existing } = await supabase
        .from('identified_companies')
        .select('id')
        .eq('company', job.company)
        .eq('tool_detected', result.tool_detected)
        .single();
      
      if (existing) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('identified_companies')
          .update({
            signal_type: 'explicit_mention',
            context: result.context || '',
            job_title: job.job_title,
            job_url: job.job_url,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
          
        if (updateError) {
          console.log(`     ⚠️ Failed to update: ${updateError.message}`);
        }
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from('identified_companies')
          .insert({
            company: job.company,
            tool_detected: result.tool_detected,
            signal_type: 'explicit_mention',
            context: result.context || '',
            job_title: job.job_title,
            job_url: job.job_url,
            platform: job.platform || 'LinkedIn',
            identified_date: new Date().toISOString()
          });
          
        if (insertError) {
          console.log(`     ⚠️ Failed to save: ${insertError.message}`);
        } else {
          console.log(`     💾 Saved to database`);
        }
      }
      
      // Mark as processed
      await supabase
        .from('raw_jobs')
        .update({ 
          processed: true,
          analyzed_date: new Date().toISOString()
        })
        .eq('job_id', job.job_id);
      
    } else {
      console.log('❌ No tools');
      
      // Still mark as processed
      await supabase
        .from('raw_jobs')
        .update({ 
          processed: true,
          analyzed_date: new Date().toISOString()
        })
        .eq('job_id', job.job_id);
    }
    
    // Delay between API calls
    await new Promise(r => setTimeout(r, 1000));
    
    // Stop early if we found some
    if (found.length >= 5) {
      console.log('\n\n🎯 Found enough examples, stopping early...');
      break;
    }
  }
  
  // Results
  console.log('\n' + '=' .repeat(60));
  console.log('📊 RESULTS WITH HIGH REASONING');
  console.log('=' .repeat(60));
  console.log(`Processed: ${processed} jobs`);
  console.log(`Found: ${found.length} companies using tools`);
  console.log(`Detection rate: ${Math.round(found.length/processed*100)}%`);
  
  if (found.length > 0) {
    console.log('\n🎉 COMPANIES USING SALES TOOLS:');
    found.forEach((f, i) => {
      console.log(`\n${i+1}. ✅ ${f.company}`);
      console.log(`   Job: ${f.title}`);
      console.log(`   Tool: ${f.tool}`);
      console.log(`   Category: ${f.category}`);
      if (f.context) {
        console.log(`   Evidence: "${f.context.substring(0, 150)}..."`);
      }
    });
    
    console.log('\n✅ SUCCESS! The system is detecting tools correctly!');
    console.log('🚀 Ready to enable automation for processing remaining jobs.');
  } else {
    console.log('\n⚠️  No tools found in this batch.');
    console.log('This could mean these specific jobs don\'t mention tools.');
    console.log('Let me search for jobs more likely to have tools...');
  }
  
  // Check total detected
  const { count } = await supabase
    .from('identified_companies')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n📊 Total companies in database: ${count}`);
}

testWithHighReasoning().catch(console.error);