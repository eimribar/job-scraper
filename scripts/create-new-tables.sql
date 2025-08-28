-- ================================================
-- STEP 1: CREATE NEW CLEAN DATABASE TABLES
-- Run this SQL directly in Supabase SQL Editor
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

-- Indexes for raw_jobs
CREATE INDEX idx_raw_jobs_processed ON raw_jobs (processed);
CREATE INDEX idx_raw_jobs_company ON raw_jobs (company);
CREATE INDEX idx_raw_jobs_search_term ON raw_jobs (search_term);
CREATE INDEX idx_raw_jobs_scraped_date ON raw_jobs (scraped_date);

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

-- Unique constraint and indexes for identified_companies
ALTER TABLE identified_companies ADD CONSTRAINT unique_company_tool UNIQUE(company_name, tool_detected);
CREATE INDEX idx_identified_companies_tool ON identified_companies (tool_detected);
CREATE INDEX idx_identified_companies_confidence ON identified_companies (confidence);
CREATE INDEX idx_identified_companies_date ON identified_companies (identified_date);

-- Table 4: search_terms_clean (Clean tracking for 37 terms)
CREATE TABLE search_terms_clean (
    search_term VARCHAR(255) PRIMARY KEY,
    last_scraped_date TIMESTAMP,
    jobs_found_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Indexes for search_terms_clean
CREATE INDEX idx_search_terms_clean_active ON search_terms_clean (is_active);
CREATE INDEX idx_search_terms_clean_last_scraped ON search_terms_clean (last_scraped_date);

-- ================================================
-- STEP 2: MIGRATE DATA (Run after tables created)
-- ================================================