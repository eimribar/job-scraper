-- Ensure user_profiles table has status column for pending/active states
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' 
CHECK (status IN ('active', 'pending', 'suspended', 'inactive'));

-- Update any existing records without status to be active
UPDATE user_profiles 
SET status = 'active' 
WHERE status IS NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_status ON user_profiles(status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

-- Verify the change
SELECT 
    'user_profiles columns' as check_type,
    column_name, 
    data_type,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles'
ORDER BY ordinal_position;