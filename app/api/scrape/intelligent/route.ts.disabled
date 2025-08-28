/**
 * Intelligent Scraping API Endpoint
 * Uses IntelligenceEngine for orchestrated processing
 */

import { NextRequest, NextResponse } from 'next/server';
import { IntelligenceEngine } from '@/lib/services/intelligenceEngine';
import { MonitoringService } from '@/lib/services/monitoringService';

const intelligenceEngine = new IntelligenceEngine();
const monitoring = new MonitoringService();

export async function POST(req: NextRequest) {
  try {
    const { searchTerms, options } = await req.json();

    if (!searchTerms || !Array.isArray(searchTerms) || searchTerms.length === 0) {
      return NextResponse.json(
        { error: 'Search terms are required' },
        { status: 400 }
      );
    }

    // Log request
    monitoring.logError('api', 'scrape_request', `Processing ${searchTerms.length} search terms`, 'info');

    const results = [];
    
    for (const term of searchTerms) {
      try {
        const pipeline = await intelligenceEngine.orchestrate(term, {
          maxJobs: options?.maxJobs || 50,
          platforms: options?.platforms || ['indeed', 'linkedin'],
          forceRefresh: options?.forceRefresh || false
        });
        
        results.push({
          searchTerm: term,
          success: true,
          pipeline
        });
      } catch (error) {
        monitoring.logError('scraping', 'orchestration_failed', 
          `Failed to process "${term}": ${error instanceof Error ? error.message : 'Unknown error'}`,
          'high'
        );
        
        results.push({
          searchTerm: term,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Get current metrics
    const metrics = intelligenceEngine.getMetrics();
    const insights = intelligenceEngine.getInsights(5);

    return NextResponse.json({
      success: true,
      results,
      metrics,
      insights,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    monitoring.logError('api', 'scrape_error', 
      error instanceof Error ? error.message : 'Unknown error',
      'critical'
    );

    return NextResponse.json(
      { 
        error: 'Failed to process request',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Get intelligence metrics
    const metrics = intelligenceEngine.getMetrics();
    const insights = intelligenceEngine.getInsights(10);

    return NextResponse.json({
      success: true,
      metrics,
      insights,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to get metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}