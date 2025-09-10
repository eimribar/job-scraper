-- ========================================
-- CHECK EXISTING STRUCTURE AND FIX
-- ========================================

-- 1. Check what columns notifications table has
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'notifications'
ORDER BY ordinal_position;

-- 2. Check what's in notifications table
SELECT * FROM notifications LIMIT 5;

-- 3. Update timestamps for dashboard (this should work)
UPDATE raw_jobs 
SET analyzed_date = NOW()
WHERE processed = true 
AND (analyzed_date IS NULL OR DATE(analyzed_date) < CURRENT_DATE)
AND job_id IN (
    SELECT job_id FROM raw_jobs WHERE processed = true ORDER BY job_id DESC LIMIT 100
);

UPDATE identified_companies
SET identified_date = NOW()
WHERE DATE(identified_date) < CURRENT_DATE
AND id IN (
    SELECT id FROM identified_companies ORDER BY id DESC LIMIT 50
);

-- 4. Create search_terms_clean if missing (for automation page)
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

-- 5. Create processing_queue if missing (for automation page)
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

-- 6. Populate search terms
INSERT INTO search_terms_clean (search_term)
SELECT DISTINCT search_term
FROM raw_jobs
WHERE search_term IS NOT NULL AND search_term != ''
ON CONFLICT (search_term) DO NOTHING;

-- 7. Show what we fixed
SELECT 
    'Fixed Items' as category,
    'Jobs with today date' as item,
    COUNT(*) as count
FROM raw_jobs 
WHERE DATE(analyzed_date) = CURRENT_DATE
UNION ALL
SELECT 
    '',
    'Companies with today date',
    COUNT(*)
FROM identified_companies 
WHERE DATE(identified_date) = CURRENT_DATE
UNION ALL
SELECT 
    '',
    'Search terms loaded',
    COUNT(*)
FROM search_terms_clean
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'search_terms_clean')
UNION ALL
SELECT 
    '',
    'Total companies',
    COUNT(*)
FROM identified_companies
UNION ALL
SELECT 
    '',
    'Total processed jobs',
    COUNT(*)
FROM raw_jobs
WHERE processed = true;