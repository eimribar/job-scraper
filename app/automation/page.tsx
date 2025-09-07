import { SearchTermsGrid } from "@/components/automation/search-terms-grid";
import { ProcessingQueue } from "@/components/automation/processing-queue";
import { PerformanceMetrics } from "@/components/automation/performance-metrics";
import { AppHeader } from "@/components/navigation/app-header";
import { Button } from "@/components/ui/button";
import { Play, RefreshCw } from "lucide-react";

export const dynamic = 'force-dynamic';

export default function AutomationCenter() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20">
      {/* App Navigation Header */}
      <AppHeader />
      
      {/* Page Header */}
      <div className="border-b bg-white/70 backdrop-blur-md">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Automation Center</h1>
              <p className="text-sm text-muted-foreground mt-1">Manage search terms and processing schedule</p>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <RefreshCw className="h-3 w-3" />
                Refresh
              </Button>
              <Button size="sm" className="gap-2">
                <Play className="h-3 w-3" />
                Start All
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Performance Metrics */}
          <section>
            <PerformanceMetrics />
          </section>

          {/* Main Grid */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Search Terms Grid - Takes 2 columns */}
            <div className="lg:col-span-2">
              <SearchTermsGrid />
            </div>
            
            {/* Processing Queue - Takes 1 column */}
            <div>
              <ProcessingQueue />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}