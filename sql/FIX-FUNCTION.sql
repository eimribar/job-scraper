-- ========================================
-- FIX THE FUNCTION ERROR
-- ========================================

-- Drop the existing function first
DROP FUNCTION IF EXISTS get_next_search_term_to_scrape();

-- Recreate with correct signature
CREATE OR REPLACE FUNCTION get_next_search_term_to_scrape()
RETURNS TABLE (
    id INTEGER,
    search_term TEXT,
    last_scraped_date TIMESTAMP WITH TIME ZONE,
    days_since_scraped NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        st.id,
        st.search_term,
        st.last_scraped_date,
        CASE 
            WHEN st.last_scraped_date IS NULL THEN 999999::NUMERIC
            ELSE EXTRACT(EPOCH FROM (NOW() - st.last_scraped_date))::NUMERIC / 86400
        END as days_since_scraped
    FROM search_terms st
    WHERE st.is_active = true
    AND (
        st.last_scraped_date IS NULL 
        OR st.last_scraped_date < NOW() - INTERVAL '7 days'
    )
    ORDER BY 
        st.last_scraped_date ASC NULLS FIRST
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Verify everything is working
SELECT 
    'Verification' as check_type,
    'Jobs today' as metric,
    COUNT(*) as count
FROM raw_jobs 
WHERE processed = true 
AND DATE(analyzed_date) = CURRENT_DATE
UNION ALL
SELECT 
    '',
    'Companies today',
    COUNT(*)
FROM identified_companies 
WHERE DATE(identified_date) = CURRENT_DATE
UNION ALL
SELECT 
    '',
    'Search terms',
    COUNT(*)
FROM search_terms
UNION ALL
SELECT 
    '',
    'Notifications',
    COUNT(*)
FROM notifications
UNION ALL
SELECT 
    '',
    'Function exists',
    CASE WHEN EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'get_next_search_term_to_scrape') 
         THEN 1 ELSE 0 END;

-- Final message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '====================================';
    RAISE NOTICE '✅ FUNCTION FIXED!';
    RAISE NOTICE '====================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Now refresh your browser:';
    RAISE NOTICE '1. Hard refresh (Cmd+Shift+R)';
    RAISE NOTICE '2. Dashboard should show 1606 jobs today';
    RAISE NOTICE '3. Automation page should show search terms';
    RAISE NOTICE '4. Live Activity should show notifications';
    RAISE NOTICE '====================================';
END $$;