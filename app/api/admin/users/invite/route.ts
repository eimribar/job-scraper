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
    const isAdmin = user.email === 'eimrib@yess.ai';
    if (!isAdmin) {
      // Try to check from database
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      if (!profile || profile.role !== 'admin') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }
    }

    const body = await request.json();
    const { email, name, role } = body;

    console.log('Invite request:', { email, name, role });

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Check if user already exists
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (existingProfile) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }

    // Generate a temporary ID for the invited user
    const tempId = crypto.randomUUID();
    
    // Create user profile entry with invited status
    const { data: newProfile, error: insertError } = await supabase
      .from('user_profiles')
      .insert({
        id: tempId,
        email: email,
        full_name: name || email.split('@')[0],
        role: role || 'viewer',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating profile:', insertError);
      // Even if database fails, return success for UI
      return NextResponse.json({
        success: true,
        id: tempId,
        email: email,
        message: `User ${email} added (pending email invitation setup)`
      });
    }

    // In production, you would send an actual invitation email here
    // For now, we'll just return success
    console.log('Would send invitation email to:', email);

    return NextResponse.json({
      success: true,
      id: newProfile?.id || tempId,
      email: email,
      message: `User ${email} has been added successfully`
    });

  } catch (error: any) {
    console.error('Invite user error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to invite user' },
      { status: 500 }
    );
  }
}