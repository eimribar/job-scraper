-- ============================================
-- Bulletproof Sales Tool Detector Schema for Supabase
-- Version 2.0 - Optimized for Supabase
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Drop existing tables if needed (comment out if not doing fresh install)
-- ============================================
-- DROP TABLE IF EXISTS company_duplicates CASCADE;
-- DROP TABLE IF EXISTS metrics CASCADE;
-- DROP TABLE IF EXISTS audit_log CASCADE;
-- DROP TABLE IF EXISTS analysis_cache CASCADE;
-- DROP TABLE IF EXISTS job_queue CASCADE;
-- DROP TABLE IF EXISTS scraping_intelligence CASCADE;
-- DROP TABLE IF EXISTS companies CASCADE;

-- ============================================
-- COMPANIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Core identification
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  domain TEXT,
  
  -- Tool detection results
  uses_outreach BOOLEAN DEFAULT FALSE,
  uses_salesloft BOOLEAN DEFAULT FALSE,
  detection_confidence TEXT CHECK (detection_confidence IN ('high', 'medium', 'low')),
  detection_context TEXT,
  detection_keywords TEXT[],
  
  -- Intelligence metrics
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_verified TIMESTAMPTZ,
  times_seen INTEGER DEFAULT 1,
  signal_strength NUMERIC(3,2) DEFAULT 0.00,
  confidence_score NUMERIC(3,2) DEFAULT 0.00,
  
  -- Company metadata
  industry TEXT,
  company_size TEXT,
  location TEXT,
  linkedin_url TEXT,
  website_url TEXT,
  
  -- Tracking
  last_checked TIMESTAMPTZ DEFAULT NOW(),
  check_frequency INTERVAL DEFAULT '30 days',
  
  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(normalized_name)
);

-- Add computed column for uses_both
ALTER TABLE companies 
ADD COLUMN uses_both BOOLEAN GENERATED ALWAYS AS (uses_outreach AND uses_salesloft) STORED;

-- Add computed column for should_recheck
ALTER TABLE companies 
ADD COLUMN should_recheck BOOLEAN GENERATED ALWAYS AS (last_checked + check_frequency < NOW()) STORED;

-- ============================================
-- SCRAPING INTELLIGENCE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS scraping_intelligence (
  search_term TEXT PRIMARY KEY,
  
  -- Performance metrics
  total_scrapes INTEGER DEFAULT 0,
  total_jobs_found INTEGER DEFAULT 0,
  new_companies_found INTEGER DEFAULT 0,
  yield_rate NUMERIC(4,3) DEFAULT 0.000,
  success_rate NUMERIC(4,3) DEFAULT 1.000,
  
  -- Cost tracking
  total_api_calls INTEGER DEFAULT 0,
  total_cost NUMERIC(10,4) DEFAULT 0.00,
  cost_per_company NUMERIC(10,4) DEFAULT 0.00,
  
  -- Adaptive scheduling
  scrape_interval INTERVAL DEFAULT '24 hours',
  last_scraped TIMESTAMPTZ,
  priority INTEGER DEFAULT 50,
  
  -- Platform metrics
  indeed_success_rate NUMERIC(4,3) DEFAULT 1.000,
  indeed_avg_results INTEGER DEFAULT 0,
  indeed_last_error TIMESTAMPTZ,
  indeed_error_count INTEGER DEFAULT 0,
  
  linkedin_success_rate NUMERIC(4,3) DEFAULT 1.000,
  linkedin_avg_results INTEGER DEFAULT 0,
  linkedin_last_error TIMESTAMPTZ,
  linkedin_error_count INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  paused_until TIMESTAMPTZ,
  paused_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add computed column for next_scrape_due
ALTER TABLE scraping_intelligence 
ADD COLUMN next_scrape_due TIMESTAMPTZ GENERATED ALWAYS AS (
  COALESCE(last_scraped, NOW()) + scrape_interval
) STORED;

-- ============================================
-- JOB QUEUE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS job_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Job identification
  job_type TEXT NOT NULL CHECK (job_type IN ('scrape', 'analyze', 'export', 'revalidate')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  
  -- Priority and scheduling
  priority INTEGER DEFAULT 50,
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  
  -- Job data
  payload JSONB NOT NULL,
  result JSONB,
  error_message TEXT,
  
  -- Retry logic
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  last_retry_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  
  -- Processing tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  processing_time_ms INTEGER,
  
  -- Worker assignment
  worker_id TEXT,
  locked_until TIMESTAMPTZ
);

-- ============================================
-- ANALYSIS CACHE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS analysis_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Cache key
  company_normalized TEXT NOT NULL,
  description_hash TEXT NOT NULL,
  
  -- Cached result
  analysis_result JSONB NOT NULL,
  confidence TEXT NOT NULL,
  tool_detected TEXT,
  
  -- Cache management
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  hit_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(company_normalized, description_hash)
);

