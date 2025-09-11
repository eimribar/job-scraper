-- First, check if the table exists and what columns it has
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_invitations';

-- Drop the table if it exists (to start fresh)
DROP TABLE IF EXISTS user_invitations CASCADE;

-- Create user_invitations table with all required columns
CREATE TABLE user_invitations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    role VARCHAR(20) DEFAULT 'viewer',
    invited_by UUID REFERENCES auth.users(id),
    invitation_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    accepted_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraints separately to avoid issues
ALTER TABLE user_invitations ADD CONSTRAINT unique_invitation_email UNIQUE (email);
ALTER TABLE user_invitations ADD CONSTRAINT unique_invitation_token UNIQUE (invitation_token);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_user_invitations_expires ON user_invitations(expires_at);

-- Enable RLS
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for admins
CREATE POLICY "Admins can manage invitations" ON user_invitations
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Grant permissions
GRANT ALL ON user_invitations TO authenticated;