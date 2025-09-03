/**
 * Continuous Processor
 * Runs continuously to process all unanalyzed jobs
 * No batch limits - processes until all jobs are complete
 */

import { createClient } from '@supabase/supabase-js';
import { gpt5AnalysisService } from './gpt5AnalysisService';
import { syncManager } from './syncManager';
import { 
  RawJob, 
  AnalysisResult, 
  ProcessorStatus,
  ProcessingStats 
} from '@/types';

export class ContinuousProcessor {
  private supabase;
  private analyzer;
  private isRunning: boolean = false;
  private shouldStop: boolean = false;
  private currentJob: string | null = null;
  private jobsProcessed: number = 0;
  private errors: number = 0;
  private startedAt: Date | null = null;
  private lastActivityAt: Date | null = null;

  constructor() {
    // Defer initialization to avoid build-time errors
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    
    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    } else {
      // Create a dummy client during build time
      this.supabase = null as any;
    }
    
    this.analyzer = gpt5AnalysisService;
  }
  
  private ensureInitialized() {
    if (!this.supabase) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase configuration is missing');
      }
      
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
  }

  /**
   * Start the continuous processor
   */
  async start(): Promise<void> {
    this.ensureInitialized();
    
    if (this.isRunning) {
      console.log('Processor is already running');
      return;
    }

    console.log('Starting continuous processor...');
    this.isRunning = true;
    this.shouldStop = false;
    this.jobsProcessed = 0;
    this.errors = 0;
    this.startedAt = new Date();

    try {
      // Skip sync manager initialization for now (Google Sheets auth not configured)
      // await syncManager.initialize();
      console.log('Skipping Google Sheets sync - processing from database only');

      // Main processing loop
      while (!this.shouldStop) {
        await this.processNextBatch();
        
        // Small delay to prevent CPU overload
        await this.sleep(1000);
      }
    } catch (error) {
      console.error('Processor error:', error);
      this.errors++;
    } finally {
      this.isRunning = false;
      console.log('Processor stopped');
    }
  }

  /**
   * Process the next batch of unprocessed jobs
   */
  private async processNextBatch(): Promise<void> {
    try {
      // Get unprocessed jobs (larger batch for faster processing)
      const { data: jobs, error } = await this.supabase
        .from('raw_jobs')
        .select('*')
        .eq('processed', false)
        .order('created_at', { ascending: true })
        .limit(50); // Process 50 at a time

      if (error) {
        throw error;
      }

      if (!jobs || jobs.length === 0) {
        // No jobs to process - wait a bit longer
        console.log('No unprocessed jobs found. Waiting...');
        await this.sleep(5000);
        return;
      }

      console.log(`Processing batch of ${jobs.length} jobs...`);

      // Process each job
      for (const job of jobs) {
        if (this.shouldStop) {
          break;
        }

        await this.processJob(job);
      }

    } catch (error) {
      console.error('Batch processing error:', error);
      this.errors++;
      
      // Wait before retrying
      await this.sleep(5000);
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: RawJob): Promise<void> {
    this.currentJob = job.job_id;
    this.lastActivityAt = new Date();

    try {
      console.log(`Analyzing job ${job.job_id} from ${job.company}...`);

      // Add to processing queue
      await this.addToProcessingQueue(job.job_id);

      // Analyze with GPT-5 (ONLY GPT-5, never fallback)
      const analysis = await this.analyzer.analyzeJob(job);

      // If tool detected, save to identified_companies
      if (analysis.uses_tool && analysis.tool_detected !== 'none') {
        await this.saveIdentifiedCompany(job, analysis);
        console.log(`✓ Tool detected: ${job.company} uses ${analysis.tool_detected}`);
      } else {
        console.log(`✗ No tool detected for ${job.company}`);
      }

      // Mark job as processed
      await this.markJobProcessed(job.job_id);

      // Update processing queue
      await this.updateProcessingQueue(job.job_id, 'completed');

      this.jobsProcessed++;

      // Rate limiting - reduced delay for GPT-5 (faster API)
      await this.sleep(500); // 0.5 second delay

    } catch (error) {
      console.error(`Error processing job ${job.job_id}:`, error);
      this.errors++;

      // Update processing queue with error
      await this.updateProcessingQueue(
        job.job_id, 
        'error', 
        error instanceof Error ? error.message : 'Unknown error'
      );

      // Continue with next job
    } finally {
      this.currentJob = null;
    }
  }

  /**
   * Save identified company to database
   */
  private async saveIdentifiedCompany(
    job: RawJob, 
    analysis: AnalysisResult
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('identified_companies')
        .insert({
          company: job.company,
          tool_detected: analysis.tool_detected,
          signal_type: analysis.signal_type,
          context: analysis.context,
          job_title: job.job_title,
          job_url: job.job_url,
          platform: job.platform || 'LinkedIn',
          identified_date: new Date().toISOString()
        });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error saving identified company:', error);
      throw error;
    }
  }

  /**
   * Mark job as processed in database
   */
  private async markJobProcessed(jobId: string): Promise<void> {
    const { error } = await this.supabase
      .from('raw_jobs')
      .update({ 
        processed: true, 
        analyzed_date: new Date().toISOString() 
      })
      .eq('job_id', jobId);

    if (error) {
      throw error;
    }
  }

  /**
   * Add job to processing queue
   */
  private async addToProcessingQueue(jobId: string): Promise<void> {
    await this.supabase
      .from('processing_queue')
      .upsert({
        job_id: jobId,
        status: 'processing',
        started_at: new Date().toISOString()
      }, {
        onConflict: 'job_id'
      });
  }

  /**
   * Update processing queue status
   */
  private async updateProcessingQueue(
    jobId: string, 
    status: 'completed' | 'error',
    errorMessage?: string
  ): Promise<void> {
    await this.supabase
      .from('processing_queue')
      .update({
        status,
        completed_at: status === 'completed' ? new Date().toISOString() : null,
        error_message: errorMessage
      })
      .eq('job_id', jobId);
  }

  /**
   * Stop the processor gracefully
   */
  async stop(): Promise<void> {
    console.log('Stopping processor...');
    this.shouldStop = true;

    // Wait for current job to complete
    let waitTime = 0;
    while (this.isRunning && waitTime < 30000) {
      await this.sleep(1000);
      waitTime += 1000;
    }

    if (this.isRunning) {
      console.warn('Processor did not stop gracefully');
    }
  }

  /**
   * Get current processor status
   */
  getStatus(): ProcessorStatus {
    return {
      isRunning: this.isRunning,
      currentJob: this.currentJob || undefined,
      jobsProcessed: this.jobsProcessed,
      startedAt: this.startedAt || undefined,
      lastActivityAt: this.lastActivityAt || undefined,
      errors: this.errors
    };
  }

  /**
   * Get processing statistics
   */
  async getStats(): Promise<ProcessingStats> {
    // Get counts from database
    const [totalJobs, processedJobs, pendingJobs, errorJobs] = await Promise.all([
      this.supabase.from('raw_jobs').select('*', { count: 'exact', head: true }),
      this.supabase.from('raw_jobs').select('*', { count: 'exact', head: true }).eq('processed', true),
      this.supabase.from('raw_jobs').select('*', { count: 'exact', head: true }).eq('processed', false),
      this.supabase.from('processing_queue').select('*', { count: 'exact', head: true }).eq('status', 'error')
    ]);

    const [companiesIdentified, outreachCompanies, salesloftCompanies] = await Promise.all([
      this.supabase.from('identified_companies').select('*', { count: 'exact', head: true }),
      this.supabase.from('identified_companies').select('*', { count: 'exact', head: true }).eq('tool_detected', 'Outreach.io'),
      this.supabase.from('identified_companies').select('*', { count: 'exact', head: true }).eq('tool_detected', 'SalesLoft')
    ]);

    // Calculate processing rate
    const processingRate = this.startedAt && this.jobsProcessed > 0
      ? this.jobsProcessed / ((Date.now() - this.startedAt.getTime()) / 60000)
      : 0;

    return {
      totalJobs: totalJobs.count || 0,
      processedJobs: processedJobs.count || 0,
      pendingJobs: pendingJobs.count || 0,
      errorJobs: errorJobs.count || 0,
      companiesIdentified: companiesIdentified.count || 0,
      outreachCompanies: outreachCompanies.count || 0,
      salesloftCompanies: salesloftCompanies.count || 0,
      processingRate: Math.round(processingRate * 100) / 100,
      lastProcessedAt: this.lastActivityAt || undefined
    };
  }

  /**
   * Reprocess failed jobs
   */
  async reprocessErrors(): Promise<void> {
    console.log('Reprocessing failed jobs...');

    // Get failed jobs from processing queue
    const { data: failedJobs, error } = await this.supabase
      .from('processing_queue')
      .select('job_id')
      .eq('status', 'error')
      .lt('attempts', 3); // Max 3 attempts

    if (error || !failedJobs) {
      console.error('Error fetching failed jobs:', error);
      return;
    }

    // Reset their status in raw_jobs
    for (const failed of failedJobs) {
      await this.supabase
        .from('raw_jobs')
        .update({ processed: false })
        .eq('job_id', failed.job_id);

      // Increment attempts
      await this.supabase
        .from('processing_queue')
        .update({ 
          attempts: this.supabase.rpc('increment', { x: 1 }),
          status: 'pending'
        })
        .eq('job_id', failed.job_id);
    }

    console.log(`Reset ${failedJobs.length} failed jobs for reprocessing`);
  }

  /**
   * Helper function for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance with lazy initialization
let _instance: ContinuousProcessor | null = null;

export const continuousProcessor = {
  get instance() {
    if (!_instance) {
      _instance = new ContinuousProcessor();
    }
    return _instance;
  },
  
  // Proxy methods to the instance
  start: () => continuousProcessor.instance.start(),
  stop: () => continuousProcessor.instance.stop(),
  getStatus: () => continuousProcessor.instance.getStatus(),
  getStats: () => continuousProcessor.instance.getStats(),
};