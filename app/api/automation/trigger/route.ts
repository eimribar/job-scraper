import { NextResponse } from 'next/server';
import { WeeklyScraperService } from '@/lib/services/weeklyScraperService';
import { ContinuousAnalyzerService } from '@/lib/services/continuousAnalyzerService';

// Manual trigger endpoint for testing automation
export async function POST(request: Request) {
  try {
    // Check authorization
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';
    
    switch (action) {
      case 'scrape': {
        // Manually trigger scraping
        const scraper = new WeeklyScraperService();
        
        // Check if already running
        const status = scraper.getStatus();
        if (status.isRunning) {
          return NextResponse.json({
            success: false,
            message: 'Scraper already running',
            status
          });
        }
        
        // Process one search term
        const result = await scraper.processOneSearchTerm();
        
        return NextResponse.json({
          success: result.success,
          action: 'scrape',
          result: {
            termProcessed: result.termProcessed,
            jobsScraped: result.jobsScraped,
            newJobsAdded: result.newJobsAdded,
            remainingOverdueTerms: result.remainingOverdueTerms,
            error: result.error
          }
        });
      }
      
      case 'analyze': {
        // Manually trigger analysis
        const analyzer = new ContinuousAnalyzerService();
        
        // Check if already running
        const status = analyzer.getStatus();
        if (status.isRunning) {
          return NextResponse.json({
            success: false,
            message: 'Analyzer already running',
            status
          });
        }
        
        // Process batch of jobs
        const batchSize = parseInt(searchParams.get('batch') || '10');
        const result = await analyzer.processBatch(batchSize);
        
        return NextResponse.json({
          success: result.success,
          action: 'analyze',
          result: {
            jobsProcessed: result.jobsProcessed,
            toolsDetected: result.toolsDetected,
            errors: result.errors,
            remainingUnprocessed: result.remainingUnprocessed,
            error: result.error
          }
        });
      }
      
      case 'test': {
        // Test all components
        const tests = {
          database: false,
          scraper: false,
          analyzer: false,
          openai: false,
          apify: false
        };
        
        // Test database
        try {
          const { createApiSupabaseClient } = await import('@/lib/supabase');
          const supabase = createApiSupabaseClient();
          if (supabase) {
            const { error } = await supabase.from('raw_jobs').select('id').limit(1);
            tests.database = !error;
          }
        } catch (e) {
          tests.database = false;
        }
        
        // Test OpenAI
        tests.openai = !!process.env.OPENAI_API_KEY;
        
        // Test Apify
        tests.apify = !!process.env.APIFY_TOKEN;
        
        // Test scraper initialization
        try {
          const scraper = new WeeklyScraperService();
          tests.scraper = !!scraper;
        } catch (e) {
          tests.scraper = false;
        }
        
        // Test analyzer initialization
        try {
          const analyzer = new ContinuousAnalyzerService();
          tests.analyzer = !!analyzer;
        } catch (e) {
          tests.analyzer = false;
        }
        
        const allPassed = Object.values(tests).every(t => t === true);
        
        return NextResponse.json({
          success: allPassed,
          action: 'test',
          tests,
          recommendations: {
            database: tests.database ? 'Connected' : 'Check Supabase configuration',
            scraper: tests.scraper ? 'Ready' : 'Check WeeklyScraperService',
            analyzer: tests.analyzer ? 'Ready' : 'Check ContinuousAnalyzerService',
            openai: tests.openai ? 'Configured' : 'Add OPENAI_API_KEY to environment',
            apify: tests.apify ? 'Configured' : 'Add APIFY_TOKEN to environment'
          }
        });
      }
      
      default: {
        // Return status
        const scraper = new WeeklyScraperService();
        const analyzer = new ContinuousAnalyzerService();
        
        return NextResponse.json({
          success: true,
          action: 'status',
          services: {
            scraper: scraper.getStatus(),
            analyzer: analyzer.getStatus()
          },
          availableActions: [
            'status - Get current status',
            'test - Test all components',
            'scrape - Process one search term',
            'analyze - Process batch of jobs (add ?batch=N)'
          ]
        });
      }
    }
    
  } catch (error) {
    console.error('Automation trigger error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to trigger automation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET endpoint for viewing status
export async function GET() {
  return NextResponse.json({
    message: 'Automation trigger endpoint',
    usage: 'POST /api/automation/trigger?action=[status|test|scrape|analyze]',
    actions: {
      status: 'Get current automation status',
      test: 'Test all automation components',
      scrape: 'Manually trigger scraping of one search term',
      analyze: 'Manually trigger analysis batch (add ?batch=N for custom size)'
    },
    authentication: 'Include Bearer token with CRON_SECRET value',
    example: 'curl -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" /api/automation/trigger?action=test'
  });
}