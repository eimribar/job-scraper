import { SearchTermsGrid } from "@/components/automation/search-terms-grid";
import { ProcessingQueue } from "@/components/automation/processing-queue";
import { PerformanceMetrics } from "@/components/automation/performance-metrics";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, Pause, RefreshCw } from "lucide-react";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default function AutomationCenter() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/95">
      {/* Header */}
      <header className="border-b bg-background/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-semibold">Automation Center</h1>
                <p className="text-xs text-muted-foreground">Manage search terms and scraping schedule</p>
              </div>
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
      </header>

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