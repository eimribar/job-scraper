import { createServerClient } from '@supabase/ssr'
import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Support both naming conventions for Vercel deployment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Check if we have valid configuration
const hasValidConfig = supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'your_supabase_project_url' && 
  supabaseAnonKey !== 'your_supabase_anon_key' &&
  supabaseUrl.startsWith('https://')

// For API routes - simple client without SSR/cookies
export function createApiSupabaseClient() {
  if (!hasValidConfig) {
    throw new Error('Supabase configuration is missing');
  }
  
  // Use service role key if available, otherwise use anon key
  const key = supabaseServiceKey || supabaseAnonKey;
  return createClient(supabaseUrl, key);
}

// For server-side operations (with cookies)
export function createServerSupabaseClient() {
  if (!hasValidConfig) {
    // Return a mock client that won't cause errors
    return null;
  }
  
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookies().getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookies().set(name, value, options)
        )
      },
    },
  })
}

// For client-side operations
export function createClientSupabaseClient() {
  if (!hasValidConfig) {
    return null;
  }
  
  return createBrowserClient(supabaseUrl!, supabaseAnonKey!)
}