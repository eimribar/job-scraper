-- Fix admin profile for eimrib@yess.ai
-- This works with the existing table structure

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
        -- Insert or update the user profile (without status column)
        INSERT INTO public.user_profiles (
            id,
            email,
            full_name,
            role,
            created_at,
            updated_at
        ) VALUES (
            user_id,
            'eimrib@yess.ai',
            'Admin',
            'admin',
            NOW(),
            NOW()
        )
        ON CONFLICT (id) DO UPDATE
        SET 
            role = 'admin',
            full_name = COALESCE(user_profiles.full_name, 'Admin'),
            updated_at = NOW();
        
        RAISE NOTICE 'Admin profile created/updated for eimrib@yess.ai with ID: %', user_id;
    ELSE
        RAISE NOTICE 'User eimrib@yess.ai not found in auth.users. Please login first.';
    END IF;
END $$;

-- Show the result
SELECT 
    id,
    email,
    full_name,
    role,
    created_at
FROM public.user_profiles
WHERE email = 'eimrib@yess.ai';