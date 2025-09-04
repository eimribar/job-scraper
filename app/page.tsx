import { StatsCards } from "@/components/dashboard/stats-cards";
import { RecentDiscoveries } from "@/components/dashboard/recent-discoveries";
import { CompaniesTableWrapper } from "@/components/companies/companies-table-wrapper";
import { DataService } from "@/lib/services/dataService";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, Building2, TrendingUp } from "lucide-react";

// Enable real-time data updates by disabling Next.js caching
export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  // Initialize data service
  const dataService = new DataService();
  
  let stats = {
    totalCompanies: 0,
    outreachCount: 0,
    salesLoftCount: 0,
    recentDiscoveries: [],
    jobsProcessedToday: 0,
  };
  
  let companies: any[] = [];
  let totalCompaniesCount = 0;
  
  try {
    // Fetch dashboard data
    [stats, companies] = await Promise.all([
      dataService.getDashboardStats(),
      dataService.getIdentifiedCompanies(20, 0), // Get first 20 companies
    ]);

    totalCompaniesCount = await dataService.getIdentifiedCompaniesCount();
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    // Use default empty values set above
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                <div className="p-2 bg-primary rounded-lg">
                  <Target className="h-6 w-6 text-primary-foreground" />
                </div>
                Sales Tool Detector
              </h1>
              <p className="text-muted-foreground mt-2">
                Identify companies using Outreach.io and SalesLoft through job posting analysis
              </p>
            </div>
            <div className="hidden md:flex items-center gap-4">
              <div className="text-right">
                <p className="text-2xl font-bold">{stats.totalCompanies}</p>
                <p className="text-sm text-muted-foreground">Companies Found</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Stats Overview */}
          <section>
            <StatsCards stats={stats} />
          </section>

          {/* Main Dashboard Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="companies" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Companies
              </TabsTrigger>
              <TabsTrigger value="insights" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Insights
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Recent Discoveries */}
                <RecentDiscoveries discoveries={stats.recentDiscoveries} />
                
                {/* Quick Stats Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Tool Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-green-500" />
                          <span className="font-medium">Outreach.io</span>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-bold">{stats.outreachCount}</span>
                          <p className="text-xs text-muted-foreground">
                            {((stats.outreachCount / stats.totalCompanies) * 100).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500" />
                          <span className="font-medium">SalesLoft</span>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-bold">{stats.salesLoftCount}</span>
                          <p className="text-xs text-muted-foreground">
                            {((stats.salesLoftCount / stats.totalCompanies) * 100).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      
                      <div className="pt-4 border-t">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Total Companies</span>
                          <span className="font-bold">{stats.totalCompanies}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Companies Tab */}
            <TabsContent value="companies">
              <div className="space-y-4">
                <CompaniesTableWrapper 
                  companies={companies}
                  totalCount={totalCompaniesCount}
                />
              </div>
            </TabsContent>

            {/* Insights Tab */}
            <TabsContent value="insights">
              <div className="grid gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Coming Soon: Advanced Insights</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12">
                      <TrendingUp className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
                      <h3 className="text-lg font-medium mb-2">Advanced Analytics in Development</h3>
                      <p className="text-muted-foreground max-w-md mx-auto">
                        We&apos;re building powerful insights including territory mapping, trend analysis, 
                        and competitive intelligence. Check back soon!
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}