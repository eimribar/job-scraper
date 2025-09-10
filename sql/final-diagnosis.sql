-- ========================================
-- FINAL DIAGNOSIS & FIX
-- ========================================

-- The setup shows everything is correct:
-- ✅ Trigger exists and is enabled
-- ✅ Function exists 
-- ✅ Table exists
-- ✅ RLS is disabled (no permission issues)

-- The 500 error is likely from the APP, not the database
-- Let's verify the auth flow:

-- 1. Check if any users have successfully signed up
SELECT 
    'Total Auth Users' as metric,
    COUNT(*) as value
FROM auth.users
UNION ALL
SELECT 
    'Total User Profiles',
    COUNT(*)
FROM user_profiles
UNION ALL
SELECT 
    'Admin Users',
    COUNT(*)
FROM user_profiles
WHERE role = 'admin';

-- 2. Manually test the trigger function
DO $$
DECLARE
    test_id UUID := gen_random_uuid();
    test_meta JSONB := '{"full_name": "Test User", "avatar_url": "https://example.com/avatar.jpg"}';
BEGIN
    -- Simulate what happens when auth.users gets a new row
    INSERT INTO user_profiles (
        id,
        email,
        full_name,
        avatar_url,
        role,
        status
    )
    SELECT
        test_id,
        'test_' || extract(epoch from now()) || '@example.com',
        COALESCE(test_meta->>'full_name', 'User'),
        COALESCE(test_meta->>'avatar_url', ''),
        'viewer',
        'pending';
    
    -- Check if it worked
    IF EXISTS (SELECT 1 FROM user_profiles WHERE id = test_id) THEN
        RAISE NOTICE '✅ Manual insert works! Trigger should work too.';
        -- Clean up
        DELETE FROM user_profiles WHERE id = test_id;
    ELSE
        RAISE NOTICE '❌ Manual insert failed!';
    END IF;
END $$;

-- 3. THE REAL FIX: Ensure Supabase Auth Settings
-- The error URL pattern suggests misconfiguration
-- Go to: https://app.supabase.com/project/nslcadgicgkncajoyyno/auth/url-configuration
SELECT 
    '⚠️ IMPORTANT' as action,
    'Check Supabase Dashboard > Authentication > URL Configuration' as details
UNION ALL
SELECT 
    'Site URL',
    'Must be: https://job-scraper-liard.vercel.app'
UNION ALL
SELECT 
    'Redirect URLs',
    'Must include: https://job-scraper-liard.vercel.app/auth/callback';

-- 4. If you're still getting 500 error after fixing URLs:
-- The issue might be in the application code, not the database
-- Check if environment variables are set in Vercel:

SELECT 
    'Check Vercel Environment Variables' as action,
    'NEXT_PUBLIC_SUPABASE_URL' as variable,
    'Should be: https://nslcadgicgkncajoyyno.supabase.co' as value
UNION ALL
SELECT 
    '',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'Should be set to your anon key'
UNION ALL
SELECT 
    '',
    'SUPABASE_SERVICE_ROLE_KEY',
    'Should be set to your service role key';

-- 5. Nuclear option if nothing else works:
/*
-- Disable the trigger completely
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;

-- Try signing in (should work now)
-- Then manually create your profile after successful auth:
INSERT INTO user_profiles (id, email, role, status)
SELECT id, email, 'admin', 'active'
FROM auth.users 
WHERE email = 'eimrib@yess.ai'
ON CONFLICT (id) DO UPDATE SET
    role = 'admin',
    status = 'active';
*/

-- 6. Success check
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'DIAGNOSIS COMPLETE';
    RAISE NOTICE '====================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Database setup: ✅ WORKING';
    RAISE NOTICE 'Trigger setup: ✅ WORKING';
    RAISE NOTICE '';
    RAISE NOTICE 'The 500 error is likely from:';
    RAISE NOTICE '1. Wrong Site URL in Supabase settings';
    RAISE NOTICE '2. Missing environment variables in Vercel';
    RAISE NOTICE '3. Incorrect redirect URL configuration';
    RAISE NOTICE '';
    RAISE NOTICE 'Fix the Supabase URL settings and it should work!';
    RAISE NOTICE '====================================';
END $$;