'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { ArrowUp, ArrowDown, Building2, TrendingUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ToolLogo } from '@/components/tool-logos';
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

export function QuickStats() {
  const [stats, setStats] = useState<StatCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    
    // Refresh stats every minute
    const interval = setInterval(fetchStats, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    const supabase = createClient();
    
    // Get total companies
    const { count: totalCompanies } = await supabase
      .from('identified_companies')
      .select('*', { count: 'exact', head: true });

    // Get today's discoveries
    const today = new Date().toISOString().split('T')[0];
    const { count: todayCompanies } = await supabase
      .from('identified_companies')
      .select('*', { count: 'exact', head: true })
      .gte('identified_date', today);

    // Get this week's discoveries
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const { count: weekCompanies } = await supabase
      .from('identified_companies')
      .select('*', { count: 'exact', head: true })
      .gte('identified_date', weekAgo.toISOString());

    // Get tool breakdown
    const { data: toolBreakdown } = await supabase
      .from('identified_companies')
      .select('tool_detected');
    
    const outreachCount = toolBreakdown?.filter(c => 
      c.tool_detected?.toLowerCase() === 'outreach' || 
      c.tool_detected === 'Outreach.io'
    ).length || 0;
    const salesloftCount = toolBreakdown?.filter(c => 
      c.tool_detected?.toLowerCase() === 'salesloft' || 
      c.tool_detected === 'SalesLoft'
    ).length || 0;
    const bothCount = toolBreakdown?.filter(c => 
      c.tool_detected?.toLowerCase() === 'both'
    ).length || 0;

    // Get active search terms
    const { count: activeTerms } = await supabase
      .from('search_terms')
      .select('*', { count: 'exact', head: true })
      .not('last_scraped_date', 'is', null);

    // Calculate growth rate (compare to last week)
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const { count: lastWeekCompanies } = await supabase
      .from('identified_companies')
      .select('*', { count: 'exact', head: true })
      .gte('identified_date', twoWeeksAgo.toISOString())
      .lt('identified_date', weekAgo.toISOString());

    // Calculate actual growth
    let growthRate = 0;
    let growthLabel = 'new companies';
    
    if (lastWeekCompanies && lastWeekCompanies > 0) {
      growthRate = ((weekCompanies! - lastWeekCompanies) / lastWeekCompanies * 100);
    } else if (weekCompanies && weekCompanies > 0) {
      // If no companies last week but some this week, show as new
      growthRate = 0;
      growthLabel = 'new this week';
    }

    setStats([
      {
        title: 'Total Companies',
        value: totalCompanies || 0,
        change: todayCompanies || 0,
        changeLabel: 'today',
        icon: <Building2 className="h-4 w-4" />,
        trend: todayCompanies ? 'up' : 'neutral',
        subtitle: `${weekCompanies || 0} this week`
      },
      {
        title: 'Outreach Users',
        value: outreachCount + bothCount,
        change: Math.round(((outreachCount + bothCount) / (totalCompanies || 1)) * 100),
        changeLabel: '% of total',
        icon: <Image src="/logos/outreach_transparent.png" alt="Outreach" width={80} height={24} className="object-contain" />,
        trend: 'neutral',
        subtitle: bothCount > 0 ? `Includes ${bothCount} using both tools` : 'Exclusive + shared users'
      },
      {
        title: 'SalesLoft Users',
        value: salesloftCount + bothCount,
        change: Math.round(((salesloftCount + bothCount) / (totalCompanies || 1)) * 100),
        changeLabel: '% of total',
        icon: <Image src="/logos/salesloft_transparent.png" alt="SalesLoft" width={80} height={24} className="object-contain" />,
        trend: 'neutral',
        subtitle: bothCount > 0 ? `Includes ${bothCount} using both tools` : 'Exclusive + shared users'
      },
      {
        title: 'Weekly Growth',
        value: lastWeekCompanies > 0 ? `${growthRate >= 0 ? '+' : ''}${growthRate.toFixed(1)}%` : `${weekCompanies || 0} new`,
        change: weekCompanies || 0,
        changeLabel: growthLabel,
        icon: <TrendingUp className="h-4 w-4" />,
        trend: weekCompanies > 0 ? 'up' : 'neutral',
        subtitle: lastWeekCompanies > 0 ? 'vs. previous week' : 'first week of data'
      }
    ]);
    
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="p-6 animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4 mb-3" />
            <div className="h-8 bg-muted rounded w-1/2 mb-2" />
            <div className="h-3 bg-muted rounded w-2/3" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <Card 
          key={index} 
          className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow"
        >
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
      ))}
    </div>
  );
}