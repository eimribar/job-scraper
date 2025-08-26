/**
 * Company Deduplication API
 */

import { NextRequest, NextResponse } from 'next/server';
import { CompanyDeduplicator } from '@/lib/services/companyDeduplicator';

const deduplicator = new CompanyDeduplicator();

export async function POST(req: NextRequest) {
  try {
    const { company, threshold = 0.7 } = await req.json();

    if (!company) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      );
    }

    // Check for duplicates
    const result = await deduplicator.deduplicate(company);
    
    // Find similar companies
    const similar = await deduplicator.findSimilar(company, threshold);

    return NextResponse.json({
      success: true,
      result,
      similar,
      normalized: deduplicator.normalize(company),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to process deduplication',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { primaryId, duplicateIds } = await req.json();

    if (!primaryId || !duplicateIds || !Array.isArray(duplicateIds)) {
      return NextResponse.json(
        { error: 'Primary ID and duplicate IDs are required' },
        { status: 400 }
      );
    }

    // Merge duplicates
    await deduplicator.mergeDuplicates(primaryId, duplicateIds);

    return NextResponse.json({
      success: true,
      message: `Merged ${duplicateIds.length} duplicates into primary company`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to merge duplicates',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Get deduplication statistics
    const stats = await deduplicator.getStats();

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to get statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}