/**
 * IntelligenceEngine Service
 * Central orchestrator with learning capabilities and adaptive strategies
 */

import { CompanyDeduplicator } from './companyDeduplicator';
import { SmartQueueManager } from './smartQueueManager';
import { AdaptiveScraper } from './adaptiveScraper';
import { CostOptimizedAnalyzer } from './costOptimizedAnalyzer';
import { createServerSupabaseClient } from '../supabase';
import { EventEmitter } from 'events';

export interface IntelligenceMetrics {
  totalCompaniesFound: number;
  toolsDetected: {
    outreach: number;
    salesloft: number;
    both: number;
  };
  confidenceDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  platformPerformance: {
    indeed: { success: number; failure: number; avgYield: number };
    linkedin: { success: number; failure: number; avgYield: number };
  };
  costEfficiency: number; // Cost per valuable company found
  learningProgress: number; // 0-100 score
}

export interface ProcessingPipeline {
  scrapeJobs: number;
  deduplicated: number;
  analyzed: number;
  highValueFound: number;
  totalCost: number;
  processingTime: number;
}

export interface LearningInsight {
  type: 'pattern' | 'trend' | 'anomaly' | 'optimization';
  category: string;
  description: string;
  confidence: number;
  actionable: boolean;
  suggestedAction?: string;
}

export class IntelligenceEngine extends EventEmitter {
  private deduplicator: CompanyDeduplicator;
  private queueManager: SmartQueueManager;
  private scraper: AdaptiveScraper;
  private analyzer: CostOptimizedAnalyzer;
  private supabase;
  
  // Learning and pattern recognition
  private patterns: Map<string, any> = new Map();
  private insights: LearningInsight[] = [];
  private metrics: IntelligenceMetrics = {
    totalCompaniesFound: 0,
    toolsDetected: { outreach: 0, salesloft: 0, both: 0 },
    confidenceDistribution: { high: 0, medium: 0, low: 0 },
    platformPerformance: {
      indeed: { success: 0, failure: 0, avgYield: 0 },
      linkedin: { success: 0, failure: 0, avgYield: 0 }
    },
    costEfficiency: 0,
    learningProgress: 0
  };

  // Adaptive thresholds
  private thresholds = {
    confidenceThreshold: 0.7,
    yieldThreshold: 0.3,
    costThreshold: 0.05, // $0.05 per valuable company
    recheckThreshold: 30 // days
  };

  // Processing state
  private isProcessing: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.deduplicator = new CompanyDeduplicator();
    this.queueManager = new SmartQueueManager();
    this.scraper = new AdaptiveScraper();
    this.analyzer = new CostOptimizedAnalyzer();
    this.supabase = createServerSupabaseClient();
    
