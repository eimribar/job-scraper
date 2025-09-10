#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function setupUserProfiles() {
  console.log('🔧 Setting up user_profiles table...\n');

  try {
    // Read the SQL migration file
    const sqlPath = join(__dirname, '..', 'supabase', 'migrations', 'create_user_profiles_table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute the SQL - split by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.includes('CREATE TABLE') || 
          statement.includes('ALTER TABLE') || 
          statement.includes('CREATE POLICY') || 
          statement.includes('CREATE FUNCTION') || 
          statement.includes('CREATE TRIGGER') || 
          statement.includes('CREATE INDEX')) {
        
        console.log('📝 Executing:', statement.substring(0, 50) + '...');
        
        const { error } = await supabase.rpc('exec_sql', {
          sql: statement + ';'
        }).single();

        if (error) {
          console.error('❌ Error:', error.message);
          // Continue with other statements even if one fails
        } else {
          console.log('✅ Success');
        }
      }
    }

    // Now try to insert/update admin profile directly
    console.log('\n🔧 Setting up admin profile for eimrib@yess.ai...');
    
    // First check if user exists in auth.users
    const { data: authUsers, error: authError } = await supabase
      .from('auth.users')
      .select('id, email')
      .eq('email', 'eimrib@yess.ai')
      .single();

    if (authUsers) {
      console.log('✅ Found auth user:', authUsers.email);
      
      // Try to upsert the profile
      const { data, error } = await supabase
        .from('user_profiles')
        .upsert({
          id: authUsers.id,
          email: authUsers.email,
          full_name: 'Admin',
          role: 'admin',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating profile:', error.message);
      } else {
        console.log('✅ Admin profile created/updated:', data);
      }
    } else {
      console.log('⚠️  Auth user eimrib@yess.ai not found. Profile will be created on first login.');
    }

    console.log('\n✅ Setup complete!');
    console.log('📌 Note: You may need to run the SQL directly in Supabase Dashboard if RPC is not available.');
    console.log('📌 Go to: https://supabase.com/dashboard/project/nslcadgicgkncajoyyno/sql/new');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.log('\n📌 Please run the SQL manually in Supabase Dashboard:');
    console.log('   1. Go to https://supabase.com/dashboard/project/nslcadgicgkncajoyyno/sql/new');
    console.log('   2. Copy contents from supabase/migrations/create_user_profiles_table.sql');
    console.log('   3. Run the SQL');
  }

  process.exit(0);
}

setupUserProfiles();