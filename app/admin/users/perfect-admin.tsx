'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
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
  Check,
  X,
  Mail
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

interface PerfectAdminProps {
  users: UserProfile[];
  currentUserId?: string;
}

export function PerfectAdmin({ users: initialUsers, currentUserId }: PerfectAdminProps) {
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

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
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenRoleDropdown(null);
      }
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setOpenFilterDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
      toast.success(`User ${newUserEmail} added successfully`);
      
      // Reset form
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
    
    // Update in database (fire and forget)
    try {
      await supabase
        .from('user_profiles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', userId);
    } catch (error) {
      console.error('Database update error:', error);
    }
  };

  // Delete user
  const handleDeleteUser = async (userToDelete: UserProfile) => {
    if (userToDelete.id === currentUserId) {
      toast.error("You can't delete yourself");
      return;
    }

    if (!confirm(`Are you sure you want to delete ${userToDelete.email}? This action cannot be undone.`)) {
      return;
    }

    setUsers(prev => prev.filter(user => user.id !== userToDelete.id));
    toast.success('User deleted successfully');

    // Delete from database (fire and forget)
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
    const badges = {
      admin: { bg: 'bg-purple-100', text: 'text-purple-800', icon: Shield },
      editor: { bg: 'bg-green-100', text: 'text-green-800', icon: Edit3 },
      viewer: { bg: 'bg-blue-100', text: 'text-blue-800', icon: Eye }
    };
    
    const badge = badges[role as keyof typeof badges] || { 
      bg: 'bg-gray-100', 
      text: 'text-gray-800', 
      icon: User 
    };
    
    const Icon = badge.icon;
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        <Icon className="h-3 w-3 mr-1" />
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </span>
    );
  };

  return (
    <div className="p-6" style={{ backgroundColor: 'white' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: '#1e293b' }}>All Users</h2>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>
            Manage user access and permissions
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors"
            style={{ 
              backgroundColor: 'white',
              color: '#374151',
              border: '1px solid #d1d5db'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
          
          <button
            onClick={() => setIsAddUserOpen(true)}
            className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors"
            style={{ 
              backgroundColor: '#2563eb',
              color: 'white'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Add User
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" style={{ color: '#9ca3af' }} />
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-md transition-colors"
            style={{ 
              backgroundColor: 'white',
              border: '1px solid #d1d5db',
              color: '#111827'
            }}
          />
        </div>
        
        {/* Filter Dropdown */}
        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setOpenFilterDropdown(!openFilterDropdown)}
            className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors"
            style={{ 
              backgroundColor: 'white',
              color: '#374151',
              border: '1px solid #d1d5db'
            }}
          >
            <Filter className="h-4 w-4 mr-2" />
            {filterRole === 'all' ? 'All Roles' : filterRole.charAt(0).toUpperCase() + filterRole.slice(1)}
            <ChevronDown className="ml-2 h-4 w-4" />
          </button>
          
          {openFilterDropdown && (
            <div 
              className="absolute right-0 mt-2 w-48 rounded-md shadow-lg z-50"
              style={{ backgroundColor: 'white', border: '1px solid #e5e7eb' }}
            >
              <div className="py-1">
                {['all', 'admin', 'editor', 'viewer'].map((role) => (
                  <button
                    key={role}
                    onClick={() => {
                      setFilterRole(role);
                      setOpenFilterDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm flex items-center justify-between transition-colors"
                    style={{ 
                      color: '#374151',
                      backgroundColor: filterRole === role ? '#f3f4f6' : 'white'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = filterRole === role ? '#f3f4f6' : 'white'}
                  >
                    {role === 'all' ? 'All Roles' : role.charAt(0).toUpperCase() + role.slice(1)}
                    {filterRole === role && <Check className="h-4 w-4" style={{ color: '#2563eb' }} />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="text-sm" style={{ color: '#6b7280' }}>
          {filteredUsers.length} users
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-hidden rounded-lg" style={{ border: '1px solid #e5e7eb' }}>
        <table className="min-w-full divide-y" style={{ backgroundColor: 'white', borderColor: '#e5e7eb' }}>
          <thead style={{ backgroundColor: '#f9fafb' }}>
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#374151' }}>
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#374151' }}>
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#374151' }}>
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#374151' }}>
                Joined
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: '#374151' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ backgroundColor: 'white', borderColor: '#e5e7eb' }}>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm" style={{ color: '#6b7280' }}>
                  No users found
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        {user.avatar_url ? (
                          <img className="h-10 w-10 rounded-full" src={user.avatar_url} alt="" />
                        ) : (
                          <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#e5e7eb' }}>
                            <User className="h-5 w-5" style={{ color: '#6b7280' }} />
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium" style={{ color: '#111827' }}>
                          {user.full_name || user.email.split('@')[0]}
                          {user.id === currentUserId && (
                            <span className="ml-2 text-xs" style={{ color: '#6b7280' }}>(You)</span>
                          )}
                        </div>
                        <div className="text-sm" style={{ color: '#6b7280' }}>
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="relative" ref={openRoleDropdown === user.id ? dropdownRef : null}>
                      <button
                        onClick={() => setOpenRoleDropdown(openRoleDropdown === user.id ? null : user.id)}
                        disabled={user.id === currentUserId}
                        className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ 
                          backgroundColor: 'white',
                          border: '1px solid #d1d5db'
                        }}
                      >
                        {getRoleBadge(user.role)}
                        <ChevronDown className="ml-2 h-4 w-4" />
                      </button>
                      
                      {openRoleDropdown === user.id && (
                        <div 
                          className="absolute left-0 mt-2 w-48 rounded-md shadow-lg z-50"
                          style={{ backgroundColor: 'white', border: '1px solid #e5e7eb' }}
                        >
                          <div className="py-1">
                            {['admin', 'editor', 'viewer'].map((role) => (
                              <button
                                key={role}
                                onClick={() => handleUpdateRole(user.id, role)}
                                className="w-full text-left px-4 py-2 text-sm flex items-center justify-between transition-colors"
                                style={{ 
                                  color: '#374151',
                                  backgroundColor: user.role === role ? '#f3f4f6' : 'white'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = user.role === role ? '#f3f4f6' : 'white'}
                              >
                                {getRoleBadge(role)}
                                {user.role === role && <Check className="h-4 w-4" style={{ color: '#2563eb' }} />}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Active
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: '#6b7280' }}>
                    {format(new Date(user.created_at), 'MMM d, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleDeleteUser(user)}
                      disabled={user.id === currentUserId}
                      className="text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      {isAddUserOpen && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 z-40"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            onClick={() => setIsAddUserOpen(false)}
          />
          
          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              className="w-full max-w-md rounded-lg shadow-xl"
              style={{ backgroundColor: 'white' }}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold" style={{ color: '#111827' }}>
                    Add New User
                  </h2>
                  <button
                    onClick={() => setIsAddUserOpen(false)}
                    className="text-gray-400 hover:text-gray-500 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                
                <p className="text-sm mb-6" style={{ color: '#6b7280' }}>
                  Add a new user to your team
                </p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>
                      Email address
                    </label>
                    <input
                      type="email"
                      placeholder="user@example.com"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      disabled={isLoading}
                      className="w-full px-3 py-2 text-sm rounded-md transition-colors disabled:opacity-50"
                      style={{ 
                        backgroundColor: 'white',
                        border: '1px solid #d1d5db',
                        color: '#111827'
                      }}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>
                      Full name (optional)
                    </label>
                    <input
                      type="text"
                      placeholder="John Doe"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      disabled={isLoading}
                      className="w-full px-3 py-2 text-sm rounded-md transition-colors disabled:opacity-50"
                      style={{ 
                        backgroundColor: 'white',
                        border: '1px solid #d1d5db',
                        color: '#111827'
                      }}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#374151' }}>
                      Role
                    </label>
                    <div className="space-y-2">
                      {['viewer', 'editor', 'admin'].map((role) => (
                        <button
                          key={role}
                          onClick={() => setNewUserRole(role)}
                          disabled={isLoading}
                          className="w-full text-left px-3 py-2 rounded-md transition-colors disabled:opacity-50"
                          style={{ 
                            backgroundColor: newUserRole === role ? '#eff6ff' : 'white',
                            border: `1px solid ${newUserRole === role ? '#2563eb' : '#d1d5db'}`
                          }}
                        >
                          {getRoleBadge(role)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setIsAddUserOpen(false);
                      setNewUserEmail('');
                      setNewUserName('');
                      setNewUserRole('viewer');
                    }}
                    disabled={isLoading}
                    className="px-4 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-50"
                    style={{ 
                      backgroundColor: 'white',
                      color: '#374151',
                      border: '1px solid #d1d5db'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddUser}
                    disabled={isLoading || !newUserEmail}
                    className="px-4 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-50"
                    style={{ 
                      backgroundColor: '#2563eb',
                      color: 'white'
                    }}
                  >
                    {isLoading ? 'Adding...' : 'Add User'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}