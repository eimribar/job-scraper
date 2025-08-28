/**
 * Performance Metrics API
 */

import { NextRequest, NextResponse } from 'next/server';
import { MonitoringService } from '@/lib/services/monitoringService';
import { createServerSupabaseClient } from '@/lib/supabase';

const monitoring = new MonitoringService();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const period = searchParams.get('period') || '1h'; // 1h, 6h, 24h, 7d, 30d

    // Get performance metrics from monitoring service
    const metrics = monitoring.getPerformanceMetrics(limit);

    // Get aggregated metrics from database
    const supabase = createServerSupabaseClient();
    
    const periodMap = {
      '1h': '1 hour',
      '6h': '6 hours',
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days'
    };

    let aggregatedMetrics = null;
    
    if (supabase) {
      const { data } = await supabase
        .from('metrics')
        .select('*')
        .gte('bucket_time', new Date(Date.now() - parsePeriod(periodMap[period as keyof typeof periodMap] || '1 hour')).toISOString())
        .order('bucket_time', { ascending: false });
      aggregatedMetrics = data;
    }

    // Calculate summary statistics
    const summary = calculateSummary(aggregatedMetrics || []);

    return NextResponse.json({
      success: true,
      metrics,
      aggregated: aggregatedMetrics,
      summary,
      period,
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

function parsePeriod(period: string): number {
  const match = period.match(/(\d+)\s*(hour|day)/i);
  if (!match) return 60 * 60 * 1000; // Default 1 hour

  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 'hour': return value * 60 * 60 * 1000;
    case 'day': return value * 24 * 60 * 60 * 1000;
    default: return 60 * 60 * 1000;
  }
}

function calculateSummary(metrics: any[]): any {
  if (!metrics || metrics.length === 0) {
    return {
      totalJobs: 0,
      totalCompanies: 0,
      totalCost: 0,
      avgSuccessRate: 0,
      avgProcessingTime: 0
    };
  }

  const totalJobs = metrics.reduce((sum, m) => sum + (m.jobs_scraped || 0), 0);
  const totalCompanies = metrics.reduce((sum, m) => sum + (m.new_companies || 0), 0);
  const totalCost = metrics.reduce((sum, m) => sum + (m.total_cost || 0), 0);
  const avgSuccessRate = 1 - (metrics.reduce((sum, m) => sum + (m.error_count || 0), 0) / Math.max(1, totalJobs));
  const avgProcessingTime = metrics.reduce((sum, m) => sum + (m.avg_scrape_time_ms || 0), 0) / metrics.length;

  return {
    totalJobs,
    totalCompanies,
    totalCost: totalCost.toFixed(2),
    avgSuccessRate: (avgSuccessRate * 100).toFixed(1),
    avgProcessingTime: Math.round(avgProcessingTime)
  };
}