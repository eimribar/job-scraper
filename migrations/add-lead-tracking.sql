-- Migration: Add lead generation tracking to identified_companies table
-- Date: 2025-09-07
-- Purpose: Enable BDRs to track which companies have leads generated

-- Add lead tracking columns to identified_companies table
ALTER TABLE identified_companies 
ADD COLUMN IF NOT EXISTS leads_generated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS leads_generated_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS leads_generated_by TEXT,
ADD COLUMN IF NOT EXISTS lead_gen_notes TEXT,
ADD COLUMN IF NOT EXISTS tier TEXT,
ADD COLUMN IF NOT EXISTS sponsor_1 TEXT,
ADD COLUMN IF NOT EXISTS sponsor_1_url TEXT,
ADD COLUMN IF NOT EXISTS sponsor_2 TEXT,
ADD COLUMN IF NOT EXISTS sponsor_2_url TEXT,
ADD COLUMN IF NOT EXISTS rep_sdr_bdr TEXT,
ADD COLUMN IF NOT EXISTS rep_sdr_bdr_url TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT;

-- Create index for faster filtering by lead status
CREATE INDEX IF NOT EXISTS idx_identified_companies_leads_generated 
ON identified_companies(leads_generated);

-- Create index for faster filtering by tier
CREATE INDEX IF NOT EXISTS idx_identified_companies_tier 
ON identified_companies(tier);

-- Add comment to explain the purpose of these columns
COMMENT ON COLUMN identified_companies.leads_generated IS 'Whether leads have been generated for this company';
COMMENT ON COLUMN identified_companies.leads_generated_date IS 'When leads were generated';
COMMENT ON COLUMN identified_companies.leads_generated_by IS 'User who generated the leads';
COMMENT ON COLUMN identified_companies.lead_gen_notes IS 'Additional notes about lead generation';
COMMENT ON COLUMN identified_companies.tier IS 'Company tier classification (Tier 1, >200, <200, etc.)';
COMMENT ON COLUMN identified_companies.sponsor_1 IS 'Primary sponsor name and title';
COMMENT ON COLUMN identified_companies.sponsor_1_url IS 'Primary sponsor LinkedIn URL';
COMMENT ON COLUMN identified_companies.sponsor_2 IS 'Secondary sponsor name and title';
COMMENT ON COLUMN identified_companies.sponsor_2_url IS 'Secondary sponsor LinkedIn URL';
COMMENT ON COLUMN identified_companies.rep_sdr_bdr IS 'Assigned SDR/BDR name';
COMMENT ON COLUMN identified_companies.rep_sdr_bdr_url IS 'Assigned SDR/BDR LinkedIn URL';
COMMENT ON COLUMN identified_companies.tags IS 'Additional tags or notes';