/**
 * API Route: Start continuous processor
 * POST /api/process/start
 */

import { NextRequest, NextResponse } from 'next/server';
import { continuousProcessor } from '@/lib/services/continuousProcessor';

// Store processor instance globally to persist across requests
let processorInstance: any = null;

export async function POST(request: NextRequest) {
  try {
    // Check if processor is already running
    const status = continuousProcessor.getStatus();
    
    if (status.isRunning) {
      return NextResponse.json({
        success: true,
        message: 'Processor is already running',
        data: status
      });
    }
    
    // Start processor in background (non-blocking)
    processorInstance = continuousProcessor.start();
    
    // Wait a moment to ensure it started
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get updated status
    const newStatus = continuousProcessor.getStatus();
    
    return NextResponse.json({
      success: true,
      message: 'Continuous processor started successfully',
      data: newStatus
    });
  } catch (error) {
    console.error('Error starting processor:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start processor'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}