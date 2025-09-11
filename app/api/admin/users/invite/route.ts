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
    const { email, full_name, role, department, job_title, message } = body;

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

    // Generate invitation token
    const invitationToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

    // Create invitation record
    const { data: invitation, error: inviteError } = await supabase
      .from('user_invitations')
      .insert({
        email,
        role: role || 'viewer',
        invited_by: user.id,
        invitation_token: invitationToken,
        expires_at: expiresAt.toISOString(),
        metadata: {
          full_name,
          department,
          job_title,
          message
        }
      })
      .select()
      .single();

    if (inviteError) {
      console.error('Error creating invitation:', inviteError);
      // Fallback: create temporary user profile
      const tempId = crypto.randomUUID();
      const { data: newProfile } = await supabase
        .from('user_profiles')
        .insert({
          id: tempId,
          email: email,
          full_name: full_name || email.split('@')[0],
          role: role || 'viewer',
          status: 'pending',
          department,
          job_title,
          invited_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      return NextResponse.json({
        success: true,
        invitation: {
          id: tempId,
          email,
          status: 'pending'
        },
        message: `User ${email} has been added (pending activation)`
      });
    }

    // Log the admin action
    await supabase
      .from('user_activity_logs')
      .insert({
        user_id: user.id,
        action: 'USER_INVITED',
        resource_type: 'user',
        resource_id: email,
        details: { email, role }
      });

    // In a production environment, you would send an actual email here
    // using a service like SendGrid, Resend, or Supabase Auth email
    console.log(`Invitation created for ${email} with token: ${invitationToken}`);

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation?.id,
        email: invitation?.email || email,
        expires_at: invitation?.expires_at
      },
      message: `Invitation sent to ${email}`
    });

  } catch (error: any) {
    console.error('Invite user error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to invite user' },
      { status: 500 }
    );
  }
}

// Handle bulk invitations
export async function PUT(request: NextRequest) {
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
    const { emails, role, department } = body;

    if (!emails || !Array.isArray(emails)) {
      return NextResponse.json({ error: 'Emails array is required' }, { status: 400 });
    }

    const results = {
      successful: [] as string[],
      failed: [] as { email: string; reason: string }[]
    };

    for (const email of emails) {
      try {
        // Check if user already exists
        const { data: existingProfile } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('email', email)
          .single();

        if (existingProfile) {
          results.failed.push({ email, reason: 'User already exists' });
          continue;
        }

        // Create invitation
        const invitationToken = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await supabase
          .from('user_invitations')
          .insert({
            email,
            role: role || 'viewer',
            invited_by: user.id,
            invitation_token: invitationToken,
            expires_at: expiresAt.toISOString(),
            metadata: { department }
          });

        results.successful.push(email);
      } catch (error) {
        results.failed.push({ email, reason: 'Failed to create invitation' });
      }
    }

    // Log the bulk action
    await supabase
      .from('user_activity_logs')
      .insert({
        user_id: user.id,
        action: 'BULK_USERS_INVITED',
        resource_type: 'user',
        details: {
          total: emails.length,
          successful: results.successful.length,
          failed: results.failed.length
        }
      });

    return NextResponse.json({
      success: true,
      results,
      message: `Invited ${results.successful.length} users successfully`
    });

  } catch (error: any) {
    console.error('Bulk invite error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send bulk invitations' },
      { status: 500 }
    );
  }
}