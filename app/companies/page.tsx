import { DataService } from "@/lib/services/dataService";
import { CompaniesClient } from "./companies-client";

// Enable real-time data updates by disabling Next.js caching
export const dynamic = 'force-dynamic';

interface CompaniesPageProps {
  searchParams: {
    page?: string;
    tool?: string;
    search?: string;
  };
}

export default async function CompaniesPage({ searchParams }: CompaniesPageProps) {
  try {
    const dataService = new DataService();
    
    // Parse query parameters
    const currentPage = parseInt(searchParams.page || "1");
    const tool = searchParams.tool;
    const search = searchParams.search;
    
    const itemsPerPage = 50; // Show more items per page
    const offset = (currentPage - 1) * itemsPerPage;
    
    // Fetch companies and count - simplified
    let companies = [];
    let totalCount = 0;
    
    try {
      [companies, totalCount] = await Promise.all([
        dataService.getIdentifiedCompanies(itemsPerPage, offset, tool, undefined, search),
        dataService.getIdentifiedCompaniesCount(tool, undefined, search)
      ]);
    } catch (error) {
      console.error('Error fetching companies:', error);
      // Continue with empty data if Supabase isn't configured
      companies = [];
      totalCount = 0;
    }
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Identified Companies
              </h1>
              <p className="text-muted-foreground mt-2">
                Complete overview of all companies using Outreach.io and SalesLoft
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{totalCount}</p>
              <p className="text-sm text-muted-foreground">Total Companies</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <CompaniesClient
          companies={companies}
          totalCount={totalCount}
          currentPage={currentPage}
          initialTool={tool}
          initialSearch={search}
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