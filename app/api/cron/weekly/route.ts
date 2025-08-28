import { NextResponse } from 'next/server';
import { WeeklyScraperService } from '@/lib/services/weeklyScraperService';

// This endpoint is triggered by Vercel Cron every Monday at 2 AM
export async function POST(request: Request) {
  try {
    // Security: Check if request is from Vercel Cron
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🕐 Cron: Weekly scraping triggered at', new Date().toISOString());

    const scraper = new WeeklyScraperService();
    
    // Check if it's time for weekly scrape
    const shouldScrape = await scraper.checkIfTimeForWeeklyScrape();
    if (!shouldScrape) {
      console.log('⏳ Cron: Not time for weekly scrape yet, skipping');
      return NextResponse.json({
        skipped: true,
        reason: 'Not time for weekly scrape yet',
        message: 'Will run when oldest search term is >7 days old'
      });
    }
    
    // Check if already running
    const status = scraper.getStatus();
    if (status.isRunning) {
      console.log('⚠️ Cron: Weekly scraping already running, skipping');
      return NextResponse.json({
        skipped: true,
        reason: 'Already running',
        status: status
      });
    }

    // Run the weekly scrape
    const result = await scraper.runWeeklyScrape();

    if (result.success) {
      console.log('✅ Cron: Weekly scraping completed successfully', {
        searchTermsProcessed: result.results.success,
        totalJobsScraped: result.results.totalJobs,
        newJobsFound: result.results.totalNew,
        durationMs: result.duration
      });

      return NextResponse.json({
        success: true,
        results: {
          searchTermsProcessed: result.results.success,
          searchTermsFailed: result.results.failed,
          totalJobsScraped: result.results.totalJobs,
          newJobsFound: result.results.totalNew,
          durationMinutes: Math.round(result.duration / 1000 / 60)
        },
        timestamp: new Date().toISOString()
      });
    } else {
      throw new Error(result.error || 'Weekly scrape failed');
    }

  } catch (error) {
    console.error('❌ Cron: Weekly scraping failed:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Weekly scraping failed',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Also allow GET for manual testing
export async function GET() {
  return NextResponse.json({ 
    message: 'Weekly cron endpoint active',
    nextSchedule: 'Every Monday at 2:00 AM UTC'
  });
}