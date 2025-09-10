'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  User, 
  Shield, 
  Eye, 
  UserPlus, 
  Trash2, 
  Search,
  Download,
  Filter,
  Edit3,
  ChevronDown,
  Check
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  created_at: string;
  updated_at: string;
}

interface CleanUserManagementProps {
  users: UserProfile[];
  currentUserId?: string;
}

export function CleanUserManagement({ users: initialUsers, currentUserId }: CleanUserManagementProps) {
  const [users, setUsers] = useState<UserProfile[]>(initialUsers || []);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>(initialUsers || []);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [openRoleDropdown, setOpenRoleDropdown] = useState<string | null>(null);
  const [openFilterDropdown, setOpenFilterDropdown] = useState(false);
  
  // New user form state
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('viewer');
  
  const supabase = createClient();

  // Filter users when search or role changes
  useEffect(() => {
    let filtered = users;
    
    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (filterRole !== 'all') {
      filtered = filtered.filter(user => user.role === filterRole);
    }
    
    setFilteredUsers(filtered);
  }, [searchTerm, filterRole, users]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setOpenRoleDropdown(null);
      setOpenFilterDropdown(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Add new user
  const handleAddUser = async () => {
    if (!newUserEmail) {
      toast.error('Please enter an email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newUserEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await fetch('/api/admin/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newUserEmail,
          name: newUserName || null,
          role: newUserRole
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add user');
      }
      
      const newUser: UserProfile = {
        id: data.id || crypto.randomUUID(),
        email: newUserEmail,
        full_name: newUserName || newUserEmail.split('@')[0],
        role: newUserRole,
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      setUsers(prev => [...prev, newUser]);
      toast.success(data.message || `User ${newUserEmail} added successfully`);
      
      setNewUserEmail('');
      setNewUserName('');
      setNewUserRole('viewer');
      setIsAddUserOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to add user');
    } finally {
      setIsLoading(false);
    }
  };

  // Update user role
  const handleUpdateRole = async (userId: string, newRole: string) => {
    if (userId === currentUserId && newRole !== 'admin') {
      toast.error("You can't demote yourself");
      return;
    }

    setUsers(prev => prev.map(user => 
      user.id === userId ? { ...user, role: newRole } : user
    ));
    
    setOpenRoleDropdown(null);
    toast.success('Role updated successfully');
    
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) {
        console.error('Database update error:', error);
      }
    } catch (error) {
      console.error('Error updating role:', error);
    }
  };

  // Delete user
  const handleDeleteUser = async (userToDelete: UserProfile) => {
    if (userToDelete.id === currentUserId) {
      toast.error("You can't delete yourself");
      return;
    }

    if (!confirm(`Are you sure you want to delete ${userToDelete.email}?`)) {
      return;
    }

    setUsers(prev => prev.filter(user => user.id !== userToDelete.id));
    toast.success('User deleted successfully');

    try {
      await fetch('/api/admin/users/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userToDelete.id })
      });
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  // Export users to CSV
  const handleExport = () => {
    const csv = [
      ['Email', 'Name', 'Role', 'Joined'],
      ...filteredUsers.map(user => [
        user.email,
        user.full_name || '',
        user.role,
        format(new Date(user.created_at), 'yyyy-MM-dd')
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Users exported successfully');
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            <Shield className="h-3 w-3 mr-1" />
            Admin
          </span>
        );
      case 'editor':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <Edit3 className="h-3 w-3 mr-1" />
            Editor
          </span>
        );
      case 'viewer':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Eye className="h-3 w-3 mr-1" />
            Viewer
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {role}
          </span>
        );
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">All Users</h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage user access and permissions
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="bg-white hover:bg-gray-50 text-gray-700 border-gray-300"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          
          <Button
            size="sm"
            onClick={() => setIsAddUserOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        
        {/* Custom Filter Dropdown */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpenFilterDropdown(!openFilterDropdown);
            }}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Filter className="h-4 w-4 mr-2" />
            {filterRole === 'all' ? 'All Roles' : filterRole.charAt(0).toUpperCase() + filterRole.slice(1)}
            <ChevronDown className="ml-2 -mr-0.5 h-4 w-4" />
          </button>
          
          {openFilterDropdown && (
            <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
              <div className="py-1">
                {['all', 'admin', 'editor', 'viewer'].map((role) => (
                  <button
                    key={role}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFilterRole(role);
                      setOpenFilterDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center justify-between"
                  >
                    {role === 'all' ? 'All Roles' : role.charAt(0).toUpperCase() + role.slice(1)}
                    {filterRole === role && <Check className="h-4 w-4 text-blue-600" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="text-sm text-slate-500">
          {filteredUsers.length} users
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 border-b border-gray-200">
              <TableHead className="text-gray-700">User</TableHead>
              <TableHead className="text-gray-700">Role</TableHead>
              <TableHead className="text-gray-700">Status</TableHead>
              <TableHead className="text-gray-700">Joined</TableHead>
              <TableHead className="text-gray-700 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {user.avatar_url ? (
                        <img 
                          src={user.avatar_url} 
                          alt={user.full_name || user.email}
                          className="h-8 w-8 rounded-full"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                          <User className="h-4 w-4 text-gray-500" />
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-gray-900">
                          {user.full_name || user.email.split('@')[0]}
                          {user.id === currentUserId && (
                            <span className="ml-2 text-xs text-gray-500">(You)</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {/* Custom Role Dropdown */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenRoleDropdown(openRoleDropdown === user.id ? null : user.id);
                        }}
                        disabled={user.id === currentUserId}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {getRoleBadge(user.role)}
                        <ChevronDown className="ml-2 -mr-0.5 h-4 w-4" />
                      </button>
                      
                      {openRoleDropdown === user.id && (
                        <div className="origin-top-left absolute left-0 mt-2 w-40 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                          <div className="py-1">
                            {['admin', 'editor', 'viewer'].map((role) => (
                              <button
                                key={role}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateRole(user.id, role);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center justify-between"
                              >
                                {getRoleBadge(role)}
                                {user.role === role && <Check className="h-4 w-4 text-blue-600" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Active
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {format(new Date(user.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteUser(user)}
                      disabled={user.id === currentUserId}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add User Modal */}
      {isAddUserOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New User</h2>
            <p className="text-sm text-gray-500 mb-4">Add a new user to your team</p>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-gray-700">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  disabled={isLoading}
                  className="mt-1 bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <Label htmlFor="name" className="text-gray-700">Full name (optional)</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  disabled={isLoading}
                  className="mt-1 bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <Label htmlFor="role" className="text-gray-700">Role</Label>
                <div className="mt-1 space-y-2">
                  {['viewer', 'editor', 'admin'].map((role) => (
                    <button
                      key={role}
                      onClick={() => setNewUserRole(role)}
                      className={`w-full text-left px-3 py-2 rounded-md border ${
                        newUserRole === role 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-300 bg-white hover:bg-gray-50'
                      }`}
                    >
                      {getRoleBadge(role)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddUserOpen(false);
                  setNewUserEmail('');
                  setNewUserName('');
                  setNewUserRole('viewer');
                }}
                disabled={isLoading}
                className="bg-white hover:bg-gray-50 text-gray-700 border-gray-300"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleAddUser} 
                disabled={isLoading || !newUserEmail}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isLoading ? 'Adding...' : 'Add User'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}