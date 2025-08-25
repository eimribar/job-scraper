import { NextRequest, NextResponse } from 'next/server';
import { DataService } from '@/lib/services/dataService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const tool = searchParams.get('tool') || undefined;
    const confidence = searchParams.get('confidence') || undefined;
    const format = searchParams.get('format') || 'csv';

    // Validate format
    if (format !== 'csv' && format !== 'json') {
      return NextResponse.json(
        { error: 'Format must be csv or json' },
        { status: 400 }
      );
    }

    // Initialize data service
    const dataService = new DataService();

    // Export companies
    const exportData = await dataService.exportIdentifiedCompanies(
      tool, 
      confidence, 
      format as 'csv' | 'json'
    );

    // Set appropriate headers based on format
    const headers = new Headers();
    
    if (format === 'csv') {
      headers.set('Content-Type', 'text/csv');
      headers.set('Content-Disposition', `attachment; filename="sales-tool-companies-${new Date().toISOString().split('T')[0]}.csv"`);
    } else {
      headers.set('Content-Type', 'application/json');
      headers.set('Content-Disposition', `attachment; filename="sales-tool-companies-${new Date().toISOString().split('T')[0]}.json"`);
    }

    return new NextResponse(exportData, {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error('Export error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to export companies',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}