'use client';

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

interface CompanyFilters {
  page?: number;
  limit?: number;
  tool?: string;
  confidence?: string;
  search?: string;
  leadStatus?: 'all' | 'with_leads' | 'without_leads';
}

interface Company {
  id: string;
  company: string;
  tool_detected: string;
  leads_generated: boolean;
  identified_date: string;
  job_titles: string[];
  confidence?: string;
}

interface CompaniesResponse {
  success: boolean;
  companies: Company[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  filters: CompanyFilters;
}

interface DashboardStats {
  totalCompanies: number;
  outreachCount: number;
  salesLoftCount: number;
  bothCount: number;
}

// React Query keys for consistent caching
export const companiesKeys = {
  all: ['companies'] as const,
  lists: () => [...companiesKeys.all, 'list'] as const,
  list: (filters: CompanyFilters) => [...companiesKeys.lists(), filters] as const,
  details: () => [...companiesKeys.all, 'detail'] as const,
  detail: (id: string) => [...companiesKeys.details(), id] as const,
  stats: () => [...companiesKeys.all, 'stats'] as const,
} as const;

// Fetch companies with filters
async function fetchCompanies(filters: CompanyFilters = {}): Promise<CompaniesResponse> {
  const searchParams = new URLSearchParams();
  
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      searchParams.set(key, String(value));
    }
  });

  const response = await fetch(`/api/companies?${searchParams.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch companies');
  }
  
  return response.json();
}

// Fetch dashboard stats
async function fetchDashboardStats(): Promise<DashboardStats> {
  const response = await fetch('/api/dashboard/stats');
  if (!response.ok) {
    throw new Error('Failed to fetch dashboard stats');
  }
  
  return response.json();
}

// Update lead status
async function updateLeadStatus(companyId: string, leadsGenerated: boolean): Promise<void> {
  const response = await fetch(`/api/companies/${companyId}/leads`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ leads_generated: leadsGenerated }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to update lead status');
  }
}

// Hook for fetching companies with pagination and filters
export function useCompanies(filters: CompanyFilters = {}) {
  return useQuery({
    queryKey: companiesKeys.list(filters),
    queryFn: () => fetchCompanies(filters),
    staleTime: 30 * 1000, // 30 seconds - data is fresh for 30s
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache for 5 minutes
    refetchOnWindowFocus: false, // Disable aggressive refetching
    refetchOnMount: 'always', // Always refetch on component mount
  });
}

// Hook for infinite scroll companies loading
export function useInfiniteCompanies(filters: Omit<CompanyFilters, 'page'> = {}) {
  return useInfiniteQuery({
    queryKey: [...companiesKeys.lists(), 'infinite', filters],
    queryFn: ({ pageParam = 1 }) => fetchCompanies({ ...filters, page: pageParam }),
    getNextPageParam: (lastPage) => {
      return lastPage.pagination.hasNextPage ? lastPage.pagination.page + 1 : undefined;
    },
    initialPageParam: 1,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

// Hook for dashboard stats with background updates
export function useDashboardStats() {
  return useQuery({
    queryKey: companiesKeys.stats(),
    queryFn: fetchDashboardStats,
    staleTime: 60 * 1000, // 1 minute - stats are fresh for 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes in cache
    refetchInterval: 60 * 1000, // Background update every minute
    refetchOnWindowFocus: false,
  });
}

// Hook for updating lead status with optimistic updates
export function useUpdateLeadStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ companyId, leadsGenerated }: { companyId: string; leadsGenerated: boolean }) =>
      updateLeadStatus(companyId, leadsGenerated),
    
    // Optimistic updates for instant UI feedback
    onMutate: async ({ companyId, leadsGenerated }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: companiesKeys.lists() });
      
      // Snapshot the previous value
      const previousData = queryClient.getQueriesData({ queryKey: companiesKeys.lists() });
      
      // Optimistically update all relevant queries
      queryClient.setQueriesData({ queryKey: companiesKeys.lists() }, (old: any) => {
        if (!old) return old;
        
        return {
          ...old,
          companies: old.companies.map((company: Company) =>
            company.id === companyId
              ? { ...company, leads_generated: leadsGenerated }
              : company
          ),
        };
      });
      
      // Return context object with the snapshot
      return { previousData };
    },
    
    // If mutation fails, use the context returned from onMutate to roll back
    onError: (err, newCompany, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    
    // Always refetch after error or success
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: companiesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: companiesKeys.stats() });
    },
  });
}

// Hook for prefetching companies (for navigation optimization)
export function usePrefetchCompanies() {
  const queryClient = useQueryClient();
  
  return useCallback((filters: CompanyFilters = {}) => {
    queryClient.prefetchQuery({
      queryKey: companiesKeys.list(filters),
      queryFn: () => fetchCompanies(filters),
      staleTime: 30 * 1000,
    });
  }, [queryClient]);
}

// Hook for prefetching dashboard stats
export function usePrefetchDashboardStats() {
  const queryClient = useQueryClient();
  
  return useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: companiesKeys.stats(),
      queryFn: fetchDashboardStats,
      staleTime: 60 * 1000,
    });
  }, [queryClient]);
}