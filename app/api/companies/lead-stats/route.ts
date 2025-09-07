import { NextRequest, NextResponse } from 'next/server';
import { DataService } from '@/lib/services/dataService';

export async function GET(request: NextRequest) {
  try {
    const dataService = new DataService();
    const stats = await dataService.getLeadStats();

    return NextResponse.json({
      success: true,
      stats
    });
  } catch (error: any) {
    console.error('Error fetching lead stats:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch lead stats' },
      { status: 500 }
    );
  }
}