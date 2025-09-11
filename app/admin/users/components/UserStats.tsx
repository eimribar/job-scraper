'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Users, 
  UserCheck, 
  UserX, 
  TrendingUp,
  Shield,
  Eye,
  Clock,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserStatsProps {
  stats: any;
  totalUsers: number;
  onlineUsers: number;
}

export default function UserStats({ stats, totalUsers, onlineUsers }: UserStatsProps) {
  const statsCards = [
    {
      title: 'Total Users',
      value: totalUsers,
      change: stats?.new_users_month || 0,
      changeLabel: 'new this month',
      icon: Users,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Active Users',
      value: stats?.active_users || 0,
      change: onlineUsers,
      changeLabel: 'online now',
      icon: UserCheck,
      color: 'bg-green-500',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Administrators',
      value: stats?.admin_count || 0,
      change: stats?.editor_count || 0,
      changeLabel: 'editors',
      icon: Shield,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'Active Today',
      value: stats?.active_today || 0,
      change: stats?.active_week || 0,
      changeLabel: 'active this week',
      icon: Activity,
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statsCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {stat.title}
                </CardTitle>
                <div className={cn('p-2 rounded-lg', stat.bgColor)}>
                  <Icon className={cn('h-4 w-4', stat.color.replace('bg-', 'text-'))} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    <span className="font-medium text-gray-700">{stat.change}</span> {stat.changeLabel}
                  </p>
                </div>
              </div>
              <div className={cn('absolute bottom-0 left-0 right-0 h-1', stat.color)} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}