/**
 * MonitoringService
 * Real-time monitoring, alerting, and system health tracking
 */

import { EventEmitter } from 'events';
import { createServerSupabaseClient } from '../supabase';

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  lastCheck: Date;
  services: {
    database: ServiceHealth;
    scraper: ServiceHealth;
    analyzer: ServiceHealth;
    queue: ServiceHealth;
  };
  resources: {
    memoryUsage: number;
    cpuUsage: number;
    cacheSize: number;
    queueDepth: number;
  };
  errors: ErrorMetric[];
  alerts: Alert[];
}

export interface ServiceHealth {
  name: string;
  status: 'up' | 'down' | 'degraded';
  responseTime: number;
  successRate: number;
  lastError?: string;
  lastCheck: Date;
}

export interface ErrorMetric {
  timestamp: Date;
  service: string;
  type: string;
  message: string;
  count: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface Alert {
  id: string;
  type: 'error' | 'warning' | 'info';
  service: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  autoResolve: boolean;
  resolvedAt?: Date;
}

export interface PerformanceMetrics {
  timestamp: Date;
  scraping: {
    jobsPerMinute: number;
    avgProcessingTime: number;
    successRate: number;
    platformDistribution: Record<string, number>;
  };
  analysis: {
    requestsPerMinute: number;
    avgProcessingTime: number;
    cacheHitRate: number;
    costPerAnalysis: number;
  };
  database: {
    queryTime: number;
    connectionPoolUsage: number;
    activeConnections: number;
  };
  queue: {
    depth: number;
    throughput: number;
    avgWaitTime: number;
    failureRate: number;
  };
}

export class MonitoringService extends EventEmitter {
  private supabase;
  private startTime: Date;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;
  
  // Metrics storage
  private errors: Map<string, ErrorMetric> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private performanceHistory: PerformanceMetrics[] = [];
  private serviceHealthHistory: Map<string, ServiceHealth[]> = new Map();
  
  // Thresholds for alerting
  private readonly thresholds = {
    errorRate: 0.05, // 5% error rate
    responseTime: 5000, // 5 seconds
    memoryUsage: 0.8, // 80% memory
    queueDepth: 1000, // max queue items
    successRate: 0.95, // 95% success rate
    costPerAnalysis: 0.10 // $0.10 per analysis
  };

  // Service dependencies for health checks
  private services: Map<string, () => Promise<ServiceHealth>> = new Map();

  constructor() {
    super();
    this.supabase = createServerSupabaseClient();
    this.startTime = new Date();
    
    this.initializeServices();
    this.loadHistoricalData();
  }

