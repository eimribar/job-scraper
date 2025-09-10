-- ========================================
-- MASTER DATABASE MIGRATION - FIXES EVERYTHING
-- Date: 2025-09-09
-- Purpose: Single source of truth for database schema
-- ========================================

-- Start transaction for safety
BEGIN;

-- ========================================
-- STEP 1: CORE TABLES (Keep existing data)
-- ========================================

-- 1.1 Raw Jobs Table (for scraped job data)
CREATE TABLE IF NOT EXISTS public.raw_jobs (
    job_id TEXT PRIMARY KEY,
    platform TEXT NOT NULL,
    company TEXT NOT NULL,
    job_title TEXT NOT NULL,
    location TEXT,
    description TEXT,
    job_url TEXT,
    scraped_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    search_term TEXT,
    processed BOOLEAN DEFAULT false,
    analyzed_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_raw_jobs_processed ON raw_jobs(processed);
CREATE INDEX IF NOT EXISTS idx_raw_jobs_analyzed_date ON raw_jobs(analyzed_date);
CREATE INDEX IF NOT EXISTS idx_raw_jobs_search_term ON raw_jobs(search_term);
CREATE INDEX IF NOT EXISTS idx_raw_jobs_company ON raw_jobs(company);

-- 1.2 Identified Companies Table (for companies using tools)
CREATE TABLE IF NOT EXISTS public.identified_companies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company TEXT NOT NULL,
    tool_detected TEXT NOT NULL,
    signal_type TEXT,
    context TEXT,
    confidence TEXT,
    job_title TEXT,
    job_url TEXT,
    linkedin_url TEXT,
    platform TEXT,
    identified_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    leads_generated BOOLEAN DEFAULT false,
    leads_generated_date TIMESTAMP WITH TIME ZONE,
    leads_generated_by TEXT,
    lead_gen_notes TEXT,
    tier TEXT DEFAULT 'Tier 2',
    sponsor_1 TEXT,
    sponsor_2 TEXT,
    rep_sdr_bdr TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_company_tool'
    ) THEN
        ALTER TABLE identified_companies 
        ADD CONSTRAINT unique_company_tool UNIQUE (company, tool_detected);
    END IF;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_identified_companies_company ON identified_companies(company);
CREATE INDEX IF NOT EXISTS idx_identified_companies_tool ON identified_companies(tool_detected);
CREATE INDEX IF NOT EXISTS idx_identified_companies_tier ON identified_companies(tier);
CREATE INDEX IF NOT EXISTS idx_identified_companies_leads ON identified_companies(leads_generated);
CREATE INDEX IF NOT EXISTS idx_identified_companies_date ON identified_companies(identified_date DESC);

