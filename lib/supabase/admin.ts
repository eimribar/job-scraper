import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase client with service role privileges.
 * This bypasses RLS (Row Level Security) and should only be used
 * for admin operations in secure server-side contexts.
 * 
 * NEVER expose the service role key to the client!
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase environment variables for admin client');
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}