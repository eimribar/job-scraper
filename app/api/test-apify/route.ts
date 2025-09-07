import { NextRequest, NextResponse } from 'next/server';
import { getLinkedInScraper } from '@/lib/services/apifyLinkedInScraper';

export async function GET(request: NextRequest) {
  try {
    // Get search term from query params or use default
    const searchParams = request.nextUrl.searchParams;
    const searchTerm = searchParams.get('term') || 'SDR';
    const maxRows = parseInt(searchParams.get('rows') || '5');

    console.log(`Testing Apify with search term: "${searchTerm}", max rows: ${maxRows}`);

    const scraper = getLinkedInScraper();
    
    // Test the connection and scrape a few jobs
    const jobs = await scraper.scrapeJobs(searchTerm, maxRows);

    // Format the response
    const response = {
      success: true,
      searchTerm,
      jobsFound: jobs.length,
      jobs: jobs.map(job => ({
        title: job.title,
        company: job.company,
        location: job.location,
        url: job.url,
        descriptionSnippet: job.description.substring(0, 200) + '...'
      })),
      message: `Successfully scraped ${jobs.length} jobs for "${searchTerm}"`
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('Apify test error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to test Apify scraper',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchTerm = 'SDR', rows = 10 } = body;

    console.log(`Testing Apify POST with search term: "${searchTerm}", rows: ${rows}`);

    const scraper = getLinkedInScraper();
    const jobs = await scraper.scrapeJobs(searchTerm, rows);

    // Look for Outreach.io or SalesLoft mentions
    const jobsWithTools = jobs.filter(job => {
      const desc = job.description.toLowerCase();
      return desc.includes('outreach') || desc.includes('salesloft') || desc.includes('sales loft');
    });

    return NextResponse.json({
      success: true,
      searchTerm,
      totalJobs: jobs.length,
      jobsWithSalesTools: jobsWithTools.length,
      sampleJobs: jobs.slice(0, 3).map(job => ({
        title: job.title,
        company: job.company,
        hasOutreach: job.description.toLowerCase().includes('outreach'),
        hasSalesLoft: job.description.toLowerCase().includes('salesloft') || 
                      job.description.toLowerCase().includes('sales loft')
      })),
      message: `Found ${jobsWithTools.length} jobs mentioning sales tools out of ${jobs.length} total`
    });

  } catch (error: any) {
    console.error('Apify test error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to test Apify scraper',
        details: error.message 
      },
      { status: 500 }
    );
  }
}