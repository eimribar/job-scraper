/**
 * GPT-5-mini Analysis Service
 * ⚠️ CRITICAL: HARDCODED CONFIGURATION - DO NOT MODIFY ⚠️
 * - Uses GPT-5-mini ONLY via Responses API (NOT Chat Completions)
 * - Role-based input structure (developer + user messages)
 * - Reasoning effort: 'medium' (PROVEN OPTIMAL)
 * - Verbosity: 'low' (JSON only)
 * NEVER change ANY of these settings without explicit permission
 */

import { RawJob, AnalysisResult } from '@/types';

export class GPT5AnalysisService {
  // ⚠️ HARDCODED CONFIGURATION - NEVER CHANGE ⚠️
  private readonly RESPONSES_API_URL = 'https://api.openai.com/v1/responses';
  private readonly MODEL = 'gpt-5-mini';  // HARDCODED - NEVER CHANGE
  private readonly REASONING_EFFORT = 'medium';  // HARDCODED - PROVEN OPTIMAL
  private readonly VERBOSITY = 'low';  // HARDCODED - JSON ONLY

  constructor() {
    // No OpenAI client needed - using fetch with Responses API
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required');
    }
  }

  /**
   * Analyze a job using GPT-5-mini Responses API with role-based structure
   * ⚠️ CRITICAL: Uses HARDCODED optimal configuration ⚠️
   */
  async analyzeJob(job: RawJob): Promise<AnalysisResult> {
    // Build role-based messages - NEVER CHANGE THIS STRUCTURE
    const systemMessage = this.buildSystemMessage();
    const userMessage = this.buildUserMessage(job);
    
    try {
      // ⚠️ CRITICAL: Using Responses API with HARDCODED configuration ⚠️
      const response = await fetch(this.RESPONSES_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: this.MODEL,  // HARDCODED: gpt-5-mini
          input: [systemMessage, userMessage],  // ROLE-BASED ARRAY
          reasoning: { 
            effort: this.REASONING_EFFORT  // HARDCODED: medium
          },
          text: { 
            verbosity: this.VERBOSITY  // HARDCODED: low
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`GPT-5 API error ${response.status}:`, errorText.substring(0, 200));
        throw new Error(`GPT-5 API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Extract output from GPT-5 Responses API structure
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
        throw new Error('Empty response from GPT-5 API');
      }
      
      console.log(`  ✅ GPT-5-mini responded (${outputText.length} chars)`);
      
      // Parse the response as JSON
      let analysisResult;
      try {
        analysisResult = JSON.parse(outputText);
      } catch (parseError) {
        console.error('Failed to parse GPT-5-mini output:', outputText.substring(0, 100));
        analysisResult = {
          uses_tool: false,
          tool_detected: 'none',
          signal_type: 'none',
          context: 'Parse error'
        };
      }
      
      return {
        uses_tool: analysisResult.uses_tool || false,
        tool_detected: analysisResult.tool_detected || 'none',
        signal_type: analysisResult.signal_type || 'none',
        context: analysisResult.context || '',
        // Note: confidence field removed from schema
        job_id: job.job_id,
        company: job.company,
        job_title: job.job_title,
        job_url: job.job_url,
        platform: job.platform || 'LinkedIn'
      };
      
    } catch (error: any) {
      console.error('GPT-5-mini analysis error:', error.message);
      // Return a default result on error - NEVER fallback to another model
      return {
        uses_tool: false,
        tool_detected: 'none',
        signal_type: 'none',
        context: '',
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
   * Build system message for role-based input
   * ⚠️ HARDCODED STRUCTURE - NEVER MODIFY ⚠️
   */
  private buildSystemMessage(): any {
    // HARDCODED SYSTEM MESSAGE - NEVER CHANGE
    return {
      role: 'developer',  // MUST BE 'developer'
      content: `You are an expert at detecting sales tools in job descriptions.

DETECTION RULES:
• "Outreach.io", "Outreach" (capitalized, referring to the tool)
• "SalesLoft", "Salesloft", "Sales Loft" (any variation)
• Look in: requirements, preferred skills, tech stack, tools sections
• If BOTH tools are mentioned, return "Both"
• Distinguish tools from general sales terms (cold outreach, sales outreach, etc.)

SIGNAL TYPES:
• "required" - Tool is required/must-have
• "preferred" - Tool is preferred/nice-to-have  
• "stack_mention" - Tool mentioned in tech stack or tools list
• "none" - No tools detected

RESPONSE FORMAT - RETURN ONLY VALID JSON:
{
  "uses_tool": true or false,
  "tool_detected": "Outreach.io" or "SalesLoft" or "Both" or "none",
  "signal_type": "required" or "preferred" or "stack_mention" or "none",
  "context": "exact quote from job description (max 200 chars)"
}`
    };
  }

  /**
   * Build user message for role-based input
   * ⚠️ HARDCODED STRUCTURE - NEVER MODIFY ⚠️
   */
  private buildUserMessage(job: RawJob): any {
    // HARDCODED USER MESSAGE - NEVER CHANGE
    return {
      role: 'user',  // MUST BE 'user'
      content: `Analyze this job posting:

Company: ${job.company}
Job Title: ${job.job_title}

Description:
${job.description || 'No description available'}`
    };
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