-- ============================================
-- AUDIT LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  
  -- Event details
  event_type TEXT NOT NULL,
  event_category TEXT CHECK (event_category IN ('scraping', 'analysis', 'export', 'system', 'error')),
  severity TEXT CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
  
  -- Entity reference
  entity_type TEXT,
  entity_id TEXT,
  
  -- Event data
  event_data JSONB,
  changes JSONB,
  metadata JSONB,
  
  -- Context
  user_id TEXT,
  worker_id TEXT,
  request_id TEXT,
  
  -- Performance
  duration_ms INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- METRICS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Time bucket
  bucket_time TIMESTAMPTZ NOT NULL,
  bucket_interval TEXT DEFAULT '1 hour',
  
  -- Scraping metrics
  jobs_scraped INTEGER DEFAULT 0,
  companies_found INTEGER DEFAULT 0,
  new_companies INTEGER DEFAULT 0,
  duplicates_filtered INTEGER DEFAULT 0,
  
  -- Analysis metrics
  jobs_analyzed INTEGER DEFAULT 0,
  tools_detected INTEGER DEFAULT 0,
  high_confidence_count INTEGER DEFAULT 0,
  cache_hits INTEGER DEFAULT 0,
  
  -- API usage
  apify_calls INTEGER DEFAULT 0,
  openai_calls INTEGER DEFAULT 0,
  openai_tokens_used INTEGER DEFAULT 0,
  
  -- Costs
  apify_cost NUMERIC(10,4) DEFAULT 0.00,
  openai_cost NUMERIC(10,4) DEFAULT 0.00,
  total_cost NUMERIC(10,4) DEFAULT 0.00,
  
  -- Performance
  avg_scrape_time_ms INTEGER,
  avg_analysis_time_ms INTEGER,
  error_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- COMPANY DUPLICATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS company_duplicates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  primary_company_id UUID REFERENCES companies(id),
  duplicate_company_id UUID REFERENCES companies(id),
  
  similarity_score NUMERIC(3,2),
  match_type TEXT CHECK (match_type IN ('exact', 'fuzzy', 'domain', 'manual')),
  
  verified BOOLEAN DEFAULT FALSE,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Companies indexes
CREATE INDEX IF NOT EXISTS idx_companies_normalized ON companies(normalized_name);
CREATE INDEX IF NOT EXISTS idx_companies_tools ON companies(uses_outreach, uses_salesloft);
CREATE INDEX IF NOT EXISTS idx_companies_confidence ON companies(detection_confidence);
CREATE INDEX IF NOT EXISTS idx_companies_signal ON companies(signal_strength DESC);
CREATE INDEX IF NOT EXISTS idx_companies_should_recheck ON companies(should_recheck) WHERE should_recheck = true;

-- Scraping intelligence indexes
CREATE INDEX IF NOT EXISTS idx_scraping_intel_next_due ON scraping_intelligence(next_scrape_due) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_scraping_intel_priority ON scraping_intelligence(priority DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_scraping_intel_yield ON scraping_intelligence(yield_rate DESC);

-- Job queue indexes
CREATE INDEX IF NOT EXISTS idx_queue_pending ON job_queue(priority DESC, scheduled_for) 
  WHERE status = 'pending' AND scheduled_for <= NOW();
CREATE INDEX IF NOT EXISTS idx_queue_processing ON job_queue(worker_id, locked_until) 
  WHERE status = 'processing';
CREATE INDEX IF NOT EXISTS idx_queue_retry ON job_queue(next_retry_at) 
  WHERE status = 'failed' AND retry_count < max_retries;

-- Analysis cache indexes
CREATE INDEX IF NOT EXISTS idx_cache_lookup ON analysis_cache(company_normalized, description_hash) 
  WHERE expires_at > NOW();
CREATE INDEX IF NOT EXISTS idx_cache_expiry ON analysis_cache(expires_at);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_event ON audit_log(event_type, event_category);
CREATE INDEX IF NOT EXISTS idx_audit_severity ON audit_log(severity) WHERE severity IN ('error', 'critical');

-- Metrics indexes
CREATE INDEX IF NOT EXISTS idx_metrics_bucket ON metrics(bucket_time DESC);

-- Duplicates indexes
CREATE INDEX IF NOT EXISTS idx_duplicates_primary ON company_duplicates(primary_company_id);
CREATE INDEX IF NOT EXISTS idx_duplicates_duplicate ON company_duplicates(duplicate_company_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to normalize company names
CREATE OR REPLACE FUNCTION normalize_company_name(company_name TEXT) 
RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          TRIM(company_name),
          '\s+(inc|incorporated|corp|corporation|llc|ltd|limited|co|company|group|holding|holdings|international|intl|usa|global|partners|lp|plc|gmbh|ag|sa|spa|srl|bv|nv|pty|pvt|pte|technologies|technology|tech|software|solutions|services)\.?$',
          '', 'gi'
        ),
        '[^\w\s]', '', 'g'
      ),
      '\s+', ' ', 'g'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate signal strength
