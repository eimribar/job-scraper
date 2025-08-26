import ApifyClient from 'apify-client';
import { BaseService, ServiceError } from './baseService';
import { scraperRateLimiter } from './rateLimiter';

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
  jobs: ScrapedJob[];
  errors: string[];
  stats: {
    totalAttempted: number;
    successfullyScraped: number;
    failed: number;
    duration: number;
  };
}

export class ImprovedScraperService extends BaseService {
  private apifyClient: InstanceType<typeof ApifyClient> | null = null;
  private isConfigured: boolean = false;

  constructor() {
    super();
    this.initialize();
  }

  private initialize(): void {
    try {
      this.validateConfig(['APIFY_TOKEN']);
      
      this.apifyClient = new ApifyClient({
        token: process.env.APIFY_TOKEN!,
      });
      
      this.isConfigured = true;
    } catch (error) {
      console.warn('Apify not configured:', error);
      this.isConfigured = false;
    }
  }

  async scrapeAllPlatforms(
    searchTerm: string, 
    maxItemsPerPlatform: number = 10
  ): Promise<ScrapingResult> {
    if (!this.isConfigured || !this.apifyClient) {
      return this.getMockData(searchTerm);
    }

    const startTime = Date.now();
    const results: ScrapedJob[] = [];
    const errors: string[] = [];
    let totalAttempted = 0;
    let successfullyScraped = 0;

    // Scrape Indeed first
    try {
      totalAttempted++;
      const indeedJobs = await scraperRateLimiter.execute(
        () => this.scrapeIndeedJobs(searchTerm, maxItemsPerPlatform)
      );
      results.push(...indeedJobs);
      successfullyScraped++;
      console.log(`✅ Indeed: Scraped ${indeedJobs.length} jobs`);
    } catch (error) {
      const errorMsg = `Indeed scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);
      console.error(errorMsg);
    }

    // Wait before next platform to avoid rate limits
    await this.sleep(5000);

    // Scrape LinkedIn
    try {
      totalAttempted++;
      const linkedInJobs = await scraperRateLimiter.execute(
        () => this.scrapeLinkedInJobs(searchTerm, maxItemsPerPlatform)
      );
      results.push(...linkedInJobs);
      successfullyScraped++;
      console.log(`✅ LinkedIn: Scraped ${linkedInJobs.length} jobs`);
    } catch (error) {
      const errorMsg = `LinkedIn scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);
      console.error(errorMsg);
    }

    const duration = Date.now() - startTime;

