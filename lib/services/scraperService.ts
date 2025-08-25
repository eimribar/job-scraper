import ApifyClient from 'apify-client';

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
  private apifyClient: InstanceType<typeof ApifyClient>;

  constructor() {
    if (!process.env.APIFY_TOKEN) {
      throw new Error('APIFY_TOKEN is required');
    }
    this.apifyClient = new ApifyClient({
      token: process.env.APIFY_TOKEN,
    });
  }

  async scrapeIndeedJobs(searchTerm: string, maxItems: number = 10): Promise<ScrapedJob[]> {
    try {
      console.log(`Scraping Indeed for: ${searchTerm}`);
      
      const run = await this.apifyClient.actor('misceres~indeed-scraper').call({
        followApplyRedirects: false,
        maxItems,
        parseCompanyDetails: true,
        position: searchTerm,
        saveOnlyUniqueItems: true,
      });

      const { items } = await this.apifyClient.dataset(run.defaultDatasetId).listItems();
      
      return items.map((item: unknown) => {
        const jobItem = item as {
          id?: string;
          company?: string;
          positionName?: string;
          location?: string;
          description?: string;
          url?: string;
          externalApplyLink?: string;
        };
        
        return {
          job_id: `indeed_${jobItem.id || Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          platform: 'Indeed',
          company: jobItem.company || '',
          job_title: jobItem.positionName || '',
          location: jobItem.location || '',
          description: jobItem.description || '',
          job_url: jobItem.url || jobItem.externalApplyLink || '',
          scraped_date: new Date().toISOString(),
          search_term: searchTerm,
        };
      });
    } catch (error) {
      console.error('Error scraping Indeed:', error);
      throw error;
    }
  }

  async scrapeLinkedInJobs(searchTerm: string, maxItems: number = 10): Promise<ScrapedJob[]> {
    try {
      console.log(`Scraping LinkedIn for: ${searchTerm}`);
      
      const run = await this.apifyClient.actor('bebity~linkedin-jobs-scraper').call({
        proxy: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL'],
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

  async scrapeAllPlatforms(searchTerm: string, maxItemsPerPlatform: number = 10): Promise<ScrapedJob[]> {
    const results: ScrapedJob[] = [];
    
    try {
      // Scrape Indeed
      const indeedJobs = await this.scrapeIndeedJobs(searchTerm, maxItemsPerPlatform);
      results.push(...indeedJobs);
      
      // Add delay between platforms to respect rate limits
      await this.delay(5000);
      
      // Scrape LinkedIn
      const linkedinJobs = await this.scrapeLinkedInJobs(searchTerm, maxItemsPerPlatform);
      results.push(...linkedinJobs);
      
    } catch (error) {
      console.error('Error in scrapeAllPlatforms:', error);
      throw error;
    }
    
    return this.deduplicateJobs(results);
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