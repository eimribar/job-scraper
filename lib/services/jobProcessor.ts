import { ScraperService } from './scraperService';
import { AnalysisService } from './analysisService';
import { DataService } from './dataService';
import { GPT5AnalysisService } from './gpt5AnalysisService';

export interface ProcessingStats {
  searchTerm: string;
  totalScraped: number;
  newJobs: number;
  analyzed: number;
  failed: number;
  startTime: Date;
  endTime?: Date;
  // Additional fields for autoScrapingScheduler compatibility
  jobsScraped?: number;
  jobsAnalyzed?: number;
  companiesFound?: number;
  outreachCompanies?: number;
  salesloftCompanies?: number;
}

export class JobProcessor {
  private scraperService: ScraperService;
  private analysisService: AnalysisService;
  private dataService: DataService;
  private gpt5Service: GPT5AnalysisService;
  private isProcessing: boolean = false;
  private currentStats: ProcessingStats | null = null;

  constructor() {
    this.scraperService = new ScraperService();
    this.analysisService = new AnalysisService();
    this.dataService = new DataService();
    this.gpt5Service = new GPT5AnalysisService();
  }

  /**
   * Process a single search term - scrape, deduplicate, analyze sequentially
   */
  async processSearchTerm(searchTerm: string, maxItems: number = 500): Promise<ProcessingStats> {
    if (this.isProcessing) {
      throw new Error('Already processing. Please wait for current job to complete.');
    }

    this.isProcessing = true;
    
    const stats: ProcessingStats = {
      searchTerm,
      totalScraped: 0,
      newJobs: 0,
      analyzed: 0,
      failed: 0,
      startTime: new Date()
    };

    this.currentStats = stats;

    try {
      console.log(`\n🔍 Starting processing for search term: "${searchTerm}"`);
      console.log(`⏰ Start time: ${stats.startTime.toISOString()}`);

      // Step 1: Scrape jobs from LinkedIn
      console.log(`📥 Scraping jobs from LinkedIn (max ${maxItems})...`);
      const scrapedJobs = await this.scraperService.scrapeJobs(searchTerm, maxItems);
      stats.totalScraped = scrapedJobs.length;
      console.log(`✅ Scraped ${stats.totalScraped} jobs`);
      
      // Debug: Log first 3 scraped jobs
      console.log('\n📋 Sample of scraped jobs:');
      scrapedJobs.slice(0, 3).forEach((job, idx) => {
        console.log(`  Job ${idx + 1}:`);
        console.log(`    ID: ${job.job_id}`);
        console.log(`    Company: ${job.company}`);
        console.log(`    Title: ${job.job_title}`);
      });

      // Step 2: Check each job ID against database (deduplication)
      console.log('\n🔍 Checking for new jobs (deduplication)...');
      console.log(`  Total jobs to check: ${scrapedJobs.length}`);
      const newJobs = [];
      const duplicateJobs = [];
      
      let checkCount = 0;
      for (const job of scrapedJobs) {
        checkCount++;
        if (checkCount <= 5 || checkCount % 50 === 0) {
          console.log(`\n  [${checkCount}/${scrapedJobs.length}] Checking: ${job.job_id}`);
          console.log(`    Company: ${job.company}`);
          console.log(`    Title: ${job.job_title}`);
        }
        
        const exists = await this.dataService.jobExists(job.job_id);
        
        if (!exists) {
          newJobs.push(job);
          if (checkCount <= 5) {
            console.log(`    ✅ NEW job will be saved`);
          }
        } else {
          duplicateJobs.push(job);
          if (checkCount <= 5) {
            console.log(`    ⏭️  DUPLICATE (already in DB)`);
          }
        }
      }
      
      stats.newJobs = newJobs.length;
      console.log(`📊 Found ${stats.newJobs} new jobs (${duplicateJobs.length} duplicates)`);
      if (duplicateJobs.length > 0) {
        console.log(`  Sample duplicates: ${duplicateJobs.slice(0, 3).map(j => j.company).join(', ')}`);
      }

      // Step 3: Save all NEW jobs marked as ready for analysis
      if (stats.newJobs > 0) {
        console.log('💾 Saving jobs to database...');
        
        try {
          // Save all new jobs in batches
          const batchSize = 50;
          for (let i = 0; i < newJobs.length; i += batchSize) {
            const batch = newJobs.slice(i, i + batchSize);
            await this.dataService.saveJobsReadyForAnalysis(batch);
            console.log(`  ✅ Saved batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(newJobs.length/batchSize)} (${batch.length} jobs)`);
            
            // Small delay between batches
            if (i + batchSize < newJobs.length) {
              await this.delay(100);
            }
          }
          
          console.log(`📊 Successfully saved ${newJobs.length} jobs to database`);
          
        } catch (saveError) {
          console.error('❌ Failed to save jobs:', saveError);
          stats.failed = newJobs.length;
          throw saveError;
        }
        
        // Step 4: Analyze jobs with GPT-5
        console.log('\n🔬 Starting GPT-5 analysis of jobs...');
        
        // Create notification for analysis start
        await this.createNotification(
          'analysis_started',
          `Analyzing ${newJobs.length} jobs`,
          `Starting GPT-5 analysis for "${searchTerm}"`,
          { search_term: searchTerm, jobs_count: newJobs.length }
        );
        
        let companiesFound = 0;
        let outreachCount = 0;
        let salesloftCount = 0;
        let bothCount = 0;
        let jobsAnalyzed = 0;
        
        for (const job of newJobs) {
          try {
            process.stdout.write(`  [${jobsAnalyzed + 1}/${newJobs.length}] Analyzing ${job.company}... `);
            
            // Analyze job with GPT-5
            const analysis = await this.gpt5Service.analyzeJob(job);
            
            // If tool detected, save to identified_companies
            if (analysis.uses_tool && analysis.tool_detected !== 'none') {
              // Check if company already exists
              const existingCompanies = await this.dataService.getIdentifiedCompanies(1, 0, undefined, undefined, job.company);
              const exists = existingCompanies.some(c => 
                c.company?.toLowerCase() === job.company.toLowerCase() && 
                c.tool_detected === analysis.tool_detected
              );
              
              if (!exists) {
                await this.dataService.saveIdentifiedCompany({
                  job_id: job.job_id,
                  platform: job.platform,
                  company: job.company,
                  job_title: job.job_title,
                  location: job.location,
                  description: job.description,
                  job_url: job.job_url,
                  scraped_date: job.scraped_date,
                  search_term: job.search_term,
                  analysis: {
                    uses_tool: analysis.uses_tool,
                    tool_detected: analysis.tool_detected,
                    signal_type: analysis.signal_type,
                    context: analysis.context,
                    confidence: analysis.confidence
                  },
                  analysis_date: new Date().toISOString()
                });
                
                companiesFound++;
                if (analysis.tool_detected === 'Outreach.io') outreachCount++;
                else if (analysis.tool_detected === 'SalesLoft') salesloftCount++;
                else if (analysis.tool_detected === 'Both') {
                  bothCount++;
                  outreachCount++;
                  salesloftCount++;
                }
                
                console.log(`✅ Found ${analysis.tool_detected}`);
                
                // Create notification for company discovery
                await this.createNotification(
                  'company_discovered',
                  `Found: ${job.company}`,
                  `${job.company} uses ${analysis.tool_detected}`,
                  { 
                    company: job.company,
                    tool: analysis.tool_detected,
                    job_title: job.job_title,
                    search_term: searchTerm
                  }
                );
              } else {
                console.log('⏭️ Already identified');
              }
            } else {
              console.log('❌ No tool detected');
            }
            
            // Mark job as processed
            await this.dataService.markJobAsProcessed(job.job_id);
            jobsAnalyzed++;
            
            // Rate limiting - 2 second delay between API calls
            await this.delay(2000);
            
          } catch (analysisError) {
            console.error(`\n  ❌ Failed to analyze job ${job.job_id}:`, analysisError);
            stats.failed++;
          }
        }
        
        stats.analyzed = jobsAnalyzed;
        stats.companiesFound = companiesFound;
        stats.outreachCompanies = outreachCount;
        stats.salesloftCompanies = salesloftCount;
        
        console.log(`\n✅ Analysis complete:`);
        console.log(`  - Jobs analyzed: ${jobsAnalyzed}`);
        console.log(`  - Companies found: ${companiesFound}`);
        console.log(`  - Outreach.io: ${outreachCount}`);
        console.log(`  - SalesLoft: ${salesloftCount}`);
        if (bothCount > 0) {
          console.log(`  - Using both tools: ${bothCount}`);
        }
        
        // Create notification for analysis completion
        await this.createNotification(
          'analysis_complete',
          `Analysis complete: ${searchTerm}`,
          `Analyzed ${jobsAnalyzed} jobs, found ${companiesFound} new companies (${outreachCount} Outreach, ${salesloftCount} SalesLoft)`,
          {
            search_term: searchTerm,
            jobs_analyzed: jobsAnalyzed,
            companies_found: companiesFound,
            outreach_companies: outreachCount,
            salesloft_companies: salesloftCount,
            both_tools: bothCount
          }
        );
      } else {
        // No new jobs to analyze
        stats.analyzed = 0;
        stats.companiesFound = 0;
        stats.outreachCompanies = 0;
        stats.salesloftCompanies = 0;
      }

      // Step 4: Update search term status
      await this.dataService.updateSearchTermLastScraped(searchTerm, stats.totalScraped);
      
      stats.endTime = new Date();
      const duration = (stats.endTime.getTime() - stats.startTime.getTime()) / 1000;
      
      console.log(`\n✅ Processing complete for "${searchTerm}"`);
      console.log(`📊 Summary:`);
      console.log(`  - Total scraped: ${stats.totalScraped}`);
      console.log(`  - New jobs: ${stats.newJobs}`);
      console.log(`  - Analyzed: ${stats.analyzed}`);
      console.log(`  - Failed: ${stats.failed}`);
      console.log(`  - Duration: ${Math.round(duration)} seconds (${Math.round(duration/60)} minutes)`);
      
      // Add compatibility fields for autoScrapingScheduler
      stats.jobsScraped = stats.totalScraped;
      stats.jobsAnalyzed = stats.analyzed;
      // companiesFound, outreachCompanies, salesloftCompanies are already set above
      
      return stats;
      
    } catch (error) {
      console.error('❌ Fatal error during processing:', error);
      stats.endTime = new Date();
      throw error;
    } finally {
      this.isProcessing = false;
      this.currentStats = null;
    }
  }