    return {
      jobs: results,
      errors,
      stats: {
        totalAttempted,
        successfullyScraped,
        failed: totalAttempted - successfullyScraped,
        duration,
      },
    };
  }

  private async scrapeIndeedJobs(
    searchTerm: string, 
    maxItems: number
  ): Promise<ScrapedJob[]> {
    if (!this.apifyClient) {
      throw new ServiceError('Apify client not initialized', 'NOT_INITIALIZED');
    }

    return this.withRetry(async () => {
      console.log(`🔍 Scraping Indeed for: ${searchTerm} (max ${maxItems} items)`);
      
      const actorId = process.env.APIFY_INDEED_ACTOR || 'misceres~indeed-scraper';
      
      const run = await this.apifyClient!.actor(actorId).call({
        followApplyRedirects: false,
        maxItems,
        parseCompanyDetails: true,
        position: searchTerm,
        saveOnlyUniqueItems: true,
        scrapeCompanyData: false, // Faster without extra data
      }, {
        timeout: 180, // 3 minutes timeout
        memory: 256, // Limit memory usage
      });

      if (!run.defaultDatasetId) {
        throw new ServiceError('No dataset returned from Indeed scraper', 'NO_DATASET');
      }

      const { items } = await this.apifyClient!.dataset(run.defaultDatasetId).listItems();
      
      const jobs: ScrapedJob[] = [];
      
      for (const item of items) {
        try {
          const job = this.parseIndeedJob(item, searchTerm);
          if (job) {
            jobs.push(job);
          }
        } catch (error) {
          console.warn('Failed to parse Indeed job:', error);
        }
      }

      return jobs;
    });
  }

  private async scrapeLinkedInJobs(
    searchTerm: string, 
    maxItems: number
  ): Promise<ScrapedJob[]> {
    if (!this.apifyClient) {
      throw new ServiceError('Apify client not initialized', 'NOT_INITIALIZED');
    }

    return this.withRetry(async () => {
      console.log(`🔍 Scraping LinkedIn for: ${searchTerm} (max ${maxItems} items)`);
      
      const actorId = process.env.APIFY_LINKEDIN_ACTOR || 'bebity~linkedin-jobs-scraper';
      
      const run = await this.apifyClient!.actor(actorId).call({
        query: searchTerm,
        maxResults: maxItems,
        parseCompanyDetails: false, // Faster
        saveOnlyUniqueItems: true,
      }, {
        timeout: 180, // 3 minutes timeout
        memory: 256,
      });

      if (!run.defaultDatasetId) {
        throw new ServiceError('No dataset returned from LinkedIn scraper', 'NO_DATASET');
      }

      const { items } = await this.apifyClient!.dataset(run.defaultDatasetId).listItems();
      
      const jobs: ScrapedJob[] = [];
      
      for (const item of items) {
        try {
          const job = this.parseLinkedInJob(item, searchTerm);
          if (job) {
            jobs.push(job);
          }
        } catch (error) {
          console.warn('Failed to parse LinkedIn job:', error);
        }
      }

      return jobs;
    });
  }

  private parseIndeedJob(item: any, searchTerm: string): ScrapedJob | null {
    // Validate required fields
    if (!item.id || !item.company || !item.positionName) {
      return null;
    }

    return {
      job_id: `indeed_${item.id}`,
      platform: 'Indeed',
      company: item.company.trim(),
      job_title: item.positionName.trim(),
      location: item.location || 'Remote',
      description: item.description || '',
      job_url: item.url || item.externalApplyLink || '',
      scraped_date: new Date().toISOString(),
      search_term: searchTerm,
    };
  }

  private parseLinkedInJob(item: any, searchTerm: string): ScrapedJob | null {
    // Validate required fields
    if (!item.id || !item.companyName || !item.title) {
      return null;
    }

    return {
      job_id: `linkedin_${item.id}`,
      platform: 'LinkedIn',
      company: item.companyName.trim(),
      job_title: item.title.trim(),
      location: item.location || 'Remote',
      description: item.description || '',
      job_url: item.link || '',
      scraped_date: new Date().toISOString(),
      search_term: searchTerm,
    };
  }

  private getMockData(searchTerm: string): ScrapingResult {
    console.log('⚠️  Using mock data (Apify not configured)');
    
    const mockJobs: ScrapedJob[] = [
      {
        job_id: 'mock_1',
        platform: 'Mock',
        company: 'Example Corp',
        job_title: `${searchTerm} Representative`,
        location: 'San Francisco, CA',
        description: 'Looking for an experienced SDR to join our team. Experience with Outreach.io required.',
        job_url: 'https://example.com/job1',
        scraped_date: new Date().toISOString(),
        search_term: searchTerm,
      },
      {
        job_id: 'mock_2',
        platform: 'Mock',
        company: 'Test Company',
        job_title: `Senior ${searchTerm}`,
        location: 'New York, NY',
        description: 'We use SalesLoft for our sales engagement platform. Looking for experienced professionals.',
        job_url: 'https://example.com/job2',
        scraped_date: new Date().toISOString(),
        search_term: searchTerm,
      },
    ];

    return {
      jobs: mockJobs,
      errors: [],
      stats: {
        totalAttempted: 2,
        successfullyScraped: 2,
        failed: 0,
        duration: 100,
      },
    };
  }

  // Get scraping status
  getStatus(): {
    configured: boolean;
    rateLimiter: { queued: number; running: number; callsInLastMinute: number };
  } {
    return {
      configured: this.isConfigured,
      rateLimiter: scraperRateLimiter.getQueueStatus(),
    };
  }
}