/**
 * API Route: Get sync status
 * GET /api/sync/status
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncManager } from '@/lib/services/syncManager';

export async function GET(request: NextRequest) {
  try {
    // Initialize sync manager if needed
    await syncManager.initialize();
    
    // Get sync status
    const status = await syncManager.getSyncStatus();
    
    return NextResponse.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting sync status:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get sync status'
      },
      { status: 500 }
    );
  }
}