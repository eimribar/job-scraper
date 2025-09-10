-- Ensure admin profile exists for eimrib@yess.ai
-- This script checks if the user exists in auth.users and creates/updates their profile

DO $$
DECLARE
    user_id UUID;
BEGIN
    -- Get the user ID from auth.users for eimrib@yess.ai
    SELECT id INTO user_id 
    FROM auth.users 
    WHERE email = 'eimrib@yess.ai'
    LIMIT 1;
    
    IF user_id IS NOT NULL THEN
        -- Insert or update the user profile
        INSERT INTO public.user_profiles (
            id,
            email,
            full_name,
            role,
            status,
            created_at,
            updated_at
        ) VALUES (
            user_id,
            'eimrib@yess.ai',
            'Admin',
            'admin',
            'active',
            NOW(),
            NOW()
        )
        ON CONFLICT (id) DO UPDATE
        SET 
            role = 'admin',
            status = 'active',
            updated_at = NOW();
        
        RAISE NOTICE 'Admin profile created/updated for eimrib@yess.ai with ID: %', user_id;
    ELSE
        RAISE NOTICE 'User eimrib@yess.ai not found in auth.users. Please login first.';
    END IF;
END $$;

-- Also check what users exist
SELECT 
    u.id,
    u.email,
    u.created_at as auth_created,
    p.role,
    p.status,
    p.full_name
FROM auth.users u
LEFT JOIN public.user_profiles p ON u.id = p.id
ORDER BY u.created_at DESC;