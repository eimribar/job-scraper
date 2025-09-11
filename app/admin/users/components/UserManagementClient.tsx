'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  Users, 
  UserPlus, 
  Download, 
  RefreshCw,
  Search,
  Filter,
  Settings,
  Activity,
  Shield,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import UserTable from './UserTable';
import UserStats from './UserStats';
import InviteUserDialog from './InviteUserDialog';
import UserFilters from './UserFilters';
import UserActivityLog from './UserActivityLog';
import { Badge } from '@/components/ui/badge';

interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  status: string;
  last_seen: string | null;
  created_at: string;
  updated_at: string;
  login_count: number;
  two_factor_enabled: boolean;
  department: string | null;
  job_title: string | null;
}

interface UserManagementClientProps {
  initialUsers: User[];
  stats: any;
  recentActivity: any[];
  currentUserId: string;
}

export default function UserManagementClient({ 
  initialUsers, 
  stats, 
  recentActivity,
  currentUserId 
}: UserManagementClientProps) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [filteredUsers, setFilteredUsers] = useState<User[]>(initialUsers);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [activityLogs, setActivityLogs] = useState(recentActivity);
  const supabase = createClient();

  // Real-time subscription for user updates
  useEffect(() => {
    const channel = supabase
      .channel('user-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_profiles'
      }, (payload) => {
        handleRealtimeUpdate(payload);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleRealtimeUpdate = (payload: any) => {
    if (payload.eventType === 'INSERT') {
      setUsers(prev => [payload.new as User, ...prev]);
      toast.success('New user added');
    } else if (payload.eventType === 'UPDATE') {
      setUsers(prev => prev.map(user => 
        user.id === payload.new.id ? payload.new as User : user
      ));
    } else if (payload.eventType === 'DELETE') {
      setUsers(prev => prev.filter(user => user.id !== payload.old.id));
      toast.success('User removed');
    }
  };

  // Filter users based on search and filters
  useEffect(() => {
    let filtered = [...users];

    if (searchQuery) {
      filtered = filtered.filter(user => 
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.department?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedRole !== 'all') {
      filtered = filtered.filter(user => user.role === selectedRole);
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter(user => user.status === selectedStatus);
    }

    setFilteredUsers(filtered);
  }, [users, searchQuery, selectedRole, selectedStatus]);

  const refreshUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
      toast.success('Users refreshed');
    } catch (error: any) {
      toast.error('Failed to refresh users');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const exportUsers = () => {
    const csvContent = [
      ['ID', 'Email', 'Name', 'Role', 'Status', 'Department', 'Created At', 'Last Seen'].join(','),
      ...filteredUsers.map(user => [
        user.id,
        user.email,
        user.full_name || '',
        user.role,
        user.status,
        user.department || '',
        user.created_at,
        user.last_seen || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users_export_${new Date().toISOString()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Users exported successfully');
  };

  const handleBulkDelete = async () => {
    if (selectedUsers.length === 0) {
      toast.error('No users selected');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedUsers.length} users?`)) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .in('id', selectedUsers);

      if (error) throw error;
      
      setSelectedUsers([]);
      await refreshUsers();
      toast.success(`${selectedUsers.length} users deleted`);
    } catch (error: any) {
      toast.error('Failed to delete users');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const onlineUsers = users.filter(u => {
    if (!u.last_seen) return false;
    const lastSeen = new Date(u.last_seen);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return lastSeen > fiveMinutesAgo;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500 mt-1">Manage user accounts, roles, and permissions</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={refreshUsers} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={exportUsers} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setIsInviteDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite User
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <UserStats 
        stats={stats}
        totalUsers={users.length}
        onlineUsers={onlineUsers.length}
      />

      {/* Main Content */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            All Users
            <Badge variant="secondary" className="ml-1">
              {users.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Activity Logs
          </TabsTrigger>
          <TabsTrigger value="invitations" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Invitations
          </TabsTrigger>
          <TabsTrigger value="sessions" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Active Sessions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          {/* Search and Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by name, email, or department..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <UserFilters
                  selectedRole={selectedRole}
                  selectedStatus={selectedStatus}
                  onRoleChange={setSelectedRole}
                  onStatusChange={setSelectedStatus}
                />
                {selectedUsers.length > 0 && (
                  <Button 
                    variant="destructive" 
                    onClick={handleBulkDelete}
                    disabled={loading}
                  >
                    Delete {selectedUsers.length} Users
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Users Table */}
          <UserTable
            users={filteredUsers}
            currentUserId={currentUserId}
            selectedUsers={selectedUsers}
            onSelectionChange={setSelectedUsers}
            onUserUpdate={refreshUsers}
          />
        </TabsContent>

        <TabsContent value="activity">
          <UserActivityLog activities={activityLogs} />
        </TabsContent>

        <TabsContent value="invitations">
          <Card>
            <CardHeader>
              <CardTitle>Pending Invitations</CardTitle>
              <CardDescription>Manage user invitations</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">Invitation management coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions">
          <Card>
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>Monitor active user sessions</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">Session management coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invite User Dialog */}
      <InviteUserDialog
        open={isInviteDialogOpen}
        onOpenChange={setIsInviteDialogOpen}
        onSuccess={refreshUsers}
      />
    </div>
  );
}