import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import UserManagementClient from './components/UserManagementClient';

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
    .select('role, full_name, avatar_url')
    .eq('id', user.id)
    .single();

  // If profile doesn't exist and it's the admin email, create it
  if (!profile && user.email === 'eimrib@yess.ai') {
    console.log('Creating admin profile for:', user.email);
    
    const { data: newProfile } = await supabase
      .from('user_profiles')
      .insert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || 
                  user.user_metadata?.name || 
                  'Admin',
        avatar_url: user.user_metadata?.avatar_url || 
                   user.user_metadata?.picture || null,
        role: 'admin',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('role, full_name, avatar_url')
      .single();
    
    profile = newProfile;
  }

  const isAdmin = profile?.role === 'admin' || user.email === 'eimrib@yess.ai';

  if (!isAdmin) {
    redirect('/');
  }

  // Fetch initial user data
  const { data: users, error } = await supabase
    .from('user_profiles')
    .select(`
      *,
      auth_user:id (
        email,
        created_at,
        last_sign_in_at
      )
    `)
    .order('created_at', { ascending: false });

  // Fetch user statistics
  const { data: stats } = await supabase
    .from('user_statistics')
    .select('*')
    .single();

  // Fetch recent activity
  const { data: recentActivity } = await supabase
    .from('user_activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  return (
    <div className="p-6">
      <UserManagementClient 
        initialUsers={users || []}
        stats={stats || {}}
        recentActivity={recentActivity || []}
        currentUserId={user.id}
      />
    </div>
  );
}