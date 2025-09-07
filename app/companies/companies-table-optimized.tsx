'use client';

import { memo, useMemo, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useDebounce } from 'use-debounce';
import { useCompanies, useUpdateLeadStatus } from '@/lib/hooks/useCompanies';
import { CompaniesTable } from '@/components/companies/companies-table';
import { showToast } from '@/components/ui/toast';
import { useState } from 'react';

interface CompanyFilters {
  page: number;
  limit: number;
  tool?: string;
  search?: string;
  leadStatus?: 'all' | 'with_leads' | 'without_leads';
}

interface CompaniesTableOptimizedProps {
  filters: CompanyFilters;
}

export const CompaniesTableOptimized = memo(function CompaniesTableOptimized({ 
  filters 
}: CompaniesTableOptimizedProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState(filters.search || '');
  const [debouncedSearchTerm] = useDebounce(searchTerm, 300);
  
  // Memoize the actual filters used for the query
  const queryFilters = useMemo(() => ({
    ...filters,
    search: debouncedSearchTerm,
  }), [filters, debouncedSearchTerm]);

  // Fetch companies with React Query
  const { 
    data: response, 
    isLoading, 
    error, 
    isFetching 
  } = useCompanies(queryFilters);

  // Mutation for updating lead status
  const updateLeadMutation = useUpdateLeadStatus();

  // Handle filter changes with smooth navigation
  const handleFilterChange = useCallback((newFilters: { 
    tool?: string; 
    confidence?: string; 
    search?: string; 
    excludeGoogleSheets?: boolean; 
    leadStatus?: string;
  }) => {
    const params = new URLSearchParams();
    
    if (newFilters.tool && newFilters.tool !== 'all') {
      params.set('tool', newFilters.tool);
    }
    if (newFilters.confidence && newFilters.confidence !== 'all') {
      params.set('confidence', newFilters.confidence);
    }
    if (newFilters.search) {
      params.set('search', newFilters.search);
      setSearchTerm(newFilters.search);
    } else {
      setSearchTerm('');
    }
    if (newFilters.leadStatus && newFilters.leadStatus !== 'all') {
      params.set('leadStatus', newFilters.leadStatus);
    }
    
    // Always reset to page 1 on filter change
    params.set('page', '1');
    
    const url = `/companies?${params.toString()}`;
    
    startTransition(() => {
      router.push(url, { scroll: false });
    });
  }, [router]);

  // Handle page changes
  const handlePageChange = useCallback((page: number) => {
    const params = new URLSearchParams();
    
    // Preserve existing filters
    if (filters.tool) params.set('tool', filters.tool);
    if (filters.leadStatus) params.set('leadStatus', filters.leadStatus);
    if (debouncedSearchTerm) params.set('search', debouncedSearchTerm);
    
    params.set('page', page.toString());
    
    const url = `/companies?${params.toString()}`;
    
    startTransition(() => {
      router.push(url, { scroll: false });
    });
  }, [router, filters, debouncedSearchTerm]);

  // Handle CSV export
  const handleExport = useCallback(async () => {
    try {
      showToast.loading('Preparing export...');
      
      const params = new URLSearchParams();
      if (filters.tool) params.set('tool', filters.tool);
      if (filters.leadStatus) params.set('leadStatus', filters.leadStatus);
      if (debouncedSearchTerm) params.set('search', debouncedSearchTerm);
      params.set('format', 'csv');
      
      const response = await fetch(`/api/companies/export?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Export failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `companies-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      showToast.success('Export completed successfully!');
    } catch (error) {
      console.error('Export failed:', error);
      showToast.error('Failed to export companies');
    }
  }, [filters, debouncedSearchTerm]);

  // Handle lead status updates with optimistic updates
  const handleLeadStatusUpdate = useCallback((companyId: string, leadsGenerated: boolean) => {
    updateLeadMutation.mutate(
      { companyId, leadsGenerated },
      {
        onSuccess: () => {
          showToast.success(
            leadsGenerated 
              ? 'Company marked as having leads!' 
              : 'Company marked as needing leads'
          );
          // React Query will automatically handle cache invalidation
        },
        onError: (error) => {
          console.error('Failed to update lead status:', error);
          showToast.error('Failed to update lead status');
        }
      }
    );
  }, [updateLeadMutation]);

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <h3 className="text-lg font-semibold text-red-800 mb-2">
          Failed to load companies
        </h3>
        <p className="text-red-600 text-sm">
          {error.message || 'There was an error loading the companies data.'}
        </p>
      </div>
    );
  }

  // Extract data from response
  const companies = response?.companies || [];
  const totalCount = response?.pagination?.totalCount || 0;
  const currentPage = response?.pagination?.page || filters.page;

  return (
    <CompaniesTable
      companies={companies}
      totalCount={totalCount}
      currentPage={currentPage}
      onPageChange={handlePageChange}
      onFilterChange={handleFilterChange}
      onExport={handleExport}
      onLeadStatusUpdate={handleLeadStatusUpdate}
      compact={false}
      isLoading={isLoading || isFetching || isPending}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
    />
  );
});