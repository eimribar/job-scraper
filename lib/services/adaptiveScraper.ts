/**
 * AdaptiveScraper Service
 * Intelligent scraping with platform rotation, yield-based scheduling, and health tracking
 */

import ApifyClient from 'apify-client';
import { BaseService, ServiceError } from './baseService';
import { scraperRateLimiter } from './rateLimiter';
import { createServerSupabaseClient } from '../supabase';
import { CompanyDeduplicator } from './companyDeduplicator';

export interface ScrapedJob {
  job_id: string;
  platform: string;
  company: string;
  job_title: string;
  location: string;
  description: string;
  job_url: string;
  scraped_date: string;
  search_term: string;
}

export interface ScrapingResult {
  searchTerm: string;
  jobs: ScrapedJob[];
  newJobs: ScrapedJob[];
  duplicates: number;
  knownCompanies: number;
  errors: string[];
  platformResults: {
    indeed: { success: boolean; count: number; error?: string };
    linkedin: { success: boolean; count: number; error?: string };
  };
  stats: {
    totalAttempted: number;
    successfullyScraped: number;
    newCompaniesFound: number;
    failed: number;
    duration: number;
    yieldRate: number;
  };
}

interface PlatformHealth {
  platform: string;
  isHealthy: boolean;
  successRate: number;
  lastError?: Date;
  lastSuccess?: Date;
  cooldownUntil?: Date;
  consecutiveFailures: number;
}

interface SearchTermStrategy {
  searchTerm: string;
  priority: number;
  lastScraped?: Date;
  nextScrapeDue: Date;
  scrapeInterval: number; // minutes
  yieldRate: number;
  totalScrapes: number;
  successRate: number;
  avgJobsFound: number;
  platforms: {
    indeed: boolean;
    linkedin: boolean;
  };
}

export class AdaptiveScraper extends BaseService {
  private apifyClient: ApifyClient | null = null;
  private supabase;
  private deduplicator: CompanyDeduplicator;
  private platformHealth: Map<string, PlatformHealth> = new Map();
  private searchTermStrategies: Map<string, SearchTermStrategy> = new Map();
  private processedJobIds: Set<string> = new Set();
  private knownCompanies: Set<string> = new Set();
  
  // Configuration
  private readonly MIN_SCRAPE_INTERVAL = 60; // 1 hour in minutes
  private readonly MAX_SCRAPE_INTERVAL = 10080; // 7 days in minutes
  private readonly PLATFORM_COOLDOWN = 30 * 60 * 1000; // 30 minutes in ms
  private readonly MAX_CONSECUTIVE_FAILURES = 3;
  private readonly MIN_SUCCESS_RATE = 0.3;
  private readonly HIGH_YIELD_THRESHOLD = 0.3;
  private readonly LOW_YIELD_THRESHOLD = 0.1;

