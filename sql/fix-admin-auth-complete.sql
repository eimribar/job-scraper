-- ========================================
-- COMPLETE ADMIN AUTHENTICATION FIX
-- Run this in Supabase SQL Editor
-- ========================================

-- Step 1: Check if your auth user exists
SELECT 
    'Auth User Check' as check_type,
    id, 
    email, 
    created_at,
    last_sign_in_at
FROM auth.users 
WHERE email = 'eimrib@yess.ai';

-- Step 2: Check current user_profiles status
SELECT 
    'Profile Check' as check_type,
    id,
    email,
    role,
    status
FROM user_profiles 
WHERE email = 'eimrib@yess.ai';

-- Step 3: Create or update your admin profile
DO $$
DECLARE
    v_user_id UUID;
    v_user_email TEXT;
    v_full_name TEXT;
BEGIN
    -- Get user details from auth.users
    SELECT 
        id,
        email,
        COALESCE(
            raw_user_meta_data->>'full_name',
            raw_user_meta_data->>'name',
            'Admin'
        )
    INTO v_user_id, v_user_email, v_full_name
    FROM auth.users
    WHERE email = 'eimrib@yess.ai'
    LIMIT 1;
    
    IF v_user_id IS NOT NULL THEN
        -- Create or update the profile
        INSERT INTO user_profiles (
            id,
            email,
            full_name,
            role,
            status,
            created_at,
            updated_at
        ) VALUES (
            v_user_id,
            v_user_email,
            v_full_name,
            'admin',
            'active',
            NOW(),
            NOW()
        )
        ON CONFLICT (id) DO UPDATE
        SET 
            email = EXCLUDED.email,
            full_name = COALESCE(user_profiles.full_name, EXCLUDED.full_name),
            role = 'admin',
            status = 'active',
            updated_at = NOW();
        
        RAISE NOTICE 'SUCCESS: Admin profile created/updated for % with ID: %', v_user_email, v_user_id;
    ELSE
        RAISE NOTICE 'WARNING: User eimrib@yess.ai not found in auth.users.';
        RAISE NOTICE 'ACTION REQUIRED: Please sign in with Google first, then run this script again.';
    END IF;
END $$;

-- Step 4: Verify the fix
SELECT 
    'Final Status' as check_type,
    up.id,
    up.email,
    up.role,
    up.status,
    up.created_at,
    au.last_sign_in_at
FROM user_profiles up
LEFT JOIN auth.users au ON au.id = up.id
WHERE up.email = 'eimrib@yess.ai';

-- Step 5: Fix the trigger to handle OAuth properly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert user profile with proper role detection
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
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'name',
            split_part(NEW.email, '@', 1)
        ),
        COALESCE(
            NEW.raw_user_meta_data->>'avatar_url',
            NEW.raw_user_meta_data->>'picture'
        ),
        CASE 
            WHEN NEW.email = 'eimrib@yess.ai' THEN 'admin'
            ELSE 'viewer'
        END,
        'active',
        NOW(),
        NOW()
    ) ON CONFLICT (id) DO UPDATE
    SET 
        email = EXCLUDED.email,
        full_name = COALESCE(user_profiles.full_name, EXCLUDED.full_name),
        avatar_url = COALESCE(user_profiles.avatar_url, EXCLUDED.avatar_url),
        updated_at = NOW();
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't block user creation
        RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Success message
DO $$ 
BEGIN 
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Admin authentication fix completed!';
    RAISE NOTICE 'You should now be able to access /admin/users';
    RAISE NOTICE '========================================';
END $$;