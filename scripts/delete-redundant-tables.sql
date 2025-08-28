-- ================================================
-- DELETE REDUNDANT TABLES SCRIPT
-- Run this in Supabase SQL Editor after migration is verified
-- ================================================

-- SAFETY CHECK: Verify new tables have data
SELECT 
    'SAFETY CHECK - New Tables Status' as check_type,
    '' as table_name,
    0 as record_count
UNION ALL
SELECT 
    'Clean Table' as check_type,
    'raw_jobs' as table_name, 
    COUNT(*) as record_count 
FROM raw_jobs
UNION ALL
SELECT 
    'Clean Table' as check_type,
    'processed_jobs' as table_name, 
    COUNT(*) as record_count 
FROM processed_jobs
UNION ALL
SELECT 
    'Clean Table' as check_type,
    'identified_companies' as table_name, 
    COUNT(*) as record_count 
FROM identified_companies
UNION ALL
SELECT 
    'Clean Table' as check_type,
    'search_terms_clean' as table_name, 
    COUNT(*) as record_count 
FROM search_terms_clean;

-- ================================================
-- DELETE REDUNDANT TABLES
-- ================================================

-- 1. Delete job_queue (replaced by raw_jobs)
DROP TABLE IF EXISTS job_queue CASCADE;

-- 2. Delete companies (replaced by identified_companies) 
DROP TABLE IF EXISTS companies CASCADE;

-- 3. Delete search_terms (replaced by search_terms_clean)
DROP TABLE IF EXISTS search_terms CASCADE;

-- ================================================
-- VERIFICATION: List remaining tables
-- ================================================

SELECT 
    'REMAINING TABLES' as info,
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name NOT LIKE 'pg_%'
    AND table_name NOT LIKE 'sql_%'
ORDER BY table_name;

-- ================================================
-- FINAL VERIFICATION: Check clean tables
-- ================================================

SELECT 'FINAL VERIFICATION - Clean Database Structure' as status;

SELECT 
    table_name,
    COUNT(*) as record_count
FROM (
    SELECT 'raw_jobs' as table_name, COUNT(*) as count FROM raw_jobs
    UNION ALL
    SELECT 'processed_jobs' as table_name, COUNT(*) as count FROM processed_jobs  
    UNION ALL
    SELECT 'identified_companies' as table_name, COUNT(*) as count FROM identified_companies
    UNION ALL
    SELECT 'search_terms_clean' as table_name, COUNT(*) as count FROM search_terms_clean
) t
GROUP BY table_name
ORDER BY table_name;