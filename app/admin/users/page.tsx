import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { UsersTable } from './users-table';

export default async function AdminUsersPage() {
  const supabase = await createClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  // Check if user is admin - with fallback for eimrib@yess.ai
  let isAdmin = false;
  
  // First try to get profile from database
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile && !profileError) {
    isAdmin = profile.role === 'admin';
  } else {
    // Fallback: Check if it's the admin email
    isAdmin = user.email === 'eimrib@yess.ai';
    
    // If it's the admin email but profile doesn't exist, create it
    if (isAdmin && profileError?.code === 'PGRST116') { // PGRST116 = no rows returned
      await supabase
        .from('user_profiles')
        .insert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || 'Admin',
          role: 'admin',
          avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null
        })
        .select()
        .single();
    }
  }

  if (!isAdmin) {
    redirect('/');
  }

  // Get all users - handle potential table not existing
  const { data: users, error: usersError } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false });
  
  // If table doesn't exist, create a mock admin user for display
  const displayUsers = users || (isAdmin ? [{
    id: user.id,
    email: user.email || 'eimrib@yess.ai',
    full_name: user.user_metadata?.full_name || 'Admin',
    role: 'admin',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }] : []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20">
      {/* Page Header */}
      <div className="border-b bg-white/70 backdrop-blur-md">
        <div className="container mx-auto px-6 py-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              User Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage user access and permissions
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-xl border shadow-lg">
          <UsersTable users={displayUsers} />
        </div>
      </main>
    </div>
  );
}