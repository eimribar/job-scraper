import { NextResponse } from 'next/server';
import { JobProcessor } from '@/lib/services/jobProcessor';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { searchTerm, maxItems } = body;

    if (!searchTerm) {
      return NextResponse.json(
        { error: 'Search term is required' },
        { status: 400 }
      );
    }

    const processor = new JobProcessor();
    
    // Check if already processing
    const status = processor.getStatus();
    if (status.isProcessing) {
      return NextResponse.json(
        { 
          error: 'A job is already being processed',
          currentStats: status.currentStats
        },
        { status: 409 }
      );
    }

    console.log(`API: Triggering scrape for search term: ${searchTerm}${maxItems ? ` (max ${maxItems} items)` : ''}`);

    // Start processing (this will run sequentially)
    const stats = await processor.processSearchTerm(searchTerm, maxItems);

    return NextResponse.json({
      success: true,
      stats: {
        searchTerm: stats.searchTerm,
        totalScraped: stats.totalScraped,
        newJobs: stats.newJobs,
        analyzed: stats.analyzed,
        failed: stats.failed,
        duration: stats.endTime ? 
          Math.round((stats.endTime.getTime() - stats.startTime.getTime()) / 1000) : 
          null
      }
    });

  } catch (error) {
    console.error('Error in scrape trigger:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to trigger scraping' },
      { status: 500 }
    );
  }
}