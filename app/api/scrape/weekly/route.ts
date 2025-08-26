import { NextResponse } from 'next/server';
import { getScheduler } from '@/lib/services/scheduler';

export async function POST() {
  try {
    const scheduler = getScheduler();
    
    // Check if already running
    const status = scheduler.getStatus();
    if (status.isRunning) {
      return NextResponse.json(
        { 
          error: 'Weekly processing is already running',
          currentRun: status.currentRun
        },
        { status: 409 }
      );
    }

    console.log('API: Triggering weekly processing for all search terms');

    // Trigger manual run
    const run = await scheduler.triggerManualRun();

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
        duration: run.endTime ? 
          Math.round((run.endTime.getTime() - run.startTime.getTime()) / 1000 / 60) : 
          null
      }
    });

  } catch (error) {
    console.error('Error in weekly trigger:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to trigger weekly processing' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const scheduler = getScheduler();
    const status = scheduler.getStatus();

    return NextResponse.json({
      isRunning: status.isRunning,
      currentRun: status.currentRun
    });

  } catch (error) {
    console.error('Error getting scheduler status:', error);
    return NextResponse.json(
      { error: 'Failed to get scheduler status' },
      { status: 500 }
    );
  }
}