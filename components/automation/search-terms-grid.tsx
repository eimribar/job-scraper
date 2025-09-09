'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle, AlertCircle, Play, RotateCw, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

interface SearchTerm {
  id: string;
  search_term: string;
  last_scraped_date: string | null;
  jobs_found_last_run: number;
  companies_found_last_run: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  needsScraping: boolean;
}

export function SearchTermsGrid() {
  const [searchTerms, setSearchTerms] = useState<SearchTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingTerm, setProcessingTerm] = useState<string | null>(null);
  const [processingAll, setProcessingAll] = useState(false);

  useEffect(() => {
    fetchSearchTerms();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchSearchTerms, 30000);
    
    // Set up real-time subscription
    const supabase = createClient();
    const channel = supabase
      .channel('search-terms')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'search_terms' },
        () => {
          fetchSearchTerms();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchSearchTerms = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('search_terms')
      .select('*')
      .order('search_term');

    if (data) {
      const enrichedTerms = data.map(term => {
        const lastScraped = term.last_scraped_date ? new Date(term.last_scraped_date) : null;
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        return {
          ...term,
          needsScraping: !lastScraped || lastScraped < sevenDaysAgo,
          status: determineStatus(term, lastScraped, sevenDaysAgo)
        };
      });
      
      setSearchTerms(enrichedTerms);
    }
    setLoading(false);
  };

  const determineStatus = (term: any, lastScraped: Date | null, sevenDaysAgo: Date) => {
    if (!lastScraped) return 'pending';
    if (lastScraped < sevenDaysAgo) return 'pending';
    return 'completed';
  };

  const handleProcessTerm = async (termId: string, searchTerm: string) => {
    setProcessingTerm(termId);
    
    try {
      const response = await fetch('/api/automation/process-term', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchTerm })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        toast.success(`Processed ${searchTerm}: ${data.jobsScraped} jobs found`);
        await fetchSearchTerms();
      } else {
        toast.error(data.error || `Failed to process ${searchTerm}`);
      }
    } catch (error) {
      toast.error(`Error processing ${searchTerm}`);
      console.error('Process term error:', error);
    } finally {
      setProcessingTerm(null);
    }
  };

  const handleProcessAllPending = async () => {
    const pendingTerms = searchTerms.filter(t => t.needsScraping);
    
    if (pendingTerms.length === 0) {
      toast.info('No pending terms to process');
      return;
    }
    
    setProcessingAll(true);
    let successCount = 0;
    let errorCount = 0;
    
    toast.loading(`Processing ${pendingTerms.length} pending terms...`);
    
    for (const term of pendingTerms) {
      try {
        setProcessingTerm(term.id);
        
        const response = await fetch('/api/automation/process-term', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ searchTerm: term.search_term })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
          successCount++;
          console.log(`✅ Processed ${term.search_term}`);
        } else {
          errorCount++;
          console.error(`❌ Failed ${term.search_term}:`, data.error);
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Error processing ${term.search_term}:`, error);
      }
    }
    
    setProcessingTerm(null);
    setProcessingAll(false);
    toast.dismiss();
    
    if (successCount > 0) {
      toast.success(`Successfully processed ${successCount} terms`);
      await fetchSearchTerms();
    }
    
    if (errorCount > 0) {
      toast.error(`Failed to process ${errorCount} terms`);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'processing':
        return <RotateCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (term: SearchTerm) => {
    if (term.needsScraping) {
      return <Badge variant="outline" className="text-orange-600 border-orange-200">Needs Scraping</Badge>;
    }
    return <Badge variant="outline" className="text-green-600 border-green-200">Up to date</Badge>;
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-0 shadow-sm">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Search Terms ({searchTerms.length})</h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-orange-500" />
              <span>{searchTerms.filter(t => t.needsScraping).length} need update</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span>{searchTerms.filter(t => !t.needsScraping).length} up to date</span>
            </div>
          </div>
        </div>

        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {searchTerms.map((term) => (
            <div
              key={term.id}
              className={`p-3 rounded-lg border transition-all hover:bg-accent/50 ${
                processingTerm === term.id ? 'bg-blue-50 border-blue-200' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  {getStatusIcon(processingTerm === term.id ? 'processing' : term.status)}
                  
                  <div className="flex-1">
                    <p className="font-medium text-sm">{term.search_term}</p>
                    <div className="flex items-center gap-4 mt-1">
                      {term.last_scraped_date ? (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDistanceToNow(new Date(term.last_scraped_date), { addSuffix: true })}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Never scraped</span>
                      )}
                      
                      {term.jobs_found_last_run > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {term.jobs_found_last_run} jobs
                        </span>
                      )}
                      
                      {term.companies_found_last_run > 0 && (
                        <span className="text-xs text-green-600">
                          +{term.companies_found_last_run} companies
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {getStatusBadge(term)}
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => handleProcessTerm(term.id, term.search_term)}
                    disabled={processingTerm === term.id}
                  >
                    {processingTerm === term.id ? (
                      <RotateCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Auto-scraping enabled for terms older than 7 days</span>
            <Button 
              size="sm" 
              variant="outline" 
              className="h-7 text-xs"
              onClick={handleProcessAllPending}
              disabled={processingAll || processingTerm !== null}
            >
              {processingAll ? 'Processing...' : 'Process All Pending'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}