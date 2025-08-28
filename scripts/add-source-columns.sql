-- Add source tracking columns to identified_companies table
ALTER TABLE identified_companies 
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'job_analysis',
ADD COLUMN IF NOT EXISTS import_date TIMESTAMP WITH TIME ZONE;

-- Create index for source filtering
CREATE INDEX IF NOT EXISTS idx_identified_companies_source ON identified_companies(source);

-- Update existing records based on identified_date
-- Companies identified before July 1, 2025 are from Google Sheets
UPDATE identified_companies 
SET 
  source = 'google_sheets',
  import_date = '2025-06-26T00:00:00Z'
WHERE identified_date < '2025-07-01T00:00:00Z' 
  AND source IS NULL;

-- Companies identified after July 1, 2025 are from job analysis
UPDATE identified_companies 
SET 
  source = 'job_analysis',
  import_date = identified_date
WHERE identified_date >= '2025-07-01T00:00:00Z' 
  AND source IS NULL;