  constructor() {
    super();
    this.supabase = createServerSupabaseClient();
    this.deduplicator = new CompanyDeduplicator();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      this.validateConfig(['APIFY_TOKEN']);
      
      this.apifyClient = new ApifyClient({
        token: process.env.APIFY_TOKEN!,
      });

      // Initialize platform health
      this.platformHealth.set('indeed', {
        platform: 'indeed',
        isHealthy: true,
        successRate: 1.0,
        consecutiveFailures: 0
      });
      
      this.platformHealth.set('linkedin', {
        platform: 'linkedin',
        isHealthy: true,
        successRate: 1.0,
        consecutiveFailures: 0
      });

      // Load search term strategies from database
      await this.loadSearchTermStrategies();
      
      // Load blacklists
      await this.loadBlacklists();
      
    } catch (error) {
      console.warn('AdaptiveScraper initialization warning:', error);
    }
  }

  /**
   * Load search term strategies from database
   */
  private async loadSearchTermStrategies(): Promise<void> {
    try {
      const { data: strategies } = await this.supabase
        .from('scraping_intelligence')
        .select('*')
        .eq('is_active', true);

      if (strategies) {
        strategies.forEach(strategy => {
          this.searchTermStrategies.set(strategy.search_term, {
            searchTerm: strategy.search_term,
            priority: strategy.priority,
            lastScraped: strategy.last_scraped ? new Date(strategy.last_scraped) : undefined,
            nextScrapeDue: new Date(strategy.next_scrape_due || Date.now()),
            scrapeInterval: this.parseInterval(strategy.scrape_interval),
            yieldRate: strategy.yield_rate || 0,
            totalScrapes: strategy.total_scrapes || 0,
            successRate: strategy.success_rate || 1,
            avgJobsFound: strategy.total_jobs_found / Math.max(1, strategy.total_scrapes),
            platforms: {
              indeed: strategy.indeed_success_rate > this.MIN_SUCCESS_RATE,
              linkedin: strategy.linkedin_success_rate > this.MIN_SUCCESS_RATE
            }
          });
        });
      }
    } catch (error) {
      console.error('Failed to load search term strategies:', error);
    }
  }

  /**
   * Load blacklists (processed jobs and known companies)
   */
  private async loadBlacklists(): Promise<void> {
    try {
      // Load processed job IDs (last 90 days)
      const { data: processedIds } = await this.supabase
        .from('processed_ids')
        .select('job_id')
        .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
        .limit(10000);

      if (processedIds) {
        processedIds.forEach(record => this.processedJobIds.add(record.job_id));
      }

      // Load known companies
      const { data: companies } = await this.supabase
        .from('companies')
        .select('normalized_name')
        .or('uses_outreach.eq.true,uses_salesloft.eq.true')
        .limit(1000);

      if (companies) {
        companies.forEach(company => this.knownCompanies.add(company.normalized_name));
      }

      console.log(`Loaded ${this.processedJobIds.size} processed jobs, ${this.knownCompanies.size} known companies`);
    } catch (error) {
      console.error('Failed to load blacklists:', error);
    }
  }

  /**
   * Get next search term to scrape based on strategy
   */
  async getNextSearchTerm(): Promise<SearchTermStrategy | null> {
    const now = new Date();
    let bestCandidate: SearchTermStrategy | null = null;
    let highestScore = -Infinity;

    for (const strategy of this.searchTermStrategies.values()) {
      // Skip if not due yet
      if (strategy.nextScrapeDue > now) continue;

      // Calculate priority score
      const timeSinceLastScrape = strategy.lastScraped 
        ? (now.getTime() - strategy.lastScraped.getTime()) / (1000 * 60) // minutes
        : Infinity;

      const score = this.calculateSearchTermScore(strategy, timeSinceLastScrape);

      if (score > highestScore) {
        highestScore = score;
        bestCandidate = strategy;
      }
    }

    return bestCandidate;
  }

  /**
   * Calculate priority score for a search term
   */
  private calculateSearchTermScore(strategy: SearchTermStrategy, timeSinceLastScrape: number): number {
    let score = strategy.priority; // Base priority (0-100)

    // Time factor: urgency increases over time
    const timeFactor = Math.min(timeSinceLastScrape / strategy.scrapeInterval, 2) * 20;
    score += timeFactor;

    // Yield factor: higher yield = higher priority
    score += strategy.yieldRate * 100;

    // Success rate factor: penalize failing terms
    score *= strategy.successRate;

    // High-value term boost
    const highValueTerms = ['Revenue Operations', 'Sales Development Manager', 'Sales Manager'];
    if (highValueTerms.includes(strategy.searchTerm)) {
      score *= 1.5;
    }

    return score;
  }

  /**
   * Main scraping method with adaptive strategy
   */
  async scrapeWithStrategy(searchTerm: string, options: {
    maxItemsPerPlatform?: number;
    forceAllPlatforms?: boolean;
  } = {}): Promise<ScrapingResult> {
    const startTime = Date.now();
    const maxItems = options.maxItemsPerPlatform || 50;
    
    // Get or create strategy
    let strategy = this.searchTermStrategies.get(searchTerm);
    if (!strategy) {
      strategy = this.createDefaultStrategy(searchTerm);
      this.searchTermStrategies.set(searchTerm, strategy);
    }

    // Determine which platforms to use
    const platforms = this.selectPlatforms(strategy, options.forceAllPlatforms);
    
    // Results tracking
    const result: ScrapingResult = {
      searchTerm,
      jobs: [],
      newJobs: [],
      duplicates: 0,
      knownCompanies: 0,
      errors: [],
      platformResults: {
        indeed: { success: false, count: 0 },
        linkedin: { success: false, count: 0 }
      },
      stats: {
        totalAttempted: platforms.length,
        successfullyScraped: 0,
        newCompaniesFound: 0,
        failed: 0,
        duration: 0,
        yieldRate: 0
      }
    };

    // Scrape each platform with rotation
    for (const platform of platforms) {
      try {
        const platformJobs = await this.scrapePlatform(platform, searchTerm, maxItems);
        
        result.jobs.push(...platformJobs);
        result.platformResults[platform as 'indeed' | 'linkedin'] = {
          success: true,
          count: platformJobs.length
        };
        result.stats.successfullyScraped++;

        // Update platform health
        this.updatePlatformHealth(platform, true);

        // Wait between platforms
        if (platforms.indexOf(platform) < platforms.length - 1) {
          await this.sleep(5000);
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`${platform}: ${errorMsg}`);
        result.platformResults[platform as 'indeed' | 'linkedin'] = {
          success: false,
          count: 0,
          error: errorMsg
        };
        result.stats.failed++;

        // Update platform health
        this.updatePlatformHealth(platform, false, errorMsg);
      }
    }

    // Deduplicate and filter
    const filteredResult = await this.filterAndDeduplicate(result);
    
    // Update strategy based on results
    await this.updateStrategy(searchTerm, filteredResult);
    
    // Calculate final stats
    filteredResult.stats.duration = Date.now() - startTime;
    filteredResult.stats.yieldRate = filteredResult.stats.totalAttempted > 0
      ? filteredResult.stats.newCompaniesFound / filteredResult.stats.totalAttempted
      : 0;

    return filteredResult;
  }

  /**
   * Select platforms to use based on health and strategy
   */
  private selectPlatforms(strategy: SearchTermStrategy, forceAll?: boolean): string[] {
    const platforms: string[] = [];

    if (forceAll) {
      return ['indeed', 'linkedin'];
    }

    // Check Indeed
    const indeedHealth = this.platformHealth.get('indeed');
    if (indeedHealth?.isHealthy && strategy.platforms.indeed) {
      platforms.push('indeed');
    }

    // Check LinkedIn
    const linkedinHealth = this.platformHealth.get('linkedin');
    if (linkedinHealth?.isHealthy && strategy.platforms.linkedin) {
      platforms.push('linkedin');
    }

    // If no healthy platforms, try the one with better success rate
    if (platforms.length === 0) {
      if ((indeedHealth?.successRate || 0) > (linkedinHealth?.successRate || 0)) {
        platforms.push('indeed');
      } else {
        platforms.push('linkedin');
      }
    }

    return platforms;
  }

  /**
   * Scrape a specific platform
   */
  private async scrapePlatform(
    platform: string,
    searchTerm: string,
    maxItems: number
  ): Promise<ScrapedJob[]> {
    if (!this.apifyClient) {
      throw new ServiceError('Apify client not initialized', 'NOT_INITIALIZED');
    }

    return scraperRateLimiter.execute(async () => {
      if (platform === 'indeed') {
        return this.scrapeIndeed(searchTerm, maxItems);
      } else if (platform === 'linkedin') {
        return this.scrapeLinkedIn(searchTerm, maxItems);
      } else {
        throw new Error(`Unknown platform: ${platform}`);
      }
    });
  }

  /**
   * Scrape Indeed
   */
  private async scrapeIndeed(searchTerm: string, maxItems: number): Promise<ScrapedJob[]> {
    const run = await this.apifyClient!.actor('misceres~indeed-scraper').call({
      followApplyRedirects: false,
      maxItems,
      parseCompanyDetails: true,
      position: searchTerm,
      saveOnlyUniqueItems: true,
      scrapeCompanyData: false,
    }, {
      timeout: 180,
      memory: 256,
    });

    if (!run.defaultDatasetId) {
      throw new ServiceError('No dataset returned from Indeed scraper', 'NO_DATASET');
    }

    const { items } = await this.apifyClient!.dataset(run.defaultDatasetId).listItems();
    
    return items.map((item: any) => ({
      job_id: `indeed_${item.id || Date.now()}_${Math.random()}`,
      platform: 'Indeed',
      company: (item.company || '').trim(),
      job_title: (item.positionName || '').trim(),
      location: item.location || 'Remote',
      description: item.description || '',
      job_url: item.url || item.externalApplyLink || '',
      scraped_date: new Date().toISOString(),
      search_term: searchTerm,
    })).filter((job: ScrapedJob) => job.company && job.job_title);
  }

  /**
   * Scrape LinkedIn with custom endpoint
   */
  private async scrapeLinkedIn(searchTerm: string, maxItems: number): Promise<ScrapedJob[]> {
    // Use the custom endpoint if configured
    const endpoint = process.env.APIFY_LINKEDIN_ENDPOINT || 
      'https://api.apify.com/v2/acts/bebity~linkedin-jobs-scraper/run-sync-get-dataset-items';

    const response = await fetch(`${endpoint}?token=${process.env.APIFY_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proxy: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        },
        rows: maxItems,
        title: searchTerm
      })
    });

    if (!response.ok) {
      throw new ServiceError(`LinkedIn scraper failed: ${response.statusText}`, 'SCRAPER_ERROR');
    }

    const items = await response.json();
    
    return items.map((item: any) => ({
      job_id: `linkedin_${item.id || Date.now()}_${Math.random()}`,
      platform: 'LinkedIn',
      company: (item.companyName || '').trim(),
      job_title: (item.title || '').trim(),
      location: item.location || 'Remote',
      description: item.description || '',
      job_url: item.jobUrl || item.link || '',
      scraped_date: new Date().toISOString(),
      search_term: searchTerm,
    })).filter((job: ScrapedJob) => job.company && job.job_title);
  }

  /**
   * Filter and deduplicate scraped jobs
   */
  private async filterAndDeduplicate(result: ScrapingResult): Promise<ScrapingResult> {
    const uniqueJobs = new Map<string, ScrapedJob>();
    const seenSignatures = new Set<string>();
    let newCompaniesFound = 0;

    for (const job of result.jobs) {
      // Check cross-platform duplicates
      const signature = `${job.company.toLowerCase()}_${job.job_title.toLowerCase()}`;
      if (seenSignatures.has(signature)) {
        result.duplicates++;
        continue;
      }
      seenSignatures.add(signature);

      // Check if already processed
      if (this.processedJobIds.has(job.job_id)) {
        result.duplicates++;
        continue;
      }

      // Check company deduplication
      const dedupeResult = await this.deduplicator.deduplicate(job.company);
      
      if (dedupeResult.isKnown && !dedupeResult.shouldRecheck) {
        result.knownCompanies++;
        continue;
      }

      if (!dedupeResult.isKnown) {
        newCompaniesFound++;
      }

      uniqueJobs.set(job.job_id, job);
    }

    result.newJobs = Array.from(uniqueJobs.values());
    result.stats.newCompaniesFound = newCompaniesFound;

    return result;
  }

  /**
   * Update platform health based on scraping result
   */
  private updatePlatformHealth(platform: string, success: boolean, error?: string): void {
    const health = this.platformHealth.get(platform);
    if (!health) return;

    if (success) {
      health.consecutiveFailures = 0;
      health.lastSuccess = new Date();
      health.successRate = (health.successRate * 0.9) + 0.1; // Moving average
      health.isHealthy = true;
      health.cooldownUntil = undefined;
    } else {
      health.consecutiveFailures++;
      health.lastError = new Date();
      health.successRate = health.successRate * 0.9; // Decay
      
      // Check if platform should be marked unhealthy
      if (health.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES ||
          health.successRate < this.MIN_SUCCESS_RATE) {
        health.isHealthy = false;
        health.cooldownUntil = new Date(Date.now() + this.PLATFORM_COOLDOWN);
      }
    }
  }

  /**
   * Update search term strategy based on results
   */
  private async updateStrategy(searchTerm: string, result: ScrapingResult): Promise<void> {
    const strategy = this.searchTermStrategies.get(searchTerm);
    if (!strategy) return;

    // Update metrics
    strategy.lastScraped = new Date();
    strategy.totalScrapes++;
    strategy.avgJobsFound = (strategy.avgJobsFound * 0.8) + (result.jobs.length * 0.2);
    strategy.yieldRate = (strategy.yieldRate * 0.7) + (result.stats.yieldRate * 0.3);
    strategy.successRate = result.stats.successfullyScraped / Math.max(1, result.stats.totalAttempted);

    // Adjust scrape interval based on yield
    if (strategy.yieldRate > this.HIGH_YIELD_THRESHOLD) {
      // High yield: decrease interval (scrape more frequently)
      strategy.scrapeInterval = Math.max(
        this.MIN_SCRAPE_INTERVAL,
        strategy.scrapeInterval * 0.75
      );
    } else if (strategy.yieldRate < this.LOW_YIELD_THRESHOLD) {
      // Low yield: increase interval (scrape less frequently)
      strategy.scrapeInterval = Math.min(
        this.MAX_SCRAPE_INTERVAL,
        strategy.scrapeInterval * 1.5
      );
    }

    // Calculate next scrape time
    strategy.nextScrapeDue = new Date(Date.now() + strategy.scrapeInterval * 60 * 1000);

    // Persist to database
    await this.saveStrategy(strategy, result);
  }

  /**
   * Save strategy and results to database
   */
  private async saveStrategy(strategy: SearchTermStrategy, result: ScrapingResult): Promise<void> {
    try {
      await this.supabase
        .from('scraping_intelligence')
        .upsert({
          search_term: strategy.searchTerm,
          priority: strategy.priority,
          last_scraped: strategy.lastScraped,
          scrape_interval: `${strategy.scrapeInterval} minutes`,
          yield_rate: strategy.yieldRate,
          success_rate: strategy.successRate,
          total_scrapes: strategy.totalScrapes,
          total_jobs_found: strategy.totalScrapes * strategy.avgJobsFound,
          new_companies_found: result.stats.newCompaniesFound,
          indeed_success_rate: result.platformResults.indeed.success ? 1 : 0,
          linkedin_success_rate: result.platformResults.linkedin.success ? 1 : 0,
          indeed_avg_results: result.platformResults.indeed.count,
          linkedin_avg_results: result.platformResults.linkedin.count,
        });

      // Save scraping run record
      await this.supabase
        .from('scraping_runs')
        .insert({
          run_date: new Date(),
          search_term: strategy.searchTerm,
          total_scraped: result.jobs.length,
          new_jobs: result.newJobs.length,
          duplicates: result.duplicates,
          errors: result.errors.length,
          success: result.stats.failed === 0,
          error_message: result.errors.join('; ')
        });

    } catch (error) {
      console.error('Failed to save strategy:', error);
    }
  }

  /**
   * Create default strategy for new search term
   */
  private createDefaultStrategy(searchTerm: string): SearchTermStrategy {
    const priority = this.calculateDefaultPriority(searchTerm);
    
    return {
      searchTerm,
      priority,
      nextScrapeDue: new Date(),
      scrapeInterval: 1440, // 24 hours default
      yieldRate: 0.5, // Assume medium yield initially
      totalScrapes: 0,
      successRate: 1,
      avgJobsFound: 0,
      platforms: {
        indeed: true,
        linkedin: true
      }
    };
  }

  /**
   * Calculate default priority for search term
   */
  private calculateDefaultPriority(searchTerm: string): number {
    const priorities: Record<string, number> = {
      'Revenue Operations': 90,
      'Sales Development Manager': 85,
      'SDR': 80,
      'BDR': 80,
      'Sales Development Representative': 75,
      'Business Development Representative': 75,
      'Sales Operations': 70,
      'Sales Manager': 60,
      'Account Executive': 50,
    };

    return priorities[searchTerm] || 50;
  }

  /**
   * Parse interval string to minutes
   */
  private parseInterval(interval: string): number {
    const match = interval.match(/(\d+)\s*(minutes?|hours?|days?)/);
    if (!match) return 1440; // Default 24 hours

    const value = parseInt(match[1]);
    const unit = match[2];

    if (unit.startsWith('minute')) return value;
    if (unit.startsWith('hour')) return value * 60;
    if (unit.startsWith('day')) return value * 1440;

    return 1440;
  }

  /**
   * Get scraping statistics
   */
  async getStats(): Promise<{
    platformHealth: PlatformHealth[];
    topSearchTerms: SearchTermStrategy[];
    recentRuns: any[];
  }> {
    const { data: recentRuns } = await this.supabase
      .from('scraping_runs')
      .select('*')
      .order('run_date', { ascending: false })
      .limit(10);

    return {
      platformHealth: Array.from(this.platformHealth.values()),
      topSearchTerms: Array.from(this.searchTermStrategies.values())
        .sort((a, b) => b.yieldRate - a.yieldRate)
        .slice(0, 5),
      recentRuns: recentRuns || []
    };
  }
}