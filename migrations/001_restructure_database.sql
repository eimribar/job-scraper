-- ================================================
-- DATABASE RESTRUCTURING MIGRATION
-- From messy 3-table JSONB structure to clean 4-table architecture
-- ================================================

-- First, back up existing data (run these manually first)
-- CREATE TABLE job_queue_backup AS SELECT * FROM job_queue;
-- CREATE TABLE companies_backup AS SELECT * FROM companies;
-- CREATE TABLE search_terms_backup AS SELECT * FROM search_terms;

-- ================================================
-- STEP 1: CREATE NEW CLEAN TABLES
-- ================================================

-- Table 1: raw_jobs (All scraped job postings)
CREATE TABLE raw_jobs (
    job_id VARCHAR(255) PRIMARY KEY,
    platform VARCHAR(50) NOT NULL DEFAULT 'LinkedIn',
    company VARCHAR(255) NOT NULL,
    job_title VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    description TEXT,
    job_url TEXT,
    scraped_date TIMESTAMP NOT NULL DEFAULT NOW(),
    search_term VARCHAR(255) NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    processed_date TIMESTAMP,
    
    -- Indexes for performance
    INDEX idx_raw_jobs_processed (processed),
    INDEX idx_raw_jobs_company (company),
    INDEX idx_raw_jobs_search_term (search_term),
    INDEX idx_raw_jobs_scraped_date (scraped_date)
);

-- Table 2: processed_jobs (Simple tracking table)
CREATE TABLE processed_jobs (
    job_id VARCHAR(255) PRIMARY KEY,
    processed_date TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Foreign key constraint
    FOREIGN KEY (job_id) REFERENCES raw_jobs(job_id) ON DELETE CASCADE
);

-- Table 3: identified_companies (Only companies using tools)
CREATE TABLE identified_companies (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    tool_detected VARCHAR(50) NOT NULL CHECK (tool_detected IN ('Outreach.io', 'SalesLoft', 'Both')),
    signal_type VARCHAR(100),
    context TEXT,
    confidence VARCHAR(20) CHECK (confidence IN ('high', 'medium', 'low')),
    job_title VARCHAR(255),
    job_url TEXT,
    linkedin_url TEXT,  -- For BDR manual population
    platform VARCHAR(50) DEFAULT 'LinkedIn',
    identified_date TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Prevent duplicate detections for same company/tool
    UNIQUE(company_name, tool_detected),
    
    -- Indexes
    INDEX idx_identified_companies_tool (tool_detected),
    INDEX idx_identified_companies_confidence (confidence),
    INDEX idx_identified_companies_date (identified_date)
);

-- Table 4: search_terms_new (Clean tracking for 37 terms)
CREATE TABLE search_terms_new (
    search_term VARCHAR(255) PRIMARY KEY,
    last_scraped_date TIMESTAMP,
    jobs_found_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Index for active terms
    INDEX idx_search_terms_active (is_active),
    INDEX idx_search_terms_last_scraped (last_scraped_date)
);

-- ================================================
-- STEP 2: MIGRATE EXISTING DATA
-- ================================================

-- Migrate job_queue -> raw_jobs
INSERT INTO raw_jobs (
    job_id,
    platform,
    company,
    job_title,
    location,
    description,
    job_url,
    scraped_date,
    search_term,
    processed,
    processed_date
)
SELECT 
    payload->>'job_id' as job_id,
    COALESCE(payload->>'platform', 'LinkedIn') as platform,
    payload->>'company' as company,
    payload->>'job_title' as job_title,
    payload->>'location' as location,
    payload->>'description' as description,
    payload->>'job_url' as job_url,
    COALESCE(
        (payload->>'scraped_date')::timestamp,
        created_at
    ) as scraped_date,
    payload->>'search_term' as search_term,
    CASE 
        WHEN status = 'completed' THEN TRUE 
        ELSE FALSE 
    END as processed,
    completed_at as processed_date
FROM job_queue
WHERE payload->>'job_id' IS NOT NULL  -- Skip malformed records
ON CONFLICT (job_id) DO NOTHING;      -- Skip duplicates

