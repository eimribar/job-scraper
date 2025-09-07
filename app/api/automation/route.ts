import { NextRequest, NextResponse } from 'next/server';
import { getAutoScheduler } from '@/lib/services/autoScrapingScheduler';

// GET - Get automation status and statistics
export async function GET() {
  try {
    const scheduler = getAutoScheduler();
    const status = scheduler.getStatus();
    const stats = await scheduler.getStatistics();

    return NextResponse.json({
      success: true,
      scheduler: {
        isRunning: status.isRunning,
        currentRun: status.currentRun
      },
      statistics: {
        termsNeedingScraping: stats.needsScraping,
        recentRuns: stats.recentRuns,
        totals: stats.totalStats
      }
    });
  } catch (error) {
    console.error('Error getting automation status:', error);
    return NextResponse.json(
      { error: 'Failed to get automation status' },
      { status: 500 }
    );
  }
}

// POST - Start or stop the automation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, intervalMinutes } = body;

    const scheduler = getAutoScheduler();

    if (action === 'start') {
      scheduler.start(intervalMinutes || 5);
      return NextResponse.json({
        success: true,
        message: `Automation started (checking every ${intervalMinutes || 5} minutes)`,
        status: scheduler.getStatus()
      });
    } else if (action === 'stop') {
      scheduler.stop();
      return NextResponse.json({
        success: true,
        message: 'Automation stopped',
        status: scheduler.getStatus()
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "start" or "stop"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error controlling automation:', error);
    return NextResponse.json(
      { error: 'Failed to control automation' },
      { status: 500 }
    );
  }
}