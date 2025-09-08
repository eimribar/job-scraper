import { NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = createApiSupabaseClient();
    
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection not configured' },
        { status: 503 }
      );
    }

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get automation metrics
    const metrics = {
      database: {
        status: 'unknown',
        companies: 0,
        tierOne: 0,
        jobs: 0,
        unprocessedJobs: 0
      },
      scraping: {
        status: 'unknown',
        searchTerms: 0,
        overdueTerms: 0,
        lastScrapedDate: null,
        recentScrapes: 0
      },
      processing: {
        status: 'unknown',
        processedToday: 0,
        processedLastHour: 0,
        toolsDetected: 0,
        errorRate: 0
      },
      cronJobs: {
        scraper: {
          schedule: 'Every hour',
          nextRun: new Date(Math.ceil(now.getTime() / (60 * 60 * 1000)) * (60 * 60 * 1000)).toISOString(),
          status: 'scheduled'
        },
        analyzer: {
          schedule: 'Every 5 minutes',
          nextRun: new Date(Math.ceil(now.getTime() / (5 * 60 * 1000)) * (5 * 60 * 1000)).toISOString(),
          status: 'scheduled'
        },
        healthCheck: {
          schedule: 'Every 30 minutes',
          nextRun: new Date(Math.ceil(now.getTime() / (30 * 60 * 1000)) * (30 * 60 * 1000)).toISOString(),
          status: 'scheduled'
        }
      }
    };

    // Check database connectivity
    try {
      const { error: dbTest } = await supabase
        .from('identified_companies')
        .select('id')
        .limit(1);
      
      metrics.database.status = dbTest ? 'error' : 'connected';
    } catch {
      metrics.database.status = 'disconnected';
    }

    // Get company counts
    const { count: companiesCount } = await supabase
      .from('identified_companies')
      .select('*', { count: 'exact', head: true });
    
    const { count: tierOneCount } = await supabase
      .from('tier_one_companies')
      .select('*', { count: 'exact', head: true });
    
    const { count: jobsCount } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true });
    
    const { count: unprocessedCount } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('processed', false);

    metrics.database.companies = companiesCount || 0;
    metrics.database.tierOne = tierOneCount || 0;
    metrics.database.jobs = jobsCount || 0;
    metrics.database.unprocessedJobs = unprocessedCount || 0;

    // Check search terms status
    const { data: searchTerms, count: termsCount } = await supabase
      .from('search_terms')
      .select('*', { count: 'exact' });
    
    metrics.scraping.searchTerms = termsCount || 0;

    // Check for overdue search terms (not scraped in last week)
    if (searchTerms && searchTerms.length > 0) {
      const overdueTerms = searchTerms.filter(term => {
        if (!term.last_scraped_date) return true;
        return new Date(term.last_scraped_date) < oneWeekAgo;
      });
      metrics.scraping.overdueTerms = overdueTerms.length;
      
      // Find most recent scrape
      const sortedTerms = searchTerms
        .filter(t => t.last_scraped_date)
        .sort((a, b) => new Date(b.last_scraped_date).getTime() - new Date(a.last_scraped_date).getTime());
      
      if (sortedTerms.length > 0) {
        metrics.scraping.lastScrapedDate = sortedTerms[0].last_scraped_date;
      }
    }

    // Check recent scrapes
    const { count: recentScrapes } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true })
      .gte('scraped_date', oneHourAgo.toISOString());
    
    metrics.scraping.recentScrapes = recentScrapes || 0;

    // Check processing activity
    const { count: processedToday } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('processed', true)
      .gte('analyzed_date', oneDayAgo.toISOString());
    
    metrics.processing.processedToday = processedToday || 0;

    // Check recent tools detected
    const { count: toolsDetected } = await supabase
      .from('identified_companies')
      .select('*', { count: 'exact', head: true })
      .gte('identified_date', oneDayAgo.toISOString());
    
    metrics.processing.toolsDetected = toolsDetected || 0;

    // Determine overall status
    const overallStatus = {
      health: 'unknown',
      alerts: [],
      recommendations: []
    };

    // Check for issues
    if (metrics.database.status !== 'connected') {
      overallStatus.health = 'critical';
      overallStatus.alerts.push({
        level: 'critical',
        message: 'Database connection failed'
      });
    } else if (metrics.database.unprocessedJobs > 5000) {
      overallStatus.health = 'degraded';
      overallStatus.alerts.push({
        level: 'warning',
        message: `Large backlog: ${metrics.database.unprocessedJobs} unprocessed jobs`
      });
    } else if (metrics.scraping.overdueTerms > 10) {
      overallStatus.health = 'degraded';
      overallStatus.alerts.push({
        level: 'warning',
        message: `${metrics.scraping.overdueTerms} search terms overdue for scraping`
      });
    } else {
      overallStatus.health = 'healthy';
    }

    // Add recommendations
    if (metrics.scraping.searchTerms === 0) {
      overallStatus.recommendations.push('No search terms configured. Run: node scripts/populate-search-terms.js');
    }
    
    if (!process.env.APIFY_TOKEN) {
      overallStatus.recommendations.push('APIFY_TOKEN not configured - scraping will fail');
    }
    
    if (!process.env.CRON_SECRET) {
      overallStatus.recommendations.push('CRON_SECRET not configured - cron endpoints are unsecured');
    }

    // Calculate processing rates
    const processingRates = {
      scrapingCapacity: '500 jobs per search term per hour',
      analyzerCapacity: '100 jobs per 5 minutes (28,800/day)',
      currentBacklogClearTime: metrics.database.unprocessedJobs > 0 
        ? `${Math.ceil(metrics.database.unprocessedJobs / 100) * 5} minutes`
        : 'No backlog'
    };

    return NextResponse.json({
      timestamp: now.toISOString(),
      status: overallStatus,
      metrics,
      processingRates,
      environment: {
        hasSupabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasOpenAI: !!process.env.OPENAI_API_KEY,
        hasApify: !!process.env.APIFY_TOKEN,
        hasCronSecret: !!process.env.CRON_SECRET,
        isProduction: process.env.NODE_ENV === 'production'
      }
    });

  } catch (error) {
    console.error('Automation status error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get automation status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}