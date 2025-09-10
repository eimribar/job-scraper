-- ========================================
-- DEEP INVESTIGATION OF ALL ISSUES
-- ========================================

-- 1. Check ALL existing tables and their exact structure
SELECT 
    'EXISTING TABLES' as section,
    table_name,
    STRING_AGG(column_name || ' (' || data_type || ')', ', ' ORDER BY ordinal_position) as columns
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN (
    'search_terms',
    'search_terms_clean',
    'notifications',
    'processing_queue',
    'raw_jobs',
    'identified_companies',
    'user_profiles',
    'audit_logs',
    'user_invitations'
)
GROUP BY table_name
ORDER BY table_name;

-- 2. Check what the ProcessingWidget expects vs what exists
SELECT 
    'ProcessingWidget Queries' as component,
    'search_terms with last_scraped_date' as expects,
    EXISTS(
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'search_terms' 
        AND column_name = 'last_scraped_date'
    ) as exists_in_db;

-- 3. Check what notifications table has vs what LiveActivityFeed expects
SELECT 
    'LiveActivityFeed expects' as component,
    'notifications.notification_type' as column_needed,
    EXISTS(
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'notification_type'
    ) as exists;

-- 4. Check if search_terms table exists at all
SELECT 
    'Table Existence Check' as check_type,
    'search_terms' as table_name,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'search_terms') as exists
UNION ALL
SELECT 
    '',
    'notifications',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications')
UNION ALL
SELECT 
    '',
    'processing_queue',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'processing_queue');

-- 5. Check what search_terms_clean has (if it exists)
SELECT 
    'search_terms_clean structure' as table_info,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'search_terms_clean'
ORDER BY ordinal_position;

-- 6. Check notifications structure (if it exists)
SELECT 
    'notifications structure' as table_info,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'notifications'
ORDER BY ordinal_position;

-- 7. Check what database functions exist
SELECT 
    'Database Functions' as type,
    proname as function_name
FROM pg_proc
WHERE proname IN (
    'get_next_search_term_to_scrape',
    'handle_new_user',
    'check_user_permission'
);

-- 8. CRITICAL: What the code actually needs
/*
CODE EXPECTATIONS:

ProcessingWidget needs:
- search_terms table with: last_scraped_date column
- raw_jobs table with: processed, analyzed_date columns
- identified_companies table with: identified_date column

LiveActivityFeed needs:
- notifications table with: id, notification_type, metadata, created_at, title, message

SearchTermsGrid needs:
- search_terms table with: search_term, last_scraped_date, is_active

AutoScrapingScheduler needs:
- search_terms table with: id, search_term, last_scraped_date, is_active
- Function: get_next_search_term_to_scrape

Dashboard needs:
- raw_jobs with: analyzed_date for "jobs today" count
- identified_companies with: identified_date for "companies today" count
*/

-- 9. Check actual data timestamps
SELECT 
    'Timestamp Check' as check,
    'raw_jobs analyzed_date' as field,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE DATE(analyzed_date) = CURRENT_DATE) as today,
    COUNT(*) FILTER (WHERE analyzed_date >= CURRENT_DATE::timestamp) as gte_today
FROM raw_jobs
WHERE processed = true
UNION ALL
SELECT 
    '',
    'identified_companies identified_date',
    COUNT(*),
    COUNT(*) FILTER (WHERE DATE(identified_date) = CURRENT_DATE),
    COUNT(*) FILTER (WHERE identified_date >= CURRENT_DATE::timestamp)
FROM identified_companies;

-- 10. SUMMARY OF ISSUES
DO $$
DECLARE
    search_terms_exists BOOLEAN;
    notifications_correct BOOLEAN;
    search_terms_clean_exists BOOLEAN;
BEGIN
    SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'search_terms') INTO search_terms_exists;
    SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'notification_type') INTO notifications_correct;
    SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'search_terms_clean') INTO search_terms_clean_exists;
    
    RAISE NOTICE '';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'INVESTIGATION RESULTS:';
    RAISE NOTICE '====================================';
    
    IF NOT search_terms_exists THEN
        RAISE NOTICE '❌ CRITICAL: search_terms table DOES NOT EXIST (using search_terms_clean instead)';
    ELSE
        RAISE NOTICE '✅ search_terms table exists';
    END IF;
    
    IF NOT notifications_correct THEN
        RAISE NOTICE '❌ CRITICAL: notifications table missing notification_type column';
    ELSE
        RAISE NOTICE '✅ notifications table has correct structure';
    END IF;
    
    IF search_terms_clean_exists AND NOT search_terms_exists THEN
        RAISE NOTICE '⚠️  We have search_terms_clean but code expects search_terms';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE 'The main issues are:';
    RAISE NOTICE '1. Code expects "search_terms" but we created "search_terms_clean"';
    RAISE NOTICE '2. Notifications table structure mismatch';
    RAISE NOTICE '3. Missing database functions';
    RAISE NOTICE '====================================';
END $$;