  /**
   * Initialize service health checkers
   */
  private initializeServices(): void {
    // Database health check
    this.services.set('database', async () => {
      const start = Date.now();
      try {
        const { error } = await this.supabase
          .from('companies')
          .select('id')
          .limit(1);
        
        const responseTime = Date.now() - start;
        
        return {
          name: 'database',
          status: error ? 'down' : responseTime > 1000 ? 'degraded' : 'up',
          responseTime,
          successRate: error ? 0 : 1,
          lastError: error?.message,
          lastCheck: new Date()
        };
      } catch (error) {
        return {
          name: 'database',
          status: 'down',
          responseTime: Date.now() - start,
          successRate: 0,
          lastError: error instanceof Error ? error.message : 'Unknown error',
          lastCheck: new Date()
        };
      }
    });

    // Scraper health check
    this.services.set('scraper', async () => {
      // Check Apify API status
      const start = Date.now();
      try {
        const response = await fetch('https://api.apify.com/v2/acts', {
          headers: {
            'Authorization': `Bearer ${process.env.APIFY_API_TOKEN}`
          }
        });
        
        const responseTime = Date.now() - start;
        const isHealthy = response.ok;
        
        return {
          name: 'scraper',
          status: isHealthy ? 'up' : 'down',
          responseTime,
          successRate: isHealthy ? 1 : 0,
          lastError: !isHealthy ? `HTTP ${response.status}` : undefined,
          lastCheck: new Date()
        };
      } catch (error) {
        return {
          name: 'scraper',
          status: 'down',
          responseTime: Date.now() - start,
          successRate: 0,
          lastError: error instanceof Error ? error.message : 'Unknown error',
          lastCheck: new Date()
        };
      }
    });

    // Analyzer health check
    this.services.set('analyzer', async () => {
      const start = Date.now();
      try {
        if (!process.env.OPENAI_API_KEY) {
          return {
            name: 'analyzer',
            status: 'degraded',
            responseTime: 0,
            successRate: 0.5,
            lastError: 'API key not configured',
            lastCheck: new Date()
          };
        }

        // Test OpenAI API
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          }
        });
        
        const responseTime = Date.now() - start;
        const isHealthy = response.ok;
        
        return {
          name: 'analyzer',
          status: isHealthy ? 'up' : 'down',
          responseTime,
          successRate: isHealthy ? 1 : 0,
          lastError: !isHealthy ? `HTTP ${response.status}` : undefined,
          lastCheck: new Date()
        };
      } catch (error) {
        return {
          name: 'analyzer',
          status: 'down',
          responseTime: Date.now() - start,
          successRate: 0,
          lastError: error instanceof Error ? error.message : 'Unknown error',
          lastCheck: new Date()
        };
      }
    });

    // Queue health check (simplified)
    this.services.set('queue', async () => {
      return {
        name: 'queue',
        status: 'up',
        responseTime: 10,
        successRate: 1,
        lastCheck: new Date()
      };
    });
  }

  /**
   * Load historical monitoring data
   */
  private async loadHistoricalData(): Promise<void> {
    try {
      // Load recent errors from audit log
      const { data: recentErrors } = await this.supabase
        .from('audit_log')
        .select('*')
        .in('severity', ['error', 'critical'])
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('timestamp', { ascending: false })
        .limit(100);

      if (recentErrors) {
        recentErrors.forEach(error => {
          const key = `${error.event_type}_${error.event_category}`;
          
          if (!this.errors.has(key)) {
            this.errors.set(key, {
              timestamp: new Date(error.timestamp),
              service: error.event_category || 'unknown',
              type: error.event_type,
              message: error.event_data?.message || 'No message',
              count: 1,
              severity: error.severity as 'high' | 'critical'
            });
          } else {
            const existing = this.errors.get(key)!;
            existing.count++;
            existing.timestamp = new Date(error.timestamp);
          }
        });
      }

      // Load recent metrics
      const { data: recentMetrics } = await this.supabase
        .from('metrics')
        .select('*')
        .gte('bucket_time', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
        .order('bucket_time', { ascending: false });

      if (recentMetrics) {
        recentMetrics.forEach(metric => {
          this.performanceHistory.push({
            timestamp: new Date(metric.bucket_time),
            scraping: {
              jobsPerMinute: metric.jobs_scraped / 60,
              avgProcessingTime: metric.avg_scrape_time_ms || 0,
              successRate: 1 - (metric.error_count / Math.max(1, metric.jobs_scraped)),
              platformDistribution: {}
            },
            analysis: {
              requestsPerMinute: metric.jobs_analyzed / 60,
              avgProcessingTime: metric.avg_analysis_time_ms || 0,
              cacheHitRate: metric.cache_hits / Math.max(1, metric.jobs_analyzed),
              costPerAnalysis: metric.openai_cost / Math.max(1, metric.jobs_analyzed)
            },
            database: {
              queryTime: 0,
              connectionPoolUsage: 0,
              activeConnections: 0
            },
            queue: {
              depth: 0,
              throughput: (metric.jobs_scraped + metric.jobs_analyzed) / 60,
              avgWaitTime: 0,
              failureRate: metric.error_count / Math.max(1, metric.jobs_scraped + metric.jobs_analyzed)
            }
          });
        });
      }

      console.log(`📊 Loaded monitoring history: ${this.errors.size} errors, ${this.performanceHistory.length} metrics`);
    } catch (error) {
      console.error('Failed to load monitoring history:', error);
    }
  }

  /**
   * Start monitoring
   */
  start(): void {
    // Health check every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000);

    // Metrics collection every minute
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, 60000);

    // Initial checks
    this.performHealthCheck();
    this.collectMetrics();

    console.log('🔍 Monitoring service started');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    console.log('⏹️ Monitoring service stopped');
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    const health: SystemHealth = {
      status: 'healthy',
      uptime: Date.now() - this.startTime.getTime(),
      lastCheck: new Date(),
      services: {
        database: await this.checkService('database'),
        scraper: await this.checkService('scraper'),
        analyzer: await this.checkService('analyzer'),
        queue: await this.checkService('queue')
      },
      resources: {
        memoryUsage: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal,
        cpuUsage: 0, // Would need additional library for accurate CPU
        cacheSize: 0, // Would need to track from actual cache
        queueDepth: 0 // Would need to get from queue manager
      },
      errors: Array.from(this.errors.values()),
      alerts: Array.from(this.alerts.values()).filter(a => !a.resolvedAt)
    };

    // Determine overall health status
    const unhealthyServices = Object.values(health.services).filter(s => s.status === 'down');
    const degradedServices = Object.values(health.services).filter(s => s.status === 'degraded');

    if (unhealthyServices.length > 0) {
      health.status = 'unhealthy';
      this.createAlert('error', 'system', `${unhealthyServices.length} services are down`);
    } else if (degradedServices.length > 1) {
      health.status = 'degraded';
      this.createAlert('warning', 'system', `${degradedServices.length} services are degraded`);
    }

    // Check resource thresholds
    if (health.resources.memoryUsage > this.thresholds.memoryUsage) {
      this.createAlert('warning', 'resources', `High memory usage: ${(health.resources.memoryUsage * 100).toFixed(1)}%`);
    }

    // Store health check result
    await this.storeHealthCheck(health);
    
    this.emit('healthCheck', health);
  }

  /**
   * Check individual service health
   */
  private async checkService(name: string): Promise<ServiceHealth> {
    const checker = this.services.get(name);
    
    if (!checker) {
      return {
        name,
        status: 'down',
        responseTime: 0,
        successRate: 0,
        lastError: 'Service checker not found',
        lastCheck: new Date()
      };
    }

    try {
      const health = await checker();
      
      // Store health history
      if (!this.serviceHealthHistory.has(name)) {
        this.serviceHealthHistory.set(name, []);
      }
      
      const history = this.serviceHealthHistory.get(name)!;
      history.push(health);
      
      // Keep only last 100 checks
      if (history.length > 100) {
        history.shift();
      }

      // Check for alerts
      if (health.status === 'down') {
        this.createAlert('error', name, `Service ${name} is down: ${health.lastError}`);
      } else if (health.responseTime > this.thresholds.responseTime) {
        this.createAlert('warning', name, `Service ${name} slow response: ${health.responseTime}ms`);
      }

      return health;
    } catch (error) {
      return {
        name,
        status: 'down',
        responseTime: 0,
        successRate: 0,
        lastError: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date()
      };
    }
  }

  /**
   * Collect performance metrics
   */
  private async collectMetrics(): Promise<void> {
    const metrics: PerformanceMetrics = {
      timestamp: new Date(),
      scraping: {
        jobsPerMinute: this.calculateRate('scraping'),
        avgProcessingTime: this.calculateAvgTime('scraping'),
        successRate: this.calculateSuccessRate('scraping'),
        platformDistribution: await this.getPlatformDistribution()
      },
      analysis: {
        requestsPerMinute: this.calculateRate('analysis'),
        avgProcessingTime: this.calculateAvgTime('analysis'),
        cacheHitRate: await this.getCacheHitRate(),
        costPerAnalysis: await this.getAvgCost()
      },
      database: {
        queryTime: await this.getDbQueryTime(),
        connectionPoolUsage: 0, // Would need actual pool stats
        activeConnections: 0 // Would need actual connection stats
      },
      queue: {
        depth: await this.getQueueDepth(),
        throughput: this.calculateRate('queue'),
        avgWaitTime: this.calculateAvgTime('queue'),
        failureRate: this.calculateFailureRate('queue')
      }
    };

    // Check for threshold violations
    if (metrics.analysis.costPerAnalysis > this.thresholds.costPerAnalysis) {
      this.createAlert('warning', 'cost', `High analysis cost: $${metrics.analysis.costPerAnalysis.toFixed(3)}`);
    }

    if (metrics.scraping.successRate < this.thresholds.successRate) {
      this.createAlert('warning', 'scraping', `Low scraping success rate: ${(metrics.scraping.successRate * 100).toFixed(1)}%`);
    }

    // Store metrics
    await this.storeMetrics(metrics);
    
    this.performanceHistory.push(metrics);
    
    // Keep only last 1000 metrics
    if (this.performanceHistory.length > 1000) {
      this.performanceHistory.shift();
    }

    this.emit('metricsCollected', metrics);
  }

  /**
   * Create or update alert
   */
  private createAlert(
    type: 'error' | 'warning' | 'info',
    service: string,
    message: string,
    autoResolve: boolean = true
  ): void {
    const alertKey = `${service}_${type}_${message}`;
    
    if (this.alerts.has(alertKey)) {
      // Update existing alert
      const alert = this.alerts.get(alertKey)!;
      alert.timestamp = new Date();
    } else {
      // Create new alert
      const alert: Alert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        type,
        service,
        message,
        timestamp: new Date(),
        acknowledged: false,
        autoResolve
      };
      
      this.alerts.set(alertKey, alert);
      this.emit('alertCreated', alert);
      
      // Log to audit
      this.logAlert(alert);
    }
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): void {
    for (const alert of this.alerts.values()) {
      if (alert.id === alertId) {
        alert.acknowledged = true;
        alert.resolvedAt = new Date();
        this.emit('alertAcknowledged', alert);
        break;
      }
    }
  }

  /**
   * Log error
   */
  logError(service: string, type: string, message: string, severity: ErrorMetric['severity'] = 'medium'): void {
    const key = `${service}_${type}`;
    
    if (this.errors.has(key)) {
      const error = this.errors.get(key)!;
      error.count++;
      error.timestamp = new Date();
      error.message = message;
    } else {
      this.errors.set(key, {
        timestamp: new Date(),
        service,
        type,
        message,
        count: 1,
        severity
      });
    }

    // Create alert for critical errors
    if (severity === 'critical') {
      this.createAlert('error', service, `Critical error: ${message}`, false);
    }
  }

  /**
   * Get current system health
   */
  async getHealth(): Promise<SystemHealth> {
    await this.performHealthCheck();
    
    return {
      status: 'healthy',
      uptime: Date.now() - this.startTime.getTime(),
      lastCheck: new Date(),
      services: {
        database: await this.checkService('database'),
        scraper: await this.checkService('scraper'),
        analyzer: await this.checkService('analyzer'),
        queue: await this.checkService('queue')
      },
      resources: {
        memoryUsage: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal,
        cpuUsage: 0,
        cacheSize: 0,
        queueDepth: 0
      },
      errors: Array.from(this.errors.values()),
      alerts: Array.from(this.alerts.values()).filter(a => !a.resolvedAt)
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(limit: number = 100): PerformanceMetrics[] {
    return this.performanceHistory.slice(-limit);
  }

  /**
   * Helper methods for metrics calculation
   */
  private calculateRate(service: string): number {
    // Simplified - would need actual event tracking
    return Math.random() * 10;
  }

  private calculateAvgTime(service: string): number {
    // Simplified - would need actual timing data
    return 500 + Math.random() * 1000;
  }

  private calculateSuccessRate(service: string): number {
    // Simplified - would need actual success/failure tracking
    return 0.9 + Math.random() * 0.1;
  }

  private calculateFailureRate(service: string): number {
    return 1 - this.calculateSuccessRate(service);
  }

  private async getPlatformDistribution(): Promise<Record<string, number>> {
    // Would get from actual scraping service
    return {
      indeed: 0.6,
      linkedin: 0.4
    };
  }

  private async getCacheHitRate(): Promise<number> {
    // Would get from actual analyzer service
    return 0.7 + Math.random() * 0.2;
  }

  private async getAvgCost(): Promise<number> {
    // Would get from actual analyzer service
    return 0.002 + Math.random() * 0.003;
  }

  private async getDbQueryTime(): Promise<number> {
    const start = Date.now();
    await this.supabase.from('companies').select('id').limit(1);
    return Date.now() - start;
  }

  private async getQueueDepth(): Promise<number> {
    const { count } = await this.supabase
      .from('job_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    
    return count || 0;
  }

  /**
   * Store health check in database
   */
  private async storeHealthCheck(health: SystemHealth): Promise<void> {
    try {
      await this.supabase
        .from('audit_log')
        .insert({
          event_type: 'health_check',
          event_category: 'system',
          severity: health.status === 'unhealthy' ? 'error' : 
                   health.status === 'degraded' ? 'warning' : 'info',
          event_data: health
        });
    } catch (error) {
      console.error('Failed to store health check:', error);
    }
  }

  /**
   * Store metrics in database
   */
  private async storeMetrics(metrics: PerformanceMetrics): Promise<void> {
    try {
      await this.supabase
        .from('metrics')
        .insert({
          bucket_time: metrics.timestamp.toISOString(),
          bucket_interval: '1 minute',
          jobs_scraped: Math.round(metrics.scraping.jobsPerMinute * 60),
          jobs_analyzed: Math.round(metrics.analysis.requestsPerMinute * 60),
          cache_hits: Math.round(metrics.analysis.cacheHitRate * metrics.analysis.requestsPerMinute * 60),
          avg_scrape_time_ms: Math.round(metrics.scraping.avgProcessingTime),
          avg_analysis_time_ms: Math.round(metrics.analysis.avgProcessingTime),
          openai_cost: metrics.analysis.costPerAnalysis * metrics.analysis.requestsPerMinute * 60,
          error_count: Math.round((1 - metrics.scraping.successRate) * metrics.scraping.jobsPerMinute * 60)
        });
    } catch (error) {
      console.error('Failed to store metrics:', error);
    }
  }

  /**
   * Log alert to database
   */
  private async logAlert(alert: Alert): Promise<void> {
    try {
      await this.supabase
        .from('audit_log')
        .insert({
          event_type: 'alert',
          event_category: alert.service,
          severity: alert.type === 'error' ? 'error' : 
                   alert.type === 'warning' ? 'warning' : 'info',
          event_data: alert
        });
    } catch (error) {
      console.error('Failed to log alert:', error);
    }
  }
}