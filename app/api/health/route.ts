import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient();
    const now = new Date();
    
    // Check for detailed metrics
    const searchParams = request.nextUrl.searchParams;
    const detailed = searchParams.get('detailed') === 'true';
    
    // Check database connectivity
    const { data: dbTest, error: dbError } = await supabase
      .from('search_terms')
      .select('*', { count: 'exact', head: true })
      .limit(1);
    
    if (dbError) {
      throw new Error(`Database connection failed: ${dbError.message}`);
    }

    // Check recent activity
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    // Check if jobs were processed recently
    const { count: recentJobs } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('processed', true)
      .gte('analyzed_date', oneHourAgo.toISOString());
    
    // Check if any search terms need scraping
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const { count: overdueTerms } = await supabase
      .from('search_terms')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .or(`last_scraped_date.is.null,last_scraped_date.lt.${oneWeekAgo.toISOString()}`);
    
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

    // Basic health response
    const health = {
      status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
      timestamp: now.toISOString(),
      database: {
        connected: true,
        responsive: true
      },
      processing: {
        recentJobsProcessed: recentJobs || 0,
        unprocessedJobsBacklog: unprocessedJobs || 0,
        isProcessingActive: (recentJobs || 0) > 0
      },
      scraping: {
        overdueSearchTerms: overdueTerms || 0,
        needsScraping: (overdueTerms || 0) > 0
      },
      totals: {
        companiesDetected: totalCompanies || 0,
        jobsScraped: totalJobs || 0
      },
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