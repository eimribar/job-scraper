-- Essential Job Processing Updates for Sequential Processing
-- Date: 2025-08-26
-- Purpose: Add constraints and indexes for efficient job deduplication

-- 1. Add unique constraint on job_id in payload
CREATE INDEX IF NOT EXISTS idx_job_queue_job_id 
ON job_queue ((payload->>'job_id'));

-- 2. Add index for faster status lookups
CREATE INDEX IF NOT EXISTS idx_job_queue_status 
ON job_queue (status);

-- 3. Add index for faster date-based queries
CREATE INDEX IF NOT EXISTS idx_job_queue_created_at 
ON job_queue (created_at);

-- 4. Add composite index for efficient deduplication queries
CREATE INDEX IF NOT EXISTS idx_job_queue_status_job_id 
ON job_queue (status, (payload->>'job_id'));

-- 5. Add processing statistics table (optional but useful)
CREATE TABLE IF NOT EXISTS processing_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_type TEXT NOT NULL, -- 'manual' or 'scheduled'
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT DEFAULT 'running', -- 'running', 'completed', 'failed'
    search_terms_processed INTEGER DEFAULT 0,
    total_jobs_scraped INTEGER DEFAULT 0,
    total_jobs_analyzed INTEGER DEFAULT 0,
    total_new_companies INTEGER DEFAULT 0,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Add index on processing runs
CREATE INDEX IF NOT EXISTS idx_processing_runs_status 
ON processing_runs (status, started_at DESC);

-- 7. Update search_terms table if columns don't exist
ALTER TABLE search_terms 
ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending';

ALTER TABLE search_terms 
ADD COLUMN IF NOT EXISTS last_error TEXT;

ALTER TABLE search_terms 
ADD COLUMN IF NOT EXISTS last_successful_scrape TIMESTAMPTZ;

-- 8. Add index for search terms processing
CREATE INDEX IF NOT EXISTS idx_search_terms_active 
ON search_terms (is_active);

-- 9. Add column to track which search term found each company
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS detected_from_search TEXT;

-- 10. Create index for company search term tracking
CREATE INDEX IF NOT EXISTS idx_companies_search_term 
ON companies (detected_from_search);

-- 11. Create a simple function to check for duplicate job IDs
CREATE OR REPLACE FUNCTION job_exists(p_job_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM job_queue 
        WHERE payload->>'job_id' = p_job_id
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql;

-- 12. Analyze tables for query optimization
ANALYZE job_queue;
ANALYZE search_terms;
ANALYZE companies;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Essential job processing updates applied successfully';
    RAISE NOTICE 'Indexes created for efficient deduplication';
    RAISE NOTICE 'Ready for sequential job processing';
END $$;