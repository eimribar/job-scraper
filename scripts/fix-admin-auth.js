#!/usr/bin/env node

/**
 * Admin Authentication Fix Script
 * Run this to ensure admin user is properly set up
 * Usage: node scripts/fix-admin-auth.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const ADMIN_EMAIL = 'eimrib@yess.ai';

// Create Supabase client with service role key for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function checkAndFixAdminAuth() {
  console.log('🔧 Admin Authentication Fix Script');
  console.log('=====================================\n');

  try {
    // Step 1: Check if user exists in auth.users
    console.log('1️⃣ Checking auth.users for admin email...');
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error accessing auth.users:', authError.message);
      console.log('💡 Make sure SUPABASE_SERVICE_ROLE_KEY is set in .env.local');
      return;
    }

    const adminAuthUser = authUsers.users.find(u => u.email === ADMIN_EMAIL);
    
    if (!adminAuthUser) {
      console.log(`⚠️ User ${ADMIN_EMAIL} not found in auth.users`);
      console.log('📝 Please sign in with Google first, then run this script again.');
      return;
    }

    console.log(`✅ Found auth user: ${adminAuthUser.id}`);
    console.log(`   Email: ${adminAuthUser.email}`);
    console.log(`   Created: ${new Date(adminAuthUser.created_at).toLocaleString()}`);
    if (adminAuthUser.last_sign_in_at) {
      console.log(`   Last Sign In: ${new Date(adminAuthUser.last_sign_in_at).toLocaleString()}`);
    }

    // Step 2: Check user_profiles table
    console.log('\n2️⃣ Checking user_profiles table...');
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', adminAuthUser.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('❌ Error checking user_profiles:', profileError.message);
      return;
    }

    if (profile) {
      console.log('📋 Existing profile found:');
      console.log(`   Role: ${profile.role}`);
      console.log(`   Status: ${profile.status || 'N/A'}`);
      console.log(`   Full Name: ${profile.full_name || 'N/A'}`);

      // Update to admin if not already
      if (profile.role !== 'admin' || profile.status !== 'active') {
        console.log('\n3️⃣ Updating profile to admin...');
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({
            role: 'admin',
            status: 'active',
            updated_at: new Date().toISOString()
          })
          .eq('id', adminAuthUser.id);

        if (updateError) {
          console.error('❌ Error updating profile:', updateError.message);
          return;
        }
        console.log('✅ Profile updated to admin role');
      } else {
        console.log('✅ Profile already has admin role');
      }
    } else {
      // Create new profile
      console.log('\n3️⃣ Creating admin profile...');
      const metadata = adminAuthUser.user_metadata || {};
      
      const { error: insertError } = await supabase
        .from('user_profiles')
        .insert({
          id: adminAuthUser.id,
          email: adminAuthUser.email,
          full_name: metadata.full_name || metadata.name || 'Admin',
          avatar_url: metadata.avatar_url || metadata.picture || null,
          role: 'admin',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('❌ Error creating profile:', insertError.message);
        return;
      }
      console.log('✅ Admin profile created successfully');
    }

    // Step 4: Verify the fix
    console.log('\n4️⃣ Verifying admin access...');
    const { data: finalProfile, error: finalError } = await supabase
      .from('user_profiles')
      .select('id, email, role, status')
      .eq('id', adminAuthUser.id)
      .single();

    if (finalError) {
      console.error('❌ Error verifying profile:', finalError.message);
      return;
    }

    if (finalProfile && finalProfile.role === 'admin' && finalProfile.status === 'active') {
      console.log('✅ Admin authentication successfully configured!');
      console.log('\n🎉 SUCCESS! You can now access:');
      console.log('   http://localhost:3000/admin/users');
    } else {
      console.log('⚠️ Profile exists but may not have correct permissions');
      console.log('   Current role:', finalProfile?.role);
      console.log('   Current status:', finalProfile?.status);
    }

    // Step 5: Show additional info
    console.log('\n📊 Summary:');
    console.log('=====================================');
    console.log(`User ID: ${adminAuthUser.id}`);
    console.log(`Email: ${ADMIN_EMAIL}`);
    console.log(`Role: admin`);
    console.log(`Status: active`);
    console.log('=====================================');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    console.log('\n💡 Troubleshooting tips:');
    console.log('1. Make sure your .env.local file has the correct Supabase keys');
    console.log('2. Check that you have signed in with Google at least once');
    console.log('3. Run the SQL script in Supabase dashboard if this fails');
  }
}

// Run the fix
checkAndFixAdminAuth().then(() => {
  console.log('\n✨ Script completed');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});