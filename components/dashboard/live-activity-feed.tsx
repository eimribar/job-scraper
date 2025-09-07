'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Building2, Clock, Sparkles, TrendingUp, Zap } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { createClient } from '@/lib/supabase/client';

interface ActivityItem {
  id: string;
  type: 'company_discovered' | 'scraping_started' | 'scraping_completed' | 'analysis_complete';
  title: string;
  description: string;
  timestamp: Date;
  metadata?: {
    company?: string;
    tool?: string;
    searchTerm?: string;
    jobsCount?: number;
  };
}

export function LiveActivityFeed() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLive, setIsLive] = useState(true);

  useEffect(() => {
    // Initialize with recent activities
    fetchRecentActivities();

    // Set up real-time subscription
    const supabase = createClient();
    
    const channel = supabase
      .channel('activity-feed')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const newActivity = transformNotificationToActivity(payload.new);
          setActivities(prev => [newActivity, ...prev].slice(0, 20));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchRecentActivities = async () => {
    const supabase = createClient();
    const { data: notifications } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (notifications) {
      const transformed = notifications.map(transformNotificationToActivity);
      setActivities(transformed);
    }
  };

  const transformNotificationToActivity = (notification: any): ActivityItem => {
    const metadata = notification.metadata || {};
    
    return {
      id: notification.id,
      type: notification.notification_type || 'company_discovered',
      title: notification.title,
      description: notification.message,
      timestamp: new Date(notification.created_at),
      metadata
    };
  };

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'company_discovered':
        return <Sparkles className="h-4 w-4 text-green-500" />;
      case 'scraping_started':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'scraping_completed':
        return <TrendingUp className="h-4 w-4 text-purple-500" />;
      case 'analysis_complete':
        return <Zap className="h-4 w-4 text-yellow-500" />;
      default:
        return <Building2 className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <Card className="relative overflow-hidden border-0 shadow-sm">
      
      <div className="p-3 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Live Activity</h3>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full animate-pulse ${isLive ? 'bg-green-500' : 'bg-gray-400'}`} />
            <span className="text-xs text-muted-foreground">{isLive ? 'Live' : 'Offline'}</span>
          </div>
        </div>

        <div className="overflow-y-auto space-y-2 max-h-[250px] scrollbar-thin">
          {activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Clock className="h-8 w-8 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                Waiting for activity...
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                System will automatically process search terms
              </p>
            </div>
          ) : (
            activities.map((activity, index) => (
              <div
                key={activity.id}
                className={`flex gap-2 p-2 rounded-lg transition-all hover:bg-accent/50 ${
                  index === 0 ? 'bg-accent/30 animate-in slide-in-from-top' : ''
                }`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getActivityIcon(activity.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {activity.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {activity.description}
                  </p>
                  
                  {activity.metadata && (
                    <div className="flex items-center gap-4 mt-2">
                      {activity.metadata.company && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                          {activity.metadata.company}
                        </span>
                      )}
                      {activity.metadata.tool && (
                        <span className="text-xs bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded">
                          {activity.metadata.tool}
                        </span>
                      )}
                      {activity.metadata.jobsCount && (
                        <span className="text-xs text-muted-foreground">
                          {activity.metadata.jobsCount} jobs
                        </span>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="flex-shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}