-- Migrate processed jobs
INSERT INTO processed_jobs (job_id, processed_date)
SELECT 
    payload->>'job_id' as job_id,
    COALESCE(completed_at, NOW()) as processed_date
FROM job_queue
WHERE status = 'completed' 
    AND payload->>'job_id' IS NOT NULL
ON CONFLICT (job_id) DO NOTHING;

-- Migrate companies -> identified_companies (only tool users)
INSERT INTO identified_companies (
    company_name,
    tool_detected,
    signal_type,
    context,
    confidence,
    job_title,
    job_url,
    linkedin_url,
    platform,
    identified_date
)
SELECT DISTINCT ON (name, 
    CASE 
        WHEN uses_both = TRUE THEN 'Both'
        WHEN uses_outreach = TRUE THEN 'Outreach.io'
        WHEN uses_salesloft = TRUE THEN 'SalesLoft'
    END
)
    name as company_name,
    CASE 
        WHEN uses_both = TRUE THEN 'Both'
        WHEN uses_outreach = TRUE THEN 'Outreach.io'
        WHEN uses_salesloft = TRUE THEN 'SalesLoft'
    END as tool_detected,
    COALESCE(signal_type, 'explicit_mention') as signal_type,
    context,
    COALESCE(detection_confidence, 'medium') as confidence,
    job_title,
    job_url,
    linkedin_url,
    COALESCE(platform, 'LinkedIn') as platform,
    COALESCE(identified_date, created_at, NOW()) as identified_date
FROM companies
WHERE (uses_outreach = TRUE OR uses_salesloft = TRUE OR uses_both = TRUE)
    AND name IS NOT NULL
ON CONFLICT (company_name, tool_detected) DO UPDATE SET
    context = EXCLUDED.context,
    confidence = EXCLUDED.confidence,
    job_title = EXCLUDED.job_title,
    job_url = EXCLUDED.job_url,
    identified_date = EXCLUDED.identified_date;

-- Migrate search_terms (keep only essential data)
INSERT INTO search_terms_new (search_term, last_scraped_date, jobs_found_count, is_active)
SELECT 
    search_term,
    last_scraped_date,
    COALESCE(jobs_found_count, 0) as jobs_found_count,
    COALESCE(is_active, TRUE) as is_active
FROM search_terms
ON CONFLICT (search_term) DO UPDATE SET
    last_scraped_date = EXCLUDED.last_scraped_date,
    jobs_found_count = EXCLUDED.jobs_found_count,
    is_active = EXCLUDED.is_active;

-- ================================================
-- STEP 3: VERIFICATION QUERIES
-- ================================================

-- Check data migration results
SELECT 'raw_jobs' as table_name, COUNT(*) as record_count FROM raw_jobs
UNION ALL
SELECT 'processed_jobs' as table_name, COUNT(*) as record_count FROM processed_jobs
UNION ALL  
SELECT 'identified_companies' as table_name, COUNT(*) as record_count FROM identified_companies
UNION ALL
SELECT 'search_terms_new' as table_name, COUNT(*) as record_count FROM search_terms_new;

-- Verify data integrity
SELECT 
    'Unprocessed jobs' as check_name,
    COUNT(*) as count
FROM raw_jobs 
WHERE processed = FALSE
UNION ALL
SELECT 
    'Tool detections',
    COUNT(*)
FROM identified_companies
UNION ALL
SELECT 
    'Active search terms',
    COUNT(*)
FROM search_terms_new
WHERE is_active = TRUE;

-- ================================================
-- STEP 4: CLEANUP (Run after verification)
-- ================================================

-- These commands should be run manually after verifying migration
-- DROP TABLE IF EXISTS job_queue CASCADE;
-- DROP TABLE IF EXISTS companies CASCADE;  
-- DROP TABLE IF EXISTS search_terms CASCADE;

-- Rename new search_terms table
-- DROP TABLE IF EXISTS search_terms_new CASCADE;
-- ALTER TABLE search_terms_new RENAME TO search_terms;

-- ================================================
-- MIGRATION COMPLETE
-- ================================================