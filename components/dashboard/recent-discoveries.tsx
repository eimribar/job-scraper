'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Building2, Clock } from "lucide-react";

interface RecentDiscovery {
  company_name: string;
  tool_detected: string;
  identified_date: string;
}

interface RecentDiscoveriesProps {
  discoveries: RecentDiscovery[];
}

export function RecentDiscoveries({ discoveries }: RecentDiscoveriesProps) {
  const getToolBadge = (tool: string) => {
    if (tool === 'Outreach.io') {
      return (
        <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
          🎯 Outreach
        </Badge>
      );
    }
    if (tool === 'SalesLoft') {
      return (
        <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
          ⚡ SalesLoft
        </Badge>
      );
    }
    return (
      <Badge variant="outline">
        {tool}
      </Badge>
    );
  };

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Recent Discoveries
        </CardTitle>
      </CardHeader>
      <CardContent>
        {discoveries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              No discoveries yet today
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Companies using Outreach or SalesLoft will appear here as they&apos;re discovered through job analysis.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {discoveries.map((discovery, index) => (
              <div 
                key={`${discovery.company_name}-${discovery.identified_date}-${index}`}
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate">
                    {discovery.company_name}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Discovered {formatDistanceToNow(new Date(discovery.identified_date), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex-shrink-0 ml-4">
                  {getToolBadge(discovery.tool_detected)}
                </div>
              </div>
            ))}
            
            {discoveries.length === 10 && (
              <div className="text-center pt-2">
                <p className="text-sm text-muted-foreground">
                  Showing latest 10 discoveries
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}