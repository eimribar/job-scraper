/**
 * Queue Status API
 */

import { NextRequest, NextResponse } from 'next/server';
import { SmartQueueManager } from '@/lib/services/smartQueueManager';

const queueManager = new SmartQueueManager();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') as any;

    // Get queue status
    const stats = await queueManager.getQueueStats();
    const jobs = status ? await queueManager.getJobsByStatus(status) : [];

    return NextResponse.json({
      success: true,
      stats,
      jobs: jobs.slice(0, 50), // Limit to 50 most recent
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to get queue status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action, jobId, type, payload, options } = await req.json();

    if (action === 'add') {
      if (!type || !payload) {
        return NextResponse.json(
          { error: 'Type and payload are required' },
          { status: 400 }
        );
      }

      const id = await queueManager.addJob(type, payload, options || {});
      
      return NextResponse.json({
        success: true,
        jobId: id,
        message: 'Job added to queue'
      });
    }

    if (action === 'retry' && jobId) {
      const result = await queueManager.retryJob(jobId);
      
      return NextResponse.json({
        success: result,
        message: result ? 'Job requeued for retry' : 'Failed to retry job'
      });
    }

    if (action === 'cancel' && jobId) {
      const result = await queueManager.cancelJob(jobId);
      
      return NextResponse.json({
        success: result,
        message: result ? 'Job cancelled' : 'Failed to cancel job'
      });
    }

    if (action === 'clear') {
      await queueManager.clearFailedJobs();
      
      return NextResponse.json({
        success: true,
        message: 'Failed jobs cleared'
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to process queue action',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}