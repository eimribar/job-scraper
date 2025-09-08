import { NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase';

// This endpoint runs every 30 minutes to monitor system health
export async function POST(request: Request) {
  try {
    // Security: Check if request is from Vercel Cron
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🏥 Health check cron triggered at', new Date().toISOString());

    const supabase = createApiSupabaseClient();
    const now = new Date();
    
    // Perform health checks
    const checks = {
      database: false,
      recentScraping: false,
      recentProcessing: false,
      backlogStatus: false
    };
    
    // 1. Check database connectivity
    try {
      const { error: dbError } = await supabase
        .from('search_terms')
        .select('*', { count: 'exact', head: true })
        .limit(1);
      
      checks.database = !dbError;
    } catch (e) {
      checks.database = false;
    }

    // 2. Check recent scraping activity (last 2 hours)
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const { count: recentScrapes } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true })
      .gte('scraped_date', twoHoursAgo.toISOString());
    
    checks.recentScraping = (recentScrapes || 0) > 0;

    // 3. Check recent processing activity (last hour)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const { count: recentProcessing } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('processed', true)
      .gte('analyzed_date', oneHourAgo.toISOString());
    
    checks.recentProcessing = (recentProcessing || 0) > 0;

    // 4. Check unprocessed backlog
    const { count: unprocessedJobs } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('processed', false);
    
    checks.backlogStatus = (unprocessedJobs || 0) < 5000; // Alert if backlog > 5000

    // 5. Check overdue search terms
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const { count: overdueTerms } = await supabase
      .from('search_terms')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .or(`last_scraped_date.is.null,last_scraped_date.lt.${oneWeekAgo.toISOString()}`);

    // Compile alerts
    const alerts: Array<{level: string, message: string}> = [];
    
    if (!checks.database) {
      alerts.push({
        level: 'critical',
        message: 'Database connection failed'
      });
    }
    
    if (!checks.recentScraping && (overdueTerms || 0) > 0) {
      alerts.push({
        level: 'warning',
        message: `No recent scraping activity - ${overdueTerms} terms overdue`
      });
    }
    
    if (!checks.recentProcessing && (unprocessedJobs || 0) > 100) {
      alerts.push({
        level: 'warning',
        message: `No recent processing activity - ${unprocessedJobs} jobs unprocessed`
      });
    }
    
    if (!checks.backlogStatus) {
      alerts.push({
        level: 'error',
        message: `Large unprocessed backlog: ${unprocessedJobs} jobs`
      });
    }

    // Send alerts if needed (future: integrate with Slack/email)
    if (alerts.some(a => a.level === 'critical' || a.level === 'error')) {
      console.error('🚨 HEALTH CHECK ALERTS:', alerts);
      // TODO: Send notifications via Slack webhook or email
    }

    // Determine overall health
    const health = alerts.length === 0 ? 'healthy' :
                  alerts.some(a => a.level === 'critical') ? 'critical' :
                  alerts.some(a => a.level === 'error') ? 'unhealthy' : 'degraded';

    console.log(`✅ Health check completed: ${health}`, {
      checks,
      alerts: alerts.length,
      overdueTerms: overdueTerms || 0,
      unprocessedJobs: unprocessedJobs || 0
    });

    return NextResponse.json({
      success: true,
      health,
      checks,
      alerts,
      metrics: {
        overdueSearchTerms: overdueTerms || 0,
        unprocessedJobs: unprocessedJobs || 0,
        recentScrapes: recentScrapes || 0,
        recentProcessing: recentProcessing || 0
      },
      timestamp: now.toISOString()
    });

  } catch (error) {
    console.error('❌ Health check failed:', error);
    
    return NextResponse.json(
      { 
        success: false,
        health: 'critical',
        error: error instanceof Error ? error.message : 'Health check failed',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// GET for manual health check
export async function GET() {
  // Reuse the POST logic for manual checks
  return POST(new Request('http://localhost', {
    headers: {
      authorization: `Bearer ${process.env.CRON_SECRET || ''}`
    }
  }));
}