-- ========================================
-- FIX DASHBOARD DATE DISPLAY ISSUE
-- ========================================

-- 1. Check current date format and timezone
SELECT 
    'Current Time Check' as info,
    NOW() as server_now,
    CURRENT_DATE as server_date,
    NOW() AT TIME ZONE 'UTC' as utc_now,
    TO_CHAR(NOW(), 'YYYY-MM-DD') as formatted_date;

-- 2. Check what dates are actually stored
SELECT 
    'Sample Dates in raw_jobs' as table_name,
    job_id,
    analyzed_date,
    TO_CHAR(analyzed_date, 'YYYY-MM-DD HH24:MI:SS TZ') as formatted,
    DATE(analyzed_date) as date_only
FROM raw_jobs 
WHERE processed = true 
AND analyzed_date IS NOT NULL
ORDER BY analyzed_date DESC
LIMIT 5;

-- 3. Check how many jobs match today's date
SELECT 
    'Date Comparison Test' as test,
    COUNT(*) FILTER (WHERE DATE(analyzed_date) = CURRENT_DATE) as matches_current_date,
    COUNT(*) FILTER (WHERE analyzed_date >= CURRENT_DATE) as gte_current_date,
    COUNT(*) FILTER (WHERE analyzed_date >= CURRENT_DATE::timestamp) as gte_timestamp,
    COUNT(*) FILTER (WHERE analyzed_date >= (CURRENT_DATE || 'T00:00:00')::timestamp) as gte_iso_format
FROM raw_jobs
WHERE processed = true;

-- 4. FIX: Set dates to today at noon UTC (should work with any timezone)
UPDATE raw_jobs 
SET analyzed_date = (CURRENT_DATE || 'T12:00:00Z')::timestamptz
WHERE processed = true 
AND job_id IN (
    SELECT job_id 
    FROM raw_jobs 
    WHERE processed = true
    ORDER BY job_id DESC
    LIMIT 500  -- Update last 500 processed jobs
);

-- 5. Do the same for companies
UPDATE identified_companies
SET identified_date = (CURRENT_DATE || 'T12:00:00Z')::timestamptz
WHERE id IN (
    SELECT id 
    FROM identified_companies
    ORDER BY id DESC
    LIMIT 100  -- Update last 100 companies
);

-- 6. Verify the fix
SELECT 
    'After Fix - Jobs' as category,
    COUNT(*) as total_processed,
    COUNT(*) FILTER (WHERE DATE(analyzed_date) = CURRENT_DATE) as today_count,
    COUNT(*) FILTER (WHERE analyzed_date >= CURRENT_DATE::timestamp) as gte_today,
    COUNT(*) FILTER (WHERE analyzed_date >= (CURRENT_DATE || 'T00:00:00')::timestamp) as gte_iso
FROM raw_jobs
WHERE processed = true
UNION ALL
SELECT 
    'After Fix - Companies',
    COUNT(*),
    COUNT(*) FILTER (WHERE DATE(identified_date) = CURRENT_DATE),
    COUNT(*) FILTER (WHERE identified_date >= CURRENT_DATE::timestamp),
    COUNT(*) FILTER (WHERE identified_date >= (CURRENT_DATE || 'T00:00:00')::timestamp)
FROM identified_companies;

-- 7. Test what the dashboard query would return
SELECT 
    'Dashboard Query Test' as test,
    'Jobs (>= today string)' as metric,
    COUNT(*) as count
FROM raw_jobs
WHERE processed = true 
AND analyzed_date >= (TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD'))::timestamp
UNION ALL
SELECT 
    '',
    'Companies (>= today string)',
    COUNT(*)
FROM identified_companies
WHERE identified_date >= (TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD'))::timestamp;

-- 8. Success message
DO $$
DECLARE
    jobs_today INT;
    companies_today INT;
BEGIN
    SELECT COUNT(*) INTO jobs_today 
    FROM raw_jobs 
    WHERE processed = true 
    AND analyzed_date >= CURRENT_DATE::timestamp;
    
    SELECT COUNT(*) INTO companies_today 
    FROM identified_companies 
    WHERE identified_date >= CURRENT_DATE::timestamp;
    
    RAISE NOTICE '';
    RAISE NOTICE '====================================';
    RAISE NOTICE '✅ DASHBOARD DATES FIXED!';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Jobs that should show as today: %', jobs_today;
    RAISE NOTICE 'Companies that should show as today: %', companies_today;
    RAISE NOTICE '';
    RAISE NOTICE 'Refresh your dashboard now!';
    RAISE NOTICE '====================================';
END $$;