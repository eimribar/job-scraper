/**
 * API Route: Webhook for Google Sheets changes
 * POST /api/sync/webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncManager } from '@/lib/services/syncManager';

export async function POST(request: NextRequest) {
  try {
    // Parse webhook data from Google Sheets
    const body = await request.json();
    
    console.log('Google Sheets webhook received:', body);
    
    // Verify webhook is from Google (optional security check)
    const authHeader = request.headers.get('authorization');
    if (process.env.WEBHOOK_SECRET && authHeader !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Initialize sync manager
    await syncManager.initialize();
    
    // Handle the webhook
    await syncManager.handleSheetWebhook(body);
    
    // Perform sync from Sheets
    const results = await syncManager.syncFromSheets();
    
    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
      data: results
    });
  } catch (error) {
    console.error('Webhook error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

// Google Sheets sends GET requests for webhook verification
export async function GET(request: NextRequest) {
  // Return challenge for webhook verification
  const challenge = request.nextUrl.searchParams.get('challenge');
  
  if (challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain'
      }
    });
  }
  
  return NextResponse.json({
    success: true,
    message: 'Webhook endpoint is active'
  });
}