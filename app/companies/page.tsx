import { DataService } from "@/lib/services/dataService";
import { CompaniesClient } from "./companies-client";
import { AppHeader } from "@/components/navigation/app-header";
import { QuickStatsOptimized } from "@/components/dashboard/quick-stats-optimized";

// Enable real-time data updates by disabling Next.js caching
export const dynamic = 'force-dynamic';

interface CompaniesPageProps {
  searchParams: {
    page?: string;
    tool?: string;
    search?: string;
    leadStatus?: string;
  };
}

export default async function CompaniesPage({ searchParams }: CompaniesPageProps) {
  try {
    const dataService = new DataService();
    
    // Parse query parameters (await searchParams for Next.js 15)
    const params = await searchParams;
    const currentPage = parseInt(params.page || "1");
    const tool = params.tool;
    const search = params.search;
    const leadStatus = params.leadStatus as 'all' | 'with_leads' | 'without_leads' | undefined;
    
    const itemsPerPage = 50; // Show more items per page
    const offset = (currentPage - 1) * itemsPerPage;
    
    // Fetch companies, count, and dashboard stats
    let companies = [];
    let totalCount = 0;
    let dashboardStats = {
      totalCompanies: 0,
      outreachCount: 0,
      salesLoftCount: 0,
      bothCount: 0
    };
    
    try {
      [companies, totalCount, dashboardStats] = await Promise.all([
        dataService.getIdentifiedCompanies(itemsPerPage, offset, tool, undefined, search, leadStatus),
        dataService.getIdentifiedCompaniesCount(tool, undefined, search, leadStatus),
        dataService.getDashboardStats()
      ]);
    } catch (error) {
      console.error('Error fetching companies:', error);
      // Continue with empty data if Supabase isn't configured
      companies = [];
      totalCount = 0;
    }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20">
      {/* App Navigation Header */}
      <AppHeader />
      
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
        {/* Quick Stats */}
        <section>
          <QuickStatsOptimized />
        </section>

        {/* Companies Table */}
        <CompaniesClient
          companies={companies}
          totalCount={totalCount}
          currentPage={currentPage}
          initialTool={tool}
          initialSearch={search}
          dashboardStats={dashboardStats}
        />
      </div>
    </div>
  );
  } catch (error) {
    console.error('Error in CompaniesPage:', error);
    // Return an error page
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Error Loading Companies</h1>
          <p className="text-muted-foreground">There was an error loading the companies data. Please try again later.</p>
        </div>
      </div>
    );
  }
}

// Loading skeleton for better perceived performance
function CompaniesPageSkeleton() {
  return (
    <>
      {/* Page Header Skeleton */}
      <div className="border-b bg-white/70 backdrop-blur-md">
        <div className="container mx-auto px-6 py-4">
          <div className="space-y-2">
            <div className="h-7 bg-slate-200 rounded w-64 animate-pulse" />
            <div className="h-4 bg-slate-200 rounded w-96 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="container mx-auto px-6 py-4 space-y-4">
        {/* Quick Stats Skeleton */}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-xl border p-4 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-3" />
              <div className="h-8 bg-slate-200 rounded w-1/2 mb-2" />
              <div className="h-3 bg-slate-200 rounded w-2/3" />
            </div>
          ))}
        </div>

        {/* Table Skeleton */}
        <div className="bg-white rounded-xl border">
          <div className="p-6">
            <div className="h-6 bg-slate-200 rounded w-48 mb-4 animate-pulse" />
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="h-4 bg-slate-200 rounded w-32 animate-pulse" />
                  <div className="h-4 bg-slate-200 rounded w-24 animate-pulse" />
                  <div className="h-4 bg-slate-200 rounded w-20 animate-pulse" />
                  <div className="h-4 bg-slate-200 rounded flex-1 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}