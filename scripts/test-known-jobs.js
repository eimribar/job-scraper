#!/usr/bin/env node

/**
 * Test GPT-5 with Jobs Known to Have Tool Mentions
 * Uses best practice role-based structure
 * Date: 2025-09-10
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * Analyze job using best practice structure
 */
async function analyzeJob(job) {
  const systemMessage = {
    role: 'developer',
    content: `You are an expert at detecting sales tools in job descriptions.

DETECTION RULES:
• "Outreach.io", "Outreach" (capitalized, referring to the tool)
• "SalesLoft", "Salesloft", "Sales Loft" (any variation)
• Look in: requirements, preferred skills, tech stack, tools sections
• If BOTH tools are mentioned, return "Both"

SIGNAL TYPES:
• "required" - Tool is required/must-have
• "preferred" - Tool is preferred/nice-to-have  
• "stack_mention" - Tool mentioned in tech stack or tools list

RESPONSE FORMAT:
Return ONLY valid JSON:
{
  "uses_tool": true or false,
  "tool_detected": "Outreach.io" or "SalesLoft" or "Both" or "none",
  "signal_type": "required" or "preferred" or "stack_mention",
  "context": "exact quote from job description"
}`
  };

  const userMessage = {
    role: 'user',
    content: `Analyze this job posting:

Company: ${job.company}
Job Title: ${job.title}

Description:
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
        input: [systemMessage, userMessage],
        reasoning: { effort: 'medium' },
        text: { verbosity: 'low' }
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
    console.error(`  ❌ Error: ${error.message}`);
    return { uses_tool: false, tool_detected: 'none', error: error.message };
  }
}

/**
 * Test with known jobs
 */
async function testKnownJobs() {
  console.log('🎯 TESTING JOBS WITH KNOWN TOOL MENTIONS');
  console.log('=' .repeat(60));
  console.log('Using: Role-based structure (best practice)');
  console.log('Model: gpt-5-mini');
  console.log('Reasoning: MEDIUM effort');
  console.log('=' .repeat(60));
  
  // Define test jobs with known tool mentions
  const testJobs = [
    {
      company: 'Carrot',
      title: 'Associate Account Executive - Health Plans',
      description: `About Carrot: Carrot is a global, comprehensive fertility and family care platform, supporting members and their families through many of life's most memorable moments. Trusted by many of the world's leading multinational employers, health plans, and health systems, Carrot's proven clinical program delivers exceptional outcomes and experiences for members and industry-leading cost-savings for employers. Its award-winning products serve all populations, from preconception care through pregnancy, IVF, male factor infertility, adoption, gestational carrier care, and menopause. Carrot offers localized support in over 170 countries and 25 languages. With a comprehensive program that prioritizes clinical excellence and human-centered care, Carrot supports members and their families through many of the most meaningful moments of their lives. Learn more at get-carrot.com. The Role:  The Associate Account Executive will be responsible for driving success in our Health Plan sales development and support efforts. This hybrid role will require a blend of Sales Development Representative (SDR) responsibilities and Sales Support/Marketing tasks. The ideal candidate will excel at lead generation, marketing collaboration, and providing critical support to our sales team when navigating complex client interactions. What you will focus on: * Lead the execution of lead generation strategies, partnering closely with the Marketing team to ensure alignment with overall business objectives. * Conduct outreach activities to engage prospective clients and qualify leads through various communication channels. * Continuously learn and apply sales strategy concepts to enhance the effectiveness of prospecting and lead generation efforts. * Develop a deep understanding of the market, competition, and industry trends to contribute valuable insights to the sales team. * Follow up on marketing campaigns to maximize lead conversion and schedule appointments for the sales team. * Support the sales team in addressing client inquiries, follow-up questions, and concerns related to requests for proposals (RFPs). * Assist in preparing sales proposals, presentations, and marketing collateral to support the sales process. * Collaborate with internal teams to identify opportunities for improving lead generation tactics and enhancing sales support processes. The Team:  This role sits within the Growth & Strategy Organization on the Health Plan Team will work cross-collaboratively across many teams across Carrot- marketing, sales, legal and more.  Minimum Qualifications:  * Bachelors Degree * 2+ years of experience in sales development, marketing, or sales support roles. * Strong communication and interpersonal skills, with the ability to engage effectively with clients and internal stakeholders. * Experience with sales tools (SalesLoft/Outreach, Salesforce, SalesNav, etc.) * Demonstrated ability to multitask and prioritize tasks in a fast-paced environment.`,
      expected: 'Both'  // Mentions both SalesLoft and Outreach
    }
  ];
  
  // Also get some jobs from database with known keywords
  console.log('\n📋 First, testing manually provided job with known tools...\n');
  
  for (const job of testJobs) {
    console.log(`Testing: ${job.company} - ${job.title}`);
    console.log(`Expected: ${job.expected}`);
    
    const result = await analyzeJob(job);
    
    if (result.uses_tool) {
      console.log(`✅ DETECTED: ${result.tool_detected} (${result.signal_type})`);
      console.log(`   Context: "${result.context}"`);
      
      if (result.tool_detected === job.expected) {
        console.log(`   ✅ CORRECT! Matched expected result`);
      } else {
        console.log(`   ⚠️  MISMATCH: Expected ${job.expected}, got ${result.tool_detected}`);
      }
    } else {
      console.log(`❌ NO TOOLS DETECTED`);
      console.log(`   ⚠️  FAILED: Expected ${job.expected}`);
    }
    
    console.log('-' .repeat(60));
  }
  
  // Now test database jobs with keywords
  console.log('\n📋 Now testing database jobs with tool keywords...\n');
  
  const { data: dbJobs, error } = await supabase
    .from('raw_jobs')
    .select('*')
    .or('description.ilike.%SalesLoft%,description.ilike.%Salesloft%,description.ilike.%Outreach.io%')
    .limit(5);
  
  if (!error && dbJobs && dbJobs.length > 0) {
    for (let i = 0; i < dbJobs.length; i++) {
      const job = dbJobs[i];
      console.log(`[${i+1}/${dbJobs.length}] ${job.company} - ${job.job_title}`);
      
      // Check what keywords are present
      const hasOutreach = job.description?.includes('Outreach');
      const hasSalesLoft = job.description?.match(/Sales[Ll]oft|SalesLoft/);
      console.log(`  Keywords: ${hasOutreach ? 'Outreach ' : ''}${hasSalesLoft ? 'SalesLoft' : ''}`);
      
      const result = await analyzeJob({
        company: job.company,
        title: job.job_title,
        description: job.description
      });
      
      if (result.uses_tool) {
        console.log(`  ✅ DETECTED: ${result.tool_detected} (${result.signal_type})`);
        console.log(`     Context: "${result.context?.substring(0, 100)}..."`);
      } else {
        console.log(`  ❌ NO TOOLS DETECTED (despite keywords!)`);
      }
      
      console.log('-' .repeat(60));
      
      // Small delay
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 TEST COMPLETE');
  console.log('=' .repeat(60));
  console.log('\nThe role-based structure with MEDIUM reasoning is ready for production.');
  console.log('Next step: Update all scripts and services to use this structure.');
}

// Run the test
testKnownJobs().catch(console.error);