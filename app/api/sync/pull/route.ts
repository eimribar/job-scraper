/**
 * API Route: Pull data from Google Sheets to Supabase
 * GET /api/sync/pull
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncManager } from '@/lib/services/syncManager';

export async function GET(request: NextRequest) {
  try {
    console.log('Starting pull sync from Google Sheets...');
    
    // Initialize sync manager
    await syncManager.initialize();
    
    // Perform initial sync (pull from Sheets)
    const results = await syncManager.initialSync();
    
    return NextResponse.json({
      success: true,
      message: 'Successfully synced data from Google Sheets',
      data: results
    });
  } catch (error) {
    console.error('Sync pull error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}