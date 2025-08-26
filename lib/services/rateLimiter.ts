// Rate limiter for API calls
export class RateLimiter {
  private queue: Array<() => void> = [];
  private running = 0;
  private lastCallTime = 0;
  
  constructor(
    private maxConcurrent: number = 1,
    private minTimeBetweenCalls: number = 100,
    private maxPerMinute?: number
  ) {}

  private callsInLastMinute: number[] = [];

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          // Wait for minimum time between calls
          const timeSinceLastCall = Date.now() - this.lastCallTime;
          if (timeSinceLastCall < this.minTimeBetweenCalls) {
            await this.sleep(this.minTimeBetweenCalls - timeSinceLastCall);
          }

          // Check per-minute rate limit
          if (this.maxPerMinute) {
            await this.waitForRateLimit();
          }

          this.lastCallTime = Date.now();
          this.trackCall();
          
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.running--;
          this.processQueue();
        }
      });

      this.processQueue();
    });
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Clean up old calls
    this.callsInLastMinute = this.callsInLastMinute.filter(
      time => time > oneMinuteAgo
    );

    // If we've hit the limit, wait
    if (this.maxPerMinute && this.callsInLastMinute.length >= this.maxPerMinute) {
      const oldestCall = this.callsInLastMinute[0];
      const waitTime = oldestCall + 60000 - now;
      
      if (waitTime > 0) {
        console.log(`Rate limit reached. Waiting ${waitTime}ms...`);
        await this.sleep(waitTime);
        
        // Recursively check again
        return this.waitForRateLimit();
      }
    }
  }

  private trackCall(): void {
    if (this.maxPerMinute) {
      this.callsInLastMinute.push(Date.now());
    }
  }

  private processQueue(): void {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.running++;
    const fn = this.queue.shift();
    if (fn) {
      fn();
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getQueueStatus(): { queued: number; running: number; callsInLastMinute: number } {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    return {
      queued: this.queue.length,
      running: this.running,
      callsInLastMinute: this.callsInLastMinute.filter(time => time > oneMinuteAgo).length,
    };
  }
}

// Create singleton instances for different services
export const scraperRateLimiter = new RateLimiter(
  1, // max concurrent
  5000, // 5 seconds between calls
  parseInt(process.env.SCRAPING_RATE_LIMIT || '10') // per minute
);

export const analysisRateLimiter = new RateLimiter(
  parseInt(process.env.MAX_CONCURRENT_ANALYSIS || '5'), // max concurrent
  100, // 100ms between calls
  parseInt(process.env.ANALYSIS_RATE_LIMIT || '30') // per minute
);

export const apiRateLimiter = new RateLimiter(
  10, // max concurrent
  10, // 10ms between calls
  parseInt(process.env.API_RATE_LIMIT_PER_MINUTE || '100') // per minute
);