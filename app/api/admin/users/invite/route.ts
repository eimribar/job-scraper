import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin access
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    const isAdmin = profile?.role === 'admin' || user.email === 'eimrib@yess.ai';
    
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { email, full_name, role } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Check if user already exists - handle no rows gracefully
    const { data: existingProfiles, error: checkError } = await supabase
      .from('user_profiles')
      .select('id, status')
      .eq('email', email);

    if (checkError) {
      console.error('Error checking existing profile:', checkError);
    }

    if (existingProfiles && existingProfiles.length > 0) {
      const existingProfile = existingProfiles[0];
      // If user exists but is pending, that's ok - they haven't signed in yet
      if (existingProfile.status === 'pending') {
        return NextResponse.json({ 
          error: 'User already created. They can sign in with their Google account.' 
        }, { status: 400 });
      }
      return NextResponse.json({ error: 'User already exists and is active' }, { status: 400 });
    }

    // Create user profile directly - simple and clean
    const newUserId = crypto.randomUUID();
    const { data: newProfile, error: createError } = await supabase
      .from('user_profiles')
      .insert({
        id: newUserId,
        email: email,
        full_name: full_name || email.split('@')[0],
        role: role || 'viewer',
        status: 'pending', // Will become 'active' when they sign in
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating user profile:', createError);
      return NextResponse.json({ 
        error: 'Failed to create user profile' 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: newUserId,
        email,
        full_name: newProfile?.full_name,
        role: newProfile?.role,
        status: 'pending'
      },
      message: `User ${email} created successfully. They can now sign in at ${process.env.NEXT_PUBLIC_APP_URL || 'the platform'} with their Google account.`
    });

  } catch (error: any) {
    console.error('Create user error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create user' },
      { status: 500 }
    );
  }
}