  /**
   * Process all active search terms sequentially
   */
  async processAllSearchTerms(): Promise<ProcessingStats[]> {
    const allStats: ProcessingStats[] = [];
    
    try {
      // Get all active search terms
      const searchTerms = await this.dataService.getActiveSearchTerms();
      console.log(`\n🚀 Starting weekly processing for ${searchTerms.length} search terms`);
      
      const startTime = new Date();
      
      // Process each search term sequentially
      for (let i = 0; i < searchTerms.length; i++) {
        const term = searchTerms[i];
        const termNumber = i + 1;
        
        console.log(`\n${'='.repeat(50)}`);
        console.log(`Processing term ${termNumber}/${searchTerms.length}: "${term.search_term}"`);
        console.log(`${'='.repeat(50)}`);
        
        try {
          const stats = await this.processSearchTerm(term.search_term);
          allStats.push(stats);
          
          // Delay between search terms (5 seconds)
          if (i < searchTerms.length - 1) {
            console.log('⏳ Waiting 5 seconds before next search term...');
            await this.delay(5000);
          }
          
        } catch (error) {
          console.error(`Failed to process search term "${term.search_term}":`, error);
          // Continue with next search term
          continue;
        }
      }
      
      const endTime = new Date();
      const totalDuration = (endTime.getTime() - startTime.getTime()) / 1000;
      
      // Print final summary
      console.log(`\n${'='.repeat(50)}`);
      console.log('📊 WEEKLY PROCESSING COMPLETE');
      console.log(`${'='.repeat(50)}`);
      console.log(`Total duration: ${Math.round(totalDuration/60)} minutes`);
      
      const totalScraped = allStats.reduce((sum, stat) => sum + stat.totalScraped, 0);
      const totalNew = allStats.reduce((sum, stat) => sum + stat.newJobs, 0);
      const totalAnalyzed = allStats.reduce((sum, stat) => sum + stat.analyzed, 0);
      
      console.log(`Total jobs scraped: ${totalScraped}`);
      console.log(`Total new jobs: ${totalNew}`);
      console.log(`Total analyzed: ${totalAnalyzed}`);
      
      return allStats;
      
    } catch (error) {
      console.error('Fatal error in processAllSearchTerms:', error);
      throw error;
    }
  }

  /**
   * Get current processing status
   */
  getStatus(): { isProcessing: boolean; currentStats: ProcessingStats | null } {
    return {
      isProcessing: this.isProcessing,
      currentStats: this.currentStats
    };
  }

  /**
   * Helper function to create delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a notification for the live activity feed
   */
  private async createNotification(
    type: string,
    title: string,
    message: string,
    metadata?: any
  ): Promise<void> {
    try {
      const { createApiSupabaseClient } = await import('../supabase');
      const supabase = createApiSupabaseClient();
      
      await supabase
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
}

export default JobProcessor;