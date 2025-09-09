import { NextResponse } from 'next/server';
import { ContinuousAnalyzerService } from '@/lib/services/continuousAnalyzerService';

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

// Main analyzer logic
async function runAnalyzer() {
  const startTime = Date.now();
  
  try {
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

// POST endpoint for manual triggers
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  return runAnalyzer();
}

// GET endpoint for Vercel cron and status checks
export async function GET(request: Request) {
  // If this is a Vercel cron request, run the analyzer
  if (isVercelCron(request)) {
    console.log('📢 Vercel cron detected, running analyzer...');
    return runAnalyzer();
  }
  
  // Otherwise return status
  try {
    const analyzer = new ContinuousAnalyzerService();
    const supabase = (analyzer as any).supabase;
    
    // Check unprocessed jobs count
    const { count: unprocessedCount } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('processed', false);
    
    // Check recently processed jobs from raw_jobs table
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const { count: recentlyProcessed } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('processed', true)
      .gte('analyzed_date', oneHourAgo.toISOString());
    
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