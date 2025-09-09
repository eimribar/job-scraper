'use client';

import { useState } from 'react';
import { SearchTermsGrid } from "@/components/automation/search-terms-grid";
import { ProcessingQueue } from "@/components/automation/processing-queue";
import { PerformanceMetrics } from "@/components/automation/performance-metrics";
import { Button } from "@/components/ui/button";
import { Play, RefreshCw } from "lucide-react";
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function AutomationCenter() {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isStartingAll, setIsStartingAll] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handleStartAll = async () => {
    setIsStartingAll(true);
    
    try {
      // Trigger both scraper and analyzer
      const scraperPromise = fetch('/api/automation/trigger?action=scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || 'e7d4f8c2a9b5e1d3f6a8c9b2e5d7f0a3c6b9d2e5f8a1c4d7e0f3a6b9c2d5e8f1'}`
        }
      });
      
      const analyzerPromise = fetch('/api/automation/trigger?action=analyze&batch=100', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || 'e7d4f8c2a9b5e1d3f6a8c9b2e5d7f0a3c6b9d2e5f8a1c4d7e0f3a6b9c2d5e8f1'}`
        }
      });
      
      const [scraperRes, analyzerRes] = await Promise.all([scraperPromise, analyzerPromise]);
      
      const scraperData = await scraperRes.json();
      const analyzerData = await analyzerRes.json();
      
      if (scraperData.success || analyzerData.success) {
        toast.success('Automation started successfully!');
        
        // Refresh the page after a short delay to show updated status
        setTimeout(() => {
          router.refresh();
        }, 2000);
      } else {
        const errors = [];
        if (!scraperData.success) errors.push(scraperData.message || 'Scraper failed');
        if (!analyzerData.success) errors.push(analyzerData.message || 'Analyzer failed');
        toast.error(errors.join(', '));
      }
    } catch (error) {
      console.error('Failed to start automation:', error);
      toast.error('Failed to start automation');
    } finally {
      setIsStartingAll(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20">
      {/* Page Header */}
      <div className="border-b bg-white/70 backdrop-blur-md">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Automation Center</h1>
              <p className="text-sm text-muted-foreground mt-1">Manage search terms and processing schedule</p>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button 
                size="sm" 
                className="gap-2"
                onClick={handleStartAll}
                disabled={isStartingAll}
              >
                {isStartingAll ? (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3" />
                    Start All
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Performance Metrics */}
          <section>
            <PerformanceMetrics />
          </section>

          {/* Main Grid */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Search Terms Grid - Takes 2 columns */}
            <div className="lg:col-span-2">
              <SearchTermsGrid />
            </div>
            
            {/* Processing Queue - Takes 1 column */}
            <div>
              <ProcessingQueue />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}