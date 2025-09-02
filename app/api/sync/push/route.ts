/**
 * API Route: Push data from Supabase to Google Sheets
 * POST /api/sync/push
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncManager } from '@/lib/services/syncManager';
import { createApiSupabaseClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    console.log('Starting push sync to Google Sheets...');
    
    const supabase = createApiSupabaseClient();
    
    // Initialize sync manager
    await syncManager.initialize();
    
    // Get unsynced identified companies
    const { data: unsyncedCompanies, error } = await supabase
      .from('identified_companies')
      .select('*')
      .is('sheet_row', null);

    if (error) {
      throw error;
    }

    if (!unsyncedCompanies || unsyncedCompanies.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new companies to sync',
        data: { companiesSynced: 0 }
      });
    }

    // Sync each company to Sheets
    let synced = 0;
    for (const company of unsyncedCompanies) {
      try {
        await syncManager.syncToSheets('identified_companies', company);
        synced++;
      } catch (error) {
        console.error(`Failed to sync company ${company.company}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${synced} companies to Google Sheets`,
      data: { 
        companiesSynced: synced,
        totalAttempted: unsyncedCompanies.length
      }
    });
  } catch (error) {
    console.error('Sync push error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}