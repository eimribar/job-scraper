/**
 * System Health Monitoring API
 */

import { NextRequest, NextResponse } from 'next/server';
import { MonitoringService } from '@/lib/services/monitoringService';

const monitoring = new MonitoringService();

// Start monitoring on first request
let isMonitoringStarted = false;

export async function GET(req: NextRequest) {
  try {
    // Start monitoring if not already started
    if (!isMonitoringStarted) {
      monitoring.start();
      isMonitoringStarted = true;
    }

    const health = await monitoring.getHealth();
    
    // Determine HTTP status based on health
    const status = health.status === 'healthy' ? 200 :
                   health.status === 'degraded' ? 206 : 503;

    return NextResponse.json(health, { status });
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'unhealthy',
        error: 'Failed to check health',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action, alertId } = await req.json();

    if (action === 'acknowledge' && alertId) {
      monitoring.acknowledgeAlert(alertId);
      return NextResponse.json({ success: true, message: 'Alert acknowledged' });
    }

    if (action === 'start') {
      monitoring.start();
      isMonitoringStarted = true;
      return NextResponse.json({ success: true, message: 'Monitoring started' });
    }

    if (action === 'stop') {
      monitoring.stop();
      isMonitoringStarted = false;
      return NextResponse.json({ success: true, message: 'Monitoring stopped' });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to process action',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}