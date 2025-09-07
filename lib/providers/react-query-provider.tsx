'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

// Performance-optimized query client configuration
const queryClientOptions = {
  defaultOptions: {
    queries: {
      // Aggressive caching for better performance
      staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh longer
      gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache longer
      
      // Reduce network requests
      refetchOnWindowFocus: false, // Disable aggressive refetching
      refetchOnMount: true, // Still refetch on component mount
      refetchOnReconnect: true, // Refetch when network reconnects
      
      // Smart retry logic
      retry: (failureCount: number, error: any) => {
        // Don't retry for 400-499 errors (client errors)
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        // Don't retry more than 2 times for better UX
        return failureCount < 2;
      },
      
      // Remove background refetch interval for performance
      // Individual hooks can override this when needed
      refetchInterval: false,
    },
    mutations: {
      // Quick retry for mutations
      retry: 1,
      // Network timeout for mutations
      networkMode: 'online',
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