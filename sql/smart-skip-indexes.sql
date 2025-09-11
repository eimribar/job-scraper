-- Smart Skip Logic Performance Indexes
-- Created: 2025-01-11
-- Purpose: Optimize queries for 3-month skip logic

-- 1. Index for finding companies by created_at (for age filtering)
-- This helps with queries that filter companies < 3 months old
CREATE INDEX IF NOT EXISTS idx_identified_companies_created_at 
ON identified_companies(created_at);

-- 2. Composite index for company name lookups (case-insensitive)
-- Helps with quick company existence checks
CREATE INDEX IF NOT EXISTS idx_identified_companies_company_lower 
ON identified_companies(LOWER(company));

-- 3. Composite index for company + tool_detected
-- Critical for checking if company+tool combination already exists
CREATE INDEX IF NOT EXISTS idx_identified_companies_company_tool 
ON identified_companies(company, tool_detected);

-- 4. Index for efficient date-based filtering
-- Helps partition companies into recent vs old
CREATE INDEX IF NOT EXISTS idx_identified_companies_created_at_desc 
ON identified_companies(created_at DESC);

-- 5. Ensure unique constraint exists (prevents duplicates)
-- This should already exist but adding for completeness
ALTER TABLE identified_companies 
DROP CONSTRAINT IF EXISTS unique_company_tool;

ALTER TABLE identified_companies
ADD CONSTRAINT unique_company_tool 
UNIQUE (company, tool_detected);

-- 6. Index on raw_jobs for efficient unprocessed job queries
CREATE INDEX IF NOT EXISTS idx_raw_jobs_processed_created 
ON raw_jobs(processed, created_at) 
WHERE processed = false;

-- 7. Index for company name on raw_jobs (for skip checks)
CREATE INDEX IF NOT EXISTS idx_raw_jobs_company_lower 
ON raw_jobs(LOWER(company));

-- Analyze tables to update statistics for query planner
ANALYZE identified_companies;
ANALYZE raw_jobs;

-- Verify indexes were created
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('identified_companies', 'raw_jobs')
ORDER BY tablename, indexname;