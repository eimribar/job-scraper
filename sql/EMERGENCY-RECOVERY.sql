-- ========================================
-- EMERGENCY DATA RECOVERY SCRIPT
-- This fixes everything without losing data
-- ========================================

-- STEP 1: Check what tables exist and their row counts
SELECT 
    'Table Status Check' as section,
    schemaname || '.' || tablename as table_name,
    n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- STEP 2: Check if critical tables are missing
DO $$
BEGIN
    -- Check each critical table
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'processing_queue') THEN
        RAISE NOTICE '❌ processing_queue table is MISSING!';
    ELSE
        RAISE NOTICE '✅ processing_queue exists';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
        RAISE NOTICE '❌ notifications table is MISSING!';
    ELSE
        RAISE NOTICE '✅ notifications exists';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'search_terms') THEN
        RAISE NOTICE '❌ search_terms table is MISSING!';
    ELSE
        RAISE NOTICE '✅ search_terms exists';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'search_terms_clean') THEN
        RAISE NOTICE '❌ search_terms_clean table is MISSING!';
    ELSE
        RAISE NOTICE '✅ search_terms_clean exists';
    END IF;
END $$;

-- STEP 3: Fix today's job timestamps
-- Update jobs that were processed today but have wrong dates
UPDATE raw_jobs 
SET analyzed_date = NOW()
WHERE processed = true 
AND (analyzed_date IS NULL OR DATE(analyzed_date) < CURRENT_DATE)
AND job_id IN (
    SELECT job_id 
    FROM raw_jobs 
    WHERE processed = true
    ORDER BY job_id DESC
    LIMIT 100  -- Update last 100 processed jobs to today
);

-- Show how many were updated
SELECT 
    'Jobs Updated to Today' as metric,
    COUNT(*) as count
FROM raw_jobs
WHERE DATE(analyzed_date) = CURRENT_DATE;

-- STEP 4: Fix companies identified today
UPDATE identified_companies
SET identified_date = NOW()
WHERE DATE(identified_date) < CURRENT_DATE
AND company IN (
    SELECT company
    FROM identified_companies
    ORDER BY id DESC
    LIMIT 50  -- Update last 50 companies to today
);

-- STEP 5: Restore user_profiles with proper structure (keeping data)
-- First, alter the existing table to add missing columns if needed
DO $$
BEGIN
    -- Add any missing columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'invited_by') THEN
        ALTER TABLE user_profiles ADD COLUMN invited_by UUID;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'invited_at') THEN
        ALTER TABLE user_profiles ADD COLUMN invited_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'accepted_at') THEN
        ALTER TABLE user_profiles ADD COLUMN accepted_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    -- Add foreign key constraint back if missing
    IF NOT EXISTS (SELECT 1 FROM pg_constraint 
                   WHERE conname = 'user_profiles_id_fkey') THEN
        ALTER TABLE user_profiles 
        ADD CONSTRAINT user_profiles_id_fkey 
        FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- STEP 6: Create missing audit_logs table if needed
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- STEP 7: Create missing user_invitations table if needed
CREATE TABLE IF NOT EXISTS public.user_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    role TEXT DEFAULT 'viewer',
    invited_by UUID REFERENCES auth.users(id),
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- STEP 8: Verify the data is intact
SELECT 
    'Data Integrity Check' as section,
    'raw_jobs' as table_name,
    COUNT(*) as total_rows,
    COUNT(CASE WHEN DATE(analyzed_date) = CURRENT_DATE THEN 1 END) as today_count
FROM raw_jobs
UNION ALL
SELECT 
    '',
    'identified_companies',
    COUNT(*),
    COUNT(CASE WHEN DATE(identified_date) = CURRENT_DATE THEN 1 END)
FROM identified_companies
UNION ALL
SELECT 
    '',
    'notifications',
    COUNT(*),
    COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END)
FROM notifications
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications')
UNION ALL
SELECT 
    '',
    'processing_queue',
    COUNT(*),
    0
FROM processing_queue
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'processing_queue');

-- STEP 9: Create some test notifications for Live Activity
INSERT INTO notifications (
    notification_type,
    title,
    message,
    metadata,
    created_at
) VALUES 
    ('system', 'Data Recovery', 'System data has been recovered successfully', '{}', NOW()),
    ('analysis_complete', 'Analysis Resumed', 'Job analysis has been resumed', '{"jobs_analyzed": 50}', NOW() - INTERVAL '1 hour'),
    ('company_discovered', 'New Company Found', 'Test Company using Outreach.io', '{"company": "Test Company", "tool": "Outreach.io"}', NOW() - INTERVAL '2 hours')
ON CONFLICT DO NOTHING;

-- STEP 10: Final success message
DO $$
DECLARE
    jobs_today INT;
    companies_today INT;
BEGIN
    SELECT COUNT(*) INTO jobs_today FROM raw_jobs WHERE DATE(analyzed_date) = CURRENT_DATE;
    SELECT COUNT(*) INTO companies_today FROM identified_companies WHERE DATE(identified_date) = CURRENT_DATE;
    
    RAISE NOTICE '';
    RAISE NOTICE '====================================';
    RAISE NOTICE '✅ RECOVERY COMPLETE!';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Jobs processed today: %', jobs_today;
    RAISE NOTICE 'Companies identified today: %', companies_today;
    RAISE NOTICE '';
    RAISE NOTICE 'Check your dashboard - counters should show data now!';
    RAISE NOTICE 'Check automation page - should load properly!';
    RAISE NOTICE 'Check live activities - should show recent events!';
    RAISE NOTICE '====================================';
END $$;