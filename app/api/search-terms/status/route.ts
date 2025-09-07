import { NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = createApiSupabaseClient();
    
    // Get all search terms ordered by urgency (oldest first)
    const { data: searchTerms, error } = await supabase
      .from('search_terms')
      .select('*')
      .eq('is_active', true)
      .order('last_scraped_date', { ascending: true, nullsFirst: true });

    if (error) {
      throw error;
    }

    // Categorize terms
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    
    const categorized = {
      neverScraped: [] as any[],
      needsScraping: [] as any[],
      recentlyScraped: [] as any[],
      nextToScrape: null as any
    };

    searchTerms?.forEach(term => {
      const lastScraped = term.last_scraped_date ? new Date(term.last_scraped_date).getTime() : null;
      const daysSinceScraped = lastScraped ? (now - lastScraped) / (1000 * 60 * 60 * 24) : null;
      
      const termWithDays = {
        ...term,
        days_since_scraped: daysSinceScraped ? Math.floor(daysSinceScraped) : null
      };

      if (!lastScraped) {
        categorized.neverScraped.push(termWithDays);
      } else if (now - lastScraped > sevenDaysMs) {
        categorized.needsScraping.push(termWithDays);
      } else {
        categorized.recentlyScraped.push(termWithDays);
      }
    });

    // Determine next term to scrape
    if (categorized.neverScraped.length > 0) {
      categorized.nextToScrape = categorized.neverScraped[0];
    } else if (categorized.needsScraping.length > 0) {
      categorized.nextToScrape = categorized.needsScraping[0];
    }

    // Get recent scraping runs
    const { data: recentRuns } = await supabase
      .from('scraping_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(5);

    // Get recent notifications
    const { data: recentNotifications } = await supabase
      .from('notifications')
      .select('*')
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      success: true,
      summary: {
        total: searchTerms?.length || 0,
        neverScraped: categorized.neverScraped.length,
        needsScraping: categorized.needsScraping.length,
        recentlyScraped: categorized.recentlyScraped.length,
        requiresAction: categorized.neverScraped.length + categorized.needsScraping.length
      },
      nextToScrape: categorized.nextToScrape,
      categorized,
      recentRuns: recentRuns || [],
      unreadNotifications: recentNotifications || [],
      automationReady: false, // Will be true when Apify token is added
      message: categorized.nextToScrape 
        ? `Next to scrape: "${categorized.nextToScrape.search_term}" (${categorized.nextToScrape.days_since_scraped || 'never'} days old)`
        : 'All search terms are up to date!'
    });
  } catch (error: any) {
    console.error('Error getting search terms status:', error);
    return NextResponse.json(
      { error: 'Failed to get search terms status', details: error.message },
      { status: 500 }
    );
  }
}