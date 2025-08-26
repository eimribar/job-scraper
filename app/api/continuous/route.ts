/**
 * Continuous Processing Control API
 */

import { NextRequest, NextResponse } from 'next/server';
import { IntelligenceEngine } from '@/lib/services/intelligenceEngine';

// Singleton instance
let intelligenceEngine: IntelligenceEngine | null = null;

function getEngine() {
  if (!intelligenceEngine) {
    intelligenceEngine = new IntelligenceEngine();
  }
  return intelligenceEngine;
}

export async function POST(req: NextRequest) {
  try {
    const { action, intervalMinutes = 30 } = await req.json();
    const engine = getEngine();

    if (action === 'start') {
      engine.startContinuousProcessing(intervalMinutes);
      
      return NextResponse.json({
        success: true,
        message: `Continuous processing started (every ${intervalMinutes} minutes)`,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'stop') {
      engine.stopContinuousProcessing();
      
      return NextResponse.json({
        success: true,
        message: 'Continuous processing stopped',
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'status') {
      const metrics = engine.getMetrics();
      const insights = engine.getInsights(5);
      
      return NextResponse.json({
        success: true,
        metrics,
        insights,
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use: start, stop, or status' },
      { status: 400 }
    );

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to control continuous processing',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const engine = getEngine();
    const metrics = engine.getMetrics();
    const insights = engine.getInsights(10);

    return NextResponse.json({
      success: true,
      status: 'ready',
      metrics,
      insights,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to get status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}