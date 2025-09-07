'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { createClient } from '@/lib/supabase/client';

interface QueueItem {
  id: string;
  searchTerm: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  startedAt?: Date;
  completedAt?: Date;
  jobsScraped?: number;
  companiesFound?: number;
  error?: string;
}

export function ProcessingQueue() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchQueue();
    
    // Poll for updates every 2 seconds when processing
    const interval = setInterval(() => {
      if (isProcessing) {
        fetchQueue();
      }
    }, 2000);

    // Set up real-time subscription
    const supabase = createClient();
    const channel = supabase
      .channel('processing-queue')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'scraping_runs' },
        () => {
          fetchQueue();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [isProcessing]);

  const fetchQueue = async () => {
    const supabase = createClient();
    
    // Get recent scraping runs
    const { data: runs } = await supabase
      .from('scraping_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(10);

    if (runs) {
      const queueItems: QueueItem[] = runs.map(run => ({
        id: run.id,
        searchTerm: run.search_term,
        status: mapStatus(run.status),
        progress: calculateProgress(run),
        startedAt: run.started_at ? new Date(run.started_at) : undefined,
        completedAt: run.completed_at ? new Date(run.completed_at) : undefined,
        jobsScraped: run.jobs_scraped,
        companiesFound: run.companies_found,
        error: run.error_message
      }));
      
      setQueue(queueItems);
      setIsProcessing(queueItems.some(item => item.status === 'processing'));
    }
  };

  const mapStatus = (status: string): QueueItem['status'] => {
    switch (status) {
      case 'running':
      case 'processing':
        return 'processing';
      case 'completed':
      case 'success':
        return 'completed';
      case 'failed':
      case 'error':
        return 'failed';
      default:
        return 'queued';
    }
  };

  const calculateProgress = (run: any): number => {
    if (run.status === 'completed') return 100;
    if (run.status === 'failed') return 0;
    if (run.jobs_scraped && run.status === 'running') {
      // Estimate based on typical 1000 jobs per term
      return Math.min(100, (run.jobs_scraped / 1000) * 100);
    }
    return 0;
  };

  const getStatusIcon = (status: QueueItem['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: QueueItem['status']) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/10 text-green-600 border-green-200">Completed</Badge>;
      case 'processing':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200">Processing</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/10 text-red-600 border-red-200">Failed</Badge>;
      default:
        return <Badge variant="outline">Queued</Badge>;
    }
  };

  return (
    <Card className="h-full overflow-hidden border-0 shadow-sm">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Processing Queue</h3>
          {isProcessing && (
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-xs text-muted-foreground">Active</span>
            </div>
          )}
        </div>

        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="h-8 w-8 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              Queue is empty
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Processing will start automatically
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {queue.map((item, index) => (
              <div
                key={item.id}
                className={`p-3 rounded-lg border transition-all ${
                  item.status === 'processing' ? 'bg-blue-50/50 border-blue-200' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(item.status)}
                    <span className="text-sm font-medium">{item.searchTerm}</span>
                  </div>
                  {getStatusBadge(item.status)}
                </div>

                {item.status === 'processing' && (
                  <div className="space-y-2">
                    <Progress value={item.progress} className="h-1.5" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Scraping LinkedIn jobs...</span>
                      <span>{item.progress.toFixed(0)}%</span>
                    </div>
                  </div>
                )}

                {item.status === 'completed' && (
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{item.jobsScraped || 0} jobs</span>
                    {item.companiesFound && item.companiesFound > 0 && (
                      <>
                        <ArrowRight className="h-3 w-3" />
                        <span className="text-green-600 font-medium">
                          +{item.companiesFound} companies
                        </span>
                      </>
                    )}
                    {item.completedAt && (
                      <span className="ml-auto">
                        {formatDistanceToNow(item.completedAt, { addSuffix: true })}
                      </span>
                    )}
                  </div>
                )}

                {item.status === 'failed' && item.error && (
                  <p className="text-xs text-red-600 mt-1 line-clamp-2">
                    {item.error}
                  </p>
                )}

                {item.status === 'queued' && (
                  <p className="text-xs text-muted-foreground">
                    Position {index + 1} in queue
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {queue.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-2xl font-bold">
                  {queue.filter(q => q.status === 'completed').length}
                </p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {queue.filter(q => q.status === 'processing').length}
                </p>
                <p className="text-xs text-muted-foreground">Processing</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-600">
                  {queue.filter(q => q.status === 'queued').length}
                </p>
                <p className="text-xs text-muted-foreground">Queued</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}