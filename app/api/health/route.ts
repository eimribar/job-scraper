import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase';
import { unifiedProcessor } from '@/lib/services/unifiedProcessorService';

export async function GET(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient();
    const now = new Date();
    
    // Check for detailed metrics
    const searchParams = request.nextUrl.searchParams;
    const detailed = searchParams.get('detailed') === 'true';
    
    // Check database connectivity - use raw_jobs as fallback
    let dbConnected = true;
    let searchTermsExists = true;
    
    // Try search_terms first
    const { error: searchTermsError } = await supabase
      .from('search_terms')
      .select('*', { count: 'exact', head: true })
      .limit(1);
    
    if (searchTermsError) {
      searchTermsExists = false;
      // Fallback to raw_jobs for connectivity check
      const { error: rawJobsError } = await supabase
        .from('raw_jobs')
        .select('*', { count: 'exact', head: true })
        .limit(1);
      
      if (rawJobsError) {
        dbConnected = false;
        throw new Error(`Database connection failed: ${rawJobsError.message}`);
      }
    }

    // Check recent activity
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    // Check if jobs were processed recently
    const { count: recentJobs } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('processed', true)
      .gte('analyzed_date', oneHourAgo.toISOString());
    
    // Check if any search terms need scraping (only if table exists)
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    let overdueTerms = 0;
    
    if (searchTermsExists) {
      const { count } = await supabase
        .from('search_terms')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .or(`last_scraped_date.is.null,last_scraped_date.lt.${oneWeekAgo.toISOString()}`);
      overdueTerms = count || 0;
    }
    
    // Check unprocessed jobs backlog
    const { count: unprocessedJobs } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('processed', false);
    
    // Get total stats
    const { count: totalCompanies } = await supabase
      .from('identified_companies')
      .select('*', { count: 'exact', head: true });
    
    const { count: totalJobs } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true });
    
    // Get processor status (consolidating monitor endpoints)
    const processorStatus = unifiedProcessor.getStatus();
    
    // Get today's metrics (consolidating dashboard endpoints)
    const today = new Date().toISOString().split('T')[0];
    const { count: jobsToday } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('processed', true)
      .gte('analyzed_date', `${today}T00:00:00`);
    
    const { count: companiesToday } = await supabase
      .from('identified_companies')
      .select('*', { count: 'exact', head: true })
      .gte('identified_date', `${today}T00:00:00`);

    // Enhanced health response (consolidating monitor/metrics/debug endpoints)
    const health = {
      status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
      timestamp: now.toISOString(),
      model: 'gpt-5-mini-2025-08-07',
      database: {
        connected: true,
        responsive: true
      },
      processing: {
        ...processorStatus,
        recentJobsProcessed: recentJobs || 0,
        unprocessedJobsBacklog: unprocessedJobs || 0,
        isProcessingActive: processorStatus.isRunning || (recentJobs || 0) > 0,
        jobsToday: jobsToday || 0,
        detectionRate: jobsToday && jobsToday > 0 
          ? `${((companiesToday || 0) / jobsToday * 100).toFixed(2)}%`
          : '0%'
      },
      scraping: {
        overdueSearchTerms: overdueTerms || 0,
        needsScraping: (overdueTerms || 0) > 0
      },
      totals: {
        companiesDetected: totalCompanies || 0,
        companiesDetectedToday: companiesToday || 0,
        jobsScraped: totalJobs || 0,
        jobsProcessedToday: jobsToday || 0
      },
      system: detailed ? {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development'
      } : undefined,
      alerts: [] as Array<{level: string, message: string, action: string}>
    };

    // Add alerts based on conditions
    if (!health.processing.isProcessingActive) {
      health.alerts.push({
        level: 'warning',
        message: 'No jobs processed in the last hour - continuous analyzer may be down',
        action: 'Check continuous analyzer process'
      });
    }

    if (health.processing.unprocessedJobsBacklog > 1000) {
      health.alerts.push({
        level: 'warning', 
        message: `Large backlog of unprocessed jobs: ${health.processing.unprocessedJobsBacklog}`,
        action: 'Check continuous analyzer performance'
      });
    }

    if (health.scraping.overdueSearchTerms > 5) {
      health.alerts.push({
        level: 'error',
        message: `${health.scraping.overdueSearchTerms} search terms are overdue for scraping`,
        action: 'Check weekly scraper process'
      });
    }

    // Set overall status based on alerts
    if (health.alerts.some(a => a.level === 'error')) {
      health.status = 'unhealthy';
    } else if (health.alerts.some(a => a.level === 'warning')) {
      health.status = 'degraded';
    }

    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 206 : 503;

    return NextResponse.json(health, { status: statusCode });
    
  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Health check failed',
        timestamp: new Date().toISOString(),
        database: {
          connected: false,
          responsive: false
        },
        alerts: [{
          level: 'error',
          message: 'System health check failed',
          action: 'Check system logs and database connectivity'
        }]
      },
      { status: 503 }
    );
  }
}

// Simple liveness check
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}