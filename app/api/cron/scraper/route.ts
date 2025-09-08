import { NextResponse } from 'next/server';
import { WeeklyScraperService } from '@/lib/services/weeklyScraperService';

// This endpoint runs every hour to scrape one search term
export async function POST(request: Request) {
  const startTime = Date.now();
  
  try {
    // Security: Check if request is from Vercel Cron
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

// GET for manual testing and monitoring
export async function GET() {
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