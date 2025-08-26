import OpenAI from 'openai';
import { BaseService, ServiceError } from './baseService';
import { analysisRateLimiter } from './rateLimiter';
import { ScrapedJob } from './improvedScraperService';

export interface AnalysisResult {
  uses_tool: boolean;
  tool_detected: 'Outreach.io' | 'SalesLoft' | 'both' | 'none';
  signal_type: 'required' | 'preferred' | 'stack_mention' | 'none';
  context: string;
  confidence: 'high' | 'medium' | 'low';
  keywords_found: string[];
  alternative_tools: string[];
}

export interface AnalyzedJob extends ScrapedJob {
  analysis: AnalysisResult;
  analysis_date: string;
  analysis_duration_ms: number;
}

export interface BatchAnalysisResult {
  analyzed: AnalyzedJob[];
  failed: Array<{ job: ScrapedJob; error: string }>;
  stats: {
    totalProcessed: number;
    successful: number;
    failed: number;
    toolsDetected: {
      outreach: number;
      salesLoft: number;
      both: number;
      none: number;
    };
    averageDuration: number;
    totalCost: number;
  };
}

export class ImprovedAnalysisService extends BaseService {
  private openai: OpenAI | null = null;
  private isConfigured: boolean = false;
  private totalTokensUsed: number = 0;
  private model: string;
  private temperature: number;

  constructor() {
    super();
    // CRITICAL: Only use GPT-5-mini model as specified by user
    // NEVER fallback to gpt-4 or any other model unless explicitly defined
    this.model = process.env.OPENAI_MODEL || 'gpt-5-mini-2025-08-07';
    this.temperature = parseFloat(process.env.OPENAI_TEMPERATURE || '0.3');
    this.initialize();
  }

  private initialize(): void {
    try {
      this.validateConfig(['OPENAI_API_KEY']);
      
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY!,
      });
      
