'use client';

import { useState, useCallback, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePerformanceStore } from "@/lib/stores/performance-store";
import { CompaniesTable } from "./companies-table";

interface CompaniesTableWrapperProps {
  companies: any[];
  totalCount: number;
  compact?: boolean;
}

export function CompaniesTableWrapper({ companies, totalCount, compact = false }: CompaniesTableWrapperProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const { setNavigating } = usePerformanceStore();
  const [currentPage, setCurrentPage] = useState(() => {
    const page = searchParams.get('page');
    return page ? parseInt(page) : 1;
  });
  
  // Initialize filters from URL params
  const [filters, setFilters] = useState(() => ({
    tool: searchParams.get('tool') || undefined,
    search: searchParams.get('search') || undefined,
    leadStatus: searchParams.get('leadStatus') || undefined,
  }));
  
  // Update filters when URL changes
  useEffect(() => {
    setFilters({
      tool: searchParams.get('tool') || undefined,
      search: searchParams.get('search') || undefined,
      leadStatus: searchParams.get('leadStatus') || undefined,
    });
    const page = searchParams.get('page');
    if (page) setCurrentPage(parseInt(page));
  }, [searchParams]);
  
  const navigateWithPerformance = useCallback((url: string) => {
    const startTime = performance.now();
    setNavigating(true);
    
    startTransition(() => {
      router.push(url, { scroll: false });
      
      // Track navigation performance
      setTimeout(() => {
        const endTime = performance.now();
        setNavigating(false);
        console.log(`Fast navigation to ${url}: ${endTime - startTime}ms`);
      }, 0);
    });
  }, [router, setNavigating]);
  
  const handleFilterChange = useCallback((newFilters: { tool?: string; confidence?: string; search?: string; excludeGoogleSheets?: boolean; leadStatus?: string }) => {
    // Build URL with filters
    const params = new URLSearchParams();
    if (newFilters.tool && newFilters.tool !== 'all') params.set('tool', newFilters.tool);
    if (newFilters.confidence && newFilters.confidence !== 'all') params.set('confidence', newFilters.confidence);
    if (newFilters.search) params.set('search', newFilters.search);
    if (newFilters.leadStatus && newFilters.leadStatus !== 'all') params.set('leadStatus', newFilters.leadStatus);
    params.set('page', '1'); // Reset to first page on filter change
    
    const url = `/companies?${params.toString()}`;
    navigateWithPerformance(url);
  }, [navigateWithPerformance]);
  
  const handlePageChange = useCallback((page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', page.toString());
    
    const url = `/companies?${params.toString()}`;
    setCurrentPage(page);
    navigateWithPerformance(url);
  }, [navigateWithPerformance, searchParams]);
  
  const handleExport = useCallback(async () => {
    const params = new URLSearchParams();
    if (filters.tool) params.set('tool', filters.tool);
    if (filters.leadStatus) params.set('leadStatus', filters.leadStatus);
    params.set('format', 'csv');
    
    try {
      const response = await fetch(`/api/companies/export?${params.toString()}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `companies-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  }, [filters]);
  
  return (
    <CompaniesTable
      companies={companies}
      totalCount={totalCount}
      currentPage={currentPage}
      onPageChange={handlePageChange}
      onFilterChange={handleFilterChange}
      onExport={handleExport}
      compact={compact}
      isLoading={isPending}
    />
  );
}