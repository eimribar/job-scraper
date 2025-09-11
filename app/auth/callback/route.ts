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
      // Check if a profile exists with this auth ID (returning user)
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .or(`auth_id.eq.${user.id},id.eq.${user.id}`)
        .single();
      
      if (existingProfile) {
        // Profile already exists - just update last login
        await supabase
          .from('user_profiles')
          .update({
            updated_at: new Date().toISOString(),
            is_authenticated: true,
            auth_id: user.id // Ensure auth_id is set
          })
          .or(`auth_id.eq.${user.id},id.eq.${user.id}`);
        
        console.log(`Existing user ${user.email} logged in`);
      } else {
        // Check if a pre-created profile exists with this email
        const { data: preCreatedProfile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('email', user.email)
          .single();
        
        if (preCreatedProfile) {
          // Pre-created user signing in for the first time!
          // Link the auth account to the pre-created profile
          await supabase
            .from('user_profiles')
            .update({
              auth_id: user.id, // Link to auth user
              is_authenticated: true,
              status: 'active', // Activate the account
              avatar_url: user.user_metadata?.avatar_url || 
                         user.user_metadata?.picture || 
                         preCreatedProfile.avatar_url,
              updated_at: new Date().toISOString()
            })
            .eq('id', preCreatedProfile.id);
          
          console.log(`Pre-created user ${user.email} activated with role: ${preCreatedProfile.role}`);
        } else {
          // New user - not pre-created by admin
          const isAdmin = user.email === 'eimrib@yess.ai';
          
          // Create new profile for this user
          await supabase
            .from('user_profiles')
            .insert({
              id: crypto.randomUUID(), // New random ID for the profile
              auth_id: user.id, // Link to auth user
              email: user.email,
              full_name: user.user_metadata?.full_name || 
                        user.user_metadata?.name || 
                        user.email?.split('@')[0] || 'User',
              avatar_url: user.user_metadata?.avatar_url || 
                         user.user_metadata?.picture || null,
              role: isAdmin ? 'admin' : 'viewer',
              status: 'active',
              is_authenticated: true,
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