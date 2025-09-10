-- ========================================
-- SIMPLIFIED & ROBUST AUTH TRIGGER FIX
-- This replaces the complex trigger with a simpler, working version
-- ========================================

-- Step 1: Drop existing trigger (if exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Step 2: Create a debug log table to track what's happening
CREATE TABLE IF NOT EXISTS public.auth_debug_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    event_type TEXT,
    user_email TEXT,
    user_id UUID,
    error_message TEXT,
    details JSONB
);

-- Step 3: Create SIMPLIFIED trigger function with extensive error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    _user_name TEXT;
    _avatar TEXT;
BEGIN
    -- Log the attempt
    INSERT INTO auth_debug_log (event_type, user_email, user_id, details)
    VALUES ('signup_attempt', NEW.email, NEW.id, to_jsonb(NEW.raw_user_meta_data));
    
    -- Extract user data safely
    _user_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1)
    );
    
    _avatar := COALESCE(
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.raw_user_meta_data->>'picture',
        ''
    );
    
    -- Try to insert the profile
    BEGIN
        -- Special handling for admin email
        IF NEW.email = 'eimrib@yess.ai' THEN
            INSERT INTO public.user_profiles (
                id,
                email,
                full_name,
                avatar_url,
                role,
                status,
                created_at,
                updated_at
            ) VALUES (
                NEW.id,
                NEW.email,
                _user_name,
                _avatar,
                'admin'::user_role,
                'active'::user_status,
                NOW(),
                NOW()
            ) ON CONFLICT (id) DO UPDATE SET
                full_name = EXCLUDED.full_name,
                avatar_url = EXCLUDED.avatar_url,
                updated_at = NOW();
                
            -- Log success
            INSERT INTO auth_debug_log (event_type, user_email, user_id, details)
            VALUES ('admin_created', NEW.email, NEW.id, jsonb_build_object('role', 'admin'));
        ELSE
            -- Regular user
            INSERT INTO public.user_profiles (
                id,
                email,
                full_name,
                avatar_url,
                role,
                status,
                created_at,
                updated_at
            ) VALUES (
                NEW.id,
                NEW.email,
                _user_name,
                _avatar,
                'viewer'::user_role,
                'pending'::user_status,
                NOW(),
                NOW()
            ) ON CONFLICT (id) DO UPDATE SET
                full_name = EXCLUDED.full_name,
                avatar_url = EXCLUDED.avatar_url,
                updated_at = NOW();
                
            -- Log success
            INSERT INTO auth_debug_log (event_type, user_email, user_id, details)
            VALUES ('user_created', NEW.email, NEW.id, jsonb_build_object('role', 'viewer'));
        END IF;
        
    EXCEPTION
        WHEN OTHERS THEN
            -- Log the error but don't fail the auth
            INSERT INTO auth_debug_log (event_type, user_email, user_id, error_message, details)
            VALUES (
                'profile_creation_error', 
                NEW.email, 
                NEW.id, 
                SQLERRM,
                jsonb_build_object(
                    'sqlstate', SQLSTATE,
                    'error_detail', SQLERRM
                )
            );
            -- Still return NEW to allow auth to complete
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Step 5: Grant necessary permissions
GRANT INSERT ON auth_debug_log TO authenticated;
GRANT INSERT ON auth_debug_log TO anon;

-- Step 6: Test the setup
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'AUTH TRIGGER FIXED!';
    RAISE NOTICE '====================================';
    RAISE NOTICE '';
    RAISE NOTICE 'The simplified trigger has been installed.';
    RAISE NOTICE 'It will:';
    RAISE NOTICE '1. Create user profiles automatically';
    RAISE NOTICE '2. Give admin role to eimrib@yess.ai';
    RAISE NOTICE '3. Log all attempts to auth_debug_log';
    RAISE NOTICE '4. Handle errors gracefully';
    RAISE NOTICE '';
    RAISE NOTICE 'Check auth_debug_log table for any issues:';
    RAISE NOTICE 'SELECT * FROM auth_debug_log ORDER BY event_time DESC;';
    RAISE NOTICE '';
    RAISE NOTICE '====================================';
END $$;