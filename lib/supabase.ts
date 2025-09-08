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
  if (process.env.NODE_ENV === 'production' && !global.window && typeof window === 'undefined') {
    return null;
  }
  
  if (!hasValidConfig) {
    // Return null during build time
    if (typeof window === 'undefined' && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return null;
    }
    
    // Log helpful error message in production
    if (process.env.NODE_ENV === 'production') {
      console.error('⚠️ Supabase configuration is missing!');
      console.error('Please add the following environment variables in Vercel:');
      console.error('- NEXT_PUBLIC_SUPABASE_URL');
      console.error('- NEXT_PUBLIC_SUPABASE_ANON_KEY');
      console.error('See .env.production.example for the exact values');
    } else if (process.env.NODE_ENV === 'development') {
      console.warn('Supabase configuration is missing - check .env.local');
    }
    return null;
  }
  
  // Use service role key if available, otherwise use anon key
  const key = supabaseServiceKey || supabaseAnonKey;
  
  try {
    return createClient(supabaseUrl, key);
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