import { LiveActivityFeed } from "@/components/dashboard/live-activity-feed";
import { ProcessingWidget } from "@/components/dashboard/processing-widget";
import { QuickStats } from "@/components/dashboard/quick-stats";
import { LeadCoverageWidget } from "@/components/dashboard/lead-coverage-widget";
import { CompaniesTableWrapper } from "@/components/companies/companies-table-wrapper";
import { DataService } from "@/lib/services/dataService";
import { AppHeader } from "@/components/navigation/app-header";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const dataService = new DataService();
  
  let companies: any[] = [];
  let totalCompaniesCount = 0;
  
  try {
    companies = await dataService.getIdentifiedCompanies(10, 0);
    totalCompaniesCount = await dataService.getIdentifiedCompaniesCount();
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20">
      {/* App Navigation Header */}
      <AppHeader />

      {/* Main Content */}
      <main className="container mx-auto px-6 py-3">
        <div className="space-y-3">
          {/* Quick Stats */}
          <section>
            <QuickStats />
          </section>

          {/* Main Grid with hover effects */}
          <div className="grid gap-3 lg:grid-cols-3 items-start">
            {/* Live Activity Feed - Takes 2 columns on large screens */}
            <div className="lg:col-span-2">
              <LiveActivityFeed />
            </div>
            
            {/* Right column widgets */}
            <div className="space-y-2">
              {/* Processing Widget */}
              <ProcessingWidget />
              
              {/* Lead Coverage Widget */}
              <LeadCoverageWidget />
            </div>
          </div>

          {/* Recent Companies Section with enhanced styling */}
          <section className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="text-lg font-bold">Recent Discoveries</h2>
                <p className="text-xs text-muted-foreground">
                  Latest companies identified using sales engagement platforms
                </p>
              </div>
              <Link href="/companies">
                <Button variant="outline" size="sm" className="gap-2 hover:scale-105 transition-transform shadow-sm hover:shadow-md">
                  View All {totalCompaniesCount}
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
            
            <div className="bg-white/80 backdrop-blur-sm rounded-xl border shadow-lg hover:shadow-xl transition-shadow">
              <CompaniesTableWrapper 
                companies={companies}
                totalCount={totalCompaniesCount}
                compact={true}
              />
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}