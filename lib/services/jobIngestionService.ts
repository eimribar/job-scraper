/**
 * Job Ingestion Service - Phase 1 of the new pipeline
 * This service handles raw ingestion of scraped jobs WITHOUT any deduplication
 * All jobs are saved first, then processed in subsequent phases
 */

import { ScraperService, ScrapedJob } from './scraperService';
import { createApiSupabaseClient } from '../supabase';
import { v4 as uuidv4 } from 'uuid';

export interface IngestionResult {
  runId: string;
  searchTerm: string;
  totalScraped: number;
  savedToDatabase: number;
  failed: number;
  errors: string[];
  startTime: Date;
  endTime?: Date;
}

export interface RawJob {
  id?: string;
  scrape_run_id: string;
  search_term: string;
  job_id: string;
  linkedin_id?: string;
  platform: string;
  company: string;
  job_title: string;
  location: string;
  description: string;
  job_url: string;
  scraped_at: string;
  deduplicated: boolean;
  ready_for_analysis: boolean;
}

export class JobIngestionService {
  private scraperService: ScraperService;
  private supabase;
  
  constructor() {
    this.scraperService = new ScraperService();
    this.supabase = createApiSupabaseClient();
  }
  
  /**
   * Phase 1: Ingest ALL scraped jobs without any filtering
   */
  async ingestJobs(searchTerm: string, maxItems: number = 500): Promise<IngestionResult> {
    const runId = uuidv4();
    const result: IngestionResult = {
      runId,
      searchTerm,
      totalScraped: 0,
      savedToDatabase: 0,
      failed: 0,
      errors: [],
      startTime: new Date()
    };
    
    console.log('\n' + '='.repeat(60));
    console.log('🚀 PHASE 1: RAW INGESTION (No Deduplication)');
    console.log('='.repeat(60));
    console.log(`Run ID: ${runId}`);
    console.log(`Search Term: "${searchTerm}"`);
    console.log(`Max Items: ${maxItems}`);
    console.log(`Started: ${result.startTime.toISOString()}\n`);
    
    try {
      // Step 1: Scrape jobs from LinkedIn
      console.log('📥 Step 1: Scraping from LinkedIn...');
      const scrapedJobs = await this.scraperService.scrapeJobs(searchTerm, maxItems);
      result.totalScraped = scrapedJobs.length;
      
      console.log(`✅ Scraped ${result.totalScraped} jobs successfully\n`);
      
      if (result.totalScraped === 0) {
        console.log('⚠️  No jobs found for this search term');
        result.endTime = new Date();
        return result;
      }
      
      // Step 2: Save ALL jobs to database (using job_queue for now)
      console.log('💾 Step 2: Saving ALL jobs to database...');
      console.log('  Note: Using job_queue table with modified approach\n');
      
      // Process in batches of 50 for better reliability
      const batchSize = 50;
      const batches = [];
      for (let i = 0; i < scrapedJobs.length; i += batchSize) {
        batches.push(scrapedJobs.slice(i, i + batchSize));
      }
      
      console.log(`  Processing ${batches.length} batches of up to ${batchSize} jobs each\n`);
      
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const batchNumber = batchIndex + 1;
        
        console.log(`  Batch ${batchNumber}/${batches.length}: ${batch.length} jobs`);
        
        try {
          // Transform jobs for database insertion
          const jobsToInsert = batch.map(job => ({
            job_type: 'raw_ingestion', // New type to distinguish from normal flow
            status: 'ingested', // New status
            payload: {
              scrape_run_id: runId,
              job_id: job.job_id,
              platform: job.platform,
              company: job.company,
              job_title: job.job_title,
              location: job.location,
              description: job.description,
              job_url: job.job_url,
              scraped_date: job.scraped_date,
              search_term: job.search_term,
              // New flags for processing
              deduplicated: false,
              is_duplicate: false,
              ready_for_analysis: false,
              analyzed: false
            },
            created_at: new Date().toISOString(),
          }));
          
          // Insert batch into database
          const { data, error } = await this.supabase
            .from('job_queue')
            .insert(jobsToInsert)
            .select('id');
          
          if (error) {
            console.error(`    ❌ Failed to save batch ${batchNumber}:`, error.message);
            result.errors.push(`Batch ${batchNumber}: ${error.message}`);
            result.failed += batch.length;
          } else {
            console.log(`    ✅ Saved ${data?.length || batch.length} jobs`);
            result.savedToDatabase += data?.length || batch.length;
            
            // Log sample of saved jobs
            if (batchNumber === 1) {
              console.log(`    Sample of saved jobs:`);
              batch.slice(0, 3).forEach((job, idx) => {
                console.log(`      ${idx + 1}. ${job.job_id} | ${job.company} - ${job.job_title}`);
              });
            }
          }
          
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          console.error(`    ❌ Batch ${batchNumber} error:`, errorMsg);
          result.errors.push(`Batch ${batchNumber}: ${errorMsg}`);
          result.failed += batch.length;
        }
        
        // Small delay between batches to avoid overwhelming the database
        if (batchIndex < batches.length - 1) {
          await this.delay(500);
        }
      }
      
      // Step 3: Verify data integrity
      console.log('\n🔍 Step 3: Verifying data integrity...');
      
      const { count, error: countError } = await this.supabase
        .from('job_queue')
        .select('*', { count: 'exact', head: true })
        .eq('payload->>scrape_run_id', runId);
      
      if (!countError && count !== null) {
        console.log(`  Jobs with this run ID in database: ${count}`);
        console.log(`  Jobs scraped from LinkedIn: ${result.totalScraped}`);
        
        if (count === result.totalScraped) {
          console.log('  ✅ Data integrity check PASSED - all jobs saved!');
        } else if (count < result.totalScraped) {
          console.log(`  ⚠️  Data loss detected: ${result.totalScraped - count} jobs missing`);
          result.errors.push(`Data loss: ${result.totalScraped - count} jobs not saved`);
        }
      }
      
      result.endTime = new Date();
      const duration = (result.endTime.getTime() - result.startTime.getTime()) / 1000;
      
      // Step 4: Summary
      console.log('\n' + '='.repeat(60));
      console.log('📊 INGESTION SUMMARY');
      console.log('='.repeat(60));
      console.log(`Run ID: ${runId}`);
      console.log(`Search Term: "${searchTerm}"`);
      console.log(`Total Scraped: ${result.totalScraped}`);
      console.log(`Saved to DB: ${result.savedToDatabase}`);
      console.log(`Failed: ${result.failed}`);
      console.log(`Duration: ${Math.round(duration)} seconds`);
      
      if (result.savedToDatabase === result.totalScraped) {
        console.log('\n✅ SUCCESS: All jobs saved to database!');
        console.log('Ready for Phase 2: Deduplication');
      } else {
        console.log(`\n⚠️  WARNING: Only ${result.savedToDatabase}/${result.totalScraped} jobs saved`);
        if (result.errors.length > 0) {
          console.log('Errors encountered:');
          result.errors.forEach(err => console.log(`  - ${err}`));
        }
      }
      
      return result;
      
    } catch (error) {
      console.error('\n❌ Fatal error during ingestion:', error);
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      result.endTime = new Date();
      throw error;
    }
  }
  
  /**
   * Get jobs ready for deduplication
   */
  async getJobsForDeduplication(runId?: string): Promise<any[]> {
    let query = this.supabase
      .from('job_queue')
      .select('*')
      .eq('job_type', 'raw_ingestion')
      .eq('payload->>deduplicated', 'false');
    
    if (runId) {
      query = query.eq('payload->>scrape_run_id', runId);
    }
    
    const { data, error } = await query.limit(1000);
    
    if (error) {
      console.error('Error fetching jobs for deduplication:', error);
      return [];
    }
    
    return data || [];
  }
  
  /**
   * Get ingestion statistics
   */
  async getIngestionStats(runId?: string): Promise<any> {
    const stats: any = {
      totalIngested: 0,
      awaitingDeduplication: 0,
      readyForAnalysis: 0,
      analyzed: 0,
      recentRuns: []
    };
    
    // Get total counts
    const { count: totalCount } = await this.supabase
      .from('job_queue')
      .select('*', { count: 'exact', head: true })
      .eq('job_type', 'raw_ingestion');
    
    stats.totalIngested = totalCount || 0;
    
    // Get jobs awaiting deduplication
    const { count: dedupCount } = await this.supabase
      .from('job_queue')
      .select('*', { count: 'exact', head: true })
      .eq('job_type', 'raw_ingestion')
      .eq('payload->>deduplicated', 'false');
    
    stats.awaitingDeduplication = dedupCount || 0;
    
    // Get recent runs (unique scrape_run_ids)
    const { data: recentJobs } = await this.supabase
      .from('job_queue')
      .select('payload')
      .eq('job_type', 'raw_ingestion')
      .order('created_at', { ascending: false })
      .limit(500);
    
    if (recentJobs) {
      const runMap = new Map();
      recentJobs.forEach(job => {
        const runId = job.payload?.scrape_run_id;
        const searchTerm = job.payload?.search_term;
        if (runId && !runMap.has(runId)) {
          runMap.set(runId, searchTerm);
        }
      });
      
      stats.recentRuns = Array.from(runMap.entries()).slice(0, 5).map(([id, term]) => ({
        runId: id,
        searchTerm: term
      }));
    }
    
    return stats;
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default JobIngestionService;