-- ========================================
-- ADMIN USER MANAGEMENT MIGRATION
-- Carefully designed to work with existing schema
-- ========================================

-- 1. Enhance user_profiles table with missing columns only
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending', 'inactive')),
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS suspended_reason TEXT,
ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES user_profiles(id),
ADD COLUMN IF NOT EXISTS phone_number TEXT,
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS job_title TEXT;

-- 2. Add missing columns to user_invitations table
ALTER TABLE user_invitations 
ADD COLUMN IF NOT EXISTS invitation_token TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. Create user_activity_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id TEXT,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create user_sessions table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE,
    ip_address INET,
    user_agent TEXT,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Add missing columns to existing audit_logs table (if it exists)
-- First check if audit_logs exists and what columns it has
DO $$ 
BEGIN
    -- Add columns only if the table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
        -- Add missing columns
        ALTER TABLE audit_logs 
        ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES auth.users(id),
        ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES auth.users(id),
        ADD COLUMN IF NOT EXISTS previous_value JSONB,
        ADD COLUMN IF NOT EXISTS new_value JSONB,
        ADD COLUMN IF NOT EXISTS reason TEXT,
        ADD COLUMN IF NOT EXISTS ip_address INET;
        
        -- If user_id exists and admin_id doesn't have data, copy it
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'audit_logs' AND column_name = 'user_id') THEN
            UPDATE audit_logs SET admin_id = user_id WHERE admin_id IS NULL;
        END IF;
    ELSE
        -- Create the table if it doesn't exist
        CREATE TABLE audit_logs (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            admin_id UUID REFERENCES auth.users(id),
            target_user_id UUID REFERENCES auth.users(id),
            action VARCHAR(100) NOT NULL,
            previous_value JSONB,
            new_value JSONB,
            reason TEXT,
            ip_address INET,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    END IF;
END $$;

-- 6. Create indexes for performance (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_created_at ON user_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_action ON user_activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_user ON audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_status ON user_profiles(status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_seen ON user_profiles(last_seen DESC);

-- 7. Enable RLS on tables (won't error if already enabled)
ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 8. Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Admins can view all activity logs" ON user_activity_logs;
DROP POLICY IF EXISTS "Users can view own activity" ON user_activity_logs;
DROP POLICY IF EXISTS "Admins can manage invitations" ON user_invitations;
DROP POLICY IF EXISTS "Admins can view all sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users can view own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Only admins can view audit logs" ON audit_logs;

-- 9. Create RLS policies
-- Activity logs - admins can view all
CREATE POLICY "Admins can view all activity logs" ON user_activity_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Users can view their own activity
CREATE POLICY "Users can view own activity" ON user_activity_logs
    FOR SELECT
    USING (auth.uid() = user_id);

-- Invitations - admins can manage all
CREATE POLICY "Admins can manage invitations" ON user_invitations
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Sessions - admins can view all
CREATE POLICY "Admins can view all sessions" ON user_sessions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Users can view their own sessions
CREATE POLICY "Users can view own sessions" ON user_sessions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Audit logs - only admins can view
CREATE POLICY "Only admins can view audit logs" ON audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 10. Create or replace helper functions
CREATE OR REPLACE FUNCTION log_user_activity(
    p_user_id UUID,
    p_action VARCHAR,
    p_resource_type VARCHAR DEFAULT NULL,
    p_resource_id TEXT DEFAULT NULL,
    p_details JSONB DEFAULT '{}',
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO user_activity_logs (
        user_id, action, resource_type, resource_id, 
        details, ip_address, user_agent
    ) VALUES (
        p_user_id, p_action, p_resource_type, p_resource_id,
        p_details, p_ip_address, p_user_agent
    ) RETURNING id INTO v_log_id;
    
    -- Update last_seen in user_profiles
    UPDATE user_profiles 
    SET last_seen = NOW() 
    WHERE id = p_user_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Create or replace admin action logging function
CREATE OR REPLACE FUNCTION log_admin_action(
    p_admin_id UUID,
    p_target_user_id UUID,
    p_action VARCHAR,
    p_previous_value JSONB DEFAULT NULL,
    p_new_value JSONB DEFAULT NULL,
    p_reason TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO audit_logs (
        admin_id, target_user_id, action, 
        previous_value, new_value, reason, ip_address
    ) VALUES (
        p_admin_id, p_target_user_id, p_action,
        p_previous_value, p_new_value, p_reason, p_ip_address
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Create user statistics view
DROP VIEW IF EXISTS user_statistics;
CREATE VIEW user_statistics AS
SELECT 
    COUNT(*) FILTER (WHERE status = 'active') as active_users,
    COUNT(*) FILTER (WHERE status = 'suspended') as suspended_users,
    COUNT(*) FILTER (WHERE status = 'pending') as pending_users,
    COUNT(*) FILTER (WHERE role = 'admin') as admin_count,
    COUNT(*) FILTER (WHERE role = 'editor') as editor_count,
    COUNT(*) FILTER (WHERE role = 'viewer') as viewer_count,
    COUNT(*) FILTER (WHERE last_seen > NOW() - INTERVAL '24 hours') as active_today,
    COUNT(*) FILTER (WHERE last_seen > NOW() - INTERVAL '7 days') as active_week,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as new_users_month
FROM user_profiles;

-- 13. Grant necessary permissions
GRANT SELECT ON user_statistics TO authenticated;
GRANT ALL ON user_activity_logs TO authenticated;
GRANT ALL ON user_sessions TO authenticated;
GRANT ALL ON audit_logs TO authenticated;

-- 14. Create function to update user status
CREATE OR REPLACE FUNCTION update_user_status(
    p_user_id UUID,
    p_status VARCHAR,
    p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE user_profiles
    SET 
        status = p_status,
        suspended_at = CASE WHEN p_status = 'suspended' THEN NOW() ELSE NULL END,
        suspended_reason = CASE WHEN p_status = 'suspended' THEN p_reason ELSE NULL END,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 15. Update existing admin user to ensure proper setup
UPDATE user_profiles 
SET 
    role = 'admin',
    status = 'active'
WHERE email = 'eimrib@yess.ai';

-- 16. Add some sample data for testing (optional)
-- You can comment this out if you don't want sample data
DO $$
BEGIN
    -- Add a sample activity log entry for testing
    IF NOT EXISTS (SELECT 1 FROM user_activity_logs LIMIT 1) THEN
        INSERT INTO user_activity_logs (user_id, action, resource_type, details)
        SELECT 
            id, 
            'USER_LOGIN', 
            'authentication',
            '{"message": "Initial admin login"}'::jsonb
        FROM user_profiles 
        WHERE email = 'eimrib@yess.ai'
        LIMIT 1;
    END IF;
END $$;

-- Success message
DO $$ 
BEGIN 
    RAISE NOTICE 'Admin user management migration completed successfully!'; 
END $$;