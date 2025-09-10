/**
 * GPT-5-mini Analysis Service
 * CRITICAL: This service uses GPT-5-mini-2025-08-07 ONLY via Chat Completions API
 * NEVER fallback to GPT-4 or any other model
 * NEVER change the model unless explicitly told
 */

import { RawJob, AnalysisResult } from '@/types';
import OpenAI from 'openai';

export class GPT5AnalysisService {
  private openai: OpenAI;
  private readonly model: string = 'gpt-5-mini-2025-08-07'; // MUST USE THIS EXACT MODEL

  constructor() {
    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Analyze a job description using GPT-5-mini-2025-08-07 Chat Completions API
   * NEVER use Responses API or other models
   */
  async analyzeJob(job: RawJob): Promise<AnalysisResult> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(job);
    
    try {
      // Use GPT-5-mini Chat Completions API - NOT Responses API
      const response = await this.openai.chat.completions.create({
        model: this.model, // gpt-5-mini-2025-08-07 ONLY
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 500
        // Note: GPT-5-mini doesn't support custom temperature
      });

      const result = response.choices[0].message.content?.trim();
      
      if (!result || result.length === 0) {
        throw new Error('Empty response from GPT API');
      }
      
      console.log(`  ✅ GPT-5-mini-2025-08-07 responded (${result.length} chars)`);
      
      // Parse the response as JSON
      let analysisResult;
      try {
        analysisResult = JSON.parse(result);
      } catch (parseError) {
        console.error('Failed to parse GPT-5-mini output:', result.substring(0, 100));
        analysisResult = {
          uses_tool: false,
          tool_detected: 'none',
          signal_type: 'none',
          context: 'Parse error',
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
      
    } catch (error: any) {
      console.error('GPT-5-mini analysis error:', error.message);
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
   * Build the system prompt for GPT-5-mini
   */
  private buildSystemPrompt(): string {
    return `You are an expert at analyzing job descriptions to identify if companies use Outreach.io or SalesLoft.

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
  "context": "exact quote mentioning the tool",
  "confidence": "high"
}`;
  }

  /**
   * Build the user prompt for GPT-5-mini
   */
  private buildUserPrompt(job: RawJob): string {
    return `Company: ${job.company}
Job Title: ${job.job_title}
Job Description: ${job.description || 'No description available'}`;
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