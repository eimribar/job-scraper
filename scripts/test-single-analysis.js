/**
 * Test analyzing a single job
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

async function testSingleAnalysis() {
  console.log('🧪 Testing Single Job Analysis\n');
  
  // Get one job that's ready for analysis
  console.log('Fetching a job ready for analysis...\n');
  
  // Simple query - just get any job from our recent run
  const { data: jobs, error } = await supabase
    .from('job_queue')
    .select('*')
    .eq('payload->>scrape_run_id', '722ee08b-96e7-4033-acf3-75f09003eb9c')
    .limit(1);
  
  if (error) {
    console.error('Error fetching job:', error);
    return;
  }
  
  if (!jobs || jobs.length === 0) {
    console.log('No jobs found');
    return;
  }
  
  const job = jobs[0];
  console.log('Job found:');
  console.log(`  Company: ${job.payload.company}`);
  console.log(`  Title: ${job.payload.job_title}`);
  console.log(`  Location: ${job.payload.location}`);
  console.log(`  Ready for analysis: ${job.payload.ready_for_analysis}`);
  console.log(`  Already analyzed: ${job.payload.analyzed}\n`);
  
  if (job.payload.analyzed === true) {
    console.log('This job was already analyzed. Skipping.');
    return;
  }
  
  console.log('Analyzing job with GPT-3.5...\n');
  
  const systemPrompt = `You are an expert at analyzing job postings to detect if companies use Outreach.io or SalesLoft.

Return a JSON response with:
- uses_tool: boolean (true if either tool is detected)
- tool_detected: string ("Outreach.io", "SalesLoft", "Both", or "None")
- signal_type: string ("explicit_mention", "integration_requirement", "process_indicator", or "none")
- confidence: string ("high", "medium", or "low")
- context: string (relevant quote from job description, max 200 chars)`;

  const userPrompt = `Analyze this job posting:

Company: ${job.payload.company}
Title: ${job.payload.job_title}

Description:
${job.payload.description?.substring(0, 3000) || 'No description'}

Return only valid JSON.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 500,
      temperature: 0
    });

    const result = response.choices[0].message.content;
    console.log('Raw GPT response:');
    console.log(result);
    console.log();
    
    const analysis = JSON.parse(result);
    
    console.log('Parsed analysis:');
    console.log(`  Uses tool: ${analysis.uses_tool}`);
    console.log(`  Tool detected: ${analysis.tool_detected}`);
    console.log(`  Confidence: ${analysis.confidence}`);
    console.log(`  Signal type: ${analysis.signal_type}`);
    console.log(`  Context: ${analysis.context}\n`);
    
    // Update the job with analysis results
    job.payload.analyzed = true;
    job.payload.analysis_result = analysis;
    job.payload.analysis_date = new Date().toISOString();
    
    console.log('Updating job in database...');
    const { error: updateError } = await supabase
      .from('job_queue')
      .update({ 
        payload: job.payload,
        status: 'completed'
      })
      .eq('id', job.id);
    
    if (updateError) {
      console.error('Update error:', updateError);
    } else {
      console.log('✅ Job updated successfully!');
    }
    
    if (analysis.uses_tool) {
      console.log('\n🎯 TOOL DETECTED! This company uses', analysis.tool_detected);
    }
    
  } catch (error) {
    console.error('Analysis error:', error);
  }
}

testSingleAnalysis().catch(console.error);