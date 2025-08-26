import { NextResponse } from 'next/server';
import { DataService } from '@/lib/services/dataService';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tool = searchParams.get('tool') || undefined;
  const confidence = searchParams.get('confidence') || undefined;
  const format = searchParams.get('format') || 'csv';
  
  const dataService = new DataService();
  
  try {
    const data = await dataService.exportIdentifiedCompanies(
      tool,
      confidence,
      format as 'csv' | 'json'
    );
    
    const headers = new Headers();
    if (format === 'json') {
      headers.set('Content-Type', 'application/json');
      headers.set('Content-Disposition', `attachment; filename="companies-${new Date().toISOString().split('T')[0]}.json"`);
    } else {
      headers.set('Content-Type', 'text/csv');
      headers.set('Content-Disposition', `attachment; filename="companies-${new Date().toISOString().split('T')[0]}.csv"`);
    }
    
    return new NextResponse(data, { headers });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Failed to export companies' }, { status: 500 });
  }
}