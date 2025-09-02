-- ================================================
-- GOOGLE SHEETS SYNC DATABASE SCHEMA
-- Exact match with CSV structure
-- Date: 2025-09-02
-- ================================================

-- Drop existing tables to recreate with exact Sheet structure
DROP TABLE IF EXISTS raw_jobs CASCADE;
DROP TABLE IF EXISTS identified_companies CASCADE;
DROP TABLE IF EXISTS sync_status CASCADE;
DROP TABLE IF EXISTS processing_queue CASCADE;

-- ================================================
-- Table 1: raw_jobs (matches Raw_Jobs sheet exactly)
-- ================================================
CREATE TABLE raw_jobs (
    id SERIAL PRIMARY KEY,
    job_id TEXT UNIQUE NOT NULL,
    platform TEXT,
    company TEXT NOT NULL,
    job_title TEXT NOT NULL,
    location TEXT,
    description TEXT,
    job_url TEXT,
    scraped_date TIMESTAMPTZ,
    search_term TEXT,
    processed BOOLEAN DEFAULT FALSE,
    analyzed_date TIMESTAMPTZ,
    _stats TEXT,
    row_number INTEGER, -- Sheet row number for tracking
    sheet_row INTEGER UNIQUE, -- Unique row identifier in Google Sheet
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- Table 2: identified_companies (matches Identified_Companies sheet exactly)
-- ================================================
CREATE TABLE identified_companies (
    id SERIAL PRIMARY KEY,
    company TEXT NOT NULL,
    tool_detected TEXT,
    signal_type TEXT,
    context TEXT,
    job_title TEXT,
    job_url TEXT,
    linkedin_url TEXT,
    platform TEXT,
    identified_date TIMESTAMPTZ,
    leads_uploaded TEXT,
    -- Empty column in CSV (column K)
    tier_2_leads_uploaded TEXT,
    sponsor_1 TEXT,
    sponsor_1_li_url TEXT,
    sponsor_2 TEXT,
    sponsor_2_li_url TEXT,
    rep_sdr_bdr TEXT,
    rep_li_url TEXT,
    tags_on_dashboard TEXT,
    sheet_row INTEGER UNIQUE, -- Unique row identifier in Google Sheet
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- Table 3: sync_status (Track synchronization)
-- ================================================
CREATE TABLE sync_status (
    id SERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    last_sync_from_sheets TIMESTAMPTZ,
    last_sync_to_sheets TIMESTAMPTZ,
    sheets_last_modified TIMESTAMPTZ,
    sync_status TEXT DEFAULT 'pending', -- 'pending', 'syncing', 'completed', 'error'
    error_message TEXT,
    rows_synced INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- Table 4: processing_queue (Job processing management)
-- ================================================
CREATE TABLE processing_queue (
    id SERIAL PRIMARY KEY,
    job_id TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'error'
    priority INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- INDEXES FOR PERFORMANCE
-- ================================================

-- raw_jobs indexes
CREATE INDEX idx_raw_jobs_processed ON raw_jobs (processed);
CREATE INDEX idx_raw_jobs_company ON raw_jobs (company);
CREATE INDEX idx_raw_jobs_search_term ON raw_jobs (search_term);
CREATE INDEX idx_raw_jobs_scraped_date ON raw_jobs (scraped_date DESC);
CREATE INDEX idx_raw_jobs_sheet_row ON raw_jobs (sheet_row);
CREATE INDEX idx_raw_jobs_job_id ON raw_jobs (job_id);

-- identified_companies indexes
CREATE INDEX idx_identified_companies_company ON identified_companies (company);
CREATE INDEX idx_identified_companies_tool ON identified_companies (tool_detected);
CREATE INDEX idx_identified_companies_signal ON identified_companies (signal_type);
CREATE INDEX idx_identified_companies_date ON identified_companies (identified_date DESC);
CREATE INDEX idx_identified_companies_sheet_row ON identified_companies (sheet_row);
CREATE INDEX idx_identified_companies_leads ON identified_companies (leads_uploaded);

-- processing_queue indexes
CREATE INDEX idx_processing_queue_status ON processing_queue (status);
CREATE INDEX idx_processing_queue_priority ON processing_queue (priority DESC, created_at);
CREATE INDEX idx_processing_queue_job_id ON processing_queue (job_id);

-- sync_status indexes
CREATE INDEX idx_sync_status_table ON sync_status (table_name);
CREATE INDEX idx_sync_status_status ON sync_status (sync_status);

-- ================================================
-- CONSTRAINTS
-- ================================================

-- Tool detection values constraint
ALTER TABLE identified_companies 
ADD CONSTRAINT check_tool_detected 
CHECK (tool_detected IN ('Outreach.io', 'SalesLoft', 'Both', 'none') OR tool_detected IS NULL);

-- Signal type constraint
ALTER TABLE identified_companies 
ADD CONSTRAINT check_signal_type 
CHECK (signal_type IN ('required', 'preferred', 'stack_mention', 'none') OR signal_type IS NULL);

-- Processing status constraint
ALTER TABLE processing_queue
ADD CONSTRAINT check_processing_status
CHECK (status IN ('pending', 'processing', 'completed', 'error'));

-- Sync status constraint
ALTER TABLE sync_status
ADD CONSTRAINT check_sync_status
CHECK (sync_status IN ('pending', 'syncing', 'completed', 'error'));

-- ================================================
-- TRIGGERS FOR UPDATED_AT
-- ================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables
CREATE TRIGGER update_raw_jobs_updated_at 
BEFORE UPDATE ON raw_jobs 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_identified_companies_updated_at 
BEFORE UPDATE ON identified_companies 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sync_status_updated_at 
BEFORE UPDATE ON sync_status 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- FUNCTIONS FOR SYNC MANAGEMENT
-- ================================================

-- Function to check if a job exists
CREATE OR REPLACE FUNCTION job_exists(p_job_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM raw_jobs WHERE job_id = p_job_id LIMIT 1
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get unprocessed jobs
CREATE OR REPLACE FUNCTION get_unprocessed_jobs(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
    job_id TEXT,
    company TEXT,
    job_title TEXT,
    description TEXT,
    platform TEXT,
    job_url TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rj.job_id,
        rj.company,
        rj.job_title,
        rj.description,
        rj.platform,
        rj.job_url
    FROM raw_jobs rj
    WHERE rj.processed = FALSE
    ORDER BY rj.created_at
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- INITIAL SYNC STATUS RECORDS
-- ================================================

INSERT INTO sync_status (table_name, sync_status) 
VALUES 
    ('raw_jobs', 'pending'),
    ('identified_companies', 'pending')
ON CONFLICT DO NOTHING;

-- ================================================
-- ENABLE ROW LEVEL SECURITY (Optional)
-- ================================================

-- ALTER TABLE raw_jobs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE identified_companies ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE processing_queue ENABLE ROW LEVEL SECURITY;

-- ================================================
-- SUCCESS MESSAGE
-- ================================================

DO $$
BEGIN
    RAISE NOTICE 'Google Sheets sync schema created successfully';
    RAISE NOTICE 'Tables created: raw_jobs, identified_companies, sync_status, processing_queue';
    RAISE NOTICE 'Ready for two-way synchronization with Google Sheets';
END $$;