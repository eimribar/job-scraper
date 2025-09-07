'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

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

export function ProcessingWidget() {
  const [status, setStatus] = useState<ProcessingStatus>({
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
  });

  useEffect(() => {
    const fetchProcessingStatus = async () => {
      const supabase = createClient();
      
      // Get today's stats from raw_jobs analyzed today
      const today = new Date().toISOString().split('T')[0];
      
      // Count jobs analyzed today
      const { count: jobsAnalyzedToday } = await supabase
        .from('raw_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('processed', true)
        .gte('analyzed_date', today);

      // Count companies identified today
      const { count: companiesFoundToday } = await supabase
        .from('identified_companies')
        .select('*', { count: 'exact', head: true })
        .gte('identified_date', today);

      // Get processed terms count for today
      const { count: processedToday } = await supabase
        .from('search_terms')
        .select('*', { count: 'exact', head: true })
        .gte('last_scraped_date', today);
      
      // Check if any processing is running (simple-processor or other)
      const { count: unprocessedJobs } = await supabase
        .from('raw_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('processed', false);
      
      // Get total jobs in database
      const { count: totalJobs } = await supabase
        .from('raw_jobs')
        .select('*', { count: 'exact', head: true });
      
      const isProcessing = unprocessedJobs && unprocessedJobs > 0;

      setStatus({
        isRunning: isProcessing,
        currentSearchTerm: isProcessing ? 'Processing job queue' : null,
        progress: totalJobs && totalJobs > 0 ? Math.round(((totalJobs - (unprocessedJobs || 0)) / totalJobs) * 100) : 0,
        totalTerms: 37,
        processedTerms: processedToday || 0,
        jobsAnalyzedToday: jobsAnalyzedToday || 0,
        companiesFoundToday: companiesFoundToday || 0,
        nextScheduledRun: getNextScheduledRun(),
        estimatedTimeRemaining: isProcessing && unprocessedJobs ? calculateTimeRemaining(unprocessedJobs) : null,
        jobsInQueue: unprocessedJobs || 0,
        totalJobsInDb: totalJobs || 0
      });
    };

    // Initial fetch
    fetchProcessingStatus();
    
    // Poll for updates every 5 seconds continuously
    const interval = setInterval(fetchProcessingStatus, 5000);

    // Set up real-time subscriptions
    const supabase = createClient();
    const scrapingChannel = supabase
      .channel('processing-status')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'scraping_runs' },
        fetchProcessingStatus
      )
      .subscribe();

    // IMPORTANT: Also listen to raw_jobs updates for real-time job processing
    const jobsChannel = supabase
      .channel('jobs-status')  
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'raw_jobs' },
        fetchProcessingStatus
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(scrapingChannel);
      supabase.removeChannel(jobsChannel);
    };
  }, []);

  const getNextScheduledRun = () => {
    // Calculate next 5-minute interval
    const now = new Date();
    const minutes = now.getMinutes();
    const nextMinutes = Math.ceil(minutes / 5) * 5;
    const next = new Date(now);
    next.setMinutes(nextMinutes);
    next.setSeconds(0);
    return next;
  };

  const calculateTimeRemaining = (remainingJobs: number) => {
    const secondsPerJob = 3; // Average with GPT-5 processing
    const totalSeconds = remainingJobs * secondsPerJob;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
  };

  const handleStartProcessing = async () => {
    const response = await fetch('/api/automation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start' })
    });
    
    if (response.ok) {
      fetchProcessingStatus();
    }
  };

  const handleStopProcessing = async () => {
    const response = await fetch('/api/automation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stop' })
    });
    
    if (response.ok) {
      fetchProcessingStatus();
    }
  };

  return (
    <Card className="relative overflow-hidden border-0 shadow-sm">
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-semibold">Processing Status</h3>
            <p className="text-xs text-muted-foreground">
              {status.isRunning ? 'Processing jobs...' : 'Automation paused'}
            </p>
          </div>
          
          <Button
            size="sm"
            variant={status.isRunning ? "destructive" : "default"}
            onClick={status.isRunning ? handleStopProcessing : handleStartProcessing}
            className="gap-2"
          >
            {status.isRunning ? (
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

        {status.isRunning ? (
          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">
                  Processing: <span className="font-medium text-foreground">{status.currentSearchTerm}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {status.processedTerms}/{status.totalTerms}
                </span>
              </div>
              <Progress value={status.progress} className="h-2" />
              {status.estimatedTimeRemaining && (
                <p className="text-xs text-muted-foreground mt-1">
                  Est. time remaining: {status.estimatedTimeRemaining}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-lg font-bold">{status.jobsAnalyzedToday}</p>
                <p className="text-xs text-muted-foreground">Jobs analyzed today</p>
              </div>
              <div>
                <p className="text-lg font-bold text-green-600">{status.companiesFoundToday}</p>
                <p className="text-xs text-muted-foreground">Companies found today</p>
              </div>
            </div>
            
            <div className="pt-3 border-t space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Jobs in queue:</span>
                <span className="font-medium">{status.jobsInQueue}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Total jobs processed:</span>
                <span className="font-medium">{status.totalJobsInDb - status.jobsInQueue} / {status.totalJobsInDb}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">

            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-lg font-bold">{status.jobsAnalyzedToday}</p>
                <p className="text-xs text-muted-foreground">Jobs today</p>
              </div>
              <div>
                <p className="text-lg font-bold text-green-600">{status.companiesFoundToday}</p>
                <p className="text-xs text-muted-foreground">Companies today</p>
              </div>
            </div>
            
            {status.jobsInQueue > 0 && (
              <div className="pt-3 border-t">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Unprocessed jobs in queue:</span>
                  <span className="font-medium text-orange-600">{status.jobsInQueue} pending</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-xs text-muted-foreground">
                  {status.processedTerms} terms processed today
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => fetchProcessingStatus()}
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
}