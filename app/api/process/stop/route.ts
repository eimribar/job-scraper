/**
 * API Route: Stop continuous processor
 * POST /api/process/stop
 */

import { NextRequest, NextResponse } from 'next/server';
import { continuousProcessor } from '@/lib/services/continuousProcessor';

export async function POST(request: NextRequest) {
  try {
    // Check current status
    const status = continuousProcessor.getStatus();
    
    if (!status.isRunning) {
      return NextResponse.json({
        success: true,
        message: 'Processor is not running',
        data: status
      });
    }
    
    // Stop the processor
    await continuousProcessor.stop();
    
    // Get final status
    const finalStatus = continuousProcessor.getStatus();
    
    return NextResponse.json({
      success: true,
      message: 'Processor stopped successfully',
      data: finalStatus
    });
  } catch (error) {
    console.error('Error stopping processor:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop processor'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}