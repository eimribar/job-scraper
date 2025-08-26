import { JobProcessor } from './jobProcessor';
import { DataService } from './dataService';

export interface SchedulerConfig {
  enabled: boolean;
  cronPattern?: string; // For future cron support
  dayOfWeek?: number; // 0 = Sunday, 1 = Monday, etc.
  hourOfDay?: number; // 0-23
  minuteOfHour?: number; // 0-59
}

export interface ScheduledRun {
  id: string;
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
  searchTermsProcessed: number;
  totalJobsScraped: number;
  totalJobsAnalyzed: number;
  error?: string;
}

export class SchedulerService {
  private jobProcessor: JobProcessor;
  private dataService: DataService;
  private isRunning: boolean = false;
  private currentRun: ScheduledRun | null = null;
  private scheduledTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.jobProcessor = new JobProcessor();
    this.dataService = new DataService();
  }

  /**
   * Start the weekly scheduler
   * Default: Runs every Monday at 2 AM
   */
  startWeeklySchedule(config: SchedulerConfig = {
    enabled: true,
    dayOfWeek: 1, // Monday
    hourOfDay: 2, // 2 AM
    minuteOfHour: 0
  }) {
    if (!config.enabled) {
      console.log('⏸️ Scheduler is disabled');
      return;
    }

    this.scheduleNextRun(config);
    console.log('✅ Weekly scheduler started');
  }

  /**
   * Schedule the next run based on config
   */
  private scheduleNextRun(config: SchedulerConfig) {
    const now = new Date();
    const nextRun = this.getNextRunTime(config);
    const msUntilRun = nextRun.getTime() - now.getTime();

    console.log(`⏰ Next scheduled run: ${nextRun.toLocaleString()}`);
    console.log(`   (in ${Math.round(msUntilRun / 1000 / 60)} minutes)`);

    // Clear any existing timeout
    if (this.scheduledTimeout) {
      clearTimeout(this.scheduledTimeout);
    }

    // Schedule the run
    this.scheduledTimeout = setTimeout(async () => {
      await this.executeScheduledRun();
      // Schedule next run after completion
      this.scheduleNextRun(config);
    }, msUntilRun);
  }

  /**
   * Calculate next run time based on config
   */
  private getNextRunTime(config: SchedulerConfig): Date {
    const now = new Date();
    const nextRun = new Date();

    // Set time
    nextRun.setHours(config.hourOfDay || 2);
    nextRun.setMinutes(config.minuteOfHour || 0);
    nextRun.setSeconds(0);
    nextRun.setMilliseconds(0);

    // If we've already passed today's run time, move to next week
    if (nextRun.getTime() <= now.getTime()) {
      nextRun.setDate(nextRun.getDate() + 7);
    }

    // Adjust to correct day of week
    while (nextRun.getDay() !== (config.dayOfWeek || 1)) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    return nextRun;
  }

  /**
   * Execute a scheduled run
   */
  async executeScheduledRun(): Promise<ScheduledRun> {
    if (this.isRunning) {
      throw new Error('A scheduled run is already in progress');
    }

    console.log('\n🚀 Starting scheduled weekly run');
    console.log(`⏰ Time: ${new Date().toLocaleString()}`);

    this.isRunning = true;
    
    this.currentRun = {
      id: `run_${Date.now()}`,
      startTime: new Date(),
      status: 'running',
      searchTermsProcessed: 0,
      totalJobsScraped: 0,
      totalJobsAnalyzed: 0
    };

    try {
      // Execute the processing
      const stats = await this.jobProcessor.processAllSearchTerms();

      // Update run statistics
      this.currentRun.searchTermsProcessed = stats.length;
      this.currentRun.totalJobsScraped = stats.reduce((sum, s) => sum + s.totalScraped, 0);
      this.currentRun.totalJobsAnalyzed = stats.reduce((sum, s) => sum + s.analyzed, 0);
      this.currentRun.endTime = new Date();
      this.currentRun.status = 'completed';

      console.log('\n✅ Scheduled run completed successfully');
      
      // Log to database (optional)
      await this.logScheduledRun(this.currentRun);

      return this.currentRun;

    } catch (error) {
      console.error('❌ Scheduled run failed:', error);
      
      if (this.currentRun) {
        this.currentRun.status = 'failed';
        this.currentRun.endTime = new Date();
        this.currentRun.error = error instanceof Error ? error.message : String(error);
      }

      throw error;

    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manually trigger a run (outside of schedule)
   */
  async triggerManualRun(): Promise<ScheduledRun> {
    console.log('🔧 Manual run triggered');
    return this.executeScheduledRun();
  }

  /**
   * Stop the scheduler
   */
  stopScheduler() {
    if (this.scheduledTimeout) {
      clearTimeout(this.scheduledTimeout);
      this.scheduledTimeout = null;
    }
    console.log('⏹️ Scheduler stopped');
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    currentRun: ScheduledRun | null;
    nextRunTime?: Date;
  } {
    return {
      isRunning: this.isRunning,
      currentRun: this.currentRun,
    };
  }

  /**
   * Log scheduled run to database (optional)
   */
  private async logScheduledRun(run: ScheduledRun) {
    try {
      // This could save to a 'scheduled_runs' table for history
      console.log('📝 Run logged:', {
        id: run.id,
        duration: run.endTime ? 
          Math.round((run.endTime.getTime() - run.startTime.getTime()) / 1000 / 60) + ' minutes' : 
          'unknown',
        searchTerms: run.searchTermsProcessed,
        jobsScraped: run.totalJobsScraped,
        jobsAnalyzed: run.totalJobsAnalyzed,
        status: run.status
      });
    } catch (error) {
      console.error('Failed to log scheduled run:', error);
    }
  }
}

// Singleton instance for global scheduler
let schedulerInstance: SchedulerService | null = null;

export function getScheduler(): SchedulerService {
  if (!schedulerInstance) {
    schedulerInstance = new SchedulerService();
  }
  return schedulerInstance;
}

export default SchedulerService;