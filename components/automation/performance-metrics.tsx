'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { TrendingUp, DollarSign, Zap, Target, Clock, Database } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Metrics {
  successRate: number;
  averageProcessingTime: string;
  totalJobsScraped: number;
  totalCompaniesFound: number;
  estimatedMonthlyCost: string;
  apiCallsToday: number;
  storageUsed: string;
  lastRunTime: Date | null;
}

export function PerformanceMetrics() {
  const [metrics, setMetrics] = useState<Metrics>({
    successRate: 0,
    averageProcessingTime: '0s',
    totalJobsScraped: 0,
    totalCompaniesFound: 0,
    estimatedMonthlyCost: '$0',
    apiCallsToday: 0,
    storageUsed: '0 MB',
    lastRunTime: null
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
    
    // Refresh every minute
    const interval = setInterval(fetchMetrics, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchMetrics = async () => {
    const supabase = createClient();
    
    // Get scraping runs for metrics
    const { data: runs } = await supabase
      .from('scraping_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(100);

    if (runs && runs.length > 0) {
      // Calculate success rate
      const successfulRuns = runs.filter(r => r.status === 'completed').length;
      const successRate = (successfulRuns / runs.length) * 100;

      // Calculate average processing time
      const completedRuns = runs.filter(r => r.completed_at && r.started_at);
      const avgTime = completedRuns.length > 0
        ? completedRuns.reduce((sum, run) => {
            const duration = new Date(run.completed_at).getTime() - new Date(run.started_at).getTime();
            return sum + duration;
          }, 0) / completedRuns.length / 1000
        : 0;

      // Get totals
      const totalJobs = runs.reduce((sum, run) => sum + (run.jobs_scraped || 0), 0);
      const totalCompanies = runs.reduce((sum, run) => sum + (run.companies_found || 0), 0);

      // Get today's runs for API calls estimate
      const today = new Date().toISOString().split('T')[0];
      const todayRuns = runs.filter(r => r.started_at?.startsWith(today));
      const apiCallsToday = todayRuns.length * 37; // Estimate based on search terms

      // Calculate monthly cost (Apify: $0.04 per 1000 jobs)
      const monthlyJobs = (totalJobs / 30) * 30; // Project to full month
      const apifyCost = (monthlyJobs / 1000) * 0.04;
      const openaiCost = (monthlyJobs * 0.001); // GPT-5 estimate
      const totalCost = apifyCost + openaiCost;

      // Get storage estimate
      const { count: companiesCount } = await supabase
        .from('identified_companies')
        .select('*', { count: 'exact', head: true });
      
      const { count: jobsCount } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true });

      const storageEstimate = ((companiesCount || 0) * 1 + (jobsCount || 0) * 5) / 1024; // KB to MB

      setMetrics({
        successRate,
        averageProcessingTime: formatDuration(avgTime),
        totalJobsScraped: totalJobs,
        totalCompaniesFound: totalCompanies,
        estimatedMonthlyCost: `$${totalCost.toFixed(2)}`,
        apiCallsToday,
        storageUsed: `${storageEstimate.toFixed(1)} MB`,
        lastRunTime: runs[0]?.started_at ? new Date(runs[0].started_at) : null
      });
    }
    
    setLoading(false);
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  const metricCards = [
    {
      title: 'Success Rate',
      value: `${metrics.successRate.toFixed(1)}%`,
      icon: <TrendingUp className="h-4 w-4" />,
      color: metrics.successRate > 90 ? 'text-green-600' : 'text-orange-600',
      subtitle: 'Last 100 runs'
    },
    {
      title: 'Avg Processing Time',
      value: metrics.averageProcessingTime,
      icon: <Clock className="h-4 w-4" />,
      color: 'text-blue-600',
      subtitle: 'Per search term'
    },
    {
      title: 'Jobs Scraped',
      value: metrics.totalJobsScraped.toLocaleString(),
      icon: <Database className="h-4 w-4" />,
      color: 'text-purple-600',
      subtitle: `${metrics.totalCompaniesFound} companies found`
    },
    {
      title: 'Monthly Cost',
      value: metrics.estimatedMonthlyCost,
      icon: <DollarSign className="h-4 w-4" />,
      color: 'text-gray-600',
      subtitle: 'Apify + OpenAI'
    },
    {
      title: 'API Calls Today',
      value: metrics.apiCallsToday.toLocaleString(),
      icon: <Zap className="h-4 w-4" />,
      color: 'text-yellow-600',
      subtitle: 'LinkedIn + GPT-5'
    },
    {
      title: 'Storage Used',
      value: metrics.storageUsed,
      icon: <Database className="h-4 w-4" />,
      color: 'text-indigo-600',
      subtitle: 'Database size'
    }
  ];

  if (loading) {
    return (
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-6">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <Card key={i} className="p-4 animate-pulse">
            <div className="h-3 bg-muted rounded w-2/3 mb-2" />
            <div className="h-6 bg-muted rounded w-1/2 mb-1" />
            <div className="h-2 bg-muted rounded w-3/4" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Performance Metrics</h2>
          {metrics.lastRunTime && (
            <p className="text-xs text-muted-foreground">
              Last run: {formatDistanceToNow(metrics.lastRunTime, { addSuffix: true })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-muted-foreground">System healthy</span>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-6">
        {metricCards.map((metric, index) => (
          <Card key={index} className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className={`p-1.5 rounded-lg bg-primary/10 ${metric.color}`}>
                  {metric.icon}
                </div>
              </div>
              
              <p className={`text-2xl font-bold ${metric.color}`}>
                {metric.value}
              </p>
              <p className="text-xs font-medium text-muted-foreground mt-1">
                {metric.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {metric.subtitle}
              </p>
            </div>
            
            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
          </Card>
        ))}
      </div>
    </div>
  );
}

function formatDistanceToNow(date: Date, options: { addSuffix: boolean }) {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}