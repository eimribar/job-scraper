import { NextRequest, NextResponse } from 'next/server';
import { DataService } from '@/lib/services/dataService';

const dataService = new DataService();

export async function GET(req: NextRequest) {
  try {
    const stats = await dataService.getDashboardStats();
    
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}