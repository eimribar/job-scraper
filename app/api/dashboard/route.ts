import { NextResponse } from 'next/server';
import { DataService } from '@/lib/services/dataService-new';

export async function GET() {
  try {
    // Initialize data service
    const dataService = new DataService();

    // Get dashboard stats
    const stats = await dataService.getDashboardStats();

    return NextResponse.json({
      success: true,
      ...stats,
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch dashboard stats',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}