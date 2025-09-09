import { NextResponse } from 'next/server';
import { WeeklyScraperService } from '@/lib/services/weeklyScraperService';
import { createApiSupabaseClient } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { searchTerm } = await request.json();
    
    if (!searchTerm) {
      return NextResponse.json(
        { error: 'Search term is required' },
        { status: 400 }
      );
    }

    console.log(`📋 Manual trigger for search term: ${searchTerm}`);
    
    // Initialize scraper service
    const scraper = new WeeklyScraperService();
    
    // Check if already running
    const status = scraper.getStatus();
    if (status.isRunning) {
      return NextResponse.json({
        success: false,
        message: 'Scraper is already running. Please wait for it to complete.',
        status
      });
    }
    
    // Process the specific search term
    const result = await scraper.processSingleTerm(searchTerm);
    
    if (result.success) {
      // Update the last_scraped_date for this term
      const supabase = createApiSupabaseClient();
      await supabase
        .from('search_terms')
        .update({ 
          last_scraped_date: new Date().toISOString(),
          jobs_found_last_run: result.jobsScraped || 0,
          companies_found_last_run: result.newJobsAdded || 0
        })
        .eq('search_term', searchTerm);
      
      return NextResponse.json({
        success: true,
        message: `Successfully processed ${searchTerm}`,
        jobsScraped: result.jobsScraped,
        newJobsAdded: result.newJobsAdded,
        companiesFound: result.companiesFound || 0
      });
    } else {
      return NextResponse.json({
        success: false,
        message: result.error || 'Failed to process search term',
        error: result.error
      });
    }
    
  } catch (error) {
    console.error('❌ Error processing search term:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process search term'
      },
      { status: 500 }
    );
  }
}

// GET endpoint for testing
export async function GET() {
  return NextResponse.json({
    message: 'Process single search term endpoint',
    usage: 'POST /api/automation/process-term',
    body: '{ "searchTerm": "Head of Sales" }',
    description: 'Manually trigger scraping for a specific search term'
  });
}