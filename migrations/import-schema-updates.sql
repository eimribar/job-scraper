-- ============================================
-- Schema Updates for Google Sheets Import
-- ============================================

-- ============================================
-- SEARCH TERMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS search_terms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  search_term TEXT UNIQUE NOT NULL,
  last_scraped_date TIMESTAMPTZ,
  jobs_found_count INTEGER DEFAULT 0,
  platform_last_scraped TEXT,
  
  -- Scheduling
  scrape_frequency INTERVAL DEFAULT '7 days',
  next_scrape_due TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Tracking
  total_scrapes INTEGER DEFAULT 0,
  total_jobs_found INTEGER DEFAULT 0,
  avg_jobs_per_scrape NUMERIC(10,2) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add computed column for next scrape due
UPDATE search_terms 
SET next_scrape_due = COALESCE(last_scraped_date, NOW()) + scrape_frequency;

-- Index for scheduling
CREATE INDEX IF NOT EXISTS idx_search_terms_next_due ON search_terms(next_scrape_due) WHERE is_active = true;

-- ============================================
-- PROCESSED JOBS TABLE (for deduplication)
-- ============================================
CREATE TABLE IF NOT EXISTS processed_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id TEXT UNIQUE NOT NULL,
  platform TEXT,
  company TEXT,
  processed_date TIMESTAMPTZ DEFAULT NOW(),
  
  -- Link to identified company if found
  company_id UUID REFERENCES companies(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_jobs_id ON processed_jobs(job_id);

-- ============================================
-- ENHANCE COMPANIES TABLE
-- ============================================

-- Add new columns to companies table if they don't exist
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS signal_type TEXT,
ADD COLUMN IF NOT EXISTS context TEXT,
ADD COLUMN IF NOT EXISTS requirement_level TEXT CHECK (requirement_level IN ('required', 'preferred', 'nice-to-have', 'mentioned')),
ADD COLUMN IF NOT EXISTS job_title TEXT,
ADD COLUMN IF NOT EXISTS job_url TEXT,
ADD COLUMN IF NOT EXISTS platform TEXT CHECK (platform IN ('Indeed', 'LinkedIn', 'Both', 'Other')),
ADD COLUMN IF NOT EXISTS identified_date TIMESTAMPTZ,

-- BDR enrichment fields
ADD COLUMN IF NOT EXISTS leads_uploaded BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS tier_2_leads_uploaded TEXT,
ADD COLUMN IF NOT EXISTS sponsor_1_name TEXT,
ADD COLUMN IF NOT EXISTS sponsor_1_linkedin_url TEXT,
ADD COLUMN IF NOT EXISTS sponsor_2_name TEXT,
ADD COLUMN IF NOT EXISTS sponsor_2_linkedin_url TEXT,
ADD COLUMN IF NOT EXISTS rep_name TEXT,
ADD COLUMN IF NOT EXISTS rep_linkedin_url TEXT,
ADD COLUMN IF NOT EXISTS dashboard_tags TEXT[],
ADD COLUMN IF NOT EXISTS status TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,

-- Import tracking
ADD COLUMN IF NOT EXISTS import_source TEXT DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS import_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_manual_update TIMESTAMPTZ;

-- ============================================
-- RAW JOBS TABLE (optional, for historical data)
-- ============================================
CREATE TABLE IF NOT EXISTS raw_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id TEXT UNIQUE NOT NULL,
  platform TEXT,
  company TEXT,
  job_title TEXT,
  location TEXT,
  description TEXT,
  url TEXT,
  scraped_date TIMESTAMPTZ,
  search_term TEXT,
  
  -- Processing status
  processed BOOLEAN DEFAULT FALSE,
  processed_date TIMESTAMPTZ,
  
  -- Analysis results
  tool_detected TEXT,
  confidence TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_jobs_company ON raw_jobs(company);
CREATE INDEX IF NOT EXISTS idx_raw_jobs_processed ON raw_jobs(processed);

-- ============================================
-- IMPORT HISTORY TABLE (track all imports)
-- ============================================
CREATE TABLE IF NOT EXISTS import_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  import_type TEXT NOT NULL CHECK (import_type IN ('companies', 'search_terms', 'processed_ids', 'raw_jobs', 'bulk')),
  file_name TEXT,
  
  -- Statistics
  total_rows INTEGER DEFAULT 0,
  imported_rows INTEGER DEFAULT 0,
  updated_rows INTEGER DEFAULT 0,
  skipped_rows INTEGER DEFAULT 0,
  error_rows INTEGER DEFAULT 0,
  
  -- Details
  errors JSONB,
  summary JSONB,
  
  -- User tracking
  imported_by TEXT,
  import_date TIMESTAMPTZ DEFAULT NOW(),
  duration_ms INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- VIEWS FOR REPORTING
-- ============================================

-- View for companies with full enrichment
CREATE OR REPLACE VIEW companies_enriched AS
SELECT 
  c.*,
  CASE 
    WHEN c.uses_outreach AND c.uses_salesloft THEN 'Both'
    WHEN c.uses_outreach THEN 'Outreach.io'
    WHEN c.uses_salesloft THEN 'SalesLoft'
    ELSE 'None'
  END as tool_display,
  CASE 
    WHEN c.sponsor_1_name IS NOT NULL OR c.sponsor_2_name IS NOT NULL THEN TRUE
    ELSE FALSE
  END as has_sponsors,
  CASE 
    WHEN c.rep_name IS NOT NULL THEN TRUE
    ELSE FALSE
  END as has_rep_assigned
FROM companies c;

-- View for search term performance
CREATE OR REPLACE VIEW search_term_performance AS
SELECT 
  st.*,
  CASE 
    WHEN st.last_scraped_date IS NULL THEN 'Never'
    WHEN st.next_scrape_due < NOW() THEN 'Overdue'
    WHEN st.next_scrape_due < NOW() + INTERVAL '1 day' THEN 'Due Soon'
    ELSE 'Scheduled'
  END as scrape_status,
  EXTRACT(DAY FROM NOW() - st.last_scraped_date) as days_since_scrape
FROM search_terms st
WHERE is_active = TRUE
ORDER BY st.next_scrape_due;

-- ============================================
-- FUNCTIONS FOR IMPORT
-- ============================================

-- Function to parse tool detection from various formats
CREATE OR REPLACE FUNCTION parse_tool_detection(tool_text TEXT) 
RETURNS TABLE(uses_outreach BOOLEAN, uses_salesloft BOOLEAN) AS $$
BEGIN
  tool_text := LOWER(TRIM(tool_text));
  
  RETURN QUERY SELECT
    (tool_text LIKE '%outreach%') AS uses_outreach,
    (tool_text LIKE '%salesloft%' OR tool_text LIKE '%sales loft%') AS uses_salesloft;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate next scrape date
CREATE OR REPLACE FUNCTION update_next_scrape_date() RETURNS TRIGGER AS $$
BEGIN
  NEW.next_scrape_due := COALESCE(NEW.last_scraped_date, NOW()) + NEW.scrape_frequency;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER search_terms_next_scrape
  BEFORE INSERT OR UPDATE OF last_scraped_date, scrape_frequency ON search_terms
  FOR EACH ROW EXECUTE FUNCTION update_next_scrape_date();

-- ============================================
-- INITIAL DATA UPDATE
-- ============================================

-- Update scraping_intelligence to match search_terms format
-- (We'll migrate data from scraping_intelligence to search_terms)
INSERT INTO search_terms (search_term, is_active, scrape_frequency)
SELECT search_term, is_active, scrape_interval
FROM scraping_intelligence
ON CONFLICT (search_term) DO UPDATE SET
  is_active = EXCLUDED.is_active,
  scrape_frequency = EXCLUDED.scrape_frequency;