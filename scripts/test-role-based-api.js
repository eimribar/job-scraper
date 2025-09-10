#!/usr/bin/env node

/**
 * Test GPT-5 with Role-Based Input Structure
 * Comparing single-string vs role-based approaches
 * Date: 2025-09-10
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * Test with ROLE-BASED input structure (recommended)
 */
async function analyzeWithRoleBased(job) {
  const systemContent = `You are an expert at detecting sales tools in job descriptions.

Detection Rules:
- Look for "Outreach.io" or capitalized "Outreach" when referring to the tool (not general outreach)
- Look for "SalesLoft", "Salesloft", or "Sales Loft"
- Check requirements, preferred skills, tech stack sections
- Distinguish between tools and general sales terms

Response Format:
You must return ONLY valid JSON with no additional text:
{"uses_tool":true/false,"tool_detected":"Outreach.io"|"SalesLoft"|"Both"|"none","context":"exact quote"}`;

  const userContent = `Analyze this job posting:

Company: ${job.company}
Job Title: ${job.job_title}
Category: ${job.search_term}

Description:
${job.description}`;

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        input: [
          {
            role: 'developer',  // System/developer message
            content: systemContent
          },
          {
            role: 'user',  // User message with job data
            content: userContent
          }
        ],
        reasoning: { 
          effort: 'high'  // HIGH for best detection
        },
        text: { 
          verbosity: 'low'  // LOW for just JSON
        }
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`API error: ${data.error?.message || response.status}`);
    }
    
    // Extract output from nested structure
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
    console.error(`  ❌ Role-based error: ${error.message}`);
    return { uses_tool: false, tool_detected: 'none', error: error.message };
  }
}

/**
 * Test with SINGLE-STRING input (current approach)
 */
async function analyzeWithSingleString(job) {
  const input = `You are an expert at detecting sales tools in job descriptions.

Detection Rules:
- Look for "Outreach.io" or capitalized "Outreach" when referring to the tool (not general outreach)
- Look for "SalesLoft", "Salesloft", or "Sales Loft"
- Check requirements, preferred skills, tech stack sections
- Distinguish between tools and general sales terms

Company: ${job.company}
Job Title: ${job.job_title}
Category: ${job.search_term}

Description:
${job.description}

Response Format:
You must return ONLY valid JSON with no additional text:
{"uses_tool":true/false,"tool_detected":"Outreach.io"|"SalesLoft"|"Both"|"none","context":"exact quote"}`;

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        input: input,  // Single string
        reasoning: { 
          effort: 'high'
        },
        text: { 
          verbosity: 'low'
        }
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`API error: ${data.error?.message || response.status}`);
    }
    
    // Extract output
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
    console.error(`  ❌ Single-string error: ${error.message}`);
    return { uses_tool: false, tool_detected: 'none', error: error.message };
  }
}

/**
 * Main test function
 */
async function compareApproaches() {
  console.log('🧪 COMPARING API APPROACHES');
  console.log('=' .repeat(60));
  console.log('Testing role-based vs single-string input structures');
  console.log('Using GPT-5-mini with HIGH reasoning effort');
  console.log('=' .repeat(60));
  
  // Get jobs with likely tool mentions
  const { data: jobs, error } = await supabase
    .from('raw_jobs')
    .select('*')
    .or('description.ilike.%Outreach%,description.ilike.%SalesLoft%,description.ilike.%Salesloft%')
    .limit(10);
  
  if (error || !jobs || jobs.length === 0) {
    console.log('❌ No jobs found with potential tool mentions');
    return;
  }
  
  console.log(`\n📋 Testing ${jobs.length} jobs with both approaches...\n`);
  
  const results = {
    roleBased: { detected: 0, errors: 0 },
    singleString: { detected: 0, errors: 0 },
    matches: 0,
    differences: []
  };
  
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    console.log(`\n[${i+1}/${jobs.length}] ${job.company} - ${job.job_title}`);
    console.log('  Testing with role-based structure...');
    
    // Test role-based
    const roleResult = await analyzeWithRoleBased(job);
    console.log(`    Role-based: ${roleResult.uses_tool ? `✅ ${roleResult.tool_detected}` : '❌ No tools'}`);
    if (roleResult.error) {
      results.roleBased.errors++;
    } else if (roleResult.uses_tool) {
      results.roleBased.detected++;
      console.log(`    Context: "${roleResult.context?.substring(0, 60)}..."`);
    }
    
    // Small delay
    await new Promise(r => setTimeout(r, 1000));
    
    console.log('  Testing with single-string structure...');
    
    // Test single-string
    const stringResult = await analyzeWithSingleString(job);
    console.log(`    Single-string: ${stringResult.uses_tool ? `✅ ${stringResult.tool_detected}` : '❌ No tools'}`);
    if (stringResult.error) {
      results.singleString.errors++;
    } else if (stringResult.uses_tool) {
      results.singleString.detected++;
      console.log(`    Context: "${stringResult.context?.substring(0, 60)}..."`);
    }
    
    // Compare results
    if (roleResult.tool_detected === stringResult.tool_detected) {
      results.matches++;
      console.log('  ✅ Results match');
    } else {
      console.log('  ⚠️  Results differ!');
      results.differences.push({
        company: job.company,
        role: roleResult.tool_detected,
        string: stringResult.tool_detected
      });
    }
    
    // Delay between jobs
    await new Promise(r => setTimeout(r, 1500));
  }
  
  // Print comparison results
  console.log('\n' + '=' .repeat(60));
  console.log('📊 COMPARISON RESULTS');
  console.log('=' .repeat(60));
  
  console.log('\n🎯 Role-Based Approach:');
  console.log(`  • Detected: ${results.roleBased.detected}/${jobs.length}`);
  console.log(`  • Errors: ${results.roleBased.errors}`);
  console.log(`  • Success rate: ${Math.round(results.roleBased.detected/jobs.length*100)}%`);
  
  console.log('\n📝 Single-String Approach:');
  console.log(`  • Detected: ${results.singleString.detected}/${jobs.length}`);
  console.log(`  • Errors: ${results.singleString.errors}`);
  console.log(`  • Success rate: ${Math.round(results.singleString.detected/jobs.length*100)}%`);
  
  console.log('\n🔄 Consistency:');
  console.log(`  • Matching results: ${results.matches}/${jobs.length}`);
  console.log(`  • Consistency rate: ${Math.round(results.matches/jobs.length*100)}%`);
  
  if (results.differences.length > 0) {
    console.log('\n⚠️  Differences found:');
    results.differences.forEach(d => {
      console.log(`  • ${d.company}:`);
      console.log(`    - Role-based: ${d.role}`);
      console.log(`    - Single-string: ${d.string}`);
    });
  }
  
  // Recommendation
  console.log('\n💡 RECOMMENDATION:');
  if (results.roleBased.detected > results.singleString.detected) {
    console.log('✅ Role-based approach performs better!');
  } else if (results.singleString.detected > results.roleBased.detected) {
    console.log('✅ Single-string approach performs better!');
  } else {
    console.log('✅ Both approaches perform equally well');
  }
  
  if (results.matches === jobs.length) {
    console.log('✅ Results are 100% consistent - either approach works');
  } else {
    console.log(`⚠️  Only ${Math.round(results.matches/jobs.length*100)}% consistency - further testing needed`);
  }
}

// Run the comparison
compareApproaches().catch(console.error);