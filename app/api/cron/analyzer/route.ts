import { NextResponse } from 'next/server';
import { ContinuousAnalyzerService } from '@/lib/services/continuousAnalyzerService';

// This endpoint runs every 5 minutes to analyze unprocessed jobs
export async function POST(request: Request) {
  const startTime = Date.now();
  
  try {
    // Security: Check if request is from Vercel Cron
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🤖 Analyzer cron triggered at', new Date().toISOString());

    const analyzer = new ContinuousAnalyzerService();
    
    // Check if already running
    const status = analyzer.getStatus();
    if (status.isRunning) {
      console.log('⚠️ Analyzer already running, skipping');
      return NextResponse.json({
        skipped: true,
        reason: 'Already running',
        status: status
      });
    }

    // Process batch of jobs (100 jobs = ~2-3 minutes)
    const result = await analyzer.processBatch(100);
    
    const duration = Date.now() - startTime;

    if (result.success) {
      if (result.jobsProcessed === 0) {
        // No jobs to process
        console.log('✅ No jobs to process - all caught up');
        return NextResponse.json({
          success: true,
          message: 'No jobs to process',
          durationMs: duration
        });
      }

      console.log('✅ Analysis batch completed successfully', {
        jobsProcessed: result.jobsProcessed,
        toolsDetected: result.toolsDetected,
        errors: result.errors,
        remainingUnprocessed: result.remainingUnprocessed,
        durationMs: duration
      });

      return NextResponse.json({
        success: true,
        jobsProcessed: result.jobsProcessed,
        toolsDetected: result.toolsDetected,
        errors: result.errors,
        remainingUnprocessed: result.remainingUnprocessed,
        durationMs: duration,
        timestamp: new Date().toISOString()
      });
    } else {
      throw new Error(result.error || 'Analysis failed');
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('❌ Analysis batch failed:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Analysis batch failed',
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
    const analyzer = new ContinuousAnalyzerService();
    const supabase = (analyzer as any).supabase;
    
    // Check unprocessed jobs count
    const { count: unprocessedCount } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('processed', false);
    
    // Check recently processed
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const { count: recentlyProcessed } = await supabase
      .from('processed_jobs')
      .select('*', { count: 'exact', head: true })
      .gte('processed_date', oneHourAgo.toISOString());
    
    return NextResponse.json({ 
      message: 'Continuous analyzer endpoint',
      schedule: 'Every 5 minutes',
      status: analyzer.getStatus(),
      unprocessedJobs: unprocessedCount || 0,
      jobsProcessedLastHour: recentlyProcessed || 0,
      processingRate: '100 jobs per run (every 5 min)',
      dailyCapacity: '28,800 jobs',
      nextRun: new Date(Math.ceil(Date.now() / (5 * 60 * 1000)) * (5 * 60 * 1000)).toISOString()
    });
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to get status'
    }, { status: 500 });
  }
}