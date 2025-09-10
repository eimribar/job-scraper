-- ========================================
-- CHECK WHAT'S ACTUALLY HAPPENING
-- Run these queries to see the real error
-- ========================================

-- 1. Check Postgres logs for recent errors
SELECT 
    timestamp,
    error_severity,
    message,
    detail,
    hint,
    query
FROM postgres_logs
WHERE timestamp > NOW() - INTERVAL '10 minutes'
AND (
    message LIKE '%user%' 
    OR message LIKE '%auth%' 
    OR message LIKE '%trigger%'
    OR error_severity IN ('ERROR', 'FATAL', 'PANIC')
)
ORDER BY timestamp DESC
LIMIT 20;

-- 2. Check auth audit logs
SELECT 
    created_at,
    action,
    payload
FROM auth.audit_log_entries
WHERE created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check if triggers are enabled
SELECT 
    n.nspname as schema_name,
    c.relname as table_name,
    t.tgname as trigger_name,
    p.proname as function_name,
    CASE t.tgenabled
        WHEN 'O' THEN 'ENABLED'
        WHEN 'D' THEN 'DISABLED'
        WHEN 'R' THEN 'REPLICA'
        WHEN 'A' THEN 'ALWAYS'
    END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname = 'users' AND n.nspname = 'auth';

-- 4. Check current auth.users
SELECT 
    id,
    email,
    created_at,
    last_sign_in_at,
    raw_user_meta_data
FROM auth.users
WHERE email LIKE '%eimrib%' OR email LIKE '%yess%'
ORDER BY created_at DESC;

-- 5. Check if there are any failed auth attempts
SELECT 
    COUNT(*) as failed_attempts,
    MAX(created_at) as last_attempt
FROM auth.audit_log_entries
WHERE action = 'user_signup_failed'
AND created_at > NOW() - INTERVAL '1 hour';

-- 6. Check function source code
SELECT 
    proname as function_name,
    prosrc as source_code
FROM pg_proc 
WHERE proname = 'handle_new_user'
LIMIT 1;

-- 7. Test if we can manually insert into user_profiles
DO $$
DECLARE
    test_id UUID := gen_random_uuid();
BEGIN
    -- Try manual insert
    INSERT INTO user_profiles (id, email, role, status)
    VALUES (test_id, 'manual_test@example.com', 'viewer', 'pending');
    
    -- If we get here, it worked
    RAISE NOTICE 'SUCCESS: Manual insert works!';
    
    -- Clean up
    DELETE FROM user_profiles WHERE id = test_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'ERROR: Manual insert failed with: %', SQLERRM;
END $$;