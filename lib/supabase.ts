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
  // During build time, return null to avoid cookie errors
  if (process.env.NODE_ENV === 'production' && !global.window) {
    return null;
  }
  
  if (!hasValidConfig) {
    // Return null during build time
    if (typeof window === 'undefined' && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return null;
    }
    // Only throw in development or client-side
    if (process.env.NODE_ENV === 'development' || typeof window !== 'undefined') {
      console.warn('Supabase configuration is missing');
    }
    return null;
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