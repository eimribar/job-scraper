/**
 * SmartQueueManager Service
 * Priority-based job queue with circuit breaker and backpressure handling
 */

import { EventEmitter } from 'events';
import { createServerSupabaseClient } from '../supabase';
import { ServiceError } from './baseService';

export interface QueueJob {
  id: string;
  type: 'scrape' | 'analyze' | 'export' | 'revalidate';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  scheduledFor: Date;
  payload: any;
  result?: any;
  error?: string;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  processingTimeMs?: number;
  workerId?: string;
  lockedUntil?: Date;
}

export interface QueueConfig {
  maxConcurrent: number;
  maxQueueSize: number;
  defaultPriority: number;
  defaultMaxRetries: number;
  lockTimeout: number; // ms
  pollInterval: number; // ms
  backoffMultiplier: number;
  maxBackoff: number; // ms
  circuitBreakerThreshold: number; // error count
  circuitBreakerTimeout: number; // ms
}

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
  averageProcessingTime: number;
  throughput: number;
  errorRate: number;
  queueDepth: number;
  oldestJobAge: number;
}

interface CircuitBreakerState {
  isOpen: boolean;
  failures: number;
  lastFailure?: Date;
  nextRetry?: Date;
}

export class SmartQueueManager extends EventEmitter {
  private supabase;
  private config: QueueConfig;
  private isRunning: boolean = false;
  private workerId: string;
  private processingJobs: Map<string, QueueJob> = new Map();
  private pollInterval?: NodeJS.Timeout;
  private circuitBreaker: Map<string, CircuitBreakerState> = new Map();
  private metrics: {
    jobsProcessed: number;
    totalProcessingTime: number;
    errors: number;
    lastMinuteJobs: Array<{ timestamp: Date; success: boolean }>;
  };

