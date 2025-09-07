'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

const queryClientOptions = {
  defaultOptions: {
    queries: {
      // Stale time - data is fresh for 30 seconds
      staleTime: 30 * 1000,
      // Cache time - keep unused data for 5 minutes
      gcTime: 5 * 60 * 1000,
      // Retry failed requests
      retry: (failureCount: number, error: any) => {
        // Don't retry for 400-499 errors
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
      // Refetch on window focus
      refetchOnWindowFocus: true,
      // Background refetch interval for live data
      refetchInterval: 30 * 1000, // 30 seconds
    },
    mutations: {
      retry: 1,
    },
  },
};

export function ReactQueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient(queryClientOptions));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}