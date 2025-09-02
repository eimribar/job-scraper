/**
 * GPT-5 Analysis Service
 * CRITICAL: This service uses GPT-5 ONLY via the Responses API
 * NEVER fallback to GPT-4, GPT-4.1, or any other model
 */

import { RawJob, AnalysisResult } from '@/types';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GPT5_MODEL = 'gpt-5'; // ONLY USE GPT-5

if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not configured');
}

export class GPT5AnalysisService {
  private apiKey: string;
  private model: string = 'gpt-5-mini'; // Use mini for faster/cheaper processing

  constructor() {
    this.apiKey = OPENAI_API_KEY!;
  }

  /**
   * Analyze a job description using GPT-5 Responses API
   * NEVER use Chat Completions API or other models
   */
  async analyzeJob(job: RawJob): Promise<AnalysisResult> {
    const prompt = this.buildPrompt(job);
    
    try {
      // Use GPT-5 Responses API - NOT Chat Completions
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model, // GPT-5 ONLY
          input: prompt,
          reasoning: { 
            effort: 'minimal' // Fastest reasoning for simple tool detection
          },
          text: { 
            verbosity: 'low' // Concise JSON output
          }
          // NO temperature parameter - not supported in GPT-5
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`GPT-5 API error: ${response.status} - ${error.substring(0, 500)}`);
        // Return default result on API error instead of throwing
        return {
          uses_tool: false,
          tool_detected: 'none',
          signal_type: 'none',
          context: '',
          confidence: 'low',
          job_id: job.job_id,
          company: job.company,
          job_title: job.job_title,
          job_url: job.job_url,
          platform: job.platform || 'LinkedIn',
          error: `API Error: ${response.status}`
        };
      }

      const data = await response.json();
      
      // GPT-5 Responses API structure: output[1].content[0].text
      let outputText = '';
      
      // Extract text from the correct location in the response
      if (data.output && Array.isArray(data.output) && data.output.length > 1) {
        const messageOutput = data.output[1]; // Second item is the message
        if (messageOutput && messageOutput.content && Array.isArray(messageOutput.content)) {
          const textContent = messageOutput.content.find(c => c.type === 'output_text');
          if (textContent && textContent.text) {
            outputText = textContent.text;
          }
        }
      }
      
      // If no text found, log the structure for debugging
      if (!outputText) {
        console.log('GPT-5 Response structure:', JSON.stringify(data, null, 2).substring(0, 500));
      }
      
      // Parse the extracted text as JSON
      let analysisResult;
      try {
        analysisResult = outputText ? JSON.parse(outputText) : {};
      } catch (parseError) {
        console.error('Failed to parse GPT-5 output:', outputText);
        analysisResult = {
          uses_tool: false,
          tool_detected: 'none',
          signal_type: 'none',
          context: '',
          confidence: 'low'
        };
      }
      
      return {
        uses_tool: analysisResult.uses_tool || false,
        tool_detected: analysisResult.tool_detected || 'none',
        signal_type: analysisResult.signal_type || 'none',
        context: analysisResult.context || '',
        confidence: analysisResult.confidence || 'low',
        job_id: job.job_id,
        company: job.company,
        job_title: job.job_title,
        job_url: job.job_url,
        platform: job.platform || 'LinkedIn'
      };
      
    } catch (error) {
      console.error('GPT-5 analysis error:', error);
      // Return a default result on error - DO NOT fallback to another model
      return {
        uses_tool: false,
        tool_detected: 'none',
        signal_type: 'none',
        context: '',
        confidence: 'low',
        job_id: job.job_id,
        company: job.company,
        job_title: job.job_title,
        job_url: job.job_url,
        platform: job.platform || 'LinkedIn',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Build the analysis prompt for GPT-5
   */
  private buildPrompt(job: RawJob): string {
    return `Analyze this job description to identify if the company uses Outreach.io or SalesLoft.

IMPORTANT RULES:
1. Distinguish between "Outreach" (the tool) and "outreach" (general sales activity)
2. Look for explicit tool mentions, not general sales terms
3. Return ONLY valid JSON, no additional text

Valid indicators for Outreach.io:
- "Outreach.io" (explicit mention)
- "Outreach platform"
- "Outreach sequences"
- Capitalized "Outreach" when listed with other tools (e.g., "Salesforce, Outreach, HubSpot")
- "experience with Outreach" (when clearly referring to the tool)

NOT valid (just general sales terms):
- "sales outreach"
- "cold outreach"
- "outreach efforts"
- "customer outreach"
- lowercase "outreach" in general context

Valid indicators for SalesLoft:
- "SalesLoft" or "Sales Loft"
- "Salesloft platform"
- Listed with other sales tools

Company: ${job.company}
Job Title: ${job.job_title}
Description: ${job.description || 'No description available'}

Return this exact JSON structure:
{
  "uses_tool": true or false,
  "tool_detected": "Outreach.io" or "SalesLoft" or "Both" or "none",
  "signal_type": "required" or "preferred" or "stack_mention" or "none",
  "context": "exact quote from the job description mentioning the tool (max 200 chars)",
  "confidence": "high" or "medium" or "low"
}`;
  }

  /**
   * Batch analyze multiple jobs (processes sequentially)
   */
  async analyzeJobs(jobs: RawJob[]): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];
    
    for (const job of jobs) {
      const result = await this.analyzeJob(job);
      results.push(result);
      
      // Rate limiting - 2 second delay between requests
      await this.sleep(2000);
    }
    
    return results;
  }

  /**
   * Helper function for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const gpt5AnalysisService = new GPT5AnalysisService();