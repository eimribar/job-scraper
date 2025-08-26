import OpenAI from 'openai';
import { ScrapedJob } from './scraperService';

export interface AnalysisResult {
  uses_tool: boolean;
  tool_detected: 'Outreach.io' | 'SalesLoft' | 'none';
  signal_type: 'required' | 'preferred' | 'stack_mention' | 'none';
  context: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface AnalyzedJob extends ScrapedJob {
  analysis: AnalysisResult;
  analysis_date: string;
}

export class AnalysisService {
  private openai: OpenAI;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required');
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async analyzeJob(job: ScrapedJob): Promise<AnalyzedJob> {
    try {
      const analysis = await this.detectSalesTools(job);
      
      return {
        ...job,
        analysis,
        analysis_date: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error analyzing job:', error);
      
      // Return with empty analysis on error
      return {
        ...job,
        analysis: {
          uses_tool: false,
          tool_detected: 'none',
          signal_type: 'none',
          context: '',
          confidence: 'low',
        },
        analysis_date: new Date().toISOString(),
      };
    }
  }

  // Single job analysis only - no batching per requirements
  // Each job is processed one at a time through OpenAI

  private async detectSalesTools(job: ScrapedJob): Promise<AnalysisResult> {
    const systemPrompt = `You are an expert at analyzing job descriptions to identify if companies use Outreach.io or SalesLoft.

IMPORTANT: Distinguish between "Outreach" (the tool) and "outreach" (general sales activity).

Valid indicators for Outreach.io:
- "Outreach.io"
- "Outreach platform"
- "Outreach sequences"
- Capitalized "Outreach" listed with other tools
- "experience with Outreach"

NOT valid (just general sales terms):
- "sales outreach"
- "cold outreach"
- "outreach efforts"
- "customer outreach"

Analyze the job description and return ONLY this JSON:
{
  "uses_tool": true/false,
  "tool_detected": "Outreach.io" or "SalesLoft" or "none",
  "signal_type": "required" or "preferred" or "stack_mention" or "none",
  "context": "exact quote mentioning the tool",
  "confidence": "high" or "medium" or "low"
}`;

    const userPrompt = `Company: ${job.company}
Job Title: ${job.job_title}
Job Description: ${job.description}`;

    const response = await this.openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-5-mini-2025-08-07', // Using GPT-5-mini as configured
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      // temperature: 0, // GPT-5-mini only supports default temperature (1)
      max_completion_tokens: 500, // Changed from max_tokens for GPT-5-mini compatibility
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    try {
      // Clean the response to extract JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const analysis = JSON.parse(jsonMatch[0]) as AnalysisResult;
      
      // Validate the response structure
      if (typeof analysis.uses_tool !== 'boolean' ||
          !['Outreach.io', 'SalesLoft', 'none'].includes(analysis.tool_detected) ||
          !['required', 'preferred', 'stack_mention', 'none'].includes(analysis.signal_type) ||
          !['high', 'medium', 'low'].includes(analysis.confidence)) {
        throw new Error('Invalid analysis structure');
      }
      
      return analysis;
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError, 'Content:', content);
      
      // Return default analysis on parse error
      return {
        uses_tool: false,
        tool_detected: 'none',
        signal_type: 'none',
        context: '',
        confidence: 'low',
      };
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}