CREATE OR REPLACE FUNCTION calculate_signal_strength(
  times_seen INTEGER,
  confidence TEXT,
  last_verified TIMESTAMPTZ
) RETURNS NUMERIC AS $$
DECLARE
  base_score NUMERIC;
  time_decay NUMERIC;
  days_old INTEGER;
BEGIN
  -- Base score from confidence
  base_score := CASE confidence
    WHEN 'high' THEN 0.8
    WHEN 'medium' THEN 0.5
    WHEN 'low' THEN 0.2
    ELSE 0.1
  END;
  
  -- Boost from times seen
  base_score := base_score + LEAST(LN(times_seen + 1) * 0.1, 0.2);
  
  -- Time decay
  days_old := EXTRACT(DAY FROM NOW() - COALESCE(last_verified, NOW()))::INTEGER;
  time_decay := GREATEST(1 - (days_old / 365.0), 0.5);
  
  RETURN LEAST(base_score * time_decay, 1.0);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger to update normalized name
CREATE OR REPLACE FUNCTION update_normalized_name() RETURNS TRIGGER AS $$
BEGIN
  NEW.normalized_name := normalize_company_name(NEW.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER company_normalize_name
  BEFORE INSERT OR UPDATE OF name ON companies
  FOR EACH ROW EXECUTE FUNCTION update_normalized_name();

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_companies_updated_at 
  BEFORE UPDATE ON companies 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scraping_intelligence_updated_at 
  BEFORE UPDATE ON scraping_intelligence 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INITIAL DATA
-- ============================================

-- Insert default search terms
INSERT INTO scraping_intelligence (search_term, priority) VALUES
  ('Revenue Operations', 90),
  ('SDR', 80),
  ('BDR', 80),
  ('Sales Development Representative', 75),
  ('Business Development Representative', 75),
  ('Sales Development Manager', 85),
  ('Sales Operations', 70),
  ('Sales Manager', 60),
  ('Account Executive', 50),
  ('Sales Engineer', 55)
ON CONFLICT (search_term) DO UPDATE SET
  priority = EXCLUDED.priority;

-- ============================================
-- VIEWS
-- ============================================

-- High-value companies view
CREATE OR REPLACE VIEW high_value_companies AS
SELECT 
  c.*,
  si.yield_rate,
  si.last_scraped
FROM companies c
LEFT JOIN scraping_intelligence si ON c.name ILIKE '%' || si.search_term || '%'
WHERE c.signal_strength > 0.7
  AND c.detection_confidence IN ('high', 'medium')
ORDER BY c.signal_strength DESC;

-- Scraping performance view
CREATE OR REPLACE VIEW scraping_performance AS
SELECT 
  search_term,
  total_scrapes,
  total_jobs_found,
  new_companies_found,
  yield_rate,
  ROUND(cost_per_company::numeric, 2) as cost_per_company,
  next_scrape_due,
  priority
FROM scraping_intelligence
WHERE is_active = true
ORDER BY priority DESC, next_scrape_due;

-- Daily metrics view
CREATE OR REPLACE VIEW daily_metrics AS
SELECT 
  DATE(bucket_time) as date,
  SUM(jobs_scraped) as total_jobs_scraped,
  SUM(new_companies) as new_companies_found,
  SUM(tools_detected) as tools_detected,
  ROUND(SUM(total_cost)::numeric, 2) as daily_cost,
  ROUND(AVG(avg_scrape_time_ms)::numeric) as avg_scrape_time,
  ROUND(AVG(avg_analysis_time_ms)::numeric) as avg_analysis_time,
  SUM(error_count) as total_errors
FROM metrics
WHERE bucket_time > NOW() - INTERVAL '30 days'
GROUP BY DATE(bucket_time)
ORDER BY date DESC;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Database schema created successfully!';
  RAISE NOTICE '📊 Tables created: companies, scraping_intelligence, job_queue, analysis_cache, audit_log, metrics, company_duplicates';
  RAISE NOTICE '🔧 Functions and triggers installed';
  RAISE NOTICE '📈 Views created for reporting';
  RAISE NOTICE '🎯 Initial search terms loaded';
END $$;