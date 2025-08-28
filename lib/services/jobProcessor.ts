import { ScraperService } from './scraperService';
import { AnalysisService } from './analysisService';
import { DataService } from './dataService';

export interface ProcessingStats {
  searchTerm: string;
  totalScraped: number;
  newJobs: number;
  analyzed: number;
  failed: number;
  startTime: Date;
  endTime?: Date;
}

export class JobProcessor {
  private scraperService: ScraperService;
  private analysisService: AnalysisService;
  private dataService: DataService;
  private isProcessing: boolean = false;
  private currentStats: ProcessingStats | null = null;

  constructor() {
    this.scraperService = new ScraperService();
    this.analysisService = new AnalysisService();
    this.dataService = new DataService();
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

      // Step 3: Process each NEW job ONE AT A TIME
      if (stats.newJobs > 0) {
        console.log('🤖 Starting sequential analysis...');
        
        for (let i = 0; i < newJobs.length; i++) {
          const job = newJobs[i];
          const jobNumber = i + 1;
          
          try {
            // Progress indicator
            if (jobNumber % 10 === 0 || jobNumber === 1 || jobNumber === stats.newJobs) {
              console.log(`  Processing job ${jobNumber}/${stats.newJobs} (${Math.round(jobNumber/stats.newJobs * 100)}%)`);
            }

            // Analyze single job with OpenAI
            const analyzedJob = await this.analysisService.analyzeJob(job);
            
            // Save to database
            console.log(`    Saving job ${job.job_id} to database...`);
            try {
              await this.dataService.saveJobs([job]);
              console.log(`    ✅ Job saved successfully`);
            } catch (saveError) {
              console.error(`    ❌ Failed to save job ${job.job_id}:`, saveError);
              throw saveError;
            }
            
            // Save analysis result if tool detected
            if (analyzedJob.analysis.uses_tool) {
              await this.dataService.saveIdentifiedCompany(analyzedJob);
              console.log(`  🎯 Tool detected: ${analyzedJob.company} uses ${analyzedJob.analysis.tool_detected}`);
            }
            
            stats.analyzed++;
            
            // Rate limit delay (1 second between API calls)
            await this.delay(1000);
            
          } catch (error) {
            console.error(`  ❌ Error processing job ${job.job_id}:`, error);
            stats.failed++;
            // Continue to next job
            continue;
          }
        }
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
}

export default JobProcessor;