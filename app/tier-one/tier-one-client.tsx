'use client';

import { useState, useEffect, useCallback } from "react";
import { CompaniesTable } from "@/components/companies/companies-table";
import { Card } from "@/components/ui/card";
import { showToast } from "@/components/ui/toast";
import { 
  CheckCircle2, 
  Users, 
  Target,
  TrendingUp,
  AlertCircle,
  Building2,
  Loader2
} from "lucide-react";

interface Stats {
  total: number;
  identified: number;
  unidentified: number;
  with_leads: number;
  engaged: number;
  coverage: number;
}

export function TierOneClient() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    identified: 0,
    unidentified: 0,
    with_leads: 0,
    engaged: 0,
    coverage: 0,
  });
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<any>({});
  const [totalCount, setTotalCount] = useState(0);

  // Fetch data with filters
  const fetchTierOneCompanies = useCallback(async (page: number = 1, currentFilters: any = {}) => {
    try {
      setLoading(true);
      
      // Build query params
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '20');
      
      if (currentFilters.search) {
        params.set('search', currentFilters.search);
      }
      if (currentFilters.tool && currentFilters.tool !== 'all') {
        params.set('tool', currentFilters.tool);
      }
      if (currentFilters.leadStatus && currentFilters.leadStatus !== 'all') {
        params.set('leadStatus', currentFilters.leadStatus);
      }
      
      const response = await fetch(`/api/tier-one?${params.toString()}`);
      const data = await response.json();
      
      if (data.success) {
        // Transform tier_one_companies data to match CompaniesTable format EXACTLY
        const transformedCompanies = data.companies.map((c: any) => ({
          id: c.id,
          company: c.company_name,
          company_name: c.company_name,
          tool_detected: c.detected_tool && c.detected_tool !== 'Not Identified Yet' ? c.detected_tool : '',
          signal_type: c.engaged ? 'engaged' : 'stack_mention',
          context: c.engagement_context || '',
          confidence: 'high',
          job_title: c.first_person || 'Manual Entry',
          job_url: c.linkedin_url || '',
          platform: c.is_identified ? 'LinkedIn' : 'Manual',
          identified_date: c.identified_date || new Date().toISOString(),
          leads_generated: c.leads_generated,
          leads_generated_date: c.leads_generated_date,
          tier: 'Tier 1',
          sponsor_1: c.first_person,
          sponsor_2: c.second_person,
          rep_sdr_bdr: c.third_person
        }));
        
        setCompanies(transformedCompanies);
        setStats(data.stats);
        setTotalCount(data.totalCount || data.stats.total);
      }
    } catch (error) {
      console.error('Error fetching Tier 1 companies:', error);
      showToast.error('Failed to load Tier 1 companies');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchTierOneCompanies(1, {});
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    fetchTierOneCompanies(page, filters);
  }, [filters, fetchTierOneCompanies]);

  const handleFilterChange = useCallback((newFilters: any) => {
    setFilters(newFilters);
    setCurrentPage(1);
    fetchTierOneCompanies(1, newFilters);
  }, [fetchTierOneCompanies]);

  const handleExport = async () => {
    try {
      const csvHeaders = [
        'Company Name',
        'Tool Detected',
        'Signal Type',
        'Platform',
        'Identified Date',
        'Tier',
        'Sponsor 1',
        'Sponsor 2',
        'Rep/SDR/BDR',
        'Leads Generated',
        'Leads Generated Date'
      ];

      const csvRows = companies.map(company => [
        company.company_name || company.company,
        company.tool_detected || 'Not Identified',
        company.signal_type,
        company.platform,
        company.identified_date ? new Date(company.identified_date).toLocaleDateString() : '',
        company.tier,
        company.sponsor_1 || '',
        company.sponsor_2 || '',
        company.rep_sdr_bdr || '',
        company.leads_generated ? 'Yes' : 'No',
        company.leads_generated_date ? new Date(company.leads_generated_date).toLocaleDateString() : ''
      ]);

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.map(cell => `"${cell || ''}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tier-1-companies-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showToast.success('Export completed successfully');
    } catch (error) {
      console.error('Export failed:', error);
      showToast.error('Failed to export data');
    }
  };

  const handleLeadStatusUpdate = useCallback(async (companyId: string, leadsGenerated: boolean) => {
    // Update local state immediately for instant feedback
    setCompanies(prev => 
      prev.map(company => 
        company.id === companyId 
          ? { ...company, leads_generated: leadsGenerated, leads_generated_date: leadsGenerated ? new Date().toISOString() : null }
          : company
      )
    );
    
    // Update stats
    setStats(prev => ({
      ...prev,
      with_leads: leadsGenerated 
        ? prev.with_leads + 1 
        : Math.max(0, prev.with_leads - 1)
    }));
    
    try {
      // Call the Tier 1 specific API to persist the change
      const response = await fetch('/api/tier-one/update-lead-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          leadsGenerated,
          generatedBy: 'Manual Update - Tier 1'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update');
      }
      
      showToast.success(
        leadsGenerated ? 'Company marked as has leads!' : 'Company marked as needs leads!'
      );
    } catch (error) {
      console.error('Error updating lead status:', error);
      // Revert on error
      setCompanies(prev => 
        prev.map(company => 
          company.id === companyId 
            ? { ...company, leads_generated: !leadsGenerated, leads_generated_date: null }
            : company
        )
      );
      setStats(prev => ({
        ...prev,
        with_leads: !leadsGenerated 
          ? prev.with_leads + 1 
          : Math.max(0, prev.with_leads - 1)
      }));
      showToast.error('Failed to update lead status. Please try again.');
    }
  }, []);

  if (loading && companies.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards - Using exact same style as QuickStatsOptimized */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
          <div className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-muted-foreground">Total Tier 1</p>
              <div className="p-2 bg-primary/10 rounded-lg">
                <Building2 className="h-4 w-4" />
              </div>
            </div>
            <div className="space-y-0">
              <p className="text-xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">
                {stats.total} priority target companies
              </p>
            </div>
          </div>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
          <div className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-muted-foreground">Identified</p>
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
            </div>
            <div className="space-y-0">
              <p className="text-xl font-bold">{stats.identified}</p>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-muted-foreground">
                  {stats.total > 0 ? Math.round((stats.identified / stats.total) * 100) : 0}% of total
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Tool detected successfully
              </p>
            </div>
          </div>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
          <div className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-muted-foreground">Unidentified</p>
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertCircle className="h-4 w-4 text-orange-600" />
              </div>
            </div>
            <div className="space-y-0">
              <p className="text-xl font-bold">{stats.unidentified}</p>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-muted-foreground">
                  {stats.total > 0 ? Math.round((stats.unidentified / stats.total) * 100) : 0}% of total
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Need further research
              </p>
            </div>
          </div>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
          <div className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-muted-foreground">With Leads</p>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <div className="space-y-0">
              <p className="text-xl font-bold">{stats.with_leads}</p>
              <div className="flex items-center gap-1 text-xs">
                <span className="text-muted-foreground">
                  {stats.total > 0 ? Math.round((stats.with_leads / stats.total) * 100) : 0}% of total
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Leads generated successfully
              </p>
            </div>
          </div>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
          <div className="p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-muted-foreground">Coverage</p>
              <div className="p-2 bg-purple-100 rounded-lg">
                <Target className="h-4 w-4 text-purple-600" />
              </div>
            </div>
            <div className="space-y-0">
              <p className="text-xl font-bold">{stats.coverage}%</p>
              <div className="flex items-center gap-1 text-xs">
                <TrendingUp className="h-3 w-3 text-green-500" />
                <span className="text-green-600">
                  {stats.coverage}% of Tier 1
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Companies identified in Tier 1
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Use the EXACT SAME CompaniesTable component */}
      <CompaniesTable
        companies={companies}
        totalCount={totalCount}
        currentPage={currentPage}
        onPageChange={handlePageChange}
        onFilterChange={handleFilterChange}
        onExport={handleExport}
        onLeadStatusUpdate={handleLeadStatusUpdate}
        isLoading={loading}
        hideTierFilter={true}
        compact={false}
      />
    </div>
  );
}