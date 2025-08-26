import { EventEmitter } from 'events';
import { ScrapedJob } from './improvedScraperService';
import { AnalyzedJob } from './improvedAnalysisService';

export interface JobQueueItem<T = any> {
  id: string;
  type: 'scrape' | 'analyze' | 'export';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  data: T;
  result?: any;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;
  maxRetries: number;
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  averageProcessingTime: number;
  throughput: number; // jobs per minute
}

export class JobQueue extends EventEmitter {
  private queue: Map<string, JobQueueItem> = new Map();
  private processing: Set<string> = new Set();
  private completionTimes: number[] = [];
  private readonly maxQueueSize: number;
  private readonly maxConcurrent: number;
  private isRunning: boolean = false;

  constructor(
    maxQueueSize: number = 1000,
    maxConcurrent: number = 5
  ) {
    super();
    this.maxQueueSize = maxQueueSize;
    this.maxConcurrent = maxConcurrent;
  }

  async add<T>(
    type: JobQueueItem['type'],
    data: T,
    options: { maxRetries?: number } = {}
  ): Promise<string> {
    if (this.queue.size >= this.maxQueueSize) {
      throw new Error(`Queue is full (max ${this.maxQueueSize} items)`);
    }

    const id = this.generateId();
    const item: JobQueueItem<T> = {
      id,
      type,
      status: 'pending',
      data,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: options.maxRetries || 3,
    };

    this.queue.set(id, item);
    this.emit('jobAdded', item);
    
    // Auto-start processing if not running
    if (!this.isRunning) {
      this.start();
    }

    return id;
  }

  async addBatch<T>(
    type: JobQueueItem['type'],
    dataArray: T[],
    options: { maxRetries?: number } = {}
  ): Promise<string[]> {
    const ids: string[] = [];
    
    for (const data of dataArray) {
      const id = await this.add(type, data, options);
      ids.push(id);
    }

    return ids;
  }

  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.emit('queueStarted');
    this.processQueue();
  }

  stop(): void {
    this.isRunning = false;
    this.emit('queueStopped');
  }

  private async processQueue(): Promise<void> {
    while (this.isRunning) {
      // Check if we can process more jobs
      if (this.processing.size >= this.maxConcurrent) {
        await this.sleep(100);
        continue;
      }

      // Find next pending job
      const pendingJob = this.getNextPendingJob();
      
      if (!pendingJob) {
        // No pending jobs, wait
        await this.sleep(1000);
        continue;
      }

      // Process the job
      this.processJob(pendingJob);
    }
  }

  private async processJob(job: JobQueueItem): Promise<void> {
    job.status = 'processing';
    job.startedAt = new Date();
    this.processing.add(job.id);
    this.emit('jobStarted', job);

    try {
      // Process based on job type
      const result = await this.executeJob(job);
      
      job.result = result;
      job.status = 'completed';
      job.completedAt = new Date();
      
      // Track completion time
      const processingTime = job.completedAt.getTime() - job.startedAt.getTime();
      this.completionTimes.push(processingTime);
      
      // Keep only last 100 times for average calculation
      if (this.completionTimes.length > 100) {
        this.completionTimes.shift();
      }

      this.emit('jobCompleted', job);
    } catch (error) {
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.retryCount++;

      if (job.retryCount < job.maxRetries) {
        // Retry with exponential backoff
        job.status = 'pending';
        const delay = Math.min(1000 * Math.pow(2, job.retryCount), 30000);
        
        console.log(`Retrying job ${job.id} in ${delay}ms (attempt ${job.retryCount}/${job.maxRetries})`);
        
        setTimeout(() => {
          this.emit('jobRetrying', job);
        }, delay);
      } else {
        job.status = 'failed';
        job.completedAt = new Date();
        this.emit('jobFailed', job);
      }
    } finally {
      this.processing.delete(job.id);
    }
  }

  private async executeJob(job: JobQueueItem): Promise<any> {
    // This should be overridden or have handlers registered
    this.emit('executeJob', job);
    
    // Simulate processing
    await this.sleep(1000);
    
    return { processed: true };
  }

  private getNextPendingJob(): JobQueueItem | null {
    for (const job of this.queue.values()) {
      if (job.status === 'pending') {
        return job;
      }
    }
    return null;
  }

  getJob(id: string): JobQueueItem | undefined {
    return this.queue.get(id);
  }

  getJobs(status?: JobQueueItem['status']): JobQueueItem[] {
    const jobs = Array.from(this.queue.values());
    
    if (status) {
      return jobs.filter(job => job.status === status);
    }
    
    return jobs;
  }

  getStats(): QueueStats {
    const jobs = Array.from(this.queue.values());
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Calculate throughput
    const recentlyCompleted = jobs.filter(
      job => job.status === 'completed' && 
      job.completedAt && 
      job.completedAt.getTime() > oneMinuteAgo
    );

    // Calculate average processing time
    const averageProcessingTime = this.completionTimes.length > 0
      ? this.completionTimes.reduce((a, b) => a + b, 0) / this.completionTimes.length
      : 0;

    return {
      pending: jobs.filter(j => j.status === 'pending').length,
      processing: jobs.filter(j => j.status === 'processing').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
      averageProcessingTime,
      throughput: recentlyCompleted.length,
    };
  }

  clear(status?: JobQueueItem['status']): void {
    if (status) {
      // Clear only jobs with specific status
      for (const [id, job] of this.queue.entries()) {
        if (job.status === status) {
          this.queue.delete(id);
        }
      }
    } else {
      // Clear all
      this.queue.clear();
      this.processing.clear();
      this.completionTimes = [];
    }
    
    this.emit('queueCleared', status);
  }

  private generateId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create singleton instances for different job types
export const scrapingQueue = new JobQueue(100, 2); // Max 100 jobs, 2 concurrent
export const analysisQueue = new JobQueue(500, 5); // Max 500 jobs, 5 concurrent
export const exportQueue = new JobQueue(50, 1); // Max 50 jobs, 1 concurrent

// Set up job executors
scrapingQueue.on('executeJob', async (job: JobQueueItem) => {
  // Scraping logic here
  console.log(`Executing scraping job: ${job.id}`);
});

analysisQueue.on('executeJob', async (job: JobQueueItem) => {
  // Analysis logic here
  console.log(`Executing analysis job: ${job.id}`);
});

exportQueue.on('executeJob', async (job: JobQueueItem) => {
  // Export logic here
  console.log(`Executing export job: ${job.id}`);
});