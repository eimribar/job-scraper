"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApiSupabaseClient = createApiSupabaseClient;
exports.createServerSupabaseClient = createServerSupabaseClient;
exports.createClientSupabaseClient = createClientSupabaseClient;
const ssr_1 = require("@supabase/ssr");
const ssr_2 = require("@supabase/ssr");
const supabase_js_1 = require("@supabase/supabase-js");
const headers_1 = require("next/headers");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Check if we have valid configuration
const hasValidConfig = supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== 'your_supabase_project_url' &&
    supabaseAnonKey !== 'your_supabase_anon_key' &&
    supabaseUrl.startsWith('https://');
// For API routes - simple client without SSR/cookies
function createApiSupabaseClient() {
    if (!hasValidConfig) {
        throw new Error('Supabase configuration is missing');
    }
    // Use service role key if available, otherwise use anon key
    const key = supabaseServiceKey || supabaseAnonKey;
    return (0, supabase_js_1.createClient)(supabaseUrl, key);
}
// For server-side operations (with cookies)
function createServerSupabaseClient() {
    if (!hasValidConfig) {
        // Return a mock client that won't cause errors
        return null;
    }
    return (0, ssr_1.createServerClient)(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return (0, headers_1.cookies)().getAll();
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value, options }) => (0, headers_1.cookies)().set(name, value, options));
            },
        },
    });
}
// For client-side operations
function createClientSupabaseClient() {
    if (!hasValidConfig) {
        return null;
    }
    return (0, ssr_2.createBrowserClient)(supabaseUrl, supabaseAnonKey);
}
