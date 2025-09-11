-- ================================================
-- FIX RLS: ADD MISSING INSERT POLICY
-- ================================================
-- Problem: No INSERT policy exists, blocking all inserts via anon key
-- Solution: Add policy allowing admins to create profiles

-- Check current policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'user_profiles'
ORDER BY policyname;

-- Add INSERT policy for admins
CREATE POLICY IF NOT EXISTS "Admins can create profiles" ON user_profiles
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE (auth_id = auth.uid() OR id = auth.uid()) 
            AND role = 'admin'
        )
        OR auth.uid() IS NOT NULL -- Allow any authenticated user to be created initially
    );

-- Add DELETE policy for admins (was also missing)
CREATE POLICY IF NOT EXISTS "Admins can delete profiles" ON user_profiles
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE (auth_id = auth.uid() OR id = auth.uid()) 
            AND role = 'admin'
        )
    );

-- Verify policies were created
SELECT 
    'After Fix' as status,
    policyname,
    cmd as operation
FROM pg_policies
WHERE tablename = 'user_profiles'
ORDER BY cmd, policyname;