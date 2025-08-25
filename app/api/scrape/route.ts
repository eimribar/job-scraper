import { NextRequest, NextResponse } from 'next/server';
import { ScraperService } from '@/lib/services/scraperService';
import { DataService } from '@/lib/services/dataService';

export async function POST(request: NextRequest) {
  try {
    const { searchTerm, maxItemsPerPlatform = 10 } = await request.json();

    if (!searchTerm) {
      return NextResponse.json(
        { error: 'Search term is required' },
        { status: 400 }
      );
    }

    // Initialize services
    const scraperService = new ScraperService();
    const dataService = new DataService();

    // Get existing processed jobs and companies for deduplication
    const [processedJobIds, knownCompanies] = await Promise.all([
      dataService.getProcessedJobIds(),
      dataService.getKnownCompanies(),
    ]);

    console.log(`Starting scrape for: ${searchTerm}`);
    console.log(`Known processed jobs: ${processedJobIds.length}`);
    console.log(`Known companies: ${knownCompanies.length}`);

    // Scrape jobs from all platforms
    const scrapedJobs = await scraperService.scrapeAllPlatforms(searchTerm, maxItemsPerPlatform);
    console.log(`Scraped ${scrapedJobs.length} jobs`);

    // Filter out already processed jobs and jobs from known companies
    const newJobs = scrapedJobs.filter(job => {
      const alreadyProcessed = processedJobIds.includes(job.job_id);
      const fromKnownCompany = knownCompanies.includes(job.company.toLowerCase().trim());
      
      if (alreadyProcessed) {
        console.log(`Skipping already processed job: ${job.job_id}`);
        return false;
      }
      
      if (fromKnownCompany) {
        console.log(`Skipping job from known company: ${job.company}`);
        return false;
      }
      
      return true;
    });

    console.log(`${newJobs.length} new jobs to process after deduplication`);

    // Save new jobs to database
    if (newJobs.length > 0) {
      await dataService.saveJobs(newJobs);
      console.log('Saved new jobs to database');
    }

    // Update search term last scraped date
    await dataService.updateSearchTermLastScraped(searchTerm, newJobs.length);

    // Return scraping results
    return NextResponse.json({
      success: true,
      searchTerm,
      totalScraped: scrapedJobs.length,
      newJobs: newJobs.length,
      alreadyProcessed: scrapedJobs.length - newJobs.length,
      message: `Successfully scraped ${scrapedJobs.length} jobs, ${newJobs.length} are new`,
    });

  } catch (error) {
    console.error('Scraping error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to scrape jobs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const dataService = new DataService();
    
    // Get active search terms that need scraping
    const searchTerms = await dataService.getActiveSearchTerms();
    
    // Filter terms that need scraping (not scraped in last 24 hours)
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    
    const termsToScrape = searchTerms.filter(term => {
      if (!term.last_scraped_date) return true;
      const lastScraped = new Date(term.last_scraped_date);
      return lastScraped < twentyFourHoursAgo;
    });

    return NextResponse.json({
      searchTerms: termsToScrape,
      totalActive: searchTerms.length,
      needingScraping: termsToScrape.length,
    });

  } catch (error) {
    console.error('Error fetching search terms:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch search terms',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}