/**
 * Unified Processor API
 * Consolidates all processing endpoints into one
 * 
 * GET  - Get processing status
 * POST - Start processing batch
 * DELETE - Stop processing
 */

import { NextResponse } from 'next/server';
import { unifiedProcessor } from '@/lib/services/unifiedProcessorService';

// GET - Status and metrics
export async function GET() {
  try {
    const status = unifiedProcessor.getStatus();
    const supabase = (unifiedProcessor as any).supabase;
    
    // Get additional metrics
    const { count: unprocessedCount } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('processed', false);
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const { count: recentlyProcessed } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('processed', true)
      .gte('analyzed_date', oneHourAgo.toISOString());
    
    // Get today's detections
    const today = new Date().toISOString().split('T')[0];
    const { count: companiesDetectedToday } = await supabase
      .from('identified_companies')
      .select('*', { count: 'exact', head: true })
      .gte('identified_date', `${today}T00:00:00`)
      .lte('identified_date', `${today}T23:59:59`);
    
    const detectionRate = recentlyProcessed > 0 
      ? ((companiesDetectedToday / recentlyProcessed) * 100).toFixed(2)
      : 0;
    
    return NextResponse.json({
      status: status.isRunning ? 'processing' : 'idle',
      stats: {
        ...status,
        unprocessedJobs: unprocessedCount || 0,
        jobsProcessedLastHour: recentlyProcessed || 0,
        companiesDetectedToday: companiesDetectedToday || 0,
        detectionRate: `${detectionRate}%`
      },
      model: 'gpt-5-mini-2025-08-07',
      batchSize: 100,
      processingRate: '100 jobs per batch, sequential analysis',
      nextRun: status.isRunning ? 'In progress' : 'Ready'
    });
  } catch (error) {
    console.error('Processor status error:', error);
    return NextResponse.json(
      { error: 'Failed to get processor status' },
      { status: 500 }
    );
  }
}

// POST - Start processing
export async function POST(request: Request) {
  try {
    // Check authorization
    const authHeader = request.headers.get('authorization');
    const userAgent = request.headers.get('user-agent');
    const isVercelCron = userAgent === 'vercel-cron/1.0';
    
    if (!isVercelCron && process.env.CRON_SECRET) {
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    
    // Parse optional parameters
    const body = await request.json().catch(() => ({}));
    const batchSize = body.batchSize || 100;
    const jobId = body.jobId; // For single job processing
    
    // Check if already running
    const status = unifiedProcessor.getStatus();
    if (status.isRunning) {
      return NextResponse.json({
        error: 'Processor already running',
        status: 'busy'
      }, { status: 409 });
    }
    
    // Process single job or batch
    if (jobId) {
      console.log(`Processing single job: ${jobId}`);
      const result = await unifiedProcessor.processSingleJob(jobId);
      return NextResponse.json(result);
    } else {
      console.log(`Starting batch processing (${batchSize} jobs)`);
      const result = await unifiedProcessor.processBatch(batchSize);
      
      if (result.success) {
        return NextResponse.json({
          success: true,
          message: 'Batch processing completed',
          results: result
        });
      } else {
        return NextResponse.json({
          success: false,
          error: result.error
        }, { status: 500 });
      }
    }
  } catch (error) {
    console.error('Processor start error:', error);
    return NextResponse.json(
      { error: 'Failed to start processor' },
      { status: 500 }
    );
  }
}

// DELETE - Stop processing (placeholder for future)
export async function DELETE() {
  try {
    // In the future, implement graceful shutdown
    const status = unifiedProcessor.getStatus();
    
    if (!status.isRunning) {
      return NextResponse.json({
        message: 'Processor is not running',
        status: 'idle'
      });
    }
    
    // For now, we can't stop mid-batch
    return NextResponse.json({
      message: 'Stop requested - will complete current batch',
      status: 'stopping',
      note: 'Processor will stop after current batch completes'
    });
  } catch (error) {
    console.error('Processor stop error:', error);
    return NextResponse.json(
      { error: 'Failed to stop processor' },
      { status: 500 }
    );
  }
}