-- ================================================
-- FINAL DATABASE CREATION SCRIPT
-- Copy and paste this ENTIRE script into Supabase SQL Editor
-- ================================================

-- Drop existing incomplete tables if they exist
DROP TABLE IF EXISTS raw_jobs CASCADE;
DROP TABLE IF EXISTS processed_jobs CASCADE;
DROP TABLE IF EXISTS identified_companies CASCADE;
DROP TABLE IF EXISTS search_terms_clean CASCADE;

-- ================================================
-- CREATE ALL 4 CLEAN TABLES
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
    processed_date TIMESTAMP
);

-- Table 2: processed_jobs (Simple tracking table)
CREATE TABLE processed_jobs (
    job_id VARCHAR(255) PRIMARY KEY,
    processed_date TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Table 3: identified_companies (Only companies using tools)
CREATE TABLE identified_companies (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    tool_detected VARCHAR(50) NOT NULL,
    signal_type VARCHAR(100),
    context TEXT,
    confidence VARCHAR(20),
    job_title VARCHAR(255),
    job_url TEXT,
    linkedin_url TEXT,
    platform VARCHAR(50) DEFAULT 'LinkedIn',
    identified_date TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Table 4: search_terms_clean (Clean tracking for 37 terms)
CREATE TABLE search_terms_clean (
    search_term VARCHAR(255) PRIMARY KEY,
    last_scraped_date TIMESTAMP,
    jobs_found_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- ================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ================================================

-- raw_jobs indexes
CREATE INDEX idx_raw_jobs_processed ON raw_jobs (processed);
CREATE INDEX idx_raw_jobs_company ON raw_jobs (company);
CREATE INDEX idx_raw_jobs_search_term ON raw_jobs (search_term);
CREATE INDEX idx_raw_jobs_scraped_date ON raw_jobs (scraped_date);

-- identified_companies indexes
CREATE INDEX idx_identified_companies_tool ON identified_companies (tool_detected);
CREATE INDEX idx_identified_companies_confidence ON identified_companies (confidence);
CREATE INDEX idx_identified_companies_date ON identified_companies (identified_date);

-- search_terms_clean indexes
CREATE INDEX idx_search_terms_clean_active ON search_terms_clean (is_active);
CREATE INDEX idx_search_terms_clean_last_scraped ON search_terms_clean (last_scraped_date);

-- ================================================
-- ADD CONSTRAINTS
-- ================================================

-- Unique constraint for identified_companies (prevent duplicates)
ALTER TABLE identified_companies 
ADD CONSTRAINT unique_company_tool UNIQUE(company_name, tool_detected);

-- Check constraints
ALTER TABLE identified_companies 
ADD CONSTRAINT check_tool_detected 
CHECK (tool_detected IN ('Outreach.io', 'SalesLoft', 'Both'));

ALTER TABLE identified_companies 
ADD CONSTRAINT check_confidence 
CHECK (confidence IN ('high', 'medium', 'low'));

-- ================================================
-- MIGRATE DATA FROM OLD TABLES
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
    COALESCE(payload->>'location', '') as location,
    COALESCE(payload->>'description', '') as description,
    COALESCE(payload->>'job_url', '') as job_url,
    COALESCE((payload->>'scraped_date')::timestamp, created_at) as scraped_date,
    COALESCE(payload->>'search_term', '') as search_term,
    CASE WHEN status = 'completed' THEN TRUE ELSE FALSE END as processed,
    completed_at as processed_date
FROM job_queue
WHERE payload->>'job_id' IS NOT NULL 
    AND payload->>'company' IS NOT NULL 
    AND payload->>'job_title' IS NOT NULL
ON CONFLICT (job_id) DO NOTHING;

-- Migrate processed jobs
INSERT INTO processed_jobs (job_id, processed_date)
SELECT 
    job_id,
    COALESCE(processed_date, NOW()) as processed_date
FROM raw_jobs
WHERE processed = TRUE
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
SELECT DISTINCT
    name as company_name,
    CASE 
        WHEN uses_both = TRUE THEN 'Both'
        WHEN uses_outreach = TRUE THEN 'Outreach.io'
        WHEN uses_salesloft = TRUE THEN 'SalesLoft'
    END as tool_detected,
    COALESCE(signal_type, 'explicit_mention') as signal_type,
    COALESCE(context, '') as context,
    CASE 
        WHEN detection_confidence = 'high' THEN 'high'
        WHEN detection_confidence = 'low' THEN 'low'
        ELSE 'medium'
    END as confidence,
    COALESCE(job_title, '') as job_title,
    COALESCE(job_url, '') as job_url,
    COALESCE(linkedin_url, '') as linkedin_url,
    COALESCE(platform, 'LinkedIn') as platform,
    COALESCE(identified_date, created_at, NOW()) as identified_date
FROM companies
WHERE (uses_outreach = TRUE OR uses_salesloft = TRUE OR uses_both = TRUE)
    AND name IS NOT NULL
    AND name != ''
ON CONFLICT (company_name, tool_detected) DO NOTHING;

-- Migrate search_terms
INSERT INTO search_terms_clean (search_term, last_scraped_date, jobs_found_count, is_active)
SELECT 
    search_term,
    last_scraped_date,
    COALESCE(jobs_found_count, 0) as jobs_found_count,
    COALESCE(is_active, TRUE) as is_active
FROM search_terms
ON CONFLICT (search_term) DO NOTHING;

-- ================================================
-- VERIFICATION QUERY
-- ================================================

SELECT 
    'raw_jobs' as table_name, 
    COUNT(*) as record_count,
    COUNT(*) FILTER (WHERE processed = FALSE) as unprocessed_count
FROM raw_jobs
UNION ALL
SELECT 
    'processed_jobs' as table_name, 
    COUNT(*) as record_count,
    NULL as unprocessed_count
FROM processed_jobs
UNION ALL  
SELECT 
    'identified_companies' as table_name, 
    COUNT(*) as record_count,
    NULL as unprocessed_count
FROM identified_companies
UNION ALL
SELECT 
    'search_terms_clean' as table_name, 
    COUNT(*) as record_count,
    COUNT(*) FILTER (WHERE is_active = TRUE) as unprocessed_count
FROM search_terms_clean;

-- ================================================
-- SUCCESS MESSAGE
-- ================================================

SELECT 'DATABASE MIGRATION COMPLETED SUCCESSFULLY!' as status;