      this.isConfigured = true;
    } catch (error) {
      console.warn('OpenAI not configured:', error);
      this.isConfigured = false;
    }
  }

  async analyzeBatch(
    jobs: ScrapedJob[], 
    options: { 
      batchSize?: number;
      confidenceThreshold?: 'high' | 'medium' | 'low';
    } = {}
  ): Promise<BatchAnalysisResult> {
    const batchSize = options.batchSize || parseInt(process.env.BATCH_SIZE || '20');
    const results: AnalyzedJob[] = [];
    const failed: Array<{ job: ScrapedJob; error: string }> = [];
    const stats = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      toolsDetected: {
        outreach: 0,
        salesLoft: 0,
        both: 0,
        none: 0,
      },
      averageDuration: 0,
      totalCost: 0,
    };

    const totalDurations: number[] = [];

    // Process in batches
    for (let i = 0; i < jobs.length; i += batchSize) {
      const batch = jobs.slice(i, i + batchSize);
      console.log(`📊 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(jobs.length / batchSize)}`);
      
      // Process batch concurrently with rate limiting
      const batchPromises = batch.map(job => 
        this.analyzeJobWithRetry(job).catch(error => ({
          error: error instanceof Error ? error.message : 'Unknown error',
          job,
        }))
      );

      const batchResults = await Promise.all(batchPromises);

      for (const result of batchResults) {
        stats.totalProcessed++;
        
        if ('error' in result) {
          failed.push({ job: result.job, error: result.error });
          stats.failed++;
        } else {
          results.push(result);
          stats.successful++;
          totalDurations.push(result.analysis_duration_ms);
          
          // Update tool detection stats
          switch (result.analysis.tool_detected) {
            case 'Outreach.io':
              stats.toolsDetected.outreach++;
              break;
            case 'SalesLoft':
              stats.toolsDetected.salesLoft++;
              break;
            case 'both':
              stats.toolsDetected.both++;
              break;
            case 'none':
              stats.toolsDetected.none++;
              break;
          }

          // Filter by confidence if specified
          if (options.confidenceThreshold) {
            const confidenceLevels = ['low', 'medium', 'high'];
            const thresholdIndex = confidenceLevels.indexOf(options.confidenceThreshold);
            const resultIndex = confidenceLevels.indexOf(result.analysis.confidence);
            
            if (resultIndex < thresholdIndex) {
              // Don't include low confidence results if threshold is higher
              results.pop();
            }
          }
        }
      }

      // Add delay between batches to avoid rate limits
      if (i + batchSize < jobs.length) {
        await this.sleep(2000);
      }
    }

    // Calculate statistics
    if (totalDurations.length > 0) {
      stats.averageDuration = totalDurations.reduce((a, b) => a + b, 0) / totalDurations.length;
    }
    
    stats.totalCost = this.estimateCost(this.totalTokensUsed);

    return {
      analyzed: results,
      failed,
      stats,
    };
  }

  private async analyzeJobWithRetry(job: ScrapedJob): Promise<AnalyzedJob> {
    return analysisRateLimiter.execute(() => this.analyzeJob(job));
  }

  async analyzeJob(job: ScrapedJob): Promise<AnalyzedJob> {
    if (!this.isConfigured || !this.openai) {
      return this.getMockAnalysis(job);
    }

    const startTime = Date.now();

    return this.withRetry(async () => {
      const analysis = await this.detectSalesTools(job);
      
      return {
        ...job,
        analysis,
        analysis_date: new Date().toISOString(),
        analysis_duration_ms: Date.now() - startTime,
      };
    });
  }

  private async detectSalesTools(job: ScrapedJob): Promise<AnalysisResult> {
    if (!this.openai) {
      throw new ServiceError('OpenAI client not initialized', 'NOT_INITIALIZED');
    }

    const prompt = this.buildAnalysisPrompt(job);

    try {
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are an expert at analyzing job descriptions to identify sales engagement tools.
Focus on detecting mentions of Outreach.io and SalesLoft.
Be precise and look for explicit mentions, requirements, or clear references to these tools.
Consider the context to determine if it's required, preferred, or just mentioned.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: this.temperature,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content;
      
      if (!content) {
        throw new ServiceError('No response from OpenAI', 'EMPTY_RESPONSE');
      }

      // Track token usage
      if (completion.usage) {
        this.totalTokensUsed += completion.usage.total_tokens;
      }

      const result = JSON.parse(content);
      
      return this.validateAnalysisResult(result);
    } catch (error) {
      this.handleError(error, 'detectSalesTools');
    }
  }

  private buildAnalysisPrompt(job: ScrapedJob): string {
    return `Analyze this job posting for ${job.company}:

Title: ${job.job_title}
Location: ${job.location}

Description:
${job.description.slice(0, 3000)}

Return a JSON object with:
{
  "uses_tool": boolean (true if Outreach.io or SalesLoft mentioned),
  "tool_detected": string ("Outreach.io", "SalesLoft", "both", or "none"),
  "signal_type": string ("required" if mandatory, "preferred" if nice-to-have, "stack_mention" if just mentioned, "none" if not found),
  "context": string (relevant quote from the description, max 200 chars),
  "confidence": string ("high" for explicit mention, "medium" for strong indicators, "low" for weak signals),
  "keywords_found": array of strings (actual keywords/phrases found),
  "alternative_tools": array of strings (other sales tools mentioned)
}`;
  }

  private validateAnalysisResult(result: any): AnalysisResult {
    // Ensure all required fields exist with defaults
    return {
      uses_tool: result.uses_tool === true,
      tool_detected: this.validateToolDetected(result.tool_detected),
      signal_type: this.validateSignalType(result.signal_type),
      context: (result.context || '').slice(0, 200),
      confidence: this.validateConfidence(result.confidence),
      keywords_found: Array.isArray(result.keywords_found) ? result.keywords_found : [],
      alternative_tools: Array.isArray(result.alternative_tools) ? result.alternative_tools : [],
    };
  }

  private validateToolDetected(value: any): 'Outreach.io' | 'SalesLoft' | 'both' | 'none' {
    const valid = ['Outreach.io', 'SalesLoft', 'both', 'none'];
    return valid.includes(value) ? value : 'none';
  }

  private validateSignalType(value: any): 'required' | 'preferred' | 'stack_mention' | 'none' {
    const valid = ['required', 'preferred', 'stack_mention', 'none'];
    return valid.includes(value) ? value : 'none';
  }

  private validateConfidence(value: any): 'high' | 'medium' | 'low' {
    const valid = ['high', 'medium', 'low'];
    return valid.includes(value) ? value : 'low';
  }

  private getMockAnalysis(job: ScrapedJob): AnalyzedJob {
    console.log('⚠️  Using mock analysis (OpenAI not configured)');
    
    // Simulate detection based on keywords
    const description = job.description.toLowerCase();
    const hasOutreach = description.includes('outreach');
    const hasSalesLoft = description.includes('salesloft') || description.includes('sales loft');
    
    let tool_detected: 'Outreach.io' | 'SalesLoft' | 'both' | 'none' = 'none';
    if (hasOutreach && hasSalesLoft) {
      tool_detected = 'both';
    } else if (hasOutreach) {
      tool_detected = 'Outreach.io';
    } else if (hasSalesLoft) {
      tool_detected = 'SalesLoft';
    }

    return {
      ...job,
      analysis: {
        uses_tool: tool_detected !== 'none',
        tool_detected,
        signal_type: tool_detected !== 'none' ? 'stack_mention' : 'none',
        context: 'Mock analysis result',
        confidence: tool_detected !== 'none' ? 'medium' : 'low',
        keywords_found: [],
        alternative_tools: [],
      },
      analysis_date: new Date().toISOString(),
      analysis_duration_ms: 100,
    };
  }

  private estimateCost(tokens: number): number {
    // Estimate based on model pricing
    const costPer1kTokens = this.model.includes('mini') ? 0.00015 : 0.003;
    return (tokens / 1000) * costPer1kTokens;
  }

  // Get analysis status
  getStatus(): {
    configured: boolean;
    model: string;
    totalTokensUsed: number;
    estimatedCost: number;
    rateLimiter: { queued: number; running: number; callsInLastMinute: number };
  } {
    return {
      configured: this.isConfigured,
      model: this.model,
      totalTokensUsed: this.totalTokensUsed,
      estimatedCost: this.estimateCost(this.totalTokensUsed),
      rateLimiter: analysisRateLimiter.getQueueStatus(),
    };
  }

  resetUsageStats(): void {
    this.totalTokensUsed = 0;
  }
}