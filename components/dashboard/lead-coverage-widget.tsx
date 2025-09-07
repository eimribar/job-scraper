'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle, TrendingUp, Users, Download, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface LeadStats {
  totalCompanies: number;
  companiesWithLeads: number;
  companiesWithoutLeads: number;
  leadCoverage: number;
  recentLeadUpdates: Array<{
    company: string;
    leads_generated_date: string;
    leads_generated_by: string;
  }>;
}

export function LeadCoverageWidget() {
  const [stats, setStats] = useState<LeadStats>({
    totalCompanies: 0,
    companiesWithLeads: 0,
    companiesWithoutLeads: 0,
    leadCoverage: 0,
    recentLeadUpdates: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeadStats();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchLeadStats, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchLeadStats = async () => {
    try {
      const response = await fetch('/api/companies/lead-stats');
      const data = await response.json();
      
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching lead stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6 animate-pulse">
        <div className="h-4 bg-muted rounded w-3/4 mb-3" />
        <div className="h-8 bg-muted rounded w-1/2 mb-2" />
        <div className="h-3 bg-muted rounded w-2/3" />
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden border-0 shadow-sm">
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-semibold">Lead Coverage</h3>
            <p className="text-xs text-muted-foreground">
              {stats.companiesWithLeads} of {stats.totalCompanies} companies
            </p>
          </div>
          <Users className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="space-y-2">
          {/* Progress Bar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xl font-bold">{stats.leadCoverage}%</span>
              <Badge variant="secondary" className="text-xs">
                Coverage
              </Badge>
            </div>
            <Progress value={stats.leadCoverage} className="h-2" />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-base font-bold">{stats.companiesWithLeads}</p>
                <p className="text-xs text-muted-foreground">Have Leads</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Circle className="h-4 w-4 text-orange-600" />
              <div>
                <p className="text-base font-bold text-orange-600">{stats.companiesWithoutLeads}</p>
                <p className="text-xs text-muted-foreground">Need Leads</p>
              </div>
            </div>
          </div>

          {/* Recent Updates */}
          {stats.recentLeadUpdates.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-1">Recent</p>
              <div className="space-y-0.5">
                {stats.recentLeadUpdates.slice(0, 2).map((update, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="truncate">{update.company}</span>
                    <Badge variant="secondary" className="text-xs">
                      {update.leads_generated_by}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 border-t">
            <Link href="/companies?leadStatus=without_leads" className="flex-1">
              <Button size="sm" variant="outline" className="w-full gap-1 h-8 text-xs">
                <Circle className="h-3 w-3" />
                View Needs Leads
              </Button>
            </Link>
            <Link href="/companies?leadStatus=with_leads" className="flex-1">
              <Button size="sm" variant="outline" className="w-full gap-1 h-8 text-xs">
                <CheckCircle2 className="h-3 w-3" />
                View Has Leads
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Background gradient */}
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-green-600/20 via-green-600/50 to-green-600/20" />
    </Card>
  );
}