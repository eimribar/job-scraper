/**
 * CostOptimizedAnalyzer Service
 * Intelligent cost reduction through pre-filtering, caching, and batch optimization
 * IMPORTANT: ONLY uses gpt-5-mini model - NEVER gpt-4 or any other model
 */

import OpenAI from 'openai';
import crypto from 'crypto';
import { createServerSupabaseClient } from '../supabase';

// CRITICAL: ONLY USE GPT-5-MINI MODEL - NEVER GPT-4
const OPENAI_MODEL = 'gpt-5-mini-2025-08-07'; // HARDCODED - DO NOT CHANGE

export interface AnalysisRequest {
  jobId: string;
  company: string;
  description: string;
  platform: 'indeed' | 'linkedin';
  metadata?: Record<string, any>;
}

export interface AnalysisResult {
  jobId: string;
  company: string;
  toolDetected: 'outreach' | 'salesloft' | 'both' | 'none';
  confidence: 'high' | 'medium' | 'low';
  signals: string[];
  keywords: string[];
  cost: number;
  cached: boolean;
  processingTime: number;
}

export interface CostMetrics {
  totalCost: number;
  apiCalls: number;
  tokenUsage: number;
  cacheHits: number;
  cacheMisses: number;
  avgCostPerAnalysis: number;
  savingsFromCache: number;
  savingsFromPreFilter: number;
}

export class CostOptimizedAnalyzer {
  private openai: OpenAI;
  private supabase;
  private cache: Map<string, AnalysisResult> = new Map();
  private costMetrics: CostMetrics = {
    totalCost: 0,
    apiCalls: 0,
    tokenUsage: 0,
    cacheHits: 0,
    cacheMisses: 0,
    avgCostPerAnalysis: 0,
    savingsFromCache: 0,
    savingsFromPreFilter: 0
  };
  
  // Pre-filter patterns
  private readonly toolPatterns = {
    outreach: [
      /outreach\.io/i,
      /outreach platform/i,
      /sales engagement.*outreach/i,
      /using outreach/i,
      /outreach sequences/i,
      /outreach cadence/i,
      /outreach experience/i,
      /outreach certified/i,
      /outreach admin/i,
      /outreach prospecting/i
    ],
    salesloft: [
      /salesloft/i,
      /sales loft/i,
      /salesloft platform/i,
      /salesloft cadence/i,
      /salesloft experience/i,
      /using salesloft/i,
      /salesloft sequences/i,
      /salesloft campaigns/i,
      /salesloft admin/i,
      /salesloft certified/i
    ],
    generic: [
      /sales engagement platform/i,
      /sales automation tool/i,
      /sales cadence/i,
      /email sequences/i,
      /sales enablement/i,
      /automated outreach/i,
      /multi-channel engagement/i,
      /sales acceleration/i
    ]
  };

  // Negative patterns (reduce confidence)
  private readonly negativePatterns = [
    /preferred but not required/i,
    /nice to have/i,
    /bonus if/i,
    /willing to train/i,
    /no experience necessary/i,
    /or similar/i,
    /equivalent tool/i,
    /any.*sales.*tool/i
  ];

