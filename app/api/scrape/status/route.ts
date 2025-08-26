import { NextResponse } from 'next/server';
import { DataService } from '@/lib/services/dataService';

export async function GET() {
  try {
    const dataService = new DataService();

    // Get some stats from database
    const [searchTerms, companiesCount] = await Promise.all([
      dataService.getActiveSearchTerms(),
      dataService.getIdentifiedCompaniesCount()
    ]);

    // Calculate last scraped info
    const lastScraped = searchTerms
      .filter(term => term.last_scraped_date)
      .sort((a, b) => {
        const dateA = new Date(a.last_scraped_date!).getTime();
        const dateB = new Date(b.last_scraped_date!).getTime();
        return dateB - dateA;
      })[0];

    return NextResponse.json({
      stats: {
        totalSearchTerms: searchTerms.length,
        activeSearchTerms: searchTerms.filter(t => t.is_active).length,
        companiesIdentified: companiesCount,
        lastScrapedTerm: lastScraped ? {
          term: lastScraped.search_term,
          date: lastScraped.last_scraped_date,
          jobsFound: lastScraped.jobs_found_count
        } : null
      }
    });

  } catch (error) {
    console.error('Error getting scraping status:', error);
    return NextResponse.json(
      { error: 'Failed to get scraping status' },
      { status: 500 }
    );
  }
}