// Base service class with retry logic and error handling
export interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  backoffMultiplier?: number;
  maxDelay?: number;
}

export class ServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export abstract class BaseService {
  protected defaultRetryOptions: RetryOptions = {
    maxRetries: 3,
    retryDelay: 1000,
    backoffMultiplier: 2,
    maxDelay: 30000,
  };

  protected async withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const opts = { ...this.defaultRetryOptions, ...options };
    let lastError: Error | undefined;
    let delay = opts.retryDelay || 1000;

    for (let attempt = 1; attempt <= (opts.maxRetries || 3); attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on certain errors
        if (this.isNonRetryableError(error)) {
          throw error;
        }

        if (attempt < (opts.maxRetries || 3)) {
          console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`, {
            error: lastError.message,
          });
          
          await this.sleep(delay);
          
          // Exponential backoff
          delay = Math.min(
            delay * (opts.backoffMultiplier || 2),
            opts.maxDelay || 30000
          );
        }
      }
    }

    throw new ServiceError(
      `Operation failed after ${opts.maxRetries} attempts`,
      'MAX_RETRIES_EXCEEDED',
      500,
      { lastError: lastError?.message }
    );
  }

  protected isNonRetryableError(error: any): boolean {
    // Don't retry on client errors (4xx)
    if (error?.statusCode >= 400 && error?.statusCode < 500) {
      return true;
    }

    // Don't retry on specific error codes
    const nonRetryableCodes = [
      'INVALID_API_KEY',
      'QUOTA_EXCEEDED',
      'RATE_LIMIT_EXCEEDED',
      'INVALID_REQUEST',
      'AUTHENTICATION_FAILED',
    ];

    return error?.code && nonRetryableCodes.includes(error.code);
  }

  protected async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected handleError(error: any, context: string): never {
    console.error(`Error in ${context}:`, error);

    if (error instanceof ServiceError) {
      throw error;
    }

    if (error?.response?.status) {
      throw new ServiceError(
        error.response.statusText || 'API request failed',
        'API_ERROR',
        error.response.status,
        { 
          context,
          message: error.message,
          response: error.response?.data,
        }
      );
    }

    throw new ServiceError(
      error?.message || 'Unknown error occurred',
      'UNKNOWN_ERROR',
      500,
      { context, error: String(error) }
    );
  }

  protected validateConfig(requiredVars: string[]): void {
    const missing = requiredVars.filter(v => !process.env[v]);
    
    if (missing.length > 0) {
      throw new ServiceError(
        `Missing required environment variables: ${missing.join(', ')}`,
        'CONFIGURATION_ERROR',
        500,
        { missing }
      );
    }
  }
}