  // Budget management
  private readonly dailyBudget: number = 10.00; // $10/day
  private dailySpend: number = 0;
  private lastBudgetReset: Date = new Date();

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.warn('⚠️ OpenAI API key not configured - analysis will be simulated');
      this.openai = null as any;
    } else {
      this.openai = new OpenAI({ apiKey });
    }
    
    this.supabase = createServerSupabaseClient();
    this.loadCacheFromDatabase();
  }

  /**
   * Load analysis cache from database
   */
  private async loadCacheFromDatabase(): Promise<void> {
    try {
      const { data: cachedAnalyses } = await this.supabase
        .from('analysis_cache')
        .select('*')
        .gt('expires_at', new Date().toISOString())
        .limit(1000);

      if (cachedAnalyses) {
        cachedAnalyses.forEach(item => {
          const cacheKey = this.generateCacheKey(item.company_normalized, item.description_hash);
          this.cache.set(cacheKey, item.analysis_result as AnalysisResult);
        });
        
        console.log(`📦 Loaded ${cachedAnalyses.length} cached analyses`);
      }
    } catch (error) {
      console.error('Failed to load cache:', error);
    }
  }

  /**
   * Generate cache key for analysis
   */
  private generateCacheKey(company: string, description: string): string {
    const normalized = company.toLowerCase().trim();
    const descHash = crypto.createHash('md5').update(description).digest('hex');
    return `${normalized}:${descHash}`;
  }

  /**
   * Pre-filter to detect obvious tool mentions
   */
  private preFilter(description: string): {
    toolDetected: 'outreach' | 'salesloft' | 'both' | 'none';
    confidence: number;
    signals: string[];
  } {
    const signals: string[] = [];
    let outreachScore = 0;
    let salesloftScore = 0;
    let genericScore = 0;
    let negativeScore = 0;

    // Check for direct tool mentions
    this.toolPatterns.outreach.forEach(pattern => {
      if (pattern.test(description)) {
        outreachScore += 10;
        const match = description.match(pattern);
        if (match) signals.push(match[0]);
      }
    });

    this.toolPatterns.salesloft.forEach(pattern => {
      if (pattern.test(description)) {
        salesloftScore += 10;
        const match = description.match(pattern);
        if (match) signals.push(match[0]);
      }
    });

    // Check for generic patterns
    this.toolPatterns.generic.forEach(pattern => {
      if (pattern.test(description)) {
        genericScore += 3;
        const match = description.match(pattern);
        if (match) signals.push(match[0]);
      }
    });

    // Check negative patterns
    this.negativePatterns.forEach(pattern => {
      if (pattern.test(description)) {
        negativeScore += 5;
      }
    });

    // Calculate confidence
    const totalScore = outreachScore + salesloftScore + genericScore;
    const confidence = Math.max(0, totalScore - negativeScore) / 100;

    // Determine tool detected
    let toolDetected: 'outreach' | 'salesloft' | 'both' | 'none' = 'none';
    
    if (outreachScore >= 10 && salesloftScore >= 10) {
      toolDetected = 'both';
    } else if (outreachScore >= 10) {
      toolDetected = 'outreach';
    } else if (salesloftScore >= 10) {
      toolDetected = 'salesloft';
    }

    return {
      toolDetected,
      confidence: Math.min(confidence, 1),
      signals
    };
  }

  /**
   * Batch analysis for multiple jobs
   */
  async analyzeBatch(requests: AnalysisRequest[]): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];
    const uncachedRequests: AnalysisRequest[] = [];

    // Step 1: Check cache and pre-filter
    for (const request of requests) {
      const cacheKey = this.generateCacheKey(request.company, request.description);
      
      // Check cache
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey)!;
        results.push({
          ...cached,
          jobId: request.jobId,
          cached: true
        });
        this.costMetrics.cacheHits++;
        this.costMetrics.savingsFromCache += 0.002; // Approximate savings
        continue;
      }

      // Pre-filter for obvious cases
      const preFilterResult = this.preFilter(request.description);
      
      if (preFilterResult.confidence >= 0.9) {
        // High confidence from pre-filter, skip AI
        const result: AnalysisResult = {
          jobId: request.jobId,
          company: request.company,
          toolDetected: preFilterResult.toolDetected,
          confidence: 'high',
          signals: preFilterResult.signals,
          keywords: this.extractKeywords(request.description),
          cost: 0,
          cached: false,
          processingTime: 10
        };
        
        results.push(result);
        this.cache.set(cacheKey, result);
        this.costMetrics.savingsFromPreFilter += 0.002;
        
        // Save to database cache
        await this.saveToCacheDatabase(request.company, request.description, result);
      } else {
        uncachedRequests.push(request);
      }
    }

    // Step 2: Batch process uncached requests with AI
    if (uncachedRequests.length > 0 && this.openai) {
      const batchResults = await this.processBatchWithAI(uncachedRequests);
      results.push(...batchResults);
    } else if (uncachedRequests.length > 0) {
      // Fallback when OpenAI not configured
      for (const request of uncachedRequests) {
        results.push(await this.analyzeSingle(request));
      }
    }

    // Update metrics
    this.costMetrics.avgCostPerAnalysis = 
      this.costMetrics.totalCost / Math.max(1, this.costMetrics.apiCalls);

    return results;
  }

  /**
   * Process batch with OpenAI (optimized for cost)
   */
  private async processBatchWithAI(requests: AnalysisRequest[]): Promise<AnalysisResult[]> {
    // Check daily budget
    if (!this.checkBudget(requests.length * 0.002)) {
      console.warn('⚠️ Daily budget exceeded, using pre-filter only');
      return requests.map(req => this.fallbackAnalysis(req));
    }

    const startTime = Date.now();
    const results: AnalysisResult[] = [];

    try {
      // Batch prompts to minimize API calls (up to 10 at once)
      const batches = this.chunkArray(requests, 10);
      
      for (const batch of batches) {
        const batchPrompt = this.createBatchPrompt(batch);
        
        // CRITICAL: ONLY USE GPT-5-MINI MODEL
        const completion = await this.openai.chat.completions.create({
          model: OPENAI_MODEL, // HARDCODED gpt-5-mini - NEVER CHANGE
          messages: [
            {
              role: 'system',
              content: 'You are a sales tool detector. Analyze job descriptions to identify if companies use Outreach.io or SalesLoft. Return JSON only.'
            },
            {
              role: 'user',
              content: batchPrompt
            }
          ],
          temperature: 0.1,
          max_tokens: 500,
          response_format: { type: 'json_object' }
        });

        const response = completion.choices[0]?.message?.content;
        if (response) {
          const parsed = JSON.parse(response);
          const batchResults = parsed.analyses || [];
          
          for (let i = 0; i < batch.length; i++) {
            const request = batch[i];
            const analysis = batchResults[i] || {};
            
            const result: AnalysisResult = {
              jobId: request.jobId,
              company: request.company,
              toolDetected: analysis.tool || 'none',
              confidence: analysis.confidence || 'low',
              signals: analysis.signals || [],
              keywords: analysis.keywords || [],
              cost: 0.002 / batch.length, // Distribute cost
              cached: false,
              processingTime: Date.now() - startTime
            };
            
            results.push(result);
            
            // Cache the result
            const cacheKey = this.generateCacheKey(request.company, request.description);
            this.cache.set(cacheKey, result);
            
            // Save to database
            await this.saveToCacheDatabase(request.company, request.description, result);
          }
        }

        // Update metrics
        this.costMetrics.apiCalls++;
        this.costMetrics.tokenUsage += completion.usage?.total_tokens || 0;
        this.costMetrics.totalCost += 0.002; // Approximate cost per batch
        this.dailySpend += 0.002;
      }
    } catch (error) {
      console.error('Batch AI processing failed:', error);
      
      // Fallback to pre-filter
      for (const request of requests) {
        results.push(this.fallbackAnalysis(request));
      }
    }

    return results;
  }

  /**
   * Single analysis (fallback)
   */
  async analyzeSingle(request: AnalysisRequest): Promise<AnalysisResult> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(request.company, request.description);

    // Check cache
    if (this.cache.has(cacheKey)) {
      this.costMetrics.cacheHits++;
      return {
        ...this.cache.get(cacheKey)!,
        jobId: request.jobId,
        cached: true
      };
    }

    // Pre-filter
    const preFilterResult = this.preFilter(request.description);
    
    // If high confidence or no OpenAI, use pre-filter
    if (preFilterResult.confidence >= 0.7 || !this.openai || !this.checkBudget(0.002)) {
      const result: AnalysisResult = {
        jobId: request.jobId,
        company: request.company,
        toolDetected: preFilterResult.toolDetected,
        confidence: preFilterResult.confidence >= 0.7 ? 'high' : 
                    preFilterResult.confidence >= 0.4 ? 'medium' : 'low',
        signals: preFilterResult.signals,
        keywords: this.extractKeywords(request.description),
        cost: 0,
        cached: false,
        processingTime: Date.now() - startTime
      };
      
      this.cache.set(cacheKey, result);
      return result;
    }

    // Use AI for complex cases
    try {
      const completion = await this.openai.chat.completions.create({
        model: OPENAI_MODEL, // HARDCODED gpt-5-mini - NEVER CHANGE
        messages: [
          {
            role: 'system',
            content: 'Analyze if this company uses Outreach.io or SalesLoft based on the job description. Return JSON with: tool (outreach/salesloft/both/none), confidence (high/medium/low), signals (array), keywords (array).'
          },
          {
            role: 'user',
            content: `Company: ${request.company}\nDescription: ${request.description.substring(0, 1000)}`
          }
        ],
        temperature: 0.1,
        max_tokens: 200,
        response_format: { type: 'json_object' }
      });

      const response = JSON.parse(completion.choices[0]?.message?.content || '{}');
      
      const result: AnalysisResult = {
        jobId: request.jobId,
        company: request.company,
        toolDetected: response.tool || 'none',
        confidence: response.confidence || 'low',
        signals: response.signals || [],
        keywords: response.keywords || [],
        cost: 0.002,
        cached: false,
        processingTime: Date.now() - startTime
      };

      // Update metrics
      this.costMetrics.apiCalls++;
      this.costMetrics.tokenUsage += completion.usage?.total_tokens || 0;
      this.costMetrics.totalCost += 0.002;
      this.dailySpend += 0.002;
      
      // Cache result
      this.cache.set(cacheKey, result);
      await this.saveToCacheDatabase(request.company, request.description, result);
      
      return result;
    } catch (error) {
      console.error('AI analysis failed:', error);
      return this.fallbackAnalysis(request);
    }
  }

  /**
   * Fallback analysis using pre-filter only
   */
  private fallbackAnalysis(request: AnalysisRequest): AnalysisResult {
    const preFilterResult = this.preFilter(request.description);
    
    return {
      jobId: request.jobId,
      company: request.company,
      toolDetected: preFilterResult.toolDetected,
      confidence: preFilterResult.confidence >= 0.5 ? 'medium' : 'low',
      signals: preFilterResult.signals,
      keywords: this.extractKeywords(request.description),
      cost: 0,
      cached: false,
      processingTime: 5
    };
  }

  /**
   * Create batch prompt for multiple analyses
   */
  private createBatchPrompt(requests: AnalysisRequest[]): string {
    const analyses = requests.map((req, idx) => ({
      id: idx,
      company: req.company,
      description: req.description.substring(0, 500) // Limit length
    }));

    return `Analyze these ${requests.length} job descriptions for Outreach.io or SalesLoft usage.
Return JSON with "analyses" array containing for each:
- tool: "outreach", "salesloft", "both", or "none"
- confidence: "high", "medium", or "low"
- signals: array of detected signals
- keywords: array of relevant keywords

Jobs:
${JSON.stringify(analyses, null, 2)}`;
  }

  /**
   * Extract keywords from description
   */
  private extractKeywords(description: string): string[] {
    const keywords: Set<string> = new Set();
    
    // Tool-specific keywords
    const toolKeywords = [
      'outreach', 'salesloft', 'sales engagement', 'cadence', 
      'sequences', 'automation', 'crm', 'salesforce', 'hubspot'
    ];
    
    toolKeywords.forEach(keyword => {
      if (description.toLowerCase().includes(keyword)) {
        keywords.add(keyword);
      }
    });

    // Skills keywords
    const skillsPattern = /(experience with|proficient in|knowledge of|familiar with|using)\s+([^,.]+)/gi;
    let match;
    
    while ((match = skillsPattern.exec(description)) !== null) {
      const skill = match[2].trim().toLowerCase();
      if (skill.length > 3 && skill.length < 30) {
        keywords.add(skill);
      }
    }

    return Array.from(keywords).slice(0, 10);
  }

  /**
   * Save analysis to database cache
   */
  private async saveToCacheDatabase(
    company: string,
    description: string,
    result: AnalysisResult
  ): Promise<void> {
    try {
      const descHash = crypto.createHash('md5').update(description).digest('hex');
      
      await this.supabase
        .from('analysis_cache')
        .upsert({
          company_normalized: company.toLowerCase().trim(),
          description_hash: descHash,
          analysis_result: result,
          confidence: result.confidence,
          tool_detected: result.toolDetected,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        }, {
          onConflict: 'company_normalized,description_hash'
        });
    } catch (error) {
      console.error('Failed to save to cache database:', error);
    }
  }

  /**
   * Check if within budget
   */
  private checkBudget(cost: number): boolean {
    // Reset daily budget if needed
    const now = new Date();
    if (now.getDate() !== this.lastBudgetReset.getDate()) {
      this.dailySpend = 0;
      this.lastBudgetReset = now;
    }

    return (this.dailySpend + cost) <= this.dailyBudget;
  }

  /**
   * Get cost metrics
   */
  getMetrics(): CostMetrics {
    return {
      ...this.costMetrics,
      cacheSize: this.cache.size,
      dailySpend: this.dailySpend,
      budgetRemaining: this.dailyBudget - this.dailySpend
    } as any;
  }

  /**
   * Clear expired cache entries
   */
  async cleanupCache(): Promise<void> {
    // Clean memory cache
    const now = Date.now();
    const expired: string[] = [];
    
    for (const [key, value] of this.cache.entries()) {
      if (now - value.processingTime > 7 * 24 * 60 * 60 * 1000) {
        expired.push(key);
      }
    }
    
    expired.forEach(key => this.cache.delete(key));

    // Clean database cache
    await this.supabase
      .from('analysis_cache')
      .delete()
      .lt('expires_at', new Date().toISOString());

    console.log(`🧹 Cleaned up ${expired.length} expired cache entries`);
  }

  /**
   * Chunk array helper
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}