#!/usr/bin/env node

/**
 * Test GPT-5 with Best Practice Role-Based Structure
 * Uses the recommended Responses API with role-based input
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
 * Analyze job using BEST PRACTICE role-based structure
 */
async function analyzeJob(job) {
  // System/Developer message with instructions
  const systemMessage = {
    role: 'developer',
    content: `You are an expert at detecting sales tools in job descriptions.

DETECTION RULES:
• "Outreach.io" or "Outreach" (capitalized, referring to the tool)
• "SalesLoft", "Salesloft", "Sales Loft" (any variation)
• Look in: requirements, preferred skills, tech stack, tools sections
• Distinguish tools from general sales terms (cold outreach, sales outreach, etc.)

SIGNAL TYPES:
• "required" - Tool is required/must-have
• "preferred" - Tool is preferred/nice-to-have  
• "stack_mention" - Tool mentioned in tech stack
• "none" - No tools detected

RESPONSE FORMAT:
Return ONLY valid JSON:
{
  "uses_tool": true or false,
  "tool_detected": "Outreach.io" or "SalesLoft" or "Both" or "none",
  "signal_type": "required" or "preferred" or "stack_mention" or "none",
  "context": "exact quote from job description (max 200 chars)"
}`
  };

  // User message with the actual job data
  const userMessage = {
    role: 'user',
    content: `Analyze this job posting for sales tool usage:

Company: ${job.company}
Job Title: ${job.job_title}
Category: ${job.search_term}

Job Description:
${job.description}`
  };

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        input: [systemMessage, userMessage],  // Role-based array
        reasoning: { 
          effort: 'medium'  // MEDIUM for balanced speed and accuracy
        },
        text: { 
          verbosity: 'low'  // LOW for concise JSON output
        }
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`API error: ${data.error?.message || response.status}`);
    }
    
    // Extract output from GPT-5 response structure
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
    console.error(`  ❌ Analysis error: ${error.message}`);
    return {
      uses_tool: false,
      tool_detected: 'none',
      signal_type: 'none',
      context: '',
      error: error.message
    };
  }
}

/**
 * Main test function
 */
async function testBestPractice(limit = 30) {
  console.log('🚀 TESTING GPT-5 WITH BEST PRACTICE STRUCTURE');
  console.log('=' .repeat(60));
  console.log('Using: Role-based input (developer + user messages)');
  console.log('Model: gpt-5-mini');
  console.log('Reasoning: MEDIUM effort');
  console.log('Verbosity: LOW (JSON only)');
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
      process.stdout.write(`[${i+1}/${jobs.length}] ${job.company.substring(0, 30).padEnd(30)} | ${job.search_term.padEnd(15)} | `);
      
      const result = await analyzeJob(job);
      
      if (result.uses_tool && result.tool_detected !== 'none') {
        console.log(`✅ ${result.tool_detected} (${result.signal_type})`);
        stats.detected++;
        stats.companiesFound.push({
          company: job.company,
          tool: result.tool_detected,
          signal: result.signal_type,
          context: result.context?.substring(0, 100)
        });
        
        if (result.tool_detected === 'Outreach.io') stats.outreach++;
        else if (result.tool_detected === 'SalesLoft') stats.salesloft++;
        else if (result.tool_detected === 'Both') {
          stats.both++;
          stats.outreach++;
          stats.salesloft++;
        }
        
        // Save to identified_companies - using proper logic like simple-processor
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
              signal_type: result.signal_type || 'explicit_mention',
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
              signal_type: result.signal_type || 'explicit_mention',
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
      
      // Stop early if we found enough examples
      if (stats.detected >= 5) {
        console.log('\n\n🎯 Found 5+ companies, stopping early...');
        break;
      }
    }
    
    // Print results
    console.log('\n' + '=' .repeat(60));
    console.log('📊 RESULTS WITH BEST PRACTICE STRUCTURE');
    console.log('=' .repeat(60));
    console.log(`✅ Processed: ${stats.processed} jobs`);
    console.log(`🎯 Detected: ${stats.detected} companies with tools`);
    console.log(`📈 Detection rate: ${Math.round(stats.detected/stats.processed*100)}%`);
    
    if (stats.detected > 0) {
      console.log(`\n📊 Tool breakdown:`);
      console.log(`  • Outreach.io: ${stats.outreach}`);
      console.log(`  • SalesLoft: ${stats.salesloft}`);
      console.log(`  • Both tools: ${stats.both}`);
      
      console.log(`\n🏢 Companies found:`);
      stats.companiesFound.forEach(c => {
        console.log(`  ✅ ${c.company} - ${c.tool} (${c.signal})`);
        if (c.context) {
          console.log(`     "${c.context}..."`);
        }
      });
    }
    
    if (stats.detected > 0) {
      console.log(`\n🎉 SUCCESS! Role-based structure is working perfectly!`);
      console.log('Ready to update all scripts and services.');
    } else {
      console.log(`\n⚠️  No tools detected in this batch.`);
      console.log('This could mean these specific jobs don\'t mention tools.');
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Parse command line args
const limit = parseInt(process.argv[2]) || 30;

// Run the test
testBestPractice(limit).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});