  constructor(config: Partial<QueueConfig> = {}) {
    super();
    
    this.config = {
      maxConcurrent: config.maxConcurrent || 5,
      maxQueueSize: config.maxQueueSize || 1000,
      defaultPriority: config.defaultPriority || 50,
      defaultMaxRetries: config.defaultMaxRetries || 3,
      lockTimeout: config.lockTimeout || 60000, // 1 minute
      pollInterval: config.pollInterval || 1000, // 1 second
      backoffMultiplier: config.backoffMultiplier || 2,
      maxBackoff: config.maxBackoff || 60000, // 1 minute
      circuitBreakerThreshold: config.circuitBreakerThreshold || 5,
      circuitBreakerTimeout: config.circuitBreakerTimeout || 300000, // 5 minutes
    };

    this.workerId = `worker_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    this.supabase = createServerSupabaseClient();
    
    this.metrics = {
      jobsProcessed: 0,
      totalProcessingTime: 0,
      errors: 0,
      lastMinuteJobs: []
    };

    // Clean up old metrics every minute
    setInterval(() => this.cleanupMetrics(), 60000);
  }

  /**
   * Start the queue processor
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    this.emit('queue:started', { workerId: this.workerId });

    // Start polling for jobs
    this.pollInterval = setInterval(() => this.processNextBatch(), this.config.pollInterval);
    
    // Process immediately
    await this.processNextBatch();
  }

  /**
   * Stop the queue processor
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
    }

    // Wait for current jobs to complete
    await this.waitForJobsToComplete();
    
    // Release any locks
    await this.releaseAllLocks();
    
    this.emit('queue:stopped', { workerId: this.workerId });
  }

  /**
   * Add a job to the queue
   */
  async addJob(
    type: QueueJob['type'],
    payload: any,
    options: {
      priority?: number;
      scheduledFor?: Date;
      maxRetries?: number;
    } = {}
  ): Promise<string> {
    // Check queue size
    const { data: queueSize } = await this.supabase
      .from('job_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (queueSize && queueSize.count >= this.config.maxQueueSize) {
      throw new ServiceError(
        'Queue is full',
        'QUEUE_FULL',
        503,
        { currentSize: queueSize.count, maxSize: this.config.maxQueueSize }
      );
    }

    // Calculate priority
    const priority = options.priority ?? this.calculatePriority(type, payload);

    // Insert job
    const { data: job, error } = await this.supabase
      .from('job_queue')
      .insert({
        job_type: type,
        status: 'pending',
        priority,
        scheduled_for: options.scheduledFor || new Date(),
        payload,
        retry_count: 0,
        max_retries: options.maxRetries ?? this.config.defaultMaxRetries,
      })
      .select()
      .single();

    if (error) {
      throw new ServiceError('Failed to add job to queue', 'QUEUE_ERROR', 500, error);
    }

    this.emit('job:added', { jobId: job.id, type, priority });
    
    return job.id;
  }

  /**
   * Calculate dynamic priority for a job
   */
  private calculatePriority(type: QueueJob['type'], payload: any): number {
    let priority = this.config.defaultPriority;

    // Type-based priority
    switch (type) {
      case 'export':
        priority += 20; // Exports are user-facing, higher priority
        break;
      case 'analyze':
        priority += 10; // Analysis is important
        break;
      case 'scrape':
        priority += 0; // Base priority
        break;
      case 'revalidate':
        priority -= 10; // Lower priority
        break;
    }

    // Payload-based adjustments
    if (type === 'scrape' && payload.searchTerm) {
      // High-value search terms get priority
      const highValueTerms = ['Revenue Operations', 'Sales Manager', 'SDR Manager'];
      if (highValueTerms.includes(payload.searchTerm)) {
        priority += 30;
      }
    }

    if (type === 'analyze' && payload.company) {
      // New companies get priority
      if (payload.isNewCompany) {
        priority += 25;
      }
      // High-confidence job titles get priority
      if (payload.jobTitle?.includes('Director') || payload.jobTitle?.includes('VP')) {
        priority += 15;
      }
    }

    // Time-based adjustments
    if (payload.urgency === 'high') {
      priority += 40;
    }

    // Ensure priority is within bounds
    return Math.max(0, Math.min(100, priority));
  }

  /**
   * Process the next batch of jobs
   */
  private async processNextBatch(): Promise<void> {
    if (!this.isRunning) return;

    // Check if we can process more jobs
    const currentProcessing = this.processingJobs.size;
    if (currentProcessing >= this.config.maxConcurrent) {
      return; // At capacity
    }

    // Check system health
    if (await this.isSystemOverloaded()) {
      this.emit('queue:backpressure', { 
        reason: 'System overloaded',
        metrics: await this.getSystemMetrics()
      });
      return;
    }

    // Get next jobs to process
    const jobsToProcess = this.config.maxConcurrent - currentProcessing;
    const jobs = await this.getNextJobs(jobsToProcess);

    // Process each job
    for (const job of jobs) {
      this.processJob(job);
    }
  }

  /**
   * Get the next jobs from the queue
   */
  private async getNextJobs(limit: number): Promise<QueueJob[]> {
    // Claim jobs atomically
    const { data: jobs, error } = await this.supabase.rpc('claim_queue_jobs', {
      worker_id: this.workerId,
      job_limit: limit,
      lock_timeout: this.config.lockTimeout
    });

    if (error) {
      console.error('Failed to claim jobs:', error);
      return [];
    }

    return jobs || [];
  }

  /**
   * Process a single job
   */
  private async processJob(job: QueueJob): Promise<void> {
    // Check circuit breaker
    if (this.isCircuitOpen(job.type)) {
      await this.requeueJob(job, 'Circuit breaker open');
      return;
    }

    this.processingJobs.set(job.id, job);
    const startTime = Date.now();

    try {
      // Update job status
      await this.updateJobStatus(job.id, 'processing', { 
        started_at: new Date(),
        worker_id: this.workerId 
      });

      this.emit('job:started', { jobId: job.id, type: job.type });

      // Execute job handler
      const result = await this.executeJob(job);

      // Mark as completed
      const processingTime = Date.now() - startTime;
      await this.updateJobStatus(job.id, 'completed', {
        completed_at: new Date(),
        processing_time_ms: processingTime,
        result
      });

      // Update metrics
      this.metrics.jobsProcessed++;
      this.metrics.totalProcessingTime += processingTime;
      this.metrics.lastMinuteJobs.push({ timestamp: new Date(), success: true });

      // Reset circuit breaker
      this.resetCircuitBreaker(job.type);

      this.emit('job:completed', { 
        jobId: job.id, 
        type: job.type, 
        processingTime,
        result 
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Update metrics
      this.metrics.errors++;
      this.metrics.lastMinuteJobs.push({ timestamp: new Date(), success: false });

      // Update circuit breaker
      this.recordCircuitBreakerFailure(job.type);

      // Handle retry logic
      if (job.retryCount < job.maxRetries) {
        await this.retryJob(job, errorMessage);
      } else {
        await this.failJob(job, errorMessage);
      }

      this.emit('job:failed', { 
        jobId: job.id, 
        type: job.type,
        error: errorMessage,
        willRetry: job.retryCount < job.maxRetries
      });

    } finally {
      this.processingJobs.delete(job.id);
    }
  }

  /**
   * Execute the actual job logic
   */
  private async executeJob(job: QueueJob): Promise<any> {
    // This is where job-specific logic would go
    // In practice, this would delegate to specific handlers
    
    switch (job.type) {
      case 'scrape':
        return await this.executeScrapeJob(job);
      case 'analyze':
        return await this.executeAnalyzeJob(job);
      case 'export':
        return await this.executeExportJob(job);
      case 'revalidate':
        return await this.executeRevalidateJob(job);
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }
  }

  // Job type specific handlers (these would be implemented with actual logic)
  private async executeScrapeJob(job: QueueJob): Promise<any> {
    // Placeholder - would call scraper service
    return { scraped: true, jobId: job.id };
  }

  private async executeAnalyzeJob(job: QueueJob): Promise<any> {
    // Placeholder - would call analyzer service
    return { analyzed: true, jobId: job.id };
  }

  private async executeExportJob(job: QueueJob): Promise<any> {
    // Placeholder - would call export service
    return { exported: true, jobId: job.id };
  }

  private async executeRevalidateJob(job: QueueJob): Promise<any> {
    // Placeholder - would call revalidation logic
    return { revalidated: true, jobId: job.id };
  }

  /**
   * Retry a failed job
   */
  private async retryJob(job: QueueJob, error: string): Promise<void> {
    const backoff = Math.min(
      Math.pow(this.config.backoffMultiplier, job.retryCount) * 1000,
      this.config.maxBackoff
    );

    const nextRetry = new Date(Date.now() + backoff);

    await this.supabase
      .from('job_queue')
      .update({
        status: 'pending',
        error_message: error,
        retry_count: job.retryCount + 1,
        last_retry_at: new Date(),
        next_retry_at: nextRetry,
        scheduled_for: nextRetry,
        worker_id: null,
        locked_until: null
      })
      .eq('id', job.id);
  }

  /**
   * Mark a job as failed
   */
  private async failJob(job: QueueJob, error: string): Promise<void> {
    await this.updateJobStatus(job.id, 'failed', {
      error_message: error,
      completed_at: new Date()
    });
  }

  /**
   * Requeue a job
   */
  private async requeueJob(job: QueueJob, reason: string): Promise<void> {
    await this.supabase
      .from('job_queue')
      .update({
        status: 'pending',
        worker_id: null,
        locked_until: null,
        error_message: reason
      })
      .eq('id', job.id);
  }

  /**
   * Update job status
   */
  private async updateJobStatus(
    jobId: string, 
    status: QueueJob['status'],
    updates: Record<string, any> = {}
  ): Promise<void> {
    await this.supabase
      .from('job_queue')
      .update({ status, ...updates })
      .eq('id', jobId);
  }

  /**
   * Circuit breaker logic
   */
  private isCircuitOpen(jobType: string): boolean {
    const state = this.circuitBreaker.get(jobType);
    if (!state) return false;

    if (state.isOpen && state.nextRetry && new Date() > state.nextRetry) {
      // Try to close the circuit
      state.isOpen = false;
      state.failures = 0;
    }

    return state.isOpen;
  }

  private recordCircuitBreakerFailure(jobType: string): void {
    let state = this.circuitBreaker.get(jobType);
    if (!state) {
      state = { isOpen: false, failures: 0 };
      this.circuitBreaker.set(jobType, state);
    }

    state.failures++;
    state.lastFailure = new Date();

    if (state.failures >= this.config.circuitBreakerThreshold) {
      state.isOpen = true;
      state.nextRetry = new Date(Date.now() + this.config.circuitBreakerTimeout);
      
      this.emit('circuit:opened', { 
        jobType, 
        failures: state.failures,
        nextRetry: state.nextRetry 
      });
    }
  }

  private resetCircuitBreaker(jobType: string): void {
    const state = this.circuitBreaker.get(jobType);
    if (state) {
      state.failures = 0;
      state.isOpen = false;
      state.lastFailure = undefined;
      state.nextRetry = undefined;
    }
  }

  /**
   * Check if system is overloaded
   */
  private async isSystemOverloaded(): Promise<boolean> {
    const metrics = await this.getSystemMetrics();
    
    // Check memory usage
    if (metrics.memoryUsage > 90) return true;
    
    // Check error rate
    if (metrics.errorRate > 0.5) return true;
    
    // Check queue depth
    if (metrics.queueDepth > this.config.maxQueueSize * 0.9) return true;
    
    return false;
  }

  /**
   * Get system metrics
   */
  private async getSystemMetrics(): Promise<{
    memoryUsage: number;
    errorRate: number;
    queueDepth: number;
  }> {
    const memoryUsage = process.memoryUsage();
    const memoryPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

    const recentJobs = this.metrics.lastMinuteJobs.filter(
      j => j.timestamp > new Date(Date.now() - 60000)
    );
    
    const errorRate = recentJobs.length > 0
      ? recentJobs.filter(j => !j.success).length / recentJobs.length
      : 0;

    const { data: queueStats } = await this.supabase
      .from('job_queue')
      .select('status', { count: 'exact', head: true })
      .eq('status', 'pending');

    return {
      memoryUsage: memoryPercent,
      errorRate,
      queueDepth: queueStats?.count || 0
    };
  }

  /**
   * Wait for all processing jobs to complete
   */
  private async waitForJobsToComplete(): Promise<void> {
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.processingJobs.size > 0 && Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Release all locks held by this worker
   */
  private async releaseAllLocks(): Promise<void> {
    await this.supabase
      .from('job_queue')
      .update({
        status: 'pending',
        worker_id: null,
        locked_until: null
      })
      .eq('worker_id', this.workerId);
  }

  /**
   * Clean up old metrics
   */
  private cleanupMetrics(): void {
    const oneMinuteAgo = new Date(Date.now() - 60000);
    this.metrics.lastMinuteJobs = this.metrics.lastMinuteJobs.filter(
      j => j.timestamp > oneMinuteAgo
    );
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    const { data: stats } = await this.supabase.rpc('get_queue_stats');

    const avgProcessingTime = this.metrics.jobsProcessed > 0
      ? this.metrics.totalProcessingTime / this.metrics.jobsProcessed
      : 0;

    const recentJobs = this.metrics.lastMinuteJobs.length;
    const recentErrors = this.metrics.lastMinuteJobs.filter(j => !j.success).length;
    const errorRate = recentJobs > 0 ? recentErrors / recentJobs : 0;

    return {
      pending: stats?.pending || 0,
      processing: stats?.processing || 0,
      completed: stats?.completed || 0,
      failed: stats?.failed || 0,
      cancelled: stats?.cancelled || 0,
      averageProcessingTime: avgProcessingTime,
      throughput: recentJobs, // jobs per minute
      errorRate,
      queueDepth: stats?.pending || 0,
      oldestJobAge: stats?.oldest_job_age || 0
    };
  }
}