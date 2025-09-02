/**
 * API Route: Get processor status and statistics
 * GET /api/process/status
 */

import { NextRequest, NextResponse } from 'next/server';
import { continuousProcessor } from '@/lib/services/continuousProcessor';

export async function GET(request: NextRequest) {
  try {
    // Get processor status
    const status = continuousProcessor.getStatus();
    
    // Get processing statistics
    const stats = await continuousProcessor.getStats();
    
    return NextResponse.json({
      success: true,
      data: {
        processor: status,
        statistics: stats
      }
    });
  } catch (error) {
    console.error('Error getting processor status:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get status'
      },
      { status: 500 }
    );
  }
}