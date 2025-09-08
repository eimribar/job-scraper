-- Create search_terms_clean table for automation
CREATE TABLE IF NOT EXISTS search_terms_clean (
  id SERIAL PRIMARY KEY,
  search_term VARCHAR(255) NOT NULL UNIQUE,
  priority INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT true,
  last_scraped_date TIMESTAMP,
  jobs_found_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create processed_jobs table for tracking analysis
CREATE TABLE IF NOT EXISTS processed_jobs (
  id SERIAL PRIMARY KEY,
  job_id VARCHAR(255) NOT NULL UNIQUE,
  platform VARCHAR(50),
  company VARCHAR(255),
  job_title VARCHAR(255),
  uses_tool BOOLEAN,
  tool_detected VARCHAR(50),
  signal_type VARCHAR(50),
  context TEXT,
  confidence VARCHAR(20),
  processed_date TIMESTAMP DEFAULT NOW(),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create automation_logs table for monitoring
CREATE TABLE IF NOT EXISTS automation_logs (
  id SERIAL PRIMARY KEY,
  service VARCHAR(50) NOT NULL, -- 'scraper', 'analyzer', 'health_check'
  action VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'success', 'error', 'skipped'
  details JSONB,
  duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create automation_metrics table for tracking performance
CREATE TABLE IF NOT EXISTS automation_metrics (
  id SERIAL PRIMARY KEY,
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  jobs_scraped INTEGER DEFAULT 0,
  jobs_analyzed INTEGER DEFAULT 0,
  tools_detected INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  avg_processing_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(metric_date)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_search_terms_clean_active ON search_terms_clean(is_active);
CREATE INDEX IF NOT EXISTS idx_search_terms_clean_priority ON search_terms_clean(priority DESC);
CREATE INDEX IF NOT EXISTS idx_search_terms_clean_last_scraped ON search_terms_clean(last_scraped_date);
CREATE INDEX IF NOT EXISTS idx_processed_jobs_job_id ON processed_jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_processed_jobs_company ON processed_jobs(company);
CREATE INDEX IF NOT EXISTS idx_processed_jobs_tool ON processed_jobs(tool_detected);
CREATE INDEX IF NOT EXISTS idx_automation_logs_service ON automation_logs(service);
CREATE INDEX IF NOT EXISTS idx_automation_logs_created ON automation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_metrics_date ON automation_metrics(metric_date DESC);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_search_terms_clean_updated_at BEFORE UPDATE ON search_terms_clean
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automation_metrics_updated_at BEFORE UPDATE ON automation_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions (adjust based on your needs)
GRANT ALL ON search_terms_clean TO authenticated;
GRANT ALL ON processed_jobs TO authenticated;
GRANT ALL ON automation_logs TO authenticated;
GRANT ALL ON automation_metrics TO authenticated;