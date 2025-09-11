import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const redirect = searchParams.get('redirect') || '/';

  if (code) {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (user && !error) {
      // First, check if a profile exists with this auth ID
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (existingProfile) {
        // Profile already linked to this auth user - just update last login
        await supabase
          .from('user_profiles')
          .update({
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
      } else {
        // Check if a pre-created profile exists with this email
        const { data: preCreatedProfile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('email', user.email)
          .single();
        
        if (preCreatedProfile) {
          // Pre-created user signing in for the first time!
          // Delete the old placeholder profile and create a new one with the auth ID
          await supabase
            .from('user_profiles')
            .delete()
            .eq('id', preCreatedProfile.id);
          
          // Create new profile with auth user ID, keeping all pre-set data
          await supabase
            .from('user_profiles')
            .insert({
              id: user.id, // Use auth user ID
              email: user.email,
              full_name: preCreatedProfile.full_name || 
                        user.user_metadata?.full_name || 
                        user.user_metadata?.name || 
                        user.email?.split('@')[0] || 'User',
              avatar_url: user.user_metadata?.avatar_url || 
                         user.user_metadata?.picture || null,
              role: preCreatedProfile.role, // Keep pre-assigned role
              status: 'active', // Activate the account
              created_at: preCreatedProfile.created_at, // Keep original creation date
              updated_at: new Date().toISOString()
            });
          
          console.log(`Pre-created user ${user.email} activated with role: ${preCreatedProfile.role}`);
        } else {
          // New user - not pre-created by admin
          // Check if we allow open registration or if it's admin only
          const isAdmin = user.email === 'eimrib@yess.ai';
          
          // For now, allow all new users but as viewers
          await supabase
            .from('user_profiles')
            .insert({
              id: user.id,
              email: user.email,
              full_name: user.user_metadata?.full_name || 
                        user.user_metadata?.name || 
                        user.email?.split('@')[0] || 'User',
              avatar_url: user.user_metadata?.avatar_url || 
                         user.user_metadata?.picture || null,
              role: isAdmin ? 'admin' : 'viewer',
              status: 'active',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          
          console.log(`New user ${user.email} created with role: ${isAdmin ? 'admin' : 'viewer'}`);
        }
      }
    }
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(`${origin}${redirect}`);
}