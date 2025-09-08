import { createApiSupabaseClient } from '../supabase';
import { ApifyClient } from 'apify-client';
import { createHash } from 'crypto';

export class WeeklyScraperService {
  private supabase;
  private apifyClient;
  private stats = {
    startTime: new Date(),
    totalScrapes: 0,
    totalJobsFound: 0,
    isRunning: false
  };

  constructor() {
    this.supabase = createApiSupabaseClient();
    this.apifyClient = new ApifyClient({
      token: process.env.APIFY_TOKEN,
    });
  }

  async checkIfTimeForWeeklyScrape(): Promise<boolean> {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const { data: lastScrape } = await this.supabase
      .from('search_terms')
      .select('term, last_scraped_date')
      .not('last_scraped_date', 'is', null)
      .order('last_scraped_date', { ascending: true })
      .limit(1);
    
    if (!lastScrape || lastScrape.length === 0) {
      console.log('🎯 No previous scrapes found - running first weekly scrape');
      return true;
    }
    
    const lastScrapeDate = new Date(lastScrape[0].last_scraped_date);
    const daysSinceOldest = Math.round((Date.now() - lastScrapeDate) / (1000 * 60 * 60 * 24));
    
    if (lastScrapeDate < oneWeekAgo) {
      console.log(`🎯 Oldest scrape was ${daysSinceOldest} days ago - time for weekly scrape`);
      return true;
    }
    
    console.log(`⏳ Not time yet - oldest scrape was only ${daysSinceOldest} days ago`);
    return false;
  }

  async scrapeLinkedInJobs(searchTerm: string, maxItems = 500, retries = 3): Promise<any[]> {
    console.log(`🕷️ Scraping LinkedIn for: "${searchTerm}" (max ${maxItems} jobs)`);
    
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`  Attempt ${attempt}/${retries}...`);
        
        const run = await this.apifyClient.actor('bebity~linkedin-jobs-scraper').call({
          proxy: {
            useApifyProxy: true,
            apifyProxyGroups: [],
          },
          rows: maxItems,
          title: searchTerm,
        });

        const { items } = await this.apifyClient.dataset(run.defaultDatasetId).listItems();
        
        console.log(`  ✅ Successfully scraped ${items.length} jobs on attempt ${attempt}`);
        
