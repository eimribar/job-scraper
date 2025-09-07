/**
 * Apify LinkedIn Jobs Scraper Service
 * Uses Apify's bebity~linkedin-jobs-scraper actor
 */

export interface LinkedInJob {
  jobId?: string;
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  postedDate?: string;
  salary?: string;
  experienceLevel?: string;
  employmentType?: string;
}

export class ApifyLinkedInScraper {
  private readonly token: string;
  private readonly endpoint: string;

  constructor() {
    this.token = process.env.APIFY_TOKEN || '';
    this.endpoint = 'https://api.apify.com/v2/acts/bebity~linkedin-jobs-scraper/run-sync-get-dataset-items';
    
    if (!this.token) {
      throw new Error('APIFY_TOKEN is required in environment variables');
    }
  }

  /**
   * Scrape LinkedIn jobs for a search term
   * @param searchTerm - The job title/term to search for
   * @param maxRows - Maximum number of jobs to return (default 1000)
   */
  async scrapeJobs(searchTerm: string, maxRows: number = 1000): Promise<LinkedInJob[]> {
    console.log(`🔍 Scraping LinkedIn for: "${searchTerm}" (max ${maxRows} jobs)`);
    
    const startTime = Date.now();
    
    try {
      // Prepare request body according to Apify format
      const requestBody = {
        proxy: {
          useApifyProxy: true,
          apifyProxyGroups: []
        },
        rows: maxRows,
        title: searchTerm
      };

      // Make request to Apify
      const response = await fetch(`${this.endpoint}?token=${this.token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Apify API error ${response.status}: ${errorText.substring(0, 200)}`);
      }

      // Parse response
      const data = await response.json();
      
      // The response is an array of job objects
      const jobs: LinkedInJob[] = Array.isArray(data) ? data : [];
      
      // Transform to our format if needed
      const transformedJobs = jobs.map(job => ({
        jobId: job.jobId || this.generateJobId(job),
        title: job.title || job.jobTitle || '',
        company: job.company || job.companyName || '',
        location: job.location || '',
        description: job.description || job.jobDescription || '',
        url: job.url || job.jobUrl || job.link || '',
        postedDate: job.postedDate || job.postedAt || job.date || '',
        salary: job.salary || job.compensation || '',
        experienceLevel: job.experienceLevel || job.seniorityLevel || '',
        employmentType: job.employmentType || job.jobType || ''
      }));

      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log(`✅ Scraped ${transformedJobs.length} jobs for "${searchTerm}" in ${duration}s`);
      
      return transformedJobs;

    } catch (error: any) {
      console.error(`❌ Error scraping LinkedIn for "${searchTerm}":`, error.message);
      throw error;
    }
  }

  /**
   * Generate a unique job ID if not provided
   */
  private generateJobId(job: any): string {
    // Create a hash from company + title + location
    const identifier = `${job.company || ''}-${job.title || ''}-${job.location || ''}`;
    return Buffer.from(identifier).toString('base64').substring(0, 20);
  }

  /**
   * Test the Apify connection with a small request
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('🧪 Testing Apify LinkedIn scraper connection...');
      
      // Test with a small request
      const jobs = await this.scrapeJobs('SDR', 5);
      
      if (jobs.length > 0) {
        console.log('✅ Apify connection successful!');
        console.log(`   Sample job: ${jobs[0].title} at ${jobs[0].company}`);
        return true;
      } else {
        console.log('⚠️ Connection works but no jobs returned');
        return true;
      }
    } catch (error: any) {
      console.error('❌ Apify connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Get scraping statistics for a batch of search terms
   */
  async getScrapingEstimate(searchTerms: string[]): Promise<{
    totalTerms: number;
    estimatedJobs: number;
    estimatedTime: string;
    estimatedCost: string;
  }> {
    return {
      totalTerms: searchTerms.length,
      estimatedJobs: searchTerms.length * 500, // Average 500 jobs per term
      estimatedTime: `${searchTerms.length * 30} seconds`, // ~30s per term
      estimatedCost: `$${(searchTerms.length * 0.04).toFixed(2)}` // ~$0.04 per term
    };
  }
}

// Create singleton instance
let scraperInstance: ApifyLinkedInScraper | null = null;

export function getLinkedInScraper(): ApifyLinkedInScraper {
  if (!scraperInstance) {
    scraperInstance = new ApifyLinkedInScraper();
  }
  return scraperInstance;
}