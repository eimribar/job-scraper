import { NextResponse } from 'next/server';
import { getScheduler } from '@/lib/services/scheduler';

// This endpoint is triggered by Vercel Cron every Monday at 2 AM
export async function POST(request: Request) {
  try {
    // Security: Check if request is from Vercel Cron
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🕐 Cron: Weekly processing triggered at', new Date().toISOString());

    const scheduler = getScheduler();
    
    // Check if already running
    const status = scheduler.getStatus();
    if (status.isRunning) {
      console.log('⚠️ Cron: Weekly processing already running, skipping');
      return NextResponse.json({
        skipped: true,
        reason: 'Already running',
        currentRun: status.currentRun
      });
    }

    // Trigger the weekly run
    const run = await scheduler.triggerManualRun();

    console.log('✅ Cron: Weekly processing completed', {
      runId: run.id,
      searchTermsProcessed: run.searchTermsProcessed,
      totalJobsScraped: run.totalJobsScraped,
      totalJobsAnalyzed: run.totalJobsAnalyzed,
      duration: run.endTime ? 
        Math.round((run.endTime.getTime() - run.startTime.getTime()) / 1000 / 60) + ' minutes' : 
        'unknown'
    });

    return NextResponse.json({
      success: true,
      run: {
        id: run.id,
        startTime: run.startTime,
        endTime: run.endTime,
        status: run.status,
        searchTermsProcessed: run.searchTermsProcessed,
        totalJobsScraped: run.totalJobsScraped,
        totalJobsAnalyzed: run.totalJobsAnalyzed,
        durationMinutes: run.endTime ? 
          Math.round((run.endTime.getTime() - run.startTime.getTime()) / 1000 / 60) : 
          null
      }
    });

  } catch (error) {
    console.error('❌ Cron: Weekly processing failed:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Weekly processing failed',
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