        return items.map((item: any) => {
          let jobId;
          
          if (item.id) {
            jobId = `linkedin_${item.id}`;
          } else {
            const company = (item.companyName || 'unknown').trim();
            const title = (item.title || 'unknown').trim();
            const location = (item.location || 'unknown').trim();
            
            const signature = `${company}|${title}|${location}|${item.jobUrl || ''}`;
            const hash = createHash('md5').update(signature).digest('hex');
            jobId = `linkedin_gen_${hash.substring(0, 12)}`;
          }
          
          return {
            job_id: jobId,
            platform: 'LinkedIn',
            company: item.companyName || '',
            job_title: item.title || '',
            location: item.location || '',
            description: item.description || '',
            job_url: item.jobUrl || '',
            scraped_date: new Date().toISOString(),
            search_term: searchTerm,
          };
        });
        
      } catch (error: any) {
        lastError = error;
        console.error(`  ❌ Attempt ${attempt} failed:`, error.message);
        
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`  ⏳ Retrying in ${delay/1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // If we get here, all retries failed
    throw new Error(`Failed to scrape after ${retries} attempts. Last error: ${lastError?.message}`);
  }

  async saveJobsToDatabase(jobs: any[], searchTerm: string): Promise<{newJobs: number, duplicates: number}> {
    if (jobs.length === 0) {
      console.log('  No jobs to save');
      return { newJobs: 0, duplicates: 0 };
    }

    console.log(`  💾 Saving ${jobs.length} jobs to raw_jobs table...`);
    
    // Check for existing jobs
    const existingJobIds = new Set();
    const { data: existingJobs } = await this.supabase
      .from('raw_jobs')
      .select('job_id')
      .in('job_id', jobs.map(j => j.job_id));
    
    if (existingJobs) {
      existingJobs.forEach(job => existingJobIds.add(job.job_id));
    }
    
    const newJobs = jobs.filter(job => !existingJobIds.has(job.job_id));
    const duplicates = jobs.length - newJobs.length;
    
    console.log(`  📊 ${newJobs.length} new jobs, ${duplicates} duplicates`);
    
    if (newJobs.length > 0) {
      const { error } = await this.supabase
        .from('raw_jobs')
        .insert(newJobs.map(job => ({
          ...job,
          processed: false
        })));

      if (error) {
        console.error('  ❌ Error saving jobs:', error.message);
        throw error;
      }
      
      console.log(`  ✅ Successfully saved ${newJobs.length} new jobs to database`);
    }
    
    return { newJobs: newJobs.length, duplicates };
  }

  async scrapeSearchTerm(searchTerm: string): Promise<any> {
    console.log(`\n[SCRAPING] "${searchTerm}"`);
    console.log('─'.repeat(50));
    
    try {
      const jobs = await this.scrapeLinkedInJobs(searchTerm, 500);
      console.log(`  🔍 Scraped ${jobs.length} jobs from LinkedIn`);
      
      const results = await this.saveJobsToDatabase(jobs, searchTerm);
      
      // Update search term status
      const { error: updateError } = await this.supabase
        .from('search_terms')
        .update({
          last_scraped_date: new Date().toISOString(),
          jobs_found_count: jobs.length,
        })
        .eq('search_term', searchTerm);
      
      if (updateError) {
        console.error('  ❌ Failed to update search term status:', updateError.message);
      }
      
      console.log(`  ✅ Scraping complete: ${results.newJobs} new, ${results.duplicates} duplicates`);
      
      this.stats.totalScrapes++;
      this.stats.totalJobsFound += results.newJobs;
      
      return { 
        success: true, 
        totalScraped: jobs.length, 
        newJobs: results.newJobs,
        duplicates: results.duplicates 
      };
      
    } catch (error: any) {
      console.log(`  ❌ Scraping failed: ${error.message}`);
      return { 
        success: false, 
        error: error.message,
        totalScraped: 0,
        newJobs: 0 
      };
    }
  }

  async runWeeklyScrape(): Promise<any> {
    if (this.stats.isRunning) {
      throw new Error('Weekly scrape is already running');
    }

    console.log('🚀 STARTING WEEKLY SCRAPE');
    console.log('='.repeat(60));
    
    this.stats.isRunning = true;
    
    try {
      // Get all active search terms
      const { data: searchTerms } = await this.supabase
        .from('search_terms')
        .select('search_term')
        .eq('is_active', true)
        .order('search_term');
      
      if (!searchTerms || searchTerms.length === 0) {
        console.log('❌ No active search terms found');
        return { success: false, error: 'No active search terms' };
      }
      
      console.log(`📋 Found ${searchTerms.length} active search terms to scrape\n`);
      
      const results = {
        success: 0,
        failed: 0,
        totalJobs: 0,
        totalNew: 0
      };
      
      // Process each search term
      for (let i = 0; i < searchTerms.length; i++) {
        const term = searchTerms[i];
        console.log(`[${i+1}/${searchTerms.length}] Processing: "${term.search_term}"`);
        
        const result = await this.scrapeSearchTerm(term.search_term);
        
        if (result.success) {
          results.success++;
          results.totalJobs += result.totalScraped;
          results.totalNew += result.newJobs;
        } else {
          results.failed++;
        }
        
        // Wait 10 seconds between terms to avoid rate limits
        if (i < searchTerms.length - 1) {
          console.log('  ⏳ Waiting 10 seconds...');
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      }
      
      console.log('\n' + '='.repeat(60));
      console.log('📊 WEEKLY SCRAPE COMPLETE');
      console.log('='.repeat(60));
      console.log(`✅ Successful: ${results.success}/${searchTerms.length}`);
      console.log(`❌ Failed: ${results.failed}/${searchTerms.length}`);
      console.log(`📈 Total jobs scraped: ${results.totalJobs}`);
      console.log(`🆕 New jobs added: ${results.totalNew}`);
      
      return {
        success: true,
        results,
        duration: Date.now() - this.stats.startTime.getTime()
      };
      
    } finally {
      this.stats.isRunning = false;
    }
  }

  async processOneSearchTerm(): Promise<any> {
    console.log('🎯 PROCESSING ONE SEARCH TERM (Hourly Cron)');
    console.log('='.repeat(60));
    
    // Get the oldest search term that needs updating (>7 days old or never scraped)
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const { data: overdueTerms, error } = await this.supabase
      .from('search_terms')
      .select('search_term, last_scraped_date')
      .eq('is_active', true)
      .or(`last_scraped_date.is.null,last_scraped_date.lt.${oneWeekAgo.toISOString()}`)
      .order('last_scraped_date', { ascending: true, nullsFirst: true })
      .limit(1);
    
    if (error) {
      console.error('❌ Error fetching overdue terms:', error);
      throw error;
    }
    
    if (!overdueTerms || overdueTerms.length === 0) {
      console.log('✅ All search terms are up to date! No scraping needed.');
      return {
        success: true,
        message: 'All search terms are up to date',
        termsProcessed: 0
      };
    }
    
    const termToProcess = overdueTerms[0];
    const daysSinceLastScrape = termToProcess.last_scraped_date 
      ? Math.round((Date.now() - new Date(termToProcess.last_scraped_date).getTime()) / (1000 * 60 * 60 * 24))
      : 'Never';
    
    console.log(`📌 Selected term: "${termToProcess.search_term}"`);
    console.log(`   Last scraped: ${daysSinceLastScrape === 'Never' ? 'Never' : `${daysSinceLastScrape} days ago`}`);
    console.log('');
    
    // Process this single search term
    try {
      const result = await this.scrapeSearchTerm(termToProcess.search_term);
      
      if (result.success) {
        console.log('\n✅ HOURLY SCRAPING COMPLETE');
        console.log(`   Term processed: "${termToProcess.search_term}"`);
        console.log(`   Jobs scraped: ${result.totalScraped}`);
        console.log(`   New jobs added: ${result.newJobs}`);
        console.log(`   Duplicates found: ${result.duplicates}`);
        
        // Check how many terms still need processing
        const { count: remainingTerms } = await this.supabase
          .from('search_terms')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true)
          .or(`last_scraped_date.is.null,last_scraped_date.lt.${oneWeekAgo.toISOString()}`);
        
        console.log(`   Remaining overdue terms: ${remainingTerms || 0}`);
        
        return {
          success: true,
          termProcessed: termToProcess.search_term,
          jobsScraped: result.totalScraped,
          newJobsAdded: result.newJobs,
          remainingOverdueTerms: remainingTerms || 0
        };
      } else {
        throw new Error(result.error || 'Scraping failed');
      }
      
    } catch (error: any) {
      console.error(`❌ Failed to process term "${termToProcess.search_term}":`, error.message);
      return {
        success: false,
        termProcessed: termToProcess.search_term,
        error: error.message
      };
    }
  }

  getStatus() {
    return {
      isRunning: this.stats.isRunning,
      totalScrapes: this.stats.totalScrapes,
      totalJobsFound: this.stats.totalJobsFound,
      startTime: this.stats.startTime
    };
  }
}