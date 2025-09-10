/**
 * Unified Scraper API
 * Consolidates all scraping endpoints into one
 * 
 * GET  - Get scraping status
 * POST - Trigger scraping (with options)
 */

import { NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase';

const supabase = createApiSupabaseClient();

// GET - Scraper status and metrics
export async function GET() {
  try {
    // Get search terms status
    const { data: searchTerms, error: termsError } = await supabase
      .from('search_terms')
      .select('*')
      .eq('is_active', true)
      .order('last_scraped_date', { ascending: true, nullsFirst: true });
    
    if (termsError) throw termsError;
    
    // Get recent scraping runs
    const { data: recentRuns, error: runsError } = await supabase
      .from('scraping_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(10);
    
    if (runsError) throw runsError;
    
    // Calculate metrics
    const overdueTerms = searchTerms?.filter(term => {
      if (!term.last_scraped_date) return true;
      const lastScraped = new Date(term.last_scraped_date);
      const daysSince = (Date.now() - lastScraped.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince > 7;
    }) || [];
    
    const activeRuns = recentRuns?.filter(run => run.status === 'scraping') || [];
    
    return NextResponse.json({
      status: activeRuns.length > 0 ? 'scraping' : 'idle',
      metrics: {
        totalSearchTerms: searchTerms?.length || 0,
        overdueTerms: overdueTerms.length,
        activeRuns: activeRuns.length,
        lastRun: recentRuns?.[0] || null
      },
      searchTerms: overdueTerms.slice(0, 5).map(term => ({
        term: term.search_term,
        lastScraped: term.last_scraped_date,
        jobsFound: term.jobs_found_count
      })),
      schedule: {
        frequency: 'Hourly',
        nextRun: new Date(Math.ceil(Date.now() / (60 * 60 * 1000)) * (60 * 60 * 1000)).toISOString()
      }
    });
  } catch (error) {
    console.error('Scraper status error:', error);
    return NextResponse.json(
      { error: 'Failed to get scraper status' },
      { status: 500 }
    );
  }
}

// POST - Trigger scraping
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
    
    // Parse options
    const body = await request.json().catch(() => ({}));
    const searchTerm = body.searchTerm;
    const forceRefresh = body.forceRefresh || false;
    
    // Get next term to scrape
    let termToScrape;
    if (searchTerm) {
      // Specific term requested
      const { data, error } = await supabase
        .from('search_terms')
        .select('*')
        .eq('search_term', searchTerm)
        .single();
      
      if (error || !data) {
        return NextResponse.json(
          { error: `Search term not found: ${searchTerm}` },
          { status: 404 }
        );
      }
      termToScrape = data;
    } else {
      // Get next overdue term
      const { data: terms, error } = await supabase
        .from('search_terms')
        .select('*')
        .eq('is_active', true)
        .order('last_scraped_date', { ascending: true, nullsFirst: true })
        .limit(1);
      
      if (error || !terms || terms.length === 0) {
        return NextResponse.json({
          message: 'No search terms need scraping',
          nextCheck: new Date(Date.now() + 60 * 60 * 1000).toISOString()
        });
      }
      
      termToScrape = terms[0];
      
      // Check if it's actually due
      if (termToScrape.last_scraped_date && !forceRefresh) {
        const lastScraped = new Date(termToScrape.last_scraped_date);
        const daysSince = (Date.now() - lastScraped.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSince < 7) {
          return NextResponse.json({
            message: 'No terms overdue for scraping',
            nextTerm: termToScrape.search_term,
            nextDue: new Date(lastScraped.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
          });
        }
      }
    }
    
    // Create scraping run record
    const { data: run, error: runError } = await supabase
      .from('scraping_runs')
      .insert({
        search_term_id: termToScrape.id,
        search_term: termToScrape.search_term,
        status: 'scraping',
        started_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (runError) throw runError;
    
    // TODO: Trigger actual Apify scraping here
    // For now, just update the search term
    await supabase
      .from('search_terms')
      .update({
        last_scraped_date: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', termToScrape.id);
    
    // Update run status
    await supabase
      .from('scraping_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        jobs_scraped: 0, // TODO: Update with actual count
        metadata: { note: 'Apify integration pending' }
      })
      .eq('id', run.id);
    
    return NextResponse.json({
      success: true,
      message: `Scraping triggered for: ${termToScrape.search_term}`,
      run: {
        id: run.id,
        searchTerm: termToScrape.search_term,
        status: 'initiated'
      }
    });
    
  } catch (error) {
    console.error('Scraper trigger error:', error);
    return NextResponse.json(
      { error: 'Failed to trigger scraping' },
      { status: 500 }
    );
  }
}