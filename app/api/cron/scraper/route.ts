import { NextResponse } from 'next/server';
import { WeeklyScraperService } from '@/lib/services/weeklyScraperService';

// Helper function to check if request is from Vercel Cron
function isVercelCron(request: Request): boolean {
  const userAgent = request.headers.get('user-agent');
  return userAgent === 'vercel-cron/1.0';
}

// Helper function to check authorization
function isAuthorized(request: Request): boolean {
  // Allow Vercel cron requests
  if (isVercelCron(request)) {
    return true;
  }
  
  // Check for CRON_SECRET in authorization header
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return true;
  }
  
  return false;
}

// Main scraper logic
async function runScraper() {
  const startTime = Date.now();
  
  try {
    console.log('🕐 Hourly scraper triggered at', new Date().toISOString());

    const scraper = new WeeklyScraperService();
    
    // Check if already running
    const status = scraper.getStatus();
    if (status.isRunning) {
      console.log('⚠️ Scraper already running, skipping');
      return NextResponse.json({
        skipped: true,
        reason: 'Already running',
        status: status
      });
    }

    // Process one search term
    const result = await scraper.processOneSearchTerm();
    
    const duration = Date.now() - startTime;

    if (result.success) {
      if (result.termsProcessed === 0) {
        // All terms are up to date
        console.log('✅ All search terms are up to date');
        return NextResponse.json({
          success: true,
          message: 'All search terms are up to date',
          durationMs: duration
        });
      }

      console.log('✅ Hourly scraping completed successfully', {
        termProcessed: result.termProcessed,
        jobsScraped: result.jobsScraped,
        newJobsAdded: result.newJobsAdded,
        remainingOverdueTerms: result.remainingOverdueTerms,
        durationMs: duration
      });

      return NextResponse.json({
        success: true,
        termProcessed: result.termProcessed,
        jobsScraped: result.jobsScraped,
        newJobsAdded: result.newJobsAdded,
        remainingOverdueTerms: result.remainingOverdueTerms,
        durationMs: duration,
        timestamp: new Date().toISOString()
      });
    } else {
      throw new Error(result.error || 'Scraping failed');
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Hourly scraping failed:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Hourly scraping failed',
        durationMs: duration,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// POST endpoint for manual triggers
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  return runScraper();
}

// GET endpoint for Vercel cron and status checks
export async function GET(request: Request) {
  // If this is a Vercel cron request, run the scraper
  if (isVercelCron(request)) {
    console.log('📢 Vercel cron detected, running scraper...');
    return runScraper();
  }
  
  // Otherwise return status
  try {
    const scraper = new WeeklyScraperService();
    
    // Check how many terms need scraping
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const supabase = (scraper as any).supabase;
    const { count: overdueCount } = await supabase
      .from('search_terms')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .or(`last_scraped_date.is.null,last_scraped_date.lt.${oneWeekAgo.toISOString()}`);
    
    return NextResponse.json({ 
      message: 'Hourly scraper endpoint',
      schedule: 'Every hour at :00',
      status: scraper.getStatus(),
      overdueSearchTerms: overdueCount || 0,
      nextRun: new Date(new Date().setMinutes(0, 0, 0) + 60 * 60 * 1000).toISOString()
    });
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to get status'
    }, { status: 500 });
  }
}