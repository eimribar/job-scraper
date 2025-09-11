import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AdminUsersClient from './components/AdminUsersClient';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const supabase = await createClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  // Check if user is admin
  let { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  // If profile doesn't exist and it's the admin email, create it
  if (!profile && user.email === 'eimrib@yess.ai') {
    const { data: newProfile } = await supabase
      .from('user_profiles')
      .insert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || 'Admin',
        avatar_url: user.user_metadata?.avatar_url || null,
        role: 'admin',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('role')
      .single();
    
    profile = newProfile;
  }

  const isAdmin = profile?.role === 'admin' || user.email === 'eimrib@yess.ai';

  if (!isAdmin) {
    redirect('/');
  }

  // Fetch users
  const { data: users } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/20">
      {/* Page Header - Same style as dashboard */}
      <div className="border-b bg-white/70 backdrop-blur-md">
        <div className="container mx-auto px-6 py-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              User Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage user accounts, roles, and permissions
            </p>
          </div>
        </div>
      </div>

      {/* Main Content - Same style as dashboard */}
      <main className="container mx-auto px-6 py-6">
        <AdminUsersClient 
          users={users || []}
          currentUserId={user.id}
        />
      </main>
    </div>
  );
}