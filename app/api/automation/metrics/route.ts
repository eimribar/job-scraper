import { NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');
    
    const supabase = createApiSupabaseClient();
    
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection not configured' },
        { status: 503 }
      );
    }

    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Get daily metrics
    const dailyMetrics = [];
    
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
      
      // Jobs scraped that day
      const { count: jobsScraped } = await supabase
        .from('raw_jobs')
        .select('*', { count: 'exact', head: true })
        .gte('scraped_date', date.toISOString())
        .lt('scraped_date', nextDate.toISOString());
      
      // Jobs analyzed that day
      const { count: jobsAnalyzed } = await supabase
        .from('raw_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('processed', true)
        .gte('analyzed_date', date.toISOString())
        .lt('analyzed_date', nextDate.toISOString());
      
      // Companies identified that day
      const { count: companiesIdentified } = await supabase
        .from('identified_companies')
        .select('*', { count: 'exact', head: true })
        .gte('identified_date', date.toISOString())
        .lt('identified_date', nextDate.toISOString());
      
      dailyMetrics.push({
        date: date.toISOString().split('T')[0],
        jobsScraped: jobsScraped || 0,
        jobsAnalyzed: jobsAnalyzed || 0,
        companiesIdentified: companiesIdentified || 0
      });
    }

    // Get tool distribution
    const { data: toolDistribution } = await supabase
      .from('identified_companies')
      .select('tool_detected');
    
    const toolCounts = {
      'Outreach.io': 0,
      'SalesLoft': 0,
      'Both': 0
    };
    
    if (toolDistribution) {
      toolDistribution.forEach(row => {
        if (toolCounts.hasOwnProperty(row.tool_detected)) {
          toolCounts[row.tool_detected]++;
        }
      });
    }

    // Get tier distribution
    const { data: tierDistribution } = await supabase
      .from('identified_companies')
      .select('tier');
    
    const tierCounts = {
      'Tier 1': 0,
      'Tier 2': 0,
      'Untiered': 0
    };
    
    if (tierDistribution) {
      tierDistribution.forEach(row => {
        if (row.tier) {
          tierCounts[row.tier] = (tierCounts[row.tier] || 0) + 1;
        } else {
          tierCounts['Untiered']++;
        }
      });
    }

    // Get processing efficiency
    const { data: recentJobs } = await supabase
      .from('raw_jobs')
      .select('scraped_date, analyzed_date')
      .eq('processed', true)
      .gte('analyzed_date', startDate.toISOString())
      .limit(1000);
    
    let totalProcessingTime = 0;
    let processedCount = 0;
    
    if (recentJobs) {
      recentJobs.forEach(job => {
        if (job.scraped_date && job.analyzed_date) {
          const scrapedTime = new Date(job.scraped_date).getTime();
          const analyzedTime = new Date(job.analyzed_date).getTime();
          const processingTime = analyzedTime - scrapedTime;
          
          if (processingTime > 0 && processingTime < 7 * 24 * 60 * 60 * 1000) { // Ignore if > 7 days
            totalProcessingTime += processingTime;
            processedCount++;
          }
        }
      });
    }
    
    const avgProcessingTime = processedCount > 0 
      ? Math.round(totalProcessingTime / processedCount / 1000 / 60) // Convert to minutes
      : 0;

    // Get success rates
    const { count: totalProcessed } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('processed', true)
      .gte('analyzed_date', startDate.toISOString());
    
    const { count: withErrors } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('processed', true)
      .not('error', 'is', null)
      .gte('analyzed_date', startDate.toISOString());
    
    const successRate = totalProcessed > 0 
      ? Math.round(((totalProcessed - (withErrors || 0)) / totalProcessed) * 100)
      : 100;

    // Get top companies by job postings
    const { data: topCompanies } = await supabase
      .from('raw_jobs')
      .select('company')
      .gte('scraped_date', startDate.toISOString());
    
    const companyJobCounts = {};
    if (topCompanies) {
      topCompanies.forEach(row => {
        companyJobCounts[row.company] = (companyJobCounts[row.company] || 0) + 1;
      });
    }
    
    const topCompaniesList = Object.entries(companyJobCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([company, count]) => ({ company, jobCount: count }));

    return NextResponse.json({
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: now.toISOString()
      },
      summary: {
        totalJobsScraped: dailyMetrics.reduce((sum, d) => sum + d.jobsScraped, 0),
        totalJobsAnalyzed: dailyMetrics.reduce((sum, d) => sum + d.jobsAnalyzed, 0),
        totalCompaniesIdentified: dailyMetrics.reduce((sum, d) => sum + d.companiesIdentified, 0),
        avgProcessingTimeMinutes: avgProcessingTime,
        successRate: `${successRate}%`
      },
      dailyMetrics,
      toolDistribution: toolCounts,
      tierDistribution: tierCounts,
      topCompaniesByJobs: topCompaniesList,
      performance: {
        avgJobsPerDay: Math.round(dailyMetrics.reduce((sum, d) => sum + d.jobsScraped, 0) / days),
        avgAnalyzedPerDay: Math.round(dailyMetrics.reduce((sum, d) => sum + d.jobsAnalyzed, 0) / days),
        avgCompaniesPerDay: Math.round(dailyMetrics.reduce((sum, d) => sum + d.companiesIdentified, 0) / days),
        processingSuccessRate: `${successRate}%`
      }
    });

  } catch (error) {
    console.error('Automation metrics error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get automation metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}