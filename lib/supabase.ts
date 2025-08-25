import { createServerClient } from '@supabase/ssr'
import { createBrowserClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Check if we have valid configuration
const hasValidConfig = supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'your_supabase_project_url' && 
  supabaseAnonKey !== 'your_supabase_anon_key' &&
  supabaseUrl.startsWith('https://')

// For server-side operations
export function createServerSupabaseClient() {
  if (!hasValidConfig) {
    // Return a mock client that won't cause errors
    return null as any;
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
    return null as any;
  }
  
  return createBrowserClient(supabaseUrl!, supabaseAnonKey!)
}