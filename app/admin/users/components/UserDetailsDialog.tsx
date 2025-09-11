'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  User,
  Mail,
  Shield,
  Calendar,
  Clock,
  Activity,
  Key,
  Globe,
  Smartphone,
  Building,
  Briefcase,
  MapPin,
  Hash,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  Eye
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface UserDetailsDialogProps {
  user: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function UserDetailsDialog({ user, open, onOpenChange }: UserDetailsDialogProps) {
  const [activities, setActivities] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (open && user) {
      fetchUserDetails();
    }
  }, [open, user]);

  const fetchUserDetails = async () => {
    setLoading(true);
    try {
      // Fetch user activities
      const { data: activityData } = await supabase
        .from('user_activity_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      // Fetch user sessions
      const { data: sessionData } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      setActivities(activityData || []);
      setSessions(sessionData || []);
    } catch (error) {
      console.error('Error fetching user details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUserStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'suspended': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return Shield;
      case 'editor': return User;
      case 'viewer': return Eye;
      default: return User;
    }
  };

  const RoleIcon = getRoleIcon(user?.role || 'viewer');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* User Header */}
          <div className="flex items-start gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={user?.avatar_url || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white text-xl">
                {user?.full_name?.slice(0, 2).toUpperCase() || user?.email?.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="text-xl font-semibold">{user?.full_name || 'Unnamed User'}</h3>
              <p className="text-gray-500">{user?.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={cn('capitalize', getUserStatusColor(user?.status || 'active'))}>
                  {user?.status || 'active'}
                </Badge>
                <Badge variant="outline" className="capitalize">
                  <RoleIcon className="h-3 w-3 mr-1" />
                  {user?.role || 'viewer'}
                </Badge>
                {user?.two_factor_enabled && (
                  <Badge variant="outline">
                    <Key className="h-3 w-3 mr-1" />
                    2FA Enabled
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Tabs */}
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="sessions">Sessions</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Contact Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span>{user?.email}</span>
                    </div>
                    {user?.phone_number && (
                      <div className="flex items-center gap-2 text-sm">
                        <Smartphone className="h-4 w-4 text-gray-400" />
                        <span>{user.phone_number}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Organization</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Building className="h-4 w-4 text-gray-400" />
                      <span>{user?.department || 'Not specified'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Briefcase className="h-4 w-4 text-gray-400" />
                      <span>{user?.job_title || 'Not specified'}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Account Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Hash className="h-4 w-4 text-gray-400" />
                      <span className="font-mono text-xs">{user?.id}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>Joined {user?.created_at ? formatDistanceToNow(new Date(user.created_at), { addSuffix: true }) : 'Unknown'}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Activity Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span>Last seen {user?.last_seen ? formatDistanceToNow(new Date(user.last_seen), { addSuffix: true }) : 'Never'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <TrendingUp className="h-4 w-4 text-gray-400" />
                      <span>{user?.login_count || 0} total logins</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="activity">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Recent Activity</CardTitle>
                  <CardDescription>User actions and events</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    {loading ? (
                      <p className="text-sm text-gray-500">Loading activities...</p>
                    ) : activities.length > 0 ? (
                      <div className="space-y-3">
                        {activities.map((activity, index) => (
                          <div key={index} className="flex items-start gap-3 pb-3 border-b last:border-0">
                            <Activity className="h-4 w-4 text-gray-400 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">{activity.action}</p>
                              {activity.resource_type && (
                                <p className="text-xs text-gray-500">
                                  {activity.resource_type} • {activity.resource_id}
                                </p>
                              )}
                              <p className="text-xs text-gray-400">
                                {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No recent activity</p>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sessions">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Active Sessions</CardTitle>
                  <CardDescription>User login sessions</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    {loading ? (
                      <p className="text-sm text-gray-500">Loading sessions...</p>
                    ) : sessions.length > 0 ? (
                      <div className="space-y-3">
                        {sessions.map((session, index) => (
                          <div key={index} className="flex items-start gap-3 pb-3 border-b last:border-0">
                            <Globe className="h-4 w-4 text-gray-400 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">
                                {session.ip_address || 'Unknown IP'}
                              </p>
                              <p className="text-xs text-gray-500">
                                {session.user_agent || 'Unknown device'}
                              </p>
                              <p className="text-xs text-gray-400">
                                Started {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
                              </p>
                            </div>
                            <Badge variant={session.is_active ? 'default' : 'secondary'} className="text-xs">
                              {session.is_active ? 'Active' : 'Expired'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No active sessions</p>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Security Settings</CardTitle>
                  <CardDescription>Account security information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-gray-400" />
                      <span className="text-sm">Two-Factor Authentication</span>
                    </div>
                    {user?.two_factor_enabled ? (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Enabled
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <XCircle className="h-3 w-3 mr-1" />
                        Disabled
                      </Badge>
                    )}
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Failed Login Attempts</p>
                    <div className="flex items-center gap-2">
                      {user?.failed_login_attempts === 0 ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                      )}
                      <span className="text-sm text-gray-600">
                        {user?.failed_login_attempts || 0} failed attempts
                      </span>
                    </div>
                  </div>
                  {user?.suspended_at && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-red-600">Account Suspended</p>
                        <p className="text-sm text-gray-600">
                          Suspended on {format(new Date(user.suspended_at), 'PPP')}
                        </p>
                        {user?.suspended_reason && (
                          <p className="text-sm text-gray-500">
                            Reason: {user.suspended_reason}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}