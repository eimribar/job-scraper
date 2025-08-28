import { DataService } from "@/lib/services/dataService";
import { CompaniesClient } from "./companies-client";

// Enable real-time data updates by disabling Next.js caching
export const dynamic = 'force-dynamic';

interface CompaniesPageProps {
  searchParams: {
    page?: string;
    tool?: string;
    confidence?: string;
    search?: string;
    excludeGoogleSheets?: string;
  };
}

export default async function CompaniesPage({ searchParams }: CompaniesPageProps) {
  const dataService = new DataService();
  
  // Parse query parameters
  const currentPage = parseInt(searchParams.page || "1");
  const tool = searchParams.tool;
  const confidence = searchParams.confidence;
  const search = searchParams.search;
  const excludeGoogleSheets = searchParams.excludeGoogleSheets === 'true';
  const source = excludeGoogleSheets ? 'job_analysis' : undefined;
  
  const itemsPerPage = 20;
  const offset = (currentPage - 1) * itemsPerPage;
  
  // Fetch companies and count
  const [companies, totalCount] = await Promise.all([
    dataService.getIdentifiedCompanies(itemsPerPage, offset, tool, confidence, source),
    dataService.getIdentifiedCompaniesCount(tool, confidence, source)
  ]);
  
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
          initialConfidence={confidence}
          initialSearch={search}
        />
      </div>
    </div>
  );
}