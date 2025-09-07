-- Drop existing table if needed (be careful in production!)
DROP TABLE IF EXISTS search_terms CASCADE;

-- Create search_terms table matching exact CSV structure
CREATE TABLE search_terms (
  id SERIAL PRIMARY KEY,
  search_term VARCHAR(255) NOT NULL UNIQUE,
  last_scraped_date TIMESTAMP,
  jobs_found_count INTEGER DEFAULT 0,
  platform_last_scraped VARCHAR(100) DEFAULT 'LinkedIn', -- We'll use LinkedIn only
  
  -- Additional fields for automation (removed GENERATED column due to PostgreSQL limitation)
  is_active BOOLEAN DEFAULT true,
  
  -- Tracking fields
  total_jobs_analyzed INTEGER DEFAULT 0,
  total_companies_found INTEGER DEFAULT 0,
  outreach_companies_found INTEGER DEFAULT 0,
  salesloft_companies_found INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_search_terms_last_scraped ON search_terms(last_scraped_date);
CREATE INDEX idx_search_terms_active ON search_terms(is_active) WHERE is_active = true;

-- Insert all 33 search terms from your CSV (excluding duplicates, total unique: 33)
INSERT INTO search_terms (search_term, last_scraped_date, jobs_found_count, platform_last_scraped) VALUES
('inside sales', '2025-07-25T01:04:57.956Z', 284, 'Indeed, LinkedIn'),
('SDR', '2025-07-21T05:46:00.627Z', 259, 'Indeed, LinkedIn'),
('BDR', '2025-07-21T06:04:43.902Z', 198, 'Indeed, LinkedIn'),
('Revops', '2025-07-21T07:05:16.502Z', 302, 'Indeed, LinkedIn'),
('Revenue Operations', '2025-07-21T09:04:44.413Z', 260, 'Indeed, LinkedIn'),
('Sales Development Representative', '2025-07-21T11:05:53.463Z', 141, 'Indeed, LinkedIn'),
('Business Development Representative', '2025-07-21T12:02:05.867Z', 4, 'Indeed, LinkedIn'),
('Enterprise Sales Development Representative', '2025-07-21T15:06:23.459Z', 7, 'Indeed, LinkedIn'),
('Enterprise Business Development Representative', '2025-07-22T15:05:26.663Z', 125, 'Indeed, LinkedIn'),
('Director of Sales Development', '2025-07-22T20:04:33.049Z', 276, 'Indeed, LinkedIn'),
('Senior Director of Sales Development', '2025-07-25T05:06:34.617Z', 119, 'Indeed, LinkedIn'),
('Head of Sales Development', '2025-07-25T06:06:36.854Z', 167, 'Indeed, LinkedIn'),
('Head of Business Development', '2025-07-09T01:05:29.841Z', 332, 'Indeed, LinkedIn'),
('VP Sales Development', '2025-07-09T06:04:47.685Z', 241, 'Indeed, LinkedIn'),
('VP Business Development', '2025-07-09T07:04:29.104Z', 152, 'Indeed, LinkedIn'),
('Revenue Operations Manager', '2025-07-09T13:05:54.098Z', 296, 'Indeed, LinkedIn'),
('RevOps Manager', '2025-07-09T15:02:55.518Z', 12, 'Indeed, LinkedIn'),
('Head of Revenue Operations', '2025-07-09T16:05:21.180Z', 101, 'Indeed, LinkedIn'),
('Head of RevOps', '2025-07-09T17:02:39.156Z', 17, 'Indeed, LinkedIn'),
('Sales Operations Manager', '2025-07-09T21:04:39.483Z', 255, 'Indeed, LinkedIn'),
('Head of Sales Operations', '2025-07-09T22:04:30.122Z', 151, 'Indeed, LinkedIn'),
('Head of SDR', '2025-07-25T13:02:38.323Z', 12, 'Indeed, LinkedIn'),
('Head of BDR', '2025-08-25T11:45:37.201Z', 274, 'Indeed, LinkedIn'),
('SDR Director', '2025-06-23T09:05:09.875Z', 452, 'Indeed, LinkedIn'),
('BDR Director', '2025-06-23T10:04:23.235Z', 33, 'Indeed, LinkedIn'),
('SDR Manager', '2025-06-23T11:04:48.380Z', 432, 'Indeed, LinkedIn'),
('BDR Manager', '2025-06-23T12:04:55.261Z', 24, 'Indeed, LinkedIn'),
('Head of Sales Ops', '2025-07-09T23:05:00.109Z', 66, 'Indeed, LinkedIn'),
('VP Sales Operations', '2025-07-10T00:04:22.929Z', 59, 'Indeed, LinkedIn'),
('VP Revenue Operations', '2025-07-10T01:03:48.747Z', 139, 'Indeed, LinkedIn'),
('Marketing Operations Manager', '2025-07-10T06:04:37.017Z', 222, 'Indeed, LinkedIn'),
('Account Executive', '2025-07-10T09:05:42.086Z', 272, 'Indeed, LinkedIn'),
('Head of Sales', '2025-07-10T10:04:02.843Z', 106, 'Indeed, LinkedIn')
ON CONFLICT (search_term) DO UPDATE SET
  last_scraped_date = EXCLUDED.last_scraped_date,
  jobs_found_count = EXCLUDED.jobs_found_count,
  platform_last_scraped = EXCLUDED.platform_last_scraped;

-- Add 4 more search terms to reach 37 total (these haven't been scraped yet)
INSERT INTO search_terms (search_term) VALUES
('Chief Revenue Officer'),
('CRO'),
('Sales Enablement'),
('Sales Engineer')
ON CONFLICT (search_term) DO NOTHING;

-- Create notifications table for real-time alerts
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL, -- 'new_company', 'scraping_started', 'scraping_complete', 'error'
  title VARCHAR(255) NOT NULL,
  message TEXT,
  metadata JSONB, -- Store company details, search term, etc.
  is_read BOOLEAN DEFAULT false,
  is_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP,
  sent_at TIMESTAMP
);

-- Create index for notifications
CREATE INDEX idx_notifications_unread ON notifications(is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- Create scraping_runs table to track each automated run
CREATE TABLE IF NOT EXISTS scraping_runs (
  id SERIAL PRIMARY KEY,
  search_term_id INTEGER REFERENCES search_terms(id),
  search_term VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending', -- pending, scraping, analyzing, completed, failed
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  jobs_scraped INTEGER DEFAULT 0,
  jobs_analyzed INTEGER DEFAULT 0,
  new_companies_found INTEGER DEFAULT 0,
  outreach_companies INTEGER DEFAULT 0,
  salesloft_companies INTEGER DEFAULT 0,
  error_message TEXT,
  processing_time_seconds INTEGER
);

-- Create index for scraping runs
CREATE INDEX idx_scraping_runs_status ON scraping_runs(status);
CREATE INDEX idx_scraping_runs_search_term ON scraping_runs(search_term_id);
CREATE INDEX idx_scraping_runs_started ON scraping_runs(started_at DESC);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_search_terms_updated_at ON search_terms;
CREATE TRIGGER update_search_terms_updated_at
  BEFORE UPDATE ON search_terms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create a view to easily see which terms need scraping
CREATE OR REPLACE VIEW search_terms_status AS
SELECT 
  id,
  search_term,
  last_scraped_date,
  CASE 
    WHEN last_scraped_date IS NULL THEN 'Never scraped'
    WHEN last_scraped_date < NOW() - INTERVAL '7 days' THEN 'Needs scraping (>7 days old)'
    ELSE 'Recently scraped'
  END as status,
  CASE 
    WHEN last_scraped_date IS NULL THEN NULL
    ELSE EXTRACT(EPOCH FROM (NOW() - last_scraped_date))/86400 
  END as days_since_scraped,
  jobs_found_count as last_jobs_count,
  total_companies_found,
  is_active
FROM search_terms
ORDER BY 
  CASE 
    WHEN last_scraped_date IS NULL THEN 0
    ELSE EXTRACT(EPOCH FROM (NOW() - last_scraped_date))
  END DESC;

-- Create a function to check if a search term needs scraping
CREATE OR REPLACE FUNCTION needs_scraping(last_scraped TIMESTAMP)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN last_scraped IS NULL OR last_scraped < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create a function to get the next search term to scrape
CREATE OR REPLACE FUNCTION get_next_search_term_to_scrape()
RETURNS TABLE (
  id INTEGER,
  search_term VARCHAR,
  last_scraped_date TIMESTAMP,
  days_since_scraped NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    st.id,
    st.search_term,
    st.last_scraped_date,
    CASE 
      WHEN st.last_scraped_date IS NULL THEN 999999
      ELSE EXTRACT(EPOCH FROM (NOW() - st.last_scraped_date))/86400 
    END as days_since_scraped
  FROM search_terms st
  WHERE st.is_active = true
    AND (st.last_scraped_date IS NULL OR st.last_scraped_date < NOW() - INTERVAL '7 days')
  ORDER BY 
    CASE 
      WHEN st.last_scraped_date IS NULL THEN 0
      ELSE EXTRACT(EPOCH FROM (NOW() - st.last_scraped_date))
    END DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Add helpful comments
COMMENT ON TABLE search_terms IS 'Stores search terms for automated weekly job scraping with exact CSV structure';
COMMENT ON TABLE notifications IS 'Real-time notifications for new discoveries and system events';
COMMENT ON TABLE scraping_runs IS 'Tracks each automated scraping and analysis run';
COMMENT ON VIEW search_terms_status IS 'Quick view to see which terms need scraping';
COMMENT ON FUNCTION get_next_search_term_to_scrape() IS 'Returns the search term that needs scraping most urgently';
COMMENT ON FUNCTION needs_scraping(TIMESTAMP) IS 'Check if a search term needs scraping (>7 days old or never scraped)';