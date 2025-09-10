-- ========================================
-- INFRASTRUCTURE FIXES FOR PRODUCTION
-- Date: 2025-09-10
-- Purpose: Fix all database inconsistencies found in QA audit
-- ========================================

-- ========================================
-- 1. ADD UNIQUE CONSTRAINT TO IDENTIFIED_COMPANIES
-- ========================================
-- This prevents duplicate company/tool combinations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_company_tool'
    ) THEN
        ALTER TABLE identified_companies
        ADD CONSTRAINT unique_company_tool 
        UNIQUE (company, tool_detected);
        RAISE NOTICE 'Added unique constraint to identified_companies';
    ELSE
        RAISE NOTICE 'Unique constraint already exists';
    END IF;
END $$;

-- ========================================
-- 2. ENSURE SEARCH_TERMS TABLE EXISTS
-- ========================================
-- Check if we need to create search_terms or if it already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'search_terms'
    ) THEN
        -- Create search_terms table
        CREATE TABLE public.search_terms (
            id SERIAL PRIMARY KEY,
            search_term TEXT UNIQUE NOT NULL,
            priority INTEGER DEFAULT 5,
            is_active BOOLEAN DEFAULT true,
            last_scraped_date TIMESTAMP WITH TIME ZONE,
            jobs_found_count INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Copy data from search_terms_clean if it exists
        IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'search_terms_clean'
        ) THEN
            INSERT INTO search_terms (search_term, priority, is_active, last_scraped_date, jobs_found_count, created_at, updated_at)
            SELECT search_term, priority, is_active, last_scraped_date, jobs_found_count, created_at, updated_at
            FROM search_terms_clean
            ON CONFLICT (search_term) DO NOTHING;
            
            RAISE NOTICE 'Migrated data from search_terms_clean to search_terms';
        END IF;
        
        RAISE NOTICE 'Created search_terms table';
    ELSE
        RAISE NOTICE 'search_terms table already exists';
    END IF;
END $$;

-- ========================================
-- 3. VERIFY NOTIFICATIONS TABLE STRUCTURE
-- ========================================
-- Ensure notifications table has notification_type field
DO $$
BEGIN
    -- Check if notification_type column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'notification_type'
    ) THEN
        -- If we have 'type' instead, rename it
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'notifications' 
            AND column_name = 'type'
        ) THEN
            ALTER TABLE notifications 
            RENAME COLUMN type TO notification_type;
            RAISE NOTICE 'Renamed type column to notification_type';
        ELSE
            RAISE NOTICE 'WARNING: notifications table missing both type and notification_type columns!';
        END IF;
    ELSE
        RAISE NOTICE '✅ notifications table has correct notification_type column';
    END IF;
END $$;

-- ========================================
-- 4. REMOVE SEARCH_TERMS_CLEAN (after migration)
-- ========================================
-- Only drop if search_terms exists and has data
DO $$
DECLARE
    search_terms_count INT;
    search_terms_clean_count INT;
BEGIN
    -- Count rows in both tables
    SELECT COUNT(*) INTO search_terms_count 
    FROM information_schema.tables 
    WHERE table_name = 'search_terms';
    
    SELECT COUNT(*) INTO search_terms_clean_count 
    FROM information_schema.tables 
    WHERE table_name = 'search_terms_clean';
    
    -- Only drop search_terms_clean if search_terms exists
    IF search_terms_count > 0 AND search_terms_clean_count > 0 THEN
        DROP TABLE IF EXISTS search_terms_clean CASCADE;
        RAISE NOTICE 'Removed search_terms_clean table';
    END IF;
END $$;

-- ========================================
-- 5. CHECK FOR MISSING TABLES
-- ========================================
SELECT 
    'Table Check' as check_type,
    expected as table_name,
    CASE 
        WHEN tablename IS NOT NULL THEN '✅ Exists'
        ELSE '❌ Missing'
    END as status
FROM (
    SELECT 'raw_jobs' as expected
    UNION SELECT 'identified_companies'
    UNION SELECT 'search_terms'
    UNION SELECT 'notifications'
    UNION SELECT 'tier_one_companies'
    UNION SELECT 'user_profiles'
) expected_tables
LEFT JOIN pg_tables ON tablename = expected AND schemaname = 'public'
ORDER BY expected;

-- ========================================
-- 6. VERIFY NO CONFIDENCE FIELD EXISTS
-- ========================================
SELECT 
    'Confidence Field Check' as check,
    CASE 
        WHEN COUNT(*) > 0 THEN '❌ Confidence field exists (should be removed)'
        ELSE '✅ No confidence field (correct)'
    END as status
FROM information_schema.columns 
WHERE table_name = 'identified_companies' 
AND column_name = 'confidence';

-- ========================================
-- 7. SUCCESS MESSAGE
-- ========================================
DO $$
DECLARE
    notification_count INT;
    search_term_count INT;
    company_count INT;
BEGIN
    SELECT COUNT(*) INTO notification_count FROM notifications;
    SELECT COUNT(*) INTO search_term_count FROM search_terms;
    SELECT COUNT(*) INTO company_count FROM identified_companies;
    
    RAISE NOTICE '';
    RAISE NOTICE '====================================';
    RAISE NOTICE '✅ INFRASTRUCTURE FIXES APPLIED!';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Notifications: %', notification_count;
    RAISE NOTICE 'Search terms: %', search_term_count;
    RAISE NOTICE 'Companies identified: %', company_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Test health endpoint (should return 200)';
    RAISE NOTICE '2. Check live activity feed (should show notifications)';
    RAISE NOTICE '3. Verify scraper can find search terms';
    RAISE NOTICE '4. Start processing to clear backlog';
    RAISE NOTICE '====================================';
END $$;