    this.initializeEventHandlers();
    this.loadHistoricalData();
  }

  /**
   * Initialize event handlers for all components
   */
  private initializeEventHandlers(): void {
    // Queue events
    this.queueManager.on('jobCompleted', (job) => {
      this.handleJobCompletion(job);
    });

    this.queueManager.on('jobFailed', (job, error) => {
      this.handleJobFailure(job, error);
    });

    // Scraper events
    this.scraper.on('scrapeCompleted', (result) => {
      this.updatePlatformMetrics(result.platform, true, result.jobs.length);
    });

    this.scraper.on('scrapeFailed', (platform, error) => {
      this.updatePlatformMetrics(platform, false, 0);
    });
  }

  /**
   * Load historical data for learning
   */
  private async loadHistoricalData(): Promise<void> {
    try {
      // Load company statistics
      const { data: companies } = await this.supabase
        .from('companies')
        .select('uses_outreach, uses_salesloft, detection_confidence, signal_strength');

      if (companies) {
        companies.forEach(company => {
          if (company.uses_outreach && company.uses_salesloft) {
            this.metrics.toolsDetected.both++;
          } else if (company.uses_outreach) {
            this.metrics.toolsDetected.outreach++;
          } else if (company.uses_salesloft) {
            this.metrics.toolsDetected.salesloft++;
          }

          this.metrics.confidenceDistribution[company.detection_confidence]++;
        });
        
        this.metrics.totalCompaniesFound = companies.length;
      }

      // Load scraping intelligence
      const { data: intelligence } = await this.supabase
        .from('scraping_intelligence')
        .select('*');

      if (intelligence) {
        this.analyzeHistoricalPatterns(intelligence);
      }

      console.log('📊 Historical data loaded:', this.metrics);
    } catch (error) {
      console.error('Failed to load historical data:', error);
    }
  }

  /**
   * Analyze historical patterns for insights
   */
  private analyzeHistoricalPatterns(data: any[]): void {
    // Analyze yield patterns
    const highYieldTerms = data
      .filter(d => d.yield_rate > 0.5)
      .map(d => d.search_term);

    if (highYieldTerms.length > 0) {
      this.insights.push({
        type: 'pattern',
        category: 'search_optimization',
        description: `High-yield search terms identified: ${highYieldTerms.join(', ')}`,
        confidence: 0.8,
        actionable: true,
        suggestedAction: 'Increase scraping frequency for these terms'
      });
    }

    // Analyze cost patterns
    const avgCostPerCompany = data.reduce((sum, d) => sum + (d.cost_per_company || 0), 0) / data.length;
    
    if (avgCostPerCompany > this.thresholds.costThreshold) {
      this.insights.push({
        type: 'optimization',
        category: 'cost_reduction',
        description: `Average cost per company ($${avgCostPerCompany.toFixed(3)}) exceeds threshold`,
        confidence: 0.9,
        actionable: true,
        suggestedAction: 'Implement more aggressive pre-filtering'
      });
    }

    // Platform performance patterns
    const platformStats = {
      indeed: data.filter(d => d.indeed_avg_results > 0),
      linkedin: data.filter(d => d.linkedin_avg_results > 0)
    };

    if (platformStats.indeed.length > platformStats.linkedin.length * 2) {
      this.insights.push({
        type: 'trend',
        category: 'platform_usage',
        description: 'Indeed showing better performance than LinkedIn',
        confidence: 0.7,
        actionable: true,
        suggestedAction: 'Prioritize Indeed for scraping'
      });
    }
  }

  /**
   * Main orchestration method
   */
  async orchestrate(searchTerm: string, options: {
    maxJobs?: number;
    platforms?: ('indeed' | 'linkedin')[];
    forceRefresh?: boolean;
  } = {}): Promise<ProcessingPipeline> {
    const startTime = Date.now();
    const pipeline: ProcessingPipeline = {
      scrapeJobs: 0,
      deduplicated: 0,
      analyzed: 0,
      highValueFound: 0,
      totalCost: 0,
      processingTime: 0
    };

    try {
      this.emit('pipelineStarted', { searchTerm, options });

      // Step 1: Check if scraping is needed
      const shouldScrape = await this.shouldScrape(searchTerm, options.forceRefresh);
      
      if (!shouldScrape) {
        console.log(`⏭️ Skipping scrape for "${searchTerm}" - recently processed`);
        return pipeline;
      }

      // Step 2: Smart scraping with platform selection
      const scrapeResult = await this.scraper.scrapeWithStrategy(searchTerm, {
        maxResults: options.maxJobs || 50,
        platforms: options.platforms
      });

      pipeline.scrapeJobs = scrapeResult.totalJobs;
      console.log(`🔍 Scraped ${pipeline.scrapeJobs} jobs for "${searchTerm}"`);

      // Step 3: Deduplication
      const uniqueCompanies = new Map<string, any>();
      
      for (const job of scrapeResult.jobs) {
        const dedupeResult = await this.deduplicator.deduplicate(job.company);
        
        if (!dedupeResult.isKnown || dedupeResult.shouldRecheck) {
          const normalizedName = this.deduplicator.normalize(job.company);
          
          if (!uniqueCompanies.has(normalizedName)) {
            uniqueCompanies.set(normalizedName, job);
          }
        }
      }

      pipeline.deduplicated = uniqueCompanies.size;
      console.log(`🔄 Deduplicated to ${pipeline.deduplicated} unique companies`);

      // Step 4: Cost-optimized analysis
      if (uniqueCompanies.size > 0) {
        const analysisRequests = Array.from(uniqueCompanies.values()).map(job => ({
          jobId: job.id,
          company: job.company,
          description: job.description,
          platform: job.platform as 'indeed' | 'linkedin'
        }));

        const analysisResults = await this.analyzer.analyzeBatch(analysisRequests);
        pipeline.analyzed = analysisResults.length;

        // Step 5: Process results and update intelligence
        for (const result of analysisResults) {
          // Update metrics
          if (result.toolDetected !== 'none') {
            pipeline.highValueFound++;
            
            if (result.toolDetected === 'both') {
              this.metrics.toolsDetected.both++;
            } else if (result.toolDetected === 'outreach') {
              this.metrics.toolsDetected.outreach++;
            } else if (result.toolDetected === 'salesloft') {
              this.metrics.toolsDetected.salesloft++;
            }
          }

          this.metrics.confidenceDistribution[result.confidence]++;
          pipeline.totalCost += result.cost;

          // Save to database
          await this.saveCompanyResult(result, searchTerm);
        }

        // Step 6: Update search term intelligence
        await this.updateSearchIntelligence(searchTerm, {
          jobsFound: pipeline.scrapeJobs,
          companiesAnalyzed: pipeline.analyzed,
          highValueFound: pipeline.highValueFound,
          cost: pipeline.totalCost
        });
      }

      // Step 7: Generate insights
      this.generateInsights(pipeline, searchTerm);

      // Step 8: Adaptive learning
      await this.adaptThresholds(pipeline);

      pipeline.processingTime = Date.now() - startTime;
      
      this.emit('pipelineCompleted', pipeline);
      
      console.log(`✅ Pipeline completed: ${pipeline.highValueFound} high-value companies found`);
      
      return pipeline;

    } catch (error) {
      console.error('Orchestration failed:', error);
      this.emit('pipelineError', error);
      throw error;
    }
  }

  /**
   * Determine if scraping is needed
   */
  private async shouldScrape(searchTerm: string, forceRefresh?: boolean): Promise<boolean> {
    if (forceRefresh) return true;

    const { data: intelligence } = await this.supabase
      .from('scraping_intelligence')
      .select('last_scraped, scrape_interval, yield_rate')
      .eq('search_term', searchTerm)
      .single();

    if (!intelligence || !intelligence.last_scraped) return true;

    const lastScraped = new Date(intelligence.last_scraped);
    const intervalMs = this.parseInterval(intelligence.scrape_interval);
    const nextDue = new Date(lastScraped.getTime() + intervalMs);

    // Adjust based on yield rate
    if (intelligence.yield_rate < 0.1) {
      // Low yield, increase interval
      return Date.now() > nextDue.getTime() * 1.5;
    } else if (intelligence.yield_rate > 0.5) {
      // High yield, decrease interval
      return Date.now() > nextDue.getTime() * 0.7;
    }

    return Date.now() > nextDue.getTime();
  }

  /**
   * Save company result to database
   */
  private async saveCompanyResult(result: any, searchTerm: string): Promise<void> {
    const normalized = this.deduplicator.normalize(result.company);
    
    await this.supabase
      .from('companies')
      .upsert({
        name: result.company,
        normalized_name: normalized,
        uses_outreach: result.toolDetected === 'outreach' || result.toolDetected === 'both',
        uses_salesloft: result.toolDetected === 'salesloft' || result.toolDetected === 'both',
        detection_confidence: result.confidence,
        detection_keywords: result.keywords,
        detection_context: result.signals.join(', '),
        signal_strength: this.calculateSignalStrength(result),
        last_verified: new Date().toISOString()
      }, {
        onConflict: 'normalized_name'
      });

    // Log to audit
    await this.logAudit('company_analyzed', {
      company: result.company,
      tool_detected: result.toolDetected,
      confidence: result.confidence,
      search_term: searchTerm
    });
  }

  /**
   * Update search term intelligence
   */
  private async updateSearchIntelligence(
    searchTerm: string,
    stats: {
      jobsFound: number;
      companiesAnalyzed: number;
      highValueFound: number;
      cost: number;
    }
  ): Promise<void> {
    const { data: current } = await this.supabase
      .from('scraping_intelligence')
      .select('*')
      .eq('search_term', searchTerm)
      .single();

    const yieldRate = stats.companiesAnalyzed > 0 
      ? stats.highValueFound / stats.companiesAnalyzed 
      : 0;

    if (current) {
      // Update existing
      await this.supabase
        .from('scraping_intelligence')
        .update({
          total_scrapes: current.total_scrapes + 1,
          total_jobs_found: current.total_jobs_found + stats.jobsFound,
          new_companies_found: current.new_companies_found + stats.highValueFound,
          yield_rate: (current.yield_rate * current.total_scrapes + yieldRate) / (current.total_scrapes + 1),
          total_cost: current.total_cost + stats.cost,
          cost_per_company: stats.highValueFound > 0 
            ? (current.total_cost + stats.cost) / (current.new_companies_found + stats.highValueFound)
            : current.cost_per_company,
          last_scraped: new Date().toISOString(),
          // Adjust interval based on yield
          scrape_interval: this.calculateOptimalInterval(yieldRate)
        })
        .eq('search_term', searchTerm);
    } else {
      // Insert new
      await this.supabase
        .from('scraping_intelligence')
        .insert({
          search_term: searchTerm,
          total_scrapes: 1,
          total_jobs_found: stats.jobsFound,
          new_companies_found: stats.highValueFound,
          yield_rate: yieldRate,
          total_cost: stats.cost,
          cost_per_company: stats.highValueFound > 0 ? stats.cost / stats.highValueFound : 0,
          last_scraped: new Date().toISOString(),
          scrape_interval: '24 hours'
        });
    }
  }

  /**
   * Generate insights from pipeline results
   */
  private generateInsights(pipeline: ProcessingPipeline, searchTerm: string): void {
    // Yield insight
    const yieldRate = pipeline.analyzed > 0 
      ? pipeline.highValueFound / pipeline.analyzed 
      : 0;

    if (yieldRate > 0.5) {
      this.insights.push({
        type: 'pattern',
        category: 'high_yield',
        description: `"${searchTerm}" showing exceptional yield rate (${(yieldRate * 100).toFixed(1)}%)`,
        confidence: 0.9,
        actionable: true,
        suggestedAction: `Increase scraping frequency for "${searchTerm}"`
      });
    } else if (yieldRate < 0.1) {
      this.insights.push({
        type: 'anomaly',
        category: 'low_yield',
        description: `"${searchTerm}" showing poor yield rate (${(yieldRate * 100).toFixed(1)}%)`,
        confidence: 0.8,
        actionable: true,
        suggestedAction: `Reduce scraping frequency or refine search term`
      });
    }

    // Cost insight
    const costPerValue = pipeline.highValueFound > 0 
      ? pipeline.totalCost / pipeline.highValueFound 
      : pipeline.totalCost;

    if (costPerValue > this.thresholds.costThreshold * 2) {
      this.insights.push({
        type: 'anomaly',
        category: 'high_cost',
        description: `Cost per valuable company ($${costPerValue.toFixed(3)}) is too high`,
        confidence: 0.9,
        actionable: true,
        suggestedAction: 'Review and optimize analysis criteria'
      });
    }

    // Deduplication insight
    const dedupeRate = pipeline.scrapeJobs > 0 
      ? 1 - (pipeline.deduplicated / pipeline.scrapeJobs)
      : 0;

    if (dedupeRate > 0.7) {
      this.insights.push({
        type: 'optimization',
        category: 'deduplication',
        description: `High duplicate rate (${(dedupeRate * 100).toFixed(1)}%) detected`,
        confidence: 0.8,
        actionable: true,
        suggestedAction: 'Consider implementing pre-scrape filtering'
      });
    }
  }

  /**
   * Adapt thresholds based on performance
   */
  private async adaptThresholds(pipeline: ProcessingPipeline): Promise<void> {
    // Calculate current efficiency
    const efficiency = pipeline.analyzed > 0 
      ? pipeline.highValueFound / pipeline.analyzed 
      : 0;
    
    const costEfficiency = pipeline.highValueFound > 0 
      ? pipeline.totalCost / pipeline.highValueFound 
      : Infinity;

    // Update cost threshold (moving average)
    this.thresholds.costThreshold = 
      (this.thresholds.costThreshold * 0.8) + (costEfficiency * 0.2);

    // Update confidence threshold based on results
    if (efficiency < 0.2) {
      // Low efficiency, be more selective
      this.thresholds.confidenceThreshold = Math.min(0.9, this.thresholds.confidenceThreshold + 0.05);
    } else if (efficiency > 0.5) {
      // High efficiency, can be less selective
      this.thresholds.confidenceThreshold = Math.max(0.5, this.thresholds.confidenceThreshold - 0.05);
    }

    // Calculate learning progress
    const totalProcessed = this.metrics.totalCompaniesFound;
    const confidenceScore = 
      (this.metrics.confidenceDistribution.high * 1.0 +
       this.metrics.confidenceDistribution.medium * 0.5 +
       this.metrics.confidenceDistribution.low * 0.2) / 
      Math.max(1, Object.values(this.metrics.confidenceDistribution).reduce((a, b) => a + b, 0));

    this.metrics.learningProgress = Math.min(100, 
      (Math.log10(totalProcessed + 1) * 10) + (confidenceScore * 50)
    );

    this.metrics.costEfficiency = this.thresholds.costThreshold;
  }

  /**
   * Start continuous processing
   */
  startContinuousProcessing(intervalMinutes: number = 30): void {
    if (this.isProcessing) {
      console.log('⚠️ Continuous processing already running');
      return;
    }

    this.isProcessing = true;
    
    const process = async () => {
      try {
        // Get next priority search term
        const { data: nextTerm } = await this.supabase
          .from('scraping_intelligence')
          .select('search_term')
          .eq('is_active', true)
          .order('next_scrape_due', { ascending: true })
          .limit(1)
          .single();

        if (nextTerm) {
          console.log(`🔄 Processing: ${nextTerm.search_term}`);
          await this.orchestrate(nextTerm.search_term);
        }
      } catch (error) {
        console.error('Continuous processing error:', error);
      }
    };

    // Initial run
    process();

    // Set up interval
    this.processingInterval = setInterval(process, intervalMinutes * 60 * 1000);
    
    console.log(`🚀 Continuous processing started (every ${intervalMinutes} minutes)`);
  }

  /**
   * Stop continuous processing
   */
  stopContinuousProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    this.isProcessing = false;
    console.log('⏹️ Continuous processing stopped');
  }

  /**
   * Get current metrics
   */
  getMetrics(): IntelligenceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get recent insights
   */
  getInsights(limit: number = 10): LearningInsight[] {
    return this.insights
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  /**
   * Helper: Calculate signal strength
   */
  private calculateSignalStrength(result: any): number {
    let strength = 0;
    
    // Confidence component
    strength += result.confidence === 'high' ? 0.4 : 
                result.confidence === 'medium' ? 0.2 : 0.1;
    
    // Signals component
    strength += Math.min(result.signals.length * 0.1, 0.3);
    
    // Keywords component
    strength += Math.min(result.keywords.length * 0.05, 0.3);
    
    return Math.min(strength, 1.0);
  }

  /**
   * Helper: Parse interval string
   */
  private parseInterval(interval: string): number {
    const match = interval.match(/(\d+)\s*(hour|day|week)/i);
    if (!match) return 24 * 60 * 60 * 1000; // Default 24 hours

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 'hour': return value * 60 * 60 * 1000;
      case 'day': return value * 24 * 60 * 60 * 1000;
      case 'week': return value * 7 * 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000;
    }
  }

  /**
   * Helper: Calculate optimal scraping interval
   */
  private calculateOptimalInterval(yieldRate: number): string {
    if (yieldRate > 0.5) return '12 hours';
    if (yieldRate > 0.3) return '24 hours';
    if (yieldRate > 0.1) return '3 days';
    if (yieldRate > 0.05) return '7 days';
    return '14 days';
  }

  /**
   * Helper: Update platform metrics
   */
  private updatePlatformMetrics(platform: string, success: boolean, jobsFound: number): void {
    const metrics = this.metrics.platformPerformance[platform as 'indeed' | 'linkedin'];
    
    if (success) {
      metrics.success++;
      metrics.avgYield = (metrics.avgYield * (metrics.success - 1) + jobsFound) / metrics.success;
    } else {
      metrics.failure++;
    }
  }

  /**
   * Helper: Log audit event
   */
  private async logAudit(eventType: string, data: any): Promise<void> {
    try {
      await this.supabase
        .from('audit_log')
        .insert({
          event_type: eventType,
          event_category: 'intelligence',
          severity: 'info',
          event_data: data
        });
    } catch (error) {
      console.error('Failed to log audit:', error);
    }
  }

  /**
   * Handle job completion
   */
  private async handleJobCompletion(job: any): Promise<void> {
    console.log(`✅ Job completed: ${job.id}`);
    this.emit('jobProcessed', job);
  }

  /**
   * Handle job failure
   */
  private async handleJobFailure(job: any, error: Error): Promise<void> {
    console.error(`❌ Job failed: ${job.id}`, error);
    
    await this.logAudit('job_failed', {
      job_id: job.id,
      error: error.message,
      retry_count: job.retryCount
    });
    
    this.emit('jobFailed', job, error);
  }
}