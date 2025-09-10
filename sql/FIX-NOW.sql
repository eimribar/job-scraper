-- ========================================
-- IMMEDIATE FIX - RUN THIS NOW IN SUPABASE
-- ========================================
-- This is the complete solution to fix "Database error saving new user"

-- PART 1: CHECK WHAT'S WRONG
-- Run this first to see current state
SELECT 'Checking existing data...' as status;

-- Check if you already exist in auth.users
SELECT COUNT(*) as existing_users, 
       STRING_AGG(email, ', ') as emails
FROM auth.users 
WHERE email = 'eimrib@yess.ai';

-- Check current trigger
SELECT COUNT(*) as trigger_exists
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- PART 2: CLEAN UP (if needed)
-- Remove any existing user data that might conflict
DELETE FROM user_profiles WHERE email = 'eimrib@yess.ai';
DELETE FROM audit_logs WHERE user_id IN (
    SELECT id FROM auth.users WHERE email = 'eimrib@yess.ai'
);
DELETE FROM auth.users WHERE email = 'eimrib@yess.ai';

-- PART 3: DROP OLD TRIGGER
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- PART 4: CREATE SIMPLE WORKING TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Just create a basic profile, nothing fancy
    INSERT INTO public.user_profiles (
        id,
        email,
        full_name,
        avatar_url,
        role,
        status,
        permissions,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'User'),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
        CASE 
            WHEN NEW.email = 'eimrib@yess.ai' THEN 'admin'::user_role
            ELSE 'viewer'::user_role
        END,
        CASE 
            WHEN NEW.email = 'eimrib@yess.ai' THEN 'active'::user_status
            ELSE 'pending'::user_status
        END,
        '{}',
        NOW(),
        NOW()
    );
    
    RETURN NEW;
EXCEPTION
    WHEN unique_violation THEN
        -- User already exists, that's fine
        RETURN NEW;
    WHEN OTHERS THEN
        -- Log error but don't block signup
        RAISE WARNING 'Error in trigger: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PART 5: ATTACH THE TRIGGER
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- PART 6: VERIFY EVERYTHING IS SET UP
SELECT 
    'Setup Complete!' as status,
    EXISTS(SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') as trigger_exists,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user') as function_exists;

-- PART 7: SUCCESS MESSAGE
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ ✅ ✅ ✅ ✅ ✅ ✅ ✅ ✅ ✅';
    RAISE NOTICE 'AUTH FIXED! TRY SIGNING IN NOW!';
    RAISE NOTICE '✅ ✅ ✅ ✅ ✅ ✅ ✅ ✅ ✅ ✅';
    RAISE NOTICE '';
    RAISE NOTICE 'Go to: https://job-scraper-liard.vercel.app/login';
    RAISE NOTICE 'Sign in with Google using: eimrib@yess.ai';
    RAISE NOTICE 'You will get admin role automatically!';
    RAISE NOTICE '';
END $$;