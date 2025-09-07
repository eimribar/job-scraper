'use client';

import { useEffect, useState, useCallback, memo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { usePerformanceStore } from '@/lib/stores/performance-store';
import { useDebounce } from 'use-debounce';

interface ProcessingStatus {
  isRunning: boolean;
  currentSearchTerm: string | null;
  progress: number;
  totalTerms: number;
  processedTerms: number;
  jobsAnalyzedToday: number;
  companiesFoundToday: number;
  nextScheduledRun: Date | null;
  estimatedTimeRemaining: string | null;
  jobsInQueue: number;
  totalJobsInDb: number;
}

// Fetch function for React Query
const fetchProcessingStatus = async (): Promise<ProcessingStatus> => {
  const supabase = createClient();
  const today = new Date().toISOString().split('T')[0];
  
  // Use Promise.all for parallel requests
  const [
    jobsAnalyzedResult,
    companiesFoundResult,
    processedTermsResult,
    unprocessedJobsResult,
    totalJobsResult
  ] = await Promise.all([
    supabase.from('raw_jobs').select('*', { count: 'exact', head: true })
      .eq('processed', true).gte('analyzed_date', today),
    supabase.from('identified_companies').select('*', { count: 'exact', head: true })
      .gte('identified_date', today),
    supabase.from('search_terms').select('*', { count: 'exact', head: true })
      .gte('last_scraped_date', today),
    supabase.from('raw_jobs').select('*', { count: 'exact', head: true })
      .eq('processed', false),
    supabase.from('raw_jobs').select('*', { count: 'exact', head: true })
  ]);

  const unprocessedJobs = unprocessedJobsResult.count || 0;
  const totalJobs = totalJobsResult.count || 0;
  const isProcessing = unprocessedJobs > 0;

  return {
    isRunning: isProcessing,
    currentSearchTerm: isProcessing ? 'Processing job queue' : null,
    progress: totalJobs > 0 ? Math.round(((totalJobs - unprocessedJobs) / totalJobs) * 100) : 0,
    totalTerms: 37,
    processedTerms: processedTermsResult.count || 0,
    jobsAnalyzedToday: jobsAnalyzedResult.count || 0,
    companiesFoundToday: companiesFoundResult.count || 0,
    nextScheduledRun: getNextScheduledRun(),
    estimatedTimeRemaining: isProcessing && unprocessedJobs > 0 ? calculateTimeRemaining(unprocessedJobs) : null,
    jobsInQueue: unprocessedJobs,
    totalJobsInDb: totalJobs
  };
};

// Utility functions
const getNextScheduledRun = () => {
  const now = new Date();
  const minutes = now.getMinutes();
  const nextMinutes = Math.ceil(minutes / 5) * 5;
  const next = new Date(now);
  next.setMinutes(nextMinutes, 0, 0);
  return next;
};

const calculateTimeRemaining = (remainingJobs: number) => {
  const secondsPerJob = 3;
  const totalSeconds = remainingJobs * secondsPerJob;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
};

const ProcessingWidget = memo(() => {
  const queryClient = useQueryClient();
  const { shouldReduceAnimations } = usePerformanceStore();
  
  // Use React Query for data fetching with optimistic updates
  const { data: status, refetch } = useQuery({
    queryKey: ['processing-status'],
    queryFn: fetchProcessingStatus,
    refetchInterval: shouldReduceAnimations ? 10000 : 5000, // Slower on slow devices
    staleTime: 2000,
    refetchOnWindowFocus: true,
  });

  // Debounced refresh function
  const [debouncedRefresh] = useDebounce(() => refetch(), 500);

  // Set up real-time subscriptions with cleanup
  useEffect(() => {
    const supabase = createClient();
    
    const jobsChannel = supabase
      .channel('jobs-status-optimized')  
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'raw_jobs' },
        () => {
          // Invalidate query to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['processing-status'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(jobsChannel);
    };
  }, [queryClient]);

  // Memoized handlers
  const handleStartProcessing = useCallback(async () => {
    try {
      const response = await fetch('/api/automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' })
      });
      
      if (response.ok) {
        // Optimistic update
        queryClient.invalidateQueries({ queryKey: ['processing-status'] });
      }
    } catch (error) {
      console.error('Failed to start processing:', error);
    }
  }, [queryClient]);

  const handleStopProcessing = useCallback(async () => {
    try {
      const response = await fetch('/api/automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' })
      });
      
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['processing-status'] });
      }
    } catch (error) {
      console.error('Failed to stop processing:', error);
    }
  }, [queryClient]);

  const handleRefresh = useCallback(() => {
    debouncedRefresh();
  }, [debouncedRefresh]);

  // Default values while loading
  const currentStatus = status || {
    isRunning: false,
    currentSearchTerm: null,
    progress: 0,
    totalTerms: 37,
    processedTerms: 0,
    jobsAnalyzedToday: 0,
    companiesFoundToday: 0,
    nextScheduledRun: null,
    estimatedTimeRemaining: null,
    jobsInQueue: 0,
    totalJobsInDb: 0
  };

  return (
    <Card className="relative overflow-hidden border-0 shadow-sm">
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-semibold">Processing Status</h3>
            <p className="text-xs text-muted-foreground">
              {currentStatus.isRunning ? 'Processing jobs...' : 'Automation paused'}
            </p>
          </div>
          
          <Button
            size="sm"
            variant={currentStatus.isRunning ? "destructive" : "default"}
            onClick={currentStatus.isRunning ? handleStopProcessing : handleStartProcessing}
            className="gap-2"
          >
            {currentStatus.isRunning ? (
              <>
                <Pause className="h-3 w-3" />
                Stop
              </>
            ) : (
              <>
                <Play className="h-3 w-3" />
                Start
              </>
            )}
          </Button>
        </div>

        {currentStatus.isRunning ? (
          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">
                  Processing: <span className="font-medium text-foreground">{currentStatus.currentSearchTerm}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {currentStatus.processedTerms}/{currentStatus.totalTerms}
                </span>
              </div>
              <Progress value={currentStatus.progress} className="h-2" />
              {currentStatus.estimatedTimeRemaining && (
                <p className="text-xs text-muted-foreground mt-1">
                  Est. time remaining: {currentStatus.estimatedTimeRemaining}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-lg font-bold">{currentStatus.jobsAnalyzedToday}</p>
                <p className="text-xs text-muted-foreground">Jobs analyzed today</p>
              </div>
              <div>
                <p className="text-lg font-bold text-green-600">{currentStatus.companiesFoundToday}</p>
                <p className="text-xs text-muted-foreground">Companies found today</p>
              </div>
            </div>
            
            <div className="pt-3 border-t space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Jobs in queue:</span>
                <span className="font-medium">{currentStatus.jobsInQueue}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Total jobs processed:</span>
                <span className="font-medium">{currentStatus.totalJobsInDb - currentStatus.jobsInQueue} / {currentStatus.totalJobsInDb}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-lg font-bold">{currentStatus.jobsAnalyzedToday}</p>
                <p className="text-xs text-muted-foreground">Jobs today</p>
              </div>
              <div>
                <p className="text-lg font-bold text-green-600">{currentStatus.companiesFoundToday}</p>
                <p className="text-xs text-muted-foreground">Companies today</p>
              </div>
            </div>
            
            {currentStatus.jobsInQueue > 0 && (
              <div className="pt-3 border-t">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Unprocessed jobs in queue:</span>
                  <span className="font-medium text-orange-600">{currentStatus.jobsInQueue} pending</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-xs text-muted-foreground">
                  {currentStatus.processedTerms} terms processed today
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={handleRefresh}
              >
                <RotateCw className="h-3 w-3 mr-1" />
                Refresh
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
});

ProcessingWidget.displayName = 'ProcessingWidget';

export { ProcessingWidget };