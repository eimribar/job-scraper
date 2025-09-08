import { createServerClient } from '@supabase/ssr'
import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

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
  // Check if we're in the build process (not runtime)
  const isBuildTime = process.env.BUILDING === 'true' || 
                      (typeof window === 'undefined' && !process.env.VERCEL);
  
  if (isBuildTime && !hasValidConfig) {
    // Only return null during actual build time, not in production runtime
    return null;
  }
  
  if (!hasValidConfig) {
    // Log helpful error message
    console.error('⚠️ Supabase configuration is missing!');
    console.error('Please add the following environment variables:');
    console.error('- NEXT_PUBLIC_SUPABASE_URL');
    console.error('- NEXT_PUBLIC_SUPABASE_ANON_KEY');
    console.error('- SUPABASE_SERVICE_ROLE_KEY (for API routes)');
    return null;
  }
  
  // Use service role key if available (preferred for API routes), otherwise use anon key
  const key = supabaseServiceKey || supabaseAnonKey;
  
  if (!key) {
    console.error('No Supabase key available (neither service role nor anon key)');
    return null;
  }
  
  try {
    const client = createClient(supabaseUrl, key);
    
    // Log which key we're using (for debugging)
    if (process.env.NODE_ENV === 'development') {
      console.log('Supabase client created with:', supabaseServiceKey ? 'service role key' : 'anon key');
    }
    
    return client;
  } catch (error) {
    console.error('Failed to create Supabase client:', error);
    return null;
  }
}

// For server-side operations (with cookies)
export function createServerSupabaseClient() {
  if (!hasValidConfig) {
    // Return a mock client that won't cause errors
    return null;
  }
  
  // Lazy load cookies to avoid build-time issues
  const { cookies: nextCookies } = require('next/headers');
  
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return nextCookies().getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          nextCookies().set(name, value, options)
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