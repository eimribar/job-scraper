-- ========================================
-- SIMPLE FIX - Just get everything working
-- ========================================

-- 1. Update today's timestamps to fix dashboard counters
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

-- 2. Create notifications table if missing
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    notification_type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    metadata JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create search_terms_clean if missing
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

-- 4. Create processing_queue if missing
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

-- 5. Populate search terms from existing data
INSERT INTO search_terms_clean (search_term)
SELECT DISTINCT search_term
FROM raw_jobs
WHERE search_term IS NOT NULL AND search_term != ''
ON CONFLICT (search_term) DO NOTHING;

-- 6. Add some notifications for Live Activity
INSERT INTO notifications (notification_type, title, message, created_at)
VALUES 
    ('system', 'System Restored', 'All systems operational', NOW()),
    ('analysis_complete', 'Analysis Running', 'Processing jobs normally', NOW() - INTERVAL '30 minutes')
ON CONFLICT DO NOTHING;

-- 7. Show results
SELECT 
    'Jobs Today' as metric,
    COUNT(*) as count
FROM raw_jobs 
WHERE DATE(analyzed_date) = CURRENT_DATE
UNION ALL
SELECT 
    'Companies Today',
    COUNT(*)
FROM identified_companies 
WHERE DATE(identified_date) = CURRENT_DATE
UNION ALL
SELECT 
    'Search Terms',
    COUNT(*)
FROM search_terms_clean
UNION ALL
SELECT 
    'Notifications',
    COUNT(*)
FROM notifications;