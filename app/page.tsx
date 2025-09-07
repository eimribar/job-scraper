import { LiveActivityFeed } from "@/components/dashboard/live-activity-feed";
import { ProcessingWidget } from "@/components/dashboard/processing-widget";
import { QuickStats } from "@/components/dashboard/quick-stats";
import { LeadCoverageWidget } from "@/components/dashboard/lead-coverage-widget";
import { CompaniesTableWrapper } from "@/components/companies/companies-table-wrapper";
import { DataService } from "@/lib/services/dataService";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Zap, Settings, Activity } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

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
      {/* Enhanced Header */}
      <header className="border-b bg-white/70 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 blur-xl group-hover:blur-2xl transition-all" />
                <div className="relative p-2.5 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl shadow-lg">
                  <Activity className="h-5 w-5 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">Sales Tool Detector</h1>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    Live Monitoring
                  </span>
                  <span className="flex items-center gap-2">
                    <Image src="/logos/outreach_transparent.png" alt="Outreach" width={40} height={12} className="object-contain opacity-60" />
                    <span className="text-muted-foreground">•</span>
                    <Image src="/logos/salesloft_transparent.png" alt="SalesLoft" width={40} height={12} className="object-contain opacity-60" />
                  </span>
                </div>
              </div>
            </div>
            
            <nav className="flex items-center gap-1">
              <Link href="/companies">
                <Button variant="ghost" size="sm" className="gap-2 hover:bg-blue-50">
                  Companies
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
              <Link href="/automation">
                <Button variant="ghost" size="sm" className="gap-2 hover:bg-purple-50">
                  <Zap className="h-3 w-3" />
                  Automation
                </Button>
              </Link>
              <Link href="/settings">
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100">
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
            </nav>
          </div>
        </div>
      </header>

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