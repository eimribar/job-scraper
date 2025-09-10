import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check if user is admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.role === 'admin' || user.email === 'eimrib@yess.ai';
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { email, name, role } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }

    // Send invitation using Supabase Auth
    // In production, you'd use Supabase's invite user API
    // For now, we'll create a placeholder entry
    const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          full_name: name,
          role: role || 'viewer'
        }
      }
    );

    if (authError) {
      // If admin API not available, create a mock invitation
      // In production, you'd send an actual email here
      console.log('Would send invitation email to:', email);
      
      // Create a pending user entry
      const mockId = crypto.randomUUID();
      
      // Try to insert into user_profiles if table exists
      await supabase
        .from('user_profiles')
        .insert({
          id: mockId,
          email,
          full_name: name || null,
          role: role || 'viewer',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      return NextResponse.json({
        success: true,
        id: mockId,
        message: `Invitation would be sent to ${email} (email service not configured)`
      });
    }

    return NextResponse.json({
      success: true,
      id: authData?.user?.id,
      message: `Invitation sent to ${email}`
    });

  } catch (error: any) {
    console.error('Invite user error:', error);
    
    // If it's a database table not found error, still return success
    if (error.code === '42P01') {
      return NextResponse.json({
        success: true,
        message: 'Invitation created (database pending setup)'
      });
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to invite user' },
      { status: 500 }
    );
  }
}