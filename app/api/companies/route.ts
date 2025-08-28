import { NextRequest, NextResponse } from 'next/server';
import { DataService } from '@/lib/services/dataService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const tool = searchParams.get('tool') || undefined;
    const confidence = searchParams.get('confidence') || undefined;
    const search = searchParams.get('search') || undefined;
    const source = searchParams.get('source') || undefined; // 'google_sheets', 'job_analysis', or undefined for all
    const excludeGoogleSheets = searchParams.get('excludeGoogleSheets') === 'true';
    
    const offset = (page - 1) * limit;

    // Initialize data service
    const dataService = new DataService();

    // Get companies with filters including source
    let companies = await dataService.getIdentifiedCompanies(
      limit, 
      offset, 
      tool, 
      confidence,
      excludeGoogleSheets ? 'job_analysis' : source
    );
    
    // Apply search filter if provided (client-side for now, could be moved to database)
    if (search) {
      const searchLower = search.toLowerCase();
      companies = companies.filter(company => 
        company.company_name.toLowerCase().includes(searchLower) ||
        company.job_title.toLowerCase().includes(searchLower)
      );
    }

    // Get total count with same filters including source
    const totalCount = await dataService.getIdentifiedCompaniesCount(
      tool, 
      confidence,
      excludeGoogleSheets ? 'job_analysis' : source
    );

    return NextResponse.json({
      success: true,
      companies,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: page * limit < totalCount,
        hasPreviousPage: page > 1,
      },
      filters: {
        tool,
        confidence,
        search,
        source: excludeGoogleSheets ? 'job_analysis' : source,
        excludeGoogleSheets,
      },
    });

  } catch (error) {
    console.error('Error fetching companies:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch companies',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}