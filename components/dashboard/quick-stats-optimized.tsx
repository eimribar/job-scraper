'use client';

import { memo } from 'react';
import { Card } from '@/components/ui/card';
import { ArrowUp, ArrowDown, Building2, TrendingUp } from 'lucide-react';
import { useDashboardStats } from '@/lib/hooks/useCompanies';
import Image from 'next/image';

interface StatCard {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  subtitle?: string;
}

// Memoized component for better performance
export const QuickStatsOptimized = memo(function QuickStatsOptimized() {
  const { data: rawStats, isLoading, error } = useDashboardStats();

  // Transform stats data into display format
  const stats: StatCard[] = rawStats ? [
    {
      title: 'Total Companies',
      value: rawStats.totalCompanies || 0,
      change: 0, // TODO: Calculate daily change if needed
      changeLabel: 'identified',
      icon: <Building2 className="h-4 w-4" />,
      trend: 'neutral',
      subtitle: `${rawStats.totalCompanies || 0} companies using sales tools`
    },
    {
      title: 'Outreach Users',
      value: rawStats.outreachCount + (rawStats.bothCount || 0),
      change: Math.round(((rawStats.outreachCount + (rawStats.bothCount || 0)) / (rawStats.totalCompanies || 1)) * 100),
      changeLabel: '% of total',
      icon: <Image src="/logos/outreach_transparent.png" alt="Outreach" width={80} height={24} className="object-contain" />,
      trend: 'neutral',
      subtitle: rawStats.bothCount > 0 ? `Includes ${rawStats.bothCount} using both tools` : 'Exclusive users'
    },
    {
      title: 'SalesLoft Users',
      value: rawStats.salesLoftCount + (rawStats.bothCount || 0),
      change: Math.round(((rawStats.salesLoftCount + (rawStats.bothCount || 0)) / (rawStats.totalCompanies || 1)) * 100),
      changeLabel: '% of total',
      icon: <Image src="/logos/salesloft_transparent.png" alt="SalesLoft" width={80} height={24} className="object-contain" />,
      trend: 'neutral',
      subtitle: rawStats.bothCount > 0 ? `Includes ${rawStats.bothCount} using both tools` : 'Exclusive users'
    },
    {
      title: 'Both Tools',
      value: rawStats.bothCount || 0,
      change: Math.round(((rawStats.bothCount || 0) / (rawStats.totalCompanies || 1)) * 100),
      changeLabel: '% of total',
      icon: <TrendingUp className="h-4 w-4" />,
      trend: rawStats.bothCount > 0 ? 'up' : 'neutral',
      subtitle: 'Companies using Outreach + SalesLoft'
    }
  ] : [];

  // Error state
  if (error) {
    return (
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="col-span-full bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-red-600 text-sm">Failed to load statistics</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="p-4 animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-3/4 mb-3" />
            <div className="h-8 bg-slate-200 rounded w-1/2 mb-2" />
            <div className="h-3 bg-slate-200 rounded w-2/3" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <StatCard key={stat.title} stat={stat} index={index} />
      ))}
    </div>
  );
});

// Memoized individual stat card for performance
const StatCard = memo(function StatCard({ stat, index }: { stat: StatCard; index: number }) {
  return (
    <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
      <div className="p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium text-muted-foreground">
            {stat.title}
          </p>
          <div className={index === 1 || index === 2 ? "" : "p-2 bg-primary/10 rounded-lg"}>
            {stat.icon}
          </div>
        </div>
        
        <div className="space-y-0">
          <p className="text-xl font-bold">
            {stat.value}
          </p>
          
          {stat.change !== undefined && (
            <div className="flex items-center gap-1 text-xs">
              {stat.trend === 'up' && (
                <ArrowUp className="h-3 w-3 text-green-500" />
              )}
              {stat.trend === 'down' && (
                <ArrowDown className="h-3 w-3 text-red-500" />
              )}
              <span className={
                stat.trend === 'up' ? 'text-green-600' :
                stat.trend === 'down' ? 'text-red-600' :
                'text-muted-foreground'
              }>
                {stat.change} {stat.changeLabel}
              </span>
            </div>
          )}
          
          {stat.subtitle && (
            <p className="text-xs text-muted-foreground">
              {stat.subtitle}
            </p>
          )}
        </div>
      </div>
      
      {/* Subtle gradient accent */}
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-primary/20 via-primary/50 to-primary/20" />
    </Card>
  );
});