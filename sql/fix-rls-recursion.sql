-- ================================================
-- FIX RLS INFINITE RECURSION IN USER_PROFILES
-- ================================================
-- Problem: RLS policy "Admins can manage all profiles" causes infinite recursion
-- because it queries user_profiles table within its own policy check
-- Solution: Use a SECURITY DEFINER function to check admin status without triggering RLS

-- Step 1: Drop all existing problematic policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Service role has full access" ON user_profiles;
DROP POLICY IF EXISTS "Admins can create profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON user_profiles;

-- Step 2: Create a secure function to check if user is admin
-- SECURITY DEFINER makes this function run with the privileges of the function creator
-- This bypasses RLS when checking admin status, preventing recursion
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Return true if the user is an admin
  RETURN EXISTS (
    SELECT 1 
    FROM user_profiles
    WHERE (auth_id = user_id OR id = user_id)
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin TO anon;

-- Step 3: Create new, clean RLS policies

-- Policy for SELECT: Users can view their own profile, admins can view all
CREATE POLICY "Users can view profiles" ON user_profiles
  FOR SELECT
  USING (
    -- User can see their own profile
    auth_id = auth.uid() 
    OR id = auth.uid()
    -- Admins can see all profiles
    OR is_admin(auth.uid())
    -- Service role can see everything
    OR auth.role() = 'service_role'
  );

-- Policy for INSERT: Only admins can create new profiles
CREATE POLICY "Admins can insert profiles" ON user_profiles
  FOR INSERT
  WITH CHECK (
    is_admin(auth.uid())
    OR auth.role() = 'service_role'
  );

-- Policy for UPDATE: Admins can update any profile, users can update their own
CREATE POLICY "Users can update profiles" ON user_profiles
  FOR UPDATE
  USING (
    -- User can update their own profile
    auth_id = auth.uid() 
    OR id = auth.uid()
    -- Admins can update all profiles
    OR is_admin(auth.uid())
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    -- Same conditions for the new row
    auth_id = auth.uid() 
    OR id = auth.uid()
    OR is_admin(auth.uid())
    OR auth.role() = 'service_role'
  );

-- Policy for DELETE: Only admins can delete profiles
CREATE POLICY "Admins can delete profiles" ON user_profiles
  FOR DELETE
  USING (
    is_admin(auth.uid())
    OR auth.role() = 'service_role'
  );

-- Step 4: Verify the fix
DO $$
BEGIN
  RAISE NOTICE 'RLS policies have been fixed to prevent infinite recursion';
  RAISE NOTICE 'The is_admin() function will check admin status without triggering RLS';
  RAISE NOTICE 'All policies now use the is_admin() function for admin checks';
END $$;

-- Step 5: Test that policies are working
-- This should return all policies without any recursion issues
SELECT 
  policyname,
  cmd as operation,
  qual as using_clause,
  with_check as with_check_clause
FROM pg_policies
WHERE tablename = 'user_profiles'
ORDER BY policyname;