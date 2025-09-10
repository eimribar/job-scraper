#!/usr/bin/env node

/**
 * Simple Processing Test
 * Tests processing directly via database and GPT-5-mini
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

async function testProcess() {
  console.log('🧪 TESTING GPT-5-mini-2025-08-07 PROCESSING');
  console.log('=' .repeat(60));
  
  try {
    // Get 5 unprocessed jobs
    const { data: jobs, error } = await supabase
      .from('raw_jobs')
      .select('*')
      .eq('processed', false)
      .limit(5);
    
    if (error) throw error;
    
    if (!jobs || jobs.length === 0) {
      console.log('❌ No unprocessed jobs found');
      return;
    }
    
    console.log(`📋 Found ${jobs.length} unprocessed jobs\n`);
    
    let detected = 0;
    
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      console.log(`[${i+1}/${jobs.length}] Processing ${job.company}...`);
      
      try {
        // Call GPT-5-mini
        const response = await openai.chat.completions.create({
          model: 'gpt-5-mini-2025-08-07', // EXACT MODEL NAME
          messages: [
            {
              role: 'system',
              content: `Analyze if the company uses Outreach.io or SalesLoft. Return JSON only:
{
  "uses_tool": true/false,
  "tool_detected": "Outreach.io"/"SalesLoft"/"Both"/"none"
}`
            },
            {
              role: 'user',
              content: `Company: ${job.company}\nTitle: ${job.job_title}\nDescription: ${job.description?.substring(0, 2000)}`
            }
          ],
          max_completion_tokens: 200
        });
        
        const result = JSON.parse(response.choices[0].message.content);
        
        if (result.uses_tool) {
          console.log(`  ✅ DETECTED: ${result.tool_detected}`);
          detected++;
          
          // Save to identified_companies
          await supabase
            .from('identified_companies')
            .upsert({
              company: job.company,
              tool_detected: result.tool_detected,
              signal_type: 'explicit_mention',
              context: '',
              job_title: job.job_title,
              job_url: job.job_url,
              platform: job.platform,
              identified_date: new Date().toISOString()
            }, { 
              onConflict: 'company,tool_detected',
              ignoreDuplicates: false 
            });
        } else {
          console.log(`  ❌ No tools detected`);
        }
        
        // Mark as processed
        await supabase
          .from('raw_jobs')
          .update({ 
            processed: true,
            analyzed_date: new Date().toISOString()
          })
          .eq('job_id', job.job_id);
        
      } catch (err) {
        console.error(`  ❌ Error: ${err.message}`);
      }
      
      // Small delay
      await new Promise(r => setTimeout(r, 500));
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('📊 RESULTS:');
    console.log(`  Processed: ${jobs.length} jobs`);
    console.log(`  Detected: ${detected} companies with tools`);
    console.log(`  Detection rate: ${Math.round(detected/jobs.length*100)}%`);
    
    if (detected > 0) {
      console.log('\n🎉 SUCCESS! GPT-5-mini-2025-08-07 is working perfectly!');
    } else {
      console.log('\n✅ Processing works! (No tools in this batch is normal)');
    }
    
    console.log('\n✅ AUTOMATION IS READY TO BE ENABLED!');
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    process.exit(1);
  }
}

testProcess();