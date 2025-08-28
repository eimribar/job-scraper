-- Migration: Add jobs_raw table for staging scraped jobs
-- This table stores ALL scraped jobs before deduplication
-- Date: 2025-08-28

-- Create jobs_raw table
CREATE TABLE IF NOT EXISTS jobs_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Scraping metadata
  scrape_run_id VARCHAR(255) NOT NULL,  -- Apify run ID
  search_term VARCHAR(255) NOT NULL,
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Job data (exactly as scraped)
  job_id VARCHAR(255) NOT NULL,  -- Our generated ID
  linkedin_id VARCHAR(100),      -- LinkedIn's original ID if provided
  platform VARCHAR(50) NOT NULL,
  company VARCHAR(500),
  job_title VARCHAR(500),
  location TEXT,
  description TEXT,
  job_url TEXT,
  
  -- Processing status
  deduplicated BOOLEAN DEFAULT false,
  is_duplicate BOOLEAN DEFAULT false,
  duplicate_of VARCHAR(255),  -- Reference to original job_id if duplicate
  duplicate_confidence INTEGER,  -- 0-100 confidence score
  ready_for_analysis BOOLEAN DEFAULT false,
  analyzed BOOLEAN DEFAULT false,
  
  -- Indexes for performance
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_jobs_raw_scrape_run ON jobs_raw(scrape_run_id);
CREATE INDEX IF NOT EXISTS idx_jobs_raw_job_id ON jobs_raw(job_id);
CREATE INDEX IF NOT EXISTS idx_jobs_raw_deduplicated ON jobs_raw(deduplicated);
CREATE INDEX IF NOT EXISTS idx_jobs_raw_ready_for_analysis ON jobs_raw(ready_for_analysis) WHERE ready_for_analysis = true;
CREATE INDEX IF NOT EXISTS idx_jobs_raw_analyzed ON jobs_raw(analyzed) WHERE analyzed = false;
CREATE INDEX IF NOT EXISTS idx_jobs_raw_search_term ON jobs_raw(search_term);
CREATE INDEX IF NOT EXISTS idx_jobs_raw_company ON jobs_raw(LOWER(company));

-- Create telemetry table for tracking pipeline runs
CREATE TABLE IF NOT EXISTS pipeline_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id VARCHAR(255) UNIQUE NOT NULL,
  search_term VARCHAR(255),
  
  -- Stage metrics
  ingestion_started_at TIMESTAMP WITH TIME ZONE,
  ingestion_completed_at TIMESTAMP WITH TIME ZONE,
  total_scraped INTEGER DEFAULT 0,
  saved_to_raw INTEGER DEFAULT 0,
  
  dedup_started_at TIMESTAMP WITH TIME ZONE,
  dedup_completed_at TIMESTAMP WITH TIME ZONE,
  duplicates_found INTEGER DEFAULT 0,
  new_jobs INTEGER DEFAULT 0,
  
  analysis_started_at TIMESTAMP WITH TIME ZONE,
  analysis_completed_at TIMESTAMP WITH TIME ZONE,
  jobs_analyzed INTEGER DEFAULT 0,
  tools_detected INTEGER DEFAULT 0,
  
  -- Error tracking
  errors JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_jobs_raw_updated_at
  BEFORE UPDATE ON jobs_raw
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pipeline_telemetry_updated_at
  BEFORE UPDATE ON pipeline_telemetry
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions (adjust based on your user setup)
GRANT ALL ON jobs_raw TO authenticated;
GRANT ALL ON pipeline_telemetry TO authenticated;

-- Add RLS policies if needed
ALTER TABLE jobs_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_telemetry ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access (adjust as needed)
CREATE POLICY "Allow authenticated full access to jobs_raw" ON jobs_raw
  FOR ALL USING (true);

CREATE POLICY "Allow authenticated full access to pipeline_telemetry" ON pipeline_telemetry
  FOR ALL USING (true);