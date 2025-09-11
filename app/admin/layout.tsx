import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminHeader from '@/components/admin/AdminHeader';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/login');
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, full_name, avatar_url')
    .eq('id', user.id)
    .single();

  const isAdmin = profile?.role === 'admin' || user.email === 'eimrib@yess.ai';

  if (!isAdmin) {
    redirect('/');
  }

  const userInfo = {
    email: user.email || '',
    name: profile?.full_name || user.email?.split('@')[0] || 'Admin',
    avatar: profile?.avatar_url || null,
    role: profile?.role || 'admin'
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader user={userInfo} />
      <div className="flex">
        <AdminSidebar />
        <main className="flex-1 ml-64">
          <div className="pt-16">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}