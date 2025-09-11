'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Activity,
  User,
  Shield,
  Edit,
  Trash2,
  LogIn,
  LogOut,
  Key,
  Settings,
  FileText,
  Download,
  Filter,
  RefreshCw,
  Clock,
  AlertCircle
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user?: {
    email: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface UserActivityLogProps {
  activities: ActivityLog[];
}

export default function UserActivityLog({ activities: initialActivities }: UserActivityLogProps) {
  const [activities, setActivities] = useState<ActivityLog[]>(initialActivities);
  const [filteredActivities, setFilteredActivities] = useState<ActivityLog[]>(initialActivities);
  const [selectedAction, setSelectedAction] = useState('all');
  const [selectedUser, setSelectedUser] = useState('all');
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    // Set up real-time subscription
    const channel = supabase
      .channel('activity-logs')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'user_activity_logs'
      }, (payload) => {
        setActivities(prev => [payload.new as ActivityLog, ...prev]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    let filtered = [...activities];

    if (selectedAction !== 'all') {
      filtered = filtered.filter(a => a.action === selectedAction);
    }

    if (selectedUser !== 'all') {
      filtered = filtered.filter(a => a.user_id === selectedUser);
    }

    setFilteredActivities(filtered);
  }, [activities, selectedAction, selectedUser]);

  const refreshActivities = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_activity_logs')
        .select(`
          *,
          user:user_id (
            email,
            full_name,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    if (action.includes('LOGIN')) return LogIn;
    if (action.includes('LOGOUT')) return LogOut;
    if (action.includes('UPDATE') || action.includes('EDIT')) return Edit;
    if (action.includes('DELETE')) return Trash2;
    if (action.includes('CREATE') || action.includes('ADD')) return FileText;
    if (action.includes('PASSWORD')) return Key;
    if (action.includes('SETTINGS')) return Settings;
    if (action.includes('EXPORT') || action.includes('DOWNLOAD')) return Download;
    if (action.includes('ADMIN')) return Shield;
    return Activity;
  };

  const getActionColor = (action: string) => {
    if (action.includes('DELETE')) return 'text-red-600 bg-red-50';
    if (action.includes('CREATE') || action.includes('ADD')) return 'text-green-600 bg-green-50';
    if (action.includes('UPDATE') || action.includes('EDIT')) return 'text-blue-600 bg-blue-50';
    if (action.includes('LOGIN') || action.includes('LOGOUT')) return 'text-purple-600 bg-purple-50';
    if (action.includes('ERROR') || action.includes('FAIL')) return 'text-orange-600 bg-orange-50';
    return 'text-gray-600 bg-gray-50';
  };

  const exportActivities = () => {
    const csvContent = [
      ['Timestamp', 'User', 'Action', 'Resource Type', 'Resource ID', 'IP Address'].join(','),
      ...filteredActivities.map(activity => [
        activity.created_at,
        activity.user?.email || 'Unknown',
        activity.action,
        activity.resource_type || '',
        activity.resource_id || '',
        activity.ip_address || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity_logs_${new Date().toISOString()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Get unique actions and users for filters
  const uniqueActions = [...new Set(activities.map(a => a.action))];
  const uniqueUsers = [...new Set(activities.map(a => ({ id: a.user_id, email: a.user?.email })))]
    .filter(u => u.email);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Activity Logs</CardTitle>
            <CardDescription>Monitor all user actions and system events</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={refreshActivities} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
              Refresh
            </Button>
            <Button onClick={exportActivities} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex gap-4 mb-4">
          <Select value={selectedAction} onValueChange={setSelectedAction}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {uniqueActions.map(action => (
                <SelectItem key={action} value={action}>
                  {action}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              {uniqueUsers.map(user => (
                <SelectItem key={user.id} value={user.id}>
                  {user.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Activity List */}
        <ScrollArea className="h-[500px]">
          <div className="space-y-2">
            {filteredActivities.length > 0 ? (
              filteredActivities.map((activity) => {
                const ActionIcon = getActionIcon(activity.action);
                return (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-white hover:bg-gray-50 transition-colors"
                  >
                    <div className={cn('p-2 rounded-lg', getActionColor(activity.action))}>
                      <ActionIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{activity.action}</p>
                        {activity.resource_type && (
                          <Badge variant="outline" className="text-xs">
                            {activity.resource_type}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        by {activity.user?.email || 'Unknown User'}
                        {activity.resource_id && (
                          <span className="text-gray-400"> • ID: {activity.resource_id}</span>
                        )}
                      </p>
                      {activity.details && Object.keys(activity.details).length > 0 && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-xs font-mono">
                          {JSON.stringify(activity.details, null, 2)}
                        </div>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                        </span>
                        {activity.ip_address && (
                          <span>IP: {activity.ip_address}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p>No activities found</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}