-- 1.3 Search Terms Table (for automation)
CREATE TABLE IF NOT EXISTS public.search_terms (
    id SERIAL PRIMARY KEY,
    search_term TEXT UNIQUE NOT NULL,
    last_scraped_date TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    jobs_found_count INTEGER DEFAULT 0,
    platform_last_scraped TEXT,
    total_jobs_analyzed INTEGER DEFAULT 0,
    total_companies_found INTEGER DEFAULT 0,
    outreach_companies_found INTEGER DEFAULT 0,
    salesloft_companies_found INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_search_terms_active ON search_terms(is_active);
CREATE INDEX IF NOT EXISTS idx_search_terms_last_scraped ON search_terms(last_scraped_date);

-- 1.4 Tier One Companies Table
CREATE TABLE IF NOT EXISTS public.tier_one_companies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_name TEXT UNIQUE NOT NULL,
    industry TEXT,
    employee_count TEXT,
    revenue_range TEXT,
    headquarters TEXT,
    website TEXT,
    linkedin_url TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tier_one_companies_name ON tier_one_companies(company_name);

-- 1.5 Processing Queue Table
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

CREATE INDEX IF NOT EXISTS idx_processing_queue_status ON processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_processing_queue_priority ON processing_queue(priority DESC);

-- 1.6 Scraping Runs Table (for tracking automation)
CREATE TABLE IF NOT EXISTS public.scraping_runs (
    id SERIAL PRIMARY KEY,
    search_term_id INTEGER REFERENCES search_terms(id),
    search_term TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    jobs_scraped INTEGER DEFAULT 0,
    jobs_analyzed INTEGER DEFAULT 0,
    new_companies_found INTEGER DEFAULT 0,
    outreach_companies INTEGER DEFAULT 0,
    salesloft_companies INTEGER DEFAULT 0,
    error_message TEXT,
    processing_time_seconds INTEGER,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_scraping_runs_status ON scraping_runs(status);
CREATE INDEX IF NOT EXISTS idx_scraping_runs_started ON scraping_runs(started_at DESC);

-- 1.7 Notifications Table (for live activity)
CREATE TABLE IF NOT EXISTS public.notifications (
    id SERIAL PRIMARY KEY,
    type TEXT NOT NULL, -- 'scraping_started', 'analysis_complete', etc.
    title TEXT NOT NULL,
    message TEXT,
    metadata JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    is_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

-- 1.8 Processed Jobs Table (tracking table)
CREATE TABLE IF NOT EXISTS public.processed_jobs (
    job_id TEXT PRIMARY KEY,
    analyzed_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- STEP 2: DATABASE FUNCTIONS
-- ========================================

-- Function to get next search term to scrape
CREATE OR REPLACE FUNCTION get_next_search_term_to_scrape()
RETURNS TABLE (
    id INTEGER,
    search_term TEXT,
    last_scraped_date TIMESTAMP WITH TIME ZONE,
    days_since_scraped NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        st.id,
        st.search_term,
        st.last_scraped_date,
        CASE 
            WHEN st.last_scraped_date IS NULL THEN 999999::NUMERIC
            ELSE EXTRACT(EPOCH FROM (NOW() - st.last_scraped_date))::NUMERIC / 86400
        END as days_since_scraped
    FROM search_terms st
    WHERE st.is_active = true
    AND (
        st.last_scraped_date IS NULL 
        OR st.last_scraped_date < NOW() - INTERVAL '7 days'
    )
    ORDER BY 
        st.last_scraped_date ASC NULLS FIRST
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to update search term stats
CREATE OR REPLACE FUNCTION update_search_term_stats(
    p_search_term TEXT,
    p_jobs_found INTEGER,
    p_companies_found INTEGER DEFAULT 0,
    p_outreach INTEGER DEFAULT 0,
    p_salesloft INTEGER DEFAULT 0
)
RETURNS void AS $$
BEGIN
    UPDATE search_terms
    SET 
        last_scraped_date = NOW(),
        jobs_found_count = p_jobs_found,
        total_companies_found = total_companies_found + p_companies_found,
        outreach_companies_found = outreach_companies_found + p_outreach,
        salesloft_companies_found = salesloft_companies_found + p_salesloft,
        updated_at = NOW()
    WHERE search_term = p_search_term;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- STEP 3: DATA MIGRATIONS & FIXES
-- ========================================

-- 3.1 Ensure all search terms exist (from raw_jobs)
INSERT INTO search_terms (search_term, is_active)
SELECT DISTINCT 
    search_term,
    true
FROM raw_jobs
WHERE search_term IS NOT NULL 
AND search_term != ''
ON CONFLICT (search_term) DO NOTHING;

-- 3.2 Update last_scraped_date based on actual data
UPDATE search_terms st
SET 
    last_scraped_date = subquery.max_date,
    jobs_found_count = subquery.job_count
FROM (
    SELECT 
        search_term,
        MAX(scraped_date) as max_date,
        COUNT(*) as job_count
    FROM raw_jobs
    WHERE search_term IS NOT NULL
    GROUP BY search_term
) subquery
WHERE st.search_term = subquery.search_term;

-- 3.3 Fix any NULL analyzed_date for processed jobs
UPDATE raw_jobs 
SET analyzed_date = scraped_date 
WHERE processed = true 
AND analyzed_date IS NULL;

-- 3.4 Create some recent notifications for Live Activity
INSERT INTO notifications (type, title, message, metadata)
SELECT 
    'company_discovered' as type,
    'New Company: ' || company as title,
    'Identified using ' || tool_detected as message,
    jsonb_build_object(
        'company', company,
        'tool', tool_detected
    ) as metadata
FROM identified_companies
WHERE identified_date > NOW() - INTERVAL '24 hours'
ORDER BY identified_date DESC
LIMIT 10
ON CONFLICT DO NOTHING;

-- 3.5 Mark Tier 1 companies in identified_companies
UPDATE identified_companies ic
SET tier = 'Tier 1'
FROM tier_one_companies t1
WHERE LOWER(ic.company) = LOWER(t1.company_name)
OR ic.company ILIKE '%' || t1.company_name || '%'
OR t1.company_name ILIKE '%' || ic.company || '%';

-- ========================================
-- STEP 4: CREATE VIEWS FOR EASIER ACCESS
-- ========================================

-- View for company tier overview
CREATE OR REPLACE VIEW company_tier_overview AS
SELECT 
    t1.company_name,
    t1.industry,
    t1.employee_count,
    ic.tool_detected,
    ic.signal_type,
    ic.confidence,
    ic.identified_date,
    ic.leads_generated,
    CASE 
        WHEN ic.id IS NOT NULL THEN 'Identified'
        ELSE 'Not Identified Yet'
    END as status
FROM tier_one_companies t1
LEFT JOIN identified_companies ic 
    ON LOWER(t1.company_name) = LOWER(ic.company)
    AND ic.tier = 'Tier 1'
ORDER BY t1.company_name;

-- View for automation dashboard
CREATE OR REPLACE VIEW automation_dashboard AS
SELECT 
    (SELECT COUNT(*) FROM raw_jobs WHERE processed = false) as unprocessed_jobs,
    (SELECT COUNT(*) FROM raw_jobs WHERE processed = true AND DATE(analyzed_date) = CURRENT_DATE) as jobs_today,
    (SELECT COUNT(*) FROM identified_companies WHERE DATE(identified_date) = CURRENT_DATE) as companies_today,
    (SELECT COUNT(*) FROM search_terms WHERE is_active = true AND (last_scraped_date IS NULL OR last_scraped_date < NOW() - INTERVAL '7 days')) as overdue_terms,
    (SELECT COUNT(*) FROM scraping_runs WHERE status = 'scraping') as active_scraping,
    (SELECT COUNT(*) FROM notifications WHERE is_read = false) as unread_notifications;

-- ========================================
-- STEP 5: CLEAN UP OLD/DUPLICATE TABLES
-- ========================================

-- Drop tables that shouldn't exist (from bad migrations)
DROP TABLE IF EXISTS search_terms_clean CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS user_invitations CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;

-- ========================================
-- STEP 6: FINAL VERIFICATION
-- ========================================

DO $$
DECLARE
    v_raw_jobs_count INTEGER;
    v_companies_count INTEGER;
    v_search_terms_count INTEGER;
    v_tier1_count INTEGER;
    v_unprocessed_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_raw_jobs_count FROM raw_jobs;
    SELECT COUNT(*) INTO v_companies_count FROM identified_companies;
    SELECT COUNT(*) INTO v_search_terms_count FROM search_terms;
    SELECT COUNT(*) INTO v_tier1_count FROM tier_one_companies;
    SELECT COUNT(*) INTO v_unprocessed_count FROM raw_jobs WHERE processed = false;
    
    RAISE NOTICE '';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'MASTER MIGRATION COMPLETE!';
    RAISE NOTICE '====================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Database Statistics:';
    RAISE NOTICE '  Total Jobs: %', v_raw_jobs_count;
    RAISE NOTICE '  Unprocessed Jobs: %', v_unprocessed_count;
    RAISE NOTICE '  Companies Identified: %', v_companies_count;
    RAISE NOTICE '  Search Terms: %', v_search_terms_count;
    RAISE NOTICE '  Tier 1 Companies: %', v_tier1_count;
    RAISE NOTICE '';
    RAISE NOTICE 'All tables created/verified ✅';
    RAISE NOTICE 'All indexes created ✅';
    RAISE NOTICE 'All functions created ✅';
    RAISE NOTICE 'All views created ✅';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '1. Run this in Supabase SQL Editor';
    RAISE NOTICE '2. Restart the application';
    RAISE NOTICE '3. Trigger manual processing of backlog';
    RAISE NOTICE '====================================';
END $$;

-- Commit the transaction
COMMIT;