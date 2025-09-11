-- ================================================
-- FIX USER PROFILES TABLE TO ALLOW PRE-REGISTRATION
-- ================================================
-- The problem: user_profiles.id has a foreign key to auth.users(id)
-- This prevents creating users before they sign up with auth
-- Solution: Remove FK constraint and add separate auth_id column

-- Step 1: Remove the foreign key constraint that's blocking us
ALTER TABLE user_profiles 
DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;

-- Step 2: Add auth_id column to link authenticated users
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS auth_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_authenticated BOOLEAN DEFAULT false;

-- Step 3: For existing users, copy their ID to auth_id
UPDATE user_profiles 
SET auth_id = id,
    is_authenticated = true
WHERE auth_id IS NULL 
  AND EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = user_profiles.id);

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_id ON user_profiles(auth_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_email_unique ON user_profiles(email);

-- Step 5: Update RLS policies to work with new structure
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

-- New policy: Users can view their own profile (by auth_id)
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT
    USING (auth_id = auth.uid() OR id = auth.uid());

-- New policy: Admins can do everything
CREATE POLICY "Admins can manage all profiles" ON user_profiles
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE (auth_id = auth.uid() OR id = auth.uid()) 
            AND role = 'admin'
        )
    );

-- New policy: Service role can do everything (for API operations)
CREATE POLICY "Service role has full access" ON user_profiles
    FOR ALL
    USING (auth.role() = 'service_role');

-- Step 6: Verify the changes
SELECT 
    'Table Structure After Fix' as check_type,
    column_name, 
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles'
  AND column_name IN ('id', 'auth_id', 'is_authenticated', 'email', 'status')
ORDER BY ordinal_position;