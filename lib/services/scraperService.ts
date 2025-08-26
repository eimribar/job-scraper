const { ApifyClient } = require('apify-client');

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

export class ScraperService {
  private apifyClient: ApifyClient;

  constructor() {
    if (!process.env.APIFY_TOKEN) {
      throw new Error('APIFY_TOKEN is required');
    }
    this.apifyClient = new ApifyClient({
      token: process.env.APIFY_TOKEN,
    });
  }

  // Indeed scraping removed - LinkedIn only as per requirements

  async scrapeLinkedInJobs(searchTerm: string, maxItems: number = 500): Promise<ScrapedJob[]> {
    try {
      console.log(`Scraping LinkedIn for: ${searchTerm} (max ${maxItems} jobs)`);
      
      const run = await this.apifyClient.actor('bebity~linkedin-jobs-scraper').call({
        proxy: {
          useApifyProxy: true,
          apifyProxyGroups: [], // Standard proxy as per requirements
        },
        rows: maxItems,
        title: searchTerm,
      });

      const { items } = await this.apifyClient.dataset(run.defaultDatasetId).listItems();
      
      return items.map((item: unknown) => {
        const jobItem = item as {
          id?: string;
          companyName?: string;
          title?: string;
          location?: string;
          description?: string;
          jobUrl?: string;
        };
        
        return {
          job_id: `linkedin_${jobItem.id || Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          platform: 'LinkedIn',
          company: jobItem.companyName || '',
          job_title: jobItem.title || '',
          location: jobItem.location || '',
          description: jobItem.description || '',
          job_url: jobItem.jobUrl || '',
          scraped_date: new Date().toISOString(),
          search_term: searchTerm,
        };
      });
    } catch (error) {
      console.error('Error scraping LinkedIn:', error);
      throw error;
    }
  }

  // LinkedIn-only scraping as per requirements
  async scrapeJobs(searchTerm: string, maxItems: number = 500): Promise<ScrapedJob[]> {
    try {
      console.log(`Starting LinkedIn scrape for: ${searchTerm}`);
      
      // Scrape LinkedIn only
      const linkedinJobs = await this.scrapeLinkedInJobs(searchTerm, maxItems);
      console.log(`Scraped ${linkedinJobs.length} jobs for search term: ${searchTerm}`);
      
      return linkedinJobs;
    } catch (error) {
      console.error('Error scraping jobs:', error);
      throw error;
    }
  }

  private deduplicateJobs(jobs: ScrapedJob[]): ScrapedJob[] {
    const uniqueJobs = new Map<string, ScrapedJob>();
    
    for (const job of jobs) {
      const key = `${job.company.toLowerCase()}_${job.job_title.toLowerCase()}_${job.location.toLowerCase()}`;
      if (!uniqueJobs.has(key)) {
        uniqueJobs.set(key, job);
      }
    }
    
    return Array.from(uniqueJobs.values());
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}