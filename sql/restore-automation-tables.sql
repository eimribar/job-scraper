-- ========================================
-- RESTORE AUTOMATION TABLES
-- This recreates the missing tables for automation & live activities
-- ========================================

-- 1. Create processing_queue table (for automation page)
CREATE TABLE IF NOT EXISTS public.processing_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending',
    priority INTEGER DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'
);

-- 2. Create search_terms_clean table (for automation)
CREATE TABLE IF NOT EXISTS public.search_terms_clean (
    id SERIAL PRIMARY KEY,
    search_term TEXT UNIQUE NOT NULL,
    priority INTEGER DEFAULT 5,
    is_active BOOLEAN DEFAULT true,
    last_scraped_date TIMESTAMP WITH TIME ZONE,
    jobs_found_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Populate search_terms_clean with existing data
INSERT INTO search_terms_clean (search_term, priority, is_active)
SELECT DISTINCT 
    search_term,
    5 as priority,
    true as is_active
FROM raw_jobs
WHERE search_term IS NOT NULL AND search_term != ''
ON CONFLICT (search_term) DO NOTHING;

-- Also add from search_terms table if it exists
INSERT INTO search_terms_clean (search_term, priority, is_active)
SELECT 
    COALESCE(term, search_term) as search_term,
    5 as priority,
    true as is_active
FROM search_terms
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'search_terms')
ON CONFLICT (search_term) DO NOTHING;

-- 4. Create notifications table (for live activities)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    notification_type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    metadata JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create index for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(notification_type);

-- 6. Create scraping_runs table (tracks automation runs)
CREATE TABLE IF NOT EXISTS public.scraping_runs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    search_term TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    jobs_found INTEGER DEFAULT 0,
    jobs_processed INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'
);

-- 7. Create processed_jobs table (tracks what's been analyzed)
CREATE TABLE IF NOT EXISTS public.processed_jobs (
    job_id TEXT PRIMARY KEY,
    analyzed_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Populate processed_jobs from raw_jobs
INSERT INTO processed_jobs (job_id, analyzed_date)
SELECT job_id, analyzed_date
FROM raw_jobs
WHERE processed = true AND analyzed_date IS NOT NULL
ON CONFLICT (job_id) DO NOTHING;

-- 9. Create sync_status table (tracks automation health)
CREATE TABLE IF NOT EXISTS public.sync_status (
    id TEXT PRIMARY KEY,
    last_sync TIMESTAMP WITH TIME ZONE,
    status TEXT,
    details JSONB DEFAULT '{}'
);

-- 10. Add initial sync status
INSERT INTO sync_status (id, last_sync, status, details)
VALUES (
    'main',
    NOW(),
    'active',
    jsonb_build_object(
        'total_jobs', (SELECT COUNT(*) FROM raw_jobs),
        'processed_jobs', (SELECT COUNT(*) FROM raw_jobs WHERE processed = true),
        'companies_found', (SELECT COUNT(*) FROM identified_companies)
    )
) ON CONFLICT (id) DO UPDATE SET
    last_sync = NOW(),
    status = 'active',
    details = EXCLUDED.details;

-- 11. Generate some recent notifications for Live Activity
INSERT INTO notifications (notification_type, title, message, metadata, created_at)
SELECT 
    'analysis_complete',
    'Batch Analysis Complete',
    'Analyzed ' || COUNT(*) || ' jobs',
    jsonb_build_object('jobs_count', COUNT(*)),
    MAX(analyzed_date)
FROM raw_jobs
WHERE processed = true 
AND analyzed_date > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', analyzed_date)
ORDER BY MAX(analyzed_date) DESC
LIMIT 5;

-- Add company discovery notifications
INSERT INTO notifications (notification_type, title, message, metadata, created_at)
SELECT 
    'company_discovered',
    'New Company: ' || company,
    'Found using ' || tool_detected,
    jsonb_build_object('company', company, 'tool', tool_detected),
    identified_date
FROM identified_companies
ORDER BY identified_date DESC
LIMIT 10;

-- 12. Verify everything was created
SELECT 
    'Table Creation Status' as check,
    tablename,
    CASE 
        WHEN n_live_tup > 0 THEN '✅ Created with ' || n_live_tup || ' rows'
        ELSE '⚠️ Created but empty'
    END as status
FROM pg_stat_user_tables
WHERE schemaname = 'public'
AND tablename IN (
    'processing_queue', 
    'search_terms_clean', 
    'notifications',
    'scraping_runs',
    'processed_jobs',
    'sync_status'
)
ORDER BY tablename;

-- 13. Success message
DO $$
DECLARE
    notification_count INT;
    search_term_count INT;
BEGIN
    SELECT COUNT(*) INTO notification_count FROM notifications;
    SELECT COUNT(*) INTO search_term_count FROM search_terms_clean;
    
    RAISE NOTICE '';
    RAISE NOTICE '====================================';
    RAISE NOTICE '✅ AUTOMATION TABLES RESTORED!';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Notifications created: %', notification_count;
    RAISE NOTICE 'Search terms loaded: %', search_term_count;
    RAISE NOTICE '';
    RAISE NOTICE 'The automation page should work now!';
    RAISE NOTICE 'Live activities should show recent events!';
    RAISE NOTICE '====================================';
END $$;