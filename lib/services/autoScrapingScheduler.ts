/**
 * Automatic Scraping Scheduler
 * Monitors search_terms table and automatically triggers scraping for terms older than 7 days
 */

import { createApiSupabaseClient } from '../supabase';
import { JobProcessor } from './jobProcessor';

export interface SearchTermToScrape {
  id: number;
  search_term: string;
  last_scraped_date: Date | null;
  days_since_scraped: number;
}

export interface ScrapingRun {
  id: number;
  search_term: string;
  status: 'pending' | 'scraping' | 'analyzing' | 'completed' | 'failed';
  started_at: Date;
  completed_at?: Date;
  jobs_scraped: number;
  jobs_analyzed: number;
  new_companies_found: number;
}

export class AutoScrapingScheduler {
  private isRunning: boolean = false;
  private currentRun: ScrapingRun | null = null;
  private checkInterval: NodeJS.Timeout | null = null;
  private supabase: any;
  private jobProcessor: JobProcessor;

  constructor() {
    this.supabase = createApiSupabaseClient();
    this.jobProcessor = new JobProcessor();
  }

  /**
   * Start the automatic scheduler
   * Checks every 5 minutes for terms that need scraping
   */
  start(intervalMinutes: number = 5) {
    if (this.isRunning) {
      console.log('⚠️ Auto-scraping scheduler is already running');
      return;
    }

    console.log(`🚀 Starting auto-scraping scheduler (checking every ${intervalMinutes} minutes)`);
    this.isRunning = true;

    // Check immediately
    this.checkAndScrape();

    // Then check periodically
    this.checkInterval = setInterval(() => {
      this.checkAndScrape();
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Stop the automatic scheduler
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    console.log('🛑 Auto-scraping scheduler stopped');
  }

  /**
   * Check for terms that need scraping and process them
   */
  private async checkAndScrape() {
    try {
      // Don't start a new run if one is already in progress
      if (this.currentRun && this.currentRun.status !== 'completed' && this.currentRun.status !== 'failed') {
        console.log('⏳ Scraping already in progress, skipping check');
        return;
      }

      // Get the next term that needs scraping
      const termToScrape = await this.getNextTermToScrape();
      
      if (!termToScrape) {
        console.log('✅ All search terms are up to date (scraped within last 7 days)');
        return;
      }

      console.log(`\n🎯 Found term that needs scraping: "${termToScrape.search_term}"`);
      console.log(`   Last scraped: ${termToScrape.last_scraped_date || 'Never'}`);
      console.log(`   Days since scraped: ${termToScrape.days_since_scraped || 'N/A'}`);

      // Start scraping this term
      await this.scrapeSearchTerm(termToScrape);

    } catch (error) {
      console.error('❌ Error in auto-scraping check:', error);
    }
  }

  /**
   * Get the next search term that needs scraping (older than 7 days)
   */
  private async getNextTermToScrape(): Promise<SearchTermToScrape | null> {
    // First try using the database function
    const { data: functionResult, error: functionError } = await this.supabase
      .rpc('get_next_search_term_to_scrape');

    if (!functionError && functionResult && functionResult.length > 0) {
      const term = functionResult[0];
      return {
        id: term.id,
        search_term: term.search_term,
        last_scraped_date: term.last_scraped_date,
        days_since_scraped: term.days_since_scraped || 999999
      };
    }

    // Fallback to manual query if function doesn't exist
    const { data, error } = await this.supabase
      .from('search_terms')
      .select('*')
      .eq('is_active', true)
      .order('last_scraped_date', { ascending: true, nullsFirst: true })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    // Calculate days since last scraped
    const daysSinceScraped = data.last_scraped_date
      ? (Date.now() - new Date(data.last_scraped_date).getTime()) / (1000 * 60 * 60 * 24)
      : 999999; // Use large number for never-scraped terms

    // Only return if it needs scraping (>7 days old or never scraped)
    if (daysSinceScraped > 7 || !data.last_scraped_date) {
      return {
        id: data.id,
        search_term: data.search_term,
        last_scraped_date: data.last_scraped_date,
        days_since_scraped: daysSinceScraped
      };
    }

    return null;
  }

  /**
   * Scrape and analyze jobs for a specific search term
   */
  private async scrapeSearchTerm(term: SearchTermToScrape) {
    const startTime = Date.now();

    try {
      // Create a scraping run record
      const { data: run, error: runError } = await this.supabase
        .from('scraping_runs')
        .insert({
          search_term_id: term.id,
          search_term: term.search_term,
          status: 'scraping',
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (runError || !run) {
        throw new Error('Failed to create scraping run record');
      }

      this.currentRun = run;

      // Send notification that scraping started
      await this.createNotification(
        'scraping_started',
        `Started scraping: ${term.search_term}`,
        `Automatic weekly scraping initiated for "${term.search_term}"`
      );

      // Use JobProcessor to scrape and analyze
      console.log(`\n📡 Starting scraping for: "${term.search_term}"`);
      
      const result = await this.jobProcessor.processSearchTerm(
        term.search_term,
        500 // Max jobs to scrape
      );

      // Update the search term's last scraped date
      await this.supabase
        .from('search_terms')
        .update({
          last_scraped_date: new Date().toISOString(),
          jobs_found_count: result.jobsScraped,
          total_jobs_analyzed: result.jobsAnalyzed,
          total_companies_found: result.companiesFound,
          outreach_companies_found: result.outreachCompanies,
          salesloft_companies_found: result.salesloftCompanies
        })
        .eq('id', term.id);

      // Update the scraping run record
      const processingTime = Math.round((Date.now() - startTime) / 1000);
      await this.supabase
        .from('scraping_runs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          jobs_scraped: result.jobsScraped,
          jobs_analyzed: result.jobsAnalyzed,
          new_companies_found: result.companiesFound,
          outreach_companies: result.outreachCompanies,
          salesloft_companies: result.salesloftCompanies,
          processing_time_seconds: processingTime
        })
        .eq('id', run.id);

      // Send completion notification
      await this.createNotification(
        'scraping_complete',
        `Completed: ${term.search_term}`,
        `Scraped ${result.jobsScraped} jobs (${result.jobsSaved} new, ${result.duplicates || 0} duplicates). ${result.companiesFound > 0 ? `Found ${result.companiesFound} companies using sales tools` : 'Ready for analysis'}`,
        {
          search_term: term.search_term,
          jobs_scraped: result.jobsScraped,
          companies_found: result.companiesFound,
          processing_time: processingTime
        }
      );

      console.log(`\n✅ Completed scraping "${term.search_term}"`);
      console.log(`   Jobs scraped: ${result.jobsScraped}`);
      console.log(`   Companies found: ${result.companiesFound}`);
      console.log(`   Processing time: ${processingTime} seconds`);

      this.currentRun = null;

    } catch (error: any) {
      console.error(`❌ Error scraping "${term.search_term}":`, error.message);

      // Update scraping run as failed
      if (this.currentRun) {
        await this.supabase
          .from('scraping_runs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: error.message,
            processing_time_seconds: Math.round((Date.now() - startTime) / 1000)
          })
          .eq('id', this.currentRun.id);
      }

      // Update search term with error
      await this.supabase
        .from('search_terms')
        .update({
          last_error: error.message
        })
        .eq('id', term.id);

      // Send error notification
      await this.createNotification(
        'error',
        `Scraping failed: ${term.search_term}`,
        error.message
      );

      this.currentRun = null;
    }
  }

  /**
   * Create a notification
   */
  private async createNotification(
    type: string,
    title: string,
    message: string,
    metadata?: any
  ) {
    try {
      await this.supabase
        .from('notifications')
        .insert({
          type,
          title,
          message,
          metadata: metadata || {}
        });
    } catch (error) {
      console.error('Failed to create notification:', error);
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      currentRun: this.currentRun
    };
  }

  /**
   * Get scraping statistics
   */
  async getStatistics() {
    // Get terms that need scraping
    const { data: needsScraping } = await this.supabase
      .from('search_terms')
      .select('*')
      .eq('is_active', true)
      .or('last_scraped_date.is.null,last_scraped_date.lt.' + new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    // Get recent runs
    const { data: recentRuns } = await this.supabase
      .from('scraping_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(10);

    // Get total statistics
    const { data: totals } = await this.supabase
      .from('search_terms')
      .select('total_jobs_analyzed, total_companies_found, outreach_companies_found, salesloft_companies_found');

    const totalStats = totals?.reduce((acc: any, term: any) => ({
      jobs: acc.jobs + (term.total_jobs_analyzed || 0),
      companies: acc.companies + (term.total_companies_found || 0),
      outreach: acc.outreach + (term.outreach_companies_found || 0),
      salesloft: acc.salesloft + (term.salesloft_companies_found || 0)
    }), { jobs: 0, companies: 0, outreach: 0, salesloft: 0 });

    return {
      needsScraping: needsScraping?.length || 0,
      recentRuns: recentRuns || [],
      totalStats
    };
  }
}

// Create singleton instance
let schedulerInstance: AutoScrapingScheduler | null = null;

export function getAutoScheduler(): AutoScrapingScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new AutoScrapingScheduler();
  }
  return schedulerInstance;
}