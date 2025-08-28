import { NextResponse } from 'next/server';
import { DataService } from '@/lib/services/dataService';

export async function GET() {
  try {
    const dataService = new DataService();
    
    // Get counts for each source
    const [totalCount, newDiscoveriesCount, googleSheetsCount] = await Promise.all([
      dataService.getIdentifiedCompaniesCount(),
      dataService.getIdentifiedCompaniesCount(undefined, undefined, 'job_analysis'),
      dataService.getIdentifiedCompaniesCount(undefined, undefined, 'google_sheets')
    ]);
    
    return NextResponse.json({
      success: true,
      stats: {
        total: totalCount,
        newDiscoveries: newDiscoveriesCount,
        googleSheets: googleSheetsCount,
        breakdown: {
          job_analysis: newDiscoveriesCount,
          google_sheets: googleSheetsCount,
          untagged: totalCount - newDiscoveriesCount - googleSheetsCount
        }
      }
    });
  } catch (error) {
    console.error('Error fetching company stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}