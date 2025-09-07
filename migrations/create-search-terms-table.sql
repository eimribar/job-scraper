-- Create search_terms table for automated weekly scraping
CREATE TABLE IF NOT EXISTS search_terms (
  id SERIAL PRIMARY KEY,
  term VARCHAR(255) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 1, -- Higher priority = process first
  schedule_day INTEGER DEFAULT 1, -- 1=Monday, 2=Tuesday, etc.
  last_scraped_at TIMESTAMP,
  next_scrape_at TIMESTAMP DEFAULT NOW() + INTERVAL '7 days',
  jobs_found_last_run INTEGER DEFAULT 0,
  companies_found_last_run INTEGER DEFAULT 0,
  total_jobs_found INTEGER DEFAULT 0,
  total_companies_found INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 100.00,
  average_processing_time INTEGER, -- in seconds
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_search_terms_active ON search_terms(is_active);
CREATE INDEX idx_search_terms_next_scrape ON search_terms(next_scrape_at);
CREATE INDEX idx_search_terms_priority ON search_terms(priority DESC);

-- Insert 37 search terms for SDR/Sales roles
INSERT INTO search_terms (term, priority, schedule_day) VALUES
-- Core SDR/BDR terms (highest priority)
('SDR', 10, 1),
('Sales Development Representative', 10, 1),
('BDR', 10, 1),
('Business Development Representative', 10, 1),
('Sales Development Manager', 9, 1),
('SDR Manager', 9, 1),
('BDR Manager', 9, 1),

-- Sales Operations & Enablement (high priority)
('Revenue Operations', 8, 2),
('Sales Operations', 8, 2),
('Sales Enablement', 8, 2),
('RevOps', 8, 2),
('Sales Ops', 8, 2),

-- Account Executive roles (medium-high priority)
('Account Executive', 7, 3),
('Enterprise Account Executive', 7, 3),
('SMB Account Executive', 7, 3),
('Mid-Market Account Executive', 7, 3),
('Inside Sales Representative', 7, 3),
('ISR', 7, 3),

-- Sales Leadership (medium priority)
('VP Sales', 6, 4),
('Vice President Sales', 6, 4),
('Director of Sales', 6, 4),
('Head of Sales', 6, 4),
('Sales Director', 6, 4),
('CRO', 6, 4),
('Chief Revenue Officer', 6, 4),

-- Sales Support & Analytics (medium priority)
('Sales Analyst', 5, 5),
('Sales Operations Analyst', 5, 5),
('Sales Engineer', 5, 5),
('Solutions Engineer', 5, 5),
('Sales Coordinator', 5, 5),

-- Specialized Sales Roles (lower priority)
('Outbound Sales', 4, 6),
('Inbound Sales', 4, 6),
('Lead Generation Specialist', 4, 6),
('Demand Generation', 4, 7),
('Growth Marketing', 4, 7),
('Pipeline Development', 4, 7),

ON CONFLICT (term) DO NOTHING;

-- Create notifications table for real-time alerts
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL, -- 'new_company', 'error', 'milestone', 'processing_complete'
  title VARCHAR(255) NOT NULL,
  message TEXT,
  metadata JSONB, -- Store additional data like company_id, tool_detected, etc.
  is_read BOOLEAN DEFAULT false,
  is_sent BOOLEAN DEFAULT false, -- For external notifications (email, slack)
  created_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP,
  sent_at TIMESTAMP
);

-- Create index for notification queries
CREATE INDEX idx_notifications_unread ON notifications(is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- Create processing_runs table to track each scraping run
CREATE TABLE IF NOT EXISTS processing_runs (
  id SERIAL PRIMARY KEY,
  search_term_id INTEGER REFERENCES search_terms(id),
  status VARCHAR(50) DEFAULT 'pending', -- pending, scraping, analyzing, completed, failed
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  jobs_scraped INTEGER DEFAULT 0,
  jobs_analyzed INTEGER DEFAULT 0,
  companies_found INTEGER DEFAULT 0,
  new_companies INTEGER DEFAULT 0,
  error_message TEXT,
  processing_time_seconds INTEGER,
  api_costs DECIMAL(10,4) DEFAULT 0.00
);

-- Create index for processing runs
CREATE INDEX idx_processing_runs_status ON processing_runs(status);
CREATE INDEX idx_processing_runs_search_term ON processing_runs(search_term_id);

-- Function to update search_terms updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_search_terms_updated_at
  BEFORE UPDATE ON search_terms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add helpful comments
COMMENT ON TABLE search_terms IS 'Stores search terms for automated weekly job scraping';
COMMENT ON TABLE notifications IS 'Real-time notifications for new discoveries and system events';
COMMENT ON TABLE processing_runs IS 'Tracks each automated scraping and analysis run';