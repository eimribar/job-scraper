-- Job Processing Updates for Sequential Processing
-- Date: 2025-08-26
-- Purpose: Add constraints and indexes for efficient job deduplication

-- 1. Add unique constraint on job_id in payload (if not exists)
-- Note: We store job_id in the JSONB payload field
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

-- 5. Create a function to check for duplicate job IDs
CREATE OR REPLACE FUNCTION check_job_exists(p_job_id TEXT)
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

-- 6. Add processing statistics table (optional)
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

-- 7. Add index on processing runs
CREATE INDEX IF NOT EXISTS idx_processing_runs_status 
ON processing_runs (status, started_at DESC);

-- 8. Update search_terms table to track processing better
ALTER TABLE search_terms 
ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS last_error TEXT,
ADD COLUMN IF NOT EXISTS last_successful_scrape TIMESTAMPTZ;

-- 9. Add index for search terms processing
CREATE INDEX IF NOT EXISTS idx_search_terms_active_status 
ON search_terms (is_active, processing_status);

-- 10. Add column to track which search term found each company
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS detected_from_search TEXT;

-- 11. Create view for processing dashboard (after adding the column)
CREATE OR REPLACE VIEW v_processing_dashboard AS
SELECT 
    st.search_term,
    st.last_scraped_date,
    st.jobs_found_count,
    st.processing_status,
    COUNT(DISTINCT c.id) as companies_found,
    MAX(c.created_at) as last_company_found
FROM 
    search_terms st
LEFT JOIN 
    companies c ON c.detected_from_search = st.search_term
WHERE 
    st.is_active = true
GROUP BY 
    st.id, st.search_term, st.last_scraped_date, 
    st.jobs_found_count, st.processing_status
ORDER BY 
    st.search_term;

-- 12. Create index for company search term tracking
CREATE INDEX IF NOT EXISTS idx_companies_search_term 
ON companies (detected_from_search);

-- 13. Add trigger to prevent duplicate job insertions
CREATE OR REPLACE FUNCTION prevent_duplicate_jobs()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM job_queue 
        WHERE payload->>'job_id' = NEW.payload->>'job_id'
        AND id != NEW.id
    ) THEN
        RAISE EXCEPTION 'Duplicate job_id: %', NEW.payload->>'job_id';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (drop first if exists)
DROP TRIGGER IF EXISTS check_duplicate_job ON job_queue;
CREATE TRIGGER check_duplicate_job 
BEFORE INSERT ON job_queue
FOR EACH ROW 
EXECUTE FUNCTION prevent_duplicate_jobs();

-- 14. Grant necessary permissions (adjust based on your user setup)
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- 15. Analyze tables for query optimization
ANALYZE job_queue;
ANALYZE search_terms;
ANALYZE companies;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Job processing updates applied successfully';
    RAISE NOTICE 'Indexes created for efficient deduplication';
    RAISE NOTICE 'Processing runs table created for tracking';
END $$;