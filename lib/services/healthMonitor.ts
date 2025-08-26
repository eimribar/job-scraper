export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  lastCheck: Date;
  responseTime?: number;
  details?: Record<string, any>;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: ServiceHealth[];
  metrics: {
    uptime: number;
    memoryUsage: number;
    cpuUsage?: number;
    requestsPerMinute: number;
    errorRate: number;
  };
  timestamp: Date;
}

export class HealthMonitor {
  private startTime: Date;
  private requestCount: number = 0;
  private errorCount: number = 0;
  private lastMinuteRequests: number[] = [];
  private lastMinuteErrors: number[] = [];

  constructor() {
    this.startTime = new Date();
    
    // Clean up old metrics every minute
    setInterval(() => this.cleanupMetrics(), 60000);
  }

  async checkSupabase(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      const { createServerSupabaseClient } = require('../supabase');
      const supabase = createServerSupabaseClient();
      
      if (!supabase) {
        return {
          name: 'Supabase',
          status: 'unhealthy',
          message: 'Not configured',
          lastCheck: new Date(),
        };
      }

      // Try a simple query
      const { error } = await supabase
        .from('search_terms')
        .select('id')
        .limit(1);

      const responseTime = Date.now() - startTime;

      if (error) {
        return {
          name: 'Supabase',
          status: 'unhealthy',
          message: error.message,
          lastCheck: new Date(),
          responseTime,
        };
      }

      return {
        name: 'Supabase',
        status: 'healthy',
        message: 'Connected',
        lastCheck: new Date(),
        responseTime,
      };
    } catch (error) {
      return {
        name: 'Supabase',
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
      };
    }
  }

  async checkOpenAI(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      if (!process.env.OPENAI_API_KEY) {
        return {
          name: 'OpenAI',
          status: 'unhealthy',
          message: 'API key not configured',
          lastCheck: new Date(),
        };
      }

      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      });

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        return {
          name: 'OpenAI',
          status: 'unhealthy',
          message: `HTTP ${response.status}`,
          lastCheck: new Date(),
          responseTime,
        };
      }

      return {
        name: 'OpenAI',
        status: 'healthy',
        message: 'API accessible',
        lastCheck: new Date(),
        responseTime,
      };
    } catch (error) {
      return {
        name: 'OpenAI',
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
      };
    }
  }

  async checkApify(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      if (!process.env.APIFY_TOKEN) {
        return {
          name: 'Apify',
          status: 'unhealthy',
          message: 'Token not configured',
          lastCheck: new Date(),
        };
      }

      const response = await fetch(
        `https://api.apify.com/v2/acts?token=${process.env.APIFY_TOKEN}&limit=1`
      );

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        return {
          name: 'Apify',
          status: 'unhealthy',
          message: `HTTP ${response.status}`,
          lastCheck: new Date(),
          responseTime,
        };
      }

      return {
        name: 'Apify',
        status: 'healthy',
        message: 'API accessible',
        lastCheck: new Date(),
        responseTime,
      };
    } catch (error) {
      return {
        name: 'Apify',
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
      };
    }
  }

  async checkQueues(): Promise<ServiceHealth> {
    try {
      const { scrapingQueue, analysisQueue, exportQueue } = require('./jobQueue');
      
      const scrapingStats = scrapingQueue.getStats();
      const analysisStats = analysisQueue.getStats();
      const exportStats = exportQueue.getStats();

      const totalPending = scrapingStats.pending + analysisStats.pending + exportStats.pending;
      const totalProcessing = scrapingStats.processing + analysisStats.processing + exportStats.processing;
      const totalFailed = scrapingStats.failed + analysisStats.failed + exportStats.failed;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = 'All queues operational';

      if (totalFailed > 10) {
        status = 'unhealthy';
        message = `High failure rate: ${totalFailed} jobs failed`;
      } else if (totalPending > 100) {
        status = 'degraded';
        message = `Queue backlog: ${totalPending} pending jobs`;
      }

      return {
        name: 'Job Queues',
        status,
        message,
        lastCheck: new Date(),
        details: {
          scraping: scrapingStats,
          analysis: analysisStats,
          export: exportStats,
        },
      };
    } catch (error) {
      return {
        name: 'Job Queues',
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date(),
      };
    }
  }

  async checkRateLimiters(): Promise<ServiceHealth> {
    try {
      const { scraperRateLimiter, analysisRateLimiter, apiRateLimiter } = require('./rateLimiter');
      
      const scraperStatus = scraperRateLimiter.getQueueStatus();
      const analysisStatus = analysisRateLimiter.getQueueStatus();
      const apiStatus = apiRateLimiter.getQueueStatus();

      const totalQueued = scraperStatus.queued + analysisStatus.queued + apiStatus.queued;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = 'Rate limiting operational';

      if (totalQueued > 50) {
        status = 'degraded';
        message = `High queue depth: ${totalQueued} requests queued`;
      }

      return {
        name: 'Rate Limiters',
        status,
        message,
        lastCheck: new Date(),
        details: {
          scraper: scraperStatus,
          analysis: analysisStatus,
          api: apiStatus,
        },
      };
    } catch (error) {
      return {
        name: 'Rate Limiters',
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date(),
      };
    }
  }

  trackRequest(): void {
    this.requestCount++;
    this.lastMinuteRequests.push(Date.now());
  }

  trackError(): void {
    this.errorCount++;
    this.lastMinuteErrors.push(Date.now());
  }

  private cleanupMetrics(): void {
    const oneMinuteAgo = Date.now() - 60000;
    
    this.lastMinuteRequests = this.lastMinuteRequests.filter(
      time => time > oneMinuteAgo
    );
    
    this.lastMinuteErrors = this.lastMinuteErrors.filter(
      time => time > oneMinuteAgo
    );
  }

  private getMemoryUsage(): number {
    const used = process.memoryUsage();
    return Math.round((used.heapUsed / used.heapTotal) * 100);
  }

  private getUptime(): number {
    return Date.now() - this.startTime.getTime();
  }

  private getErrorRate(): number {
    if (this.lastMinuteRequests.length === 0) return 0;
    return (this.lastMinuteErrors.length / this.lastMinuteRequests.length) * 100;
  }

  async getSystemHealth(): Promise<SystemHealth> {
    const services = await Promise.all([
      this.checkSupabase(),
      this.checkOpenAI(),
      this.checkApify(),
      this.checkQueues(),
      this.checkRateLimiters(),
    ]);

    // Determine overall status
    const unhealthyCount = services.filter(s => s.status === 'unhealthy').length;
    const degradedCount = services.filter(s => s.status === 'degraded').length;
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (unhealthyCount > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedCount > 0) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      services,
      metrics: {
        uptime: this.getUptime(),
        memoryUsage: this.getMemoryUsage(),
        requestsPerMinute: this.lastMinuteRequests.length,
        errorRate: this.getErrorRate(),
      },
      timestamp: new Date(),
    };
  }

  async getDetailedMetrics(): Promise<any> {
    const health = await this.getSystemHealth();
    
    return {
      ...health,
      detailed: {
        totalRequests: this.requestCount,
        totalErrors: this.errorCount,
        startTime: this.startTime,
        currentTime: new Date(),
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          env: process.env.NODE_ENV || 'development',
        },
      },
    };
  }
}

// Create singleton instance
export const healthMonitor = new HealthMonitor();