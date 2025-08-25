'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Building2, Target, Zap } from "lucide-react";

interface StatsCardsProps {
  stats: {
    totalCompanies: number;
    outreachCount: number;
    salesLoftCount: number;
    jobsProcessedToday: number;
  };
}

export function StatsCards({ stats }: StatsCardsProps) {
  const { totalCompanies, outreachCount, salesLoftCount, jobsProcessedToday } = stats;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Companies */}
      <Card className="relative overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalCompanies}</div>
          <p className="text-xs text-muted-foreground">
            Using sales tools
          </p>
        </CardContent>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-600" />
      </Card>

      {/* Outreach.io Count */}
      <Card className="relative overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Outreach.io</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{outreachCount}</div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
              🎯 Primary Tool
            </Badge>
          </div>
        </CardContent>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-green-500" />
      </Card>

      {/* SalesLoft Count */}
      <Card className="relative overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">SalesLoft</CardTitle>
          <Zap className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{salesLoftCount}</div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
              ⚡ Alternative Tool
            </Badge>
          </div>
        </CardContent>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500" />
      </Card>

      {/* Jobs Processed Today */}
      <Card className="relative overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Jobs Today</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{jobsProcessedToday}</div>
          <p className="text-xs text-muted-foreground">
            Processed & analyzed
          </p>
        </CardContent>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-600" />
      </Card>
    </div>
  );
}