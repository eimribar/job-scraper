'use client';

import { useSearchParams } from 'next/navigation';
import { QuickStatsOptimized } from "@/components/dashboard/quick-stats-optimized";
import { CompaniesTableOptimized } from "./companies-table-optimized";

export function CompaniesPageContent() {
  const searchParams = useSearchParams();
  
  // Extract filters from URL parameters
  const filters = {
    page: parseInt(searchParams.get('page') || '1'),
    tool: searchParams.get('tool') || undefined,
    search: searchParams.get('search') || undefined,
    leadStatus: searchParams.get('leadStatus') as 'all' | 'with_leads' | 'without_leads' | undefined,
    limit: 50, // Show more items per page for better performance
  };

  return (
    <>
      {/* Page Header */}
      <div className="border-b bg-white/70 backdrop-blur-md">
        <div className="container mx-auto px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Companies Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage and track companies using Outreach.io and SalesLoft
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-4 space-y-4">
        {/* Quick Stats - Now optimized with React Query */}
        <section>
          <QuickStatsOptimized />
        </section>

        {/* Companies Table - Now optimized with React Query */}
        <CompaniesTableOptimized filters={filters} />
      </div>
    </>
  );
}