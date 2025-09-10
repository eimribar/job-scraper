-- ========================================
-- DEBUG SCRIPT FOR AUTH ISSUES
-- Run each section separately to diagnose
-- ========================================

-- 1. CHECK EXISTING USERS
-- Check if user already exists in auth.users
SELECT 
    'Auth Users' as table_name,
    id, 
    email, 
    created_at,
    last_sign_in_at,
    raw_user_meta_data
FROM auth.users 
WHERE email = 'eimrib@yess.ai';

-- Check if profile already exists
SELECT 
    'User Profiles' as table_name,
    id,
    email,
    role,
    status,
    created_at
FROM user_profiles 
WHERE email = 'eimrib@yess.ai';

-- 2. CHECK TRIGGER STATUS
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgenabled as is_enabled,
    proname as function_name
FROM pg_trigger 
JOIN pg_proc ON pg_proc.oid = pg_trigger.tgfoid
WHERE tgname = 'on_auth_user_created';

-- 3. CHECK FOR ERRORS IN FUNCTION
-- Look for any syntax or reference errors
SELECT 
    proname,
    prosrc
FROM pg_proc 
WHERE proname = 'handle_new_user';

-- 4. CLEAN UP EXISTING USER (if exists)
-- CAUTION: Only run if you want to remove existing user
/*
-- Remove from user_profiles first (due to foreign key)
DELETE FROM user_profiles WHERE email = 'eimrib@yess.ai';

-- Remove from audit_logs
DELETE FROM audit_logs WHERE user_id IN (
    SELECT id FROM auth.users WHERE email = 'eimrib@yess.ai'
);

-- Remove from auth.users
DELETE FROM auth.users WHERE email = 'eimrib@yess.ai';
*/

-- 5. CHECK SUPABASE LOGS
-- This shows recent errors from triggers
SELECT 
    timestamp,
    event_message,
    metadata
FROM auth.audit_log_entries
WHERE timestamp > NOW() - INTERVAL '1 hour'
ORDER BY timestamp DESC
LIMIT 10;

-- 6. TEST TRIGGER MANUALLY
-- Simulate what happens when a user signs up
/*
DO $$
DECLARE
    test_user_id UUID := gen_random_uuid();
    test_email TEXT := 'test_' || extract(epoch from now()) || '@example.com';
BEGIN
    -- Try to insert a test user profile
    INSERT INTO user_profiles (
        id,
        email,
        full_name,
        role,
        status
    ) VALUES (
        test_user_id,
        test_email,
        'Test User',
        'viewer',
        'pending'
    );
    
    RAISE NOTICE 'Test insert successful for %', test_email;
    
    -- Clean up
    DELETE FROM user_profiles WHERE id = test_user_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error occurred: %', SQLERRM;
END $$;
*/

-- 7. CHECK TABLE CONSTRAINTS
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    conrelid::regclass as table_name
FROM pg_constraint
WHERE conrelid = 'user_profiles'::regclass;

-- 8. CHECK IF TABLES HAVE RLS ENABLED
SELECT 
    schemaname,
    tablename,
    rowsecurity,
    forcerowsecurity
FROM pg_tables
WHERE tablename IN ('user_profiles', 'user_invitations', 'audit_logs');

-- 9. VIEW RECENT FUNCTION EXECUTIONS (if logged)
SELECT 
    query,
    state,
    wait_event_type,
    wait_event
FROM pg_stat_activity
WHERE query LIKE '%handle_new_user%'
ORDER BY query_start DESC
LIMIT 5;