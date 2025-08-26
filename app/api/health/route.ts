import { NextRequest, NextResponse } from 'next/server';
import { healthMonitor } from '@/lib/services/healthMonitor';

export async function GET(request: NextRequest) {
  try {
    // Track the health check request
    healthMonitor.trackRequest();

    // Check for detailed metrics
    const searchParams = request.nextUrl.searchParams;
    const detailed = searchParams.get('detailed') === 'true';

    if (detailed) {
      const metrics = await healthMonitor.getDetailedMetrics();
      
      return NextResponse.json(metrics, {
        status: metrics.status === 'healthy' ? 200 : 
                metrics.status === 'degraded' ? 206 : 503,
      });
    }

    // Basic health check
    const health = await healthMonitor.getSystemHealth();
    
    // Return appropriate status code based on health
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 206 : 503;

    return NextResponse.json(health, { status: statusCode });
  } catch (error) {
    healthMonitor.trackError();
    
    console.error('Health check failed:', error);
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Health check failed',
        timestamp: new Date(),
      },
      { status: 503 }
    );
  }
}

// Simple liveness check
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}