-- Setup Tier Classification System for Sales Tool Detector
-- This script creates the tier_one_companies table and modifies existing tables

-- 1. Create tier_one_companies table
CREATE TABLE IF NOT EXISTS tier_one_companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL UNIQUE,
  domain TEXT,
  linkedin_url TEXT,
  tool_detected TEXT,
  leads_in_system INTEGER DEFAULT 0,
  follow_up BOOLEAN DEFAULT false,
  engaged BOOLEAN DEFAULT false,
  engagement_context TEXT,
  first_person TEXT,
  second_person TEXT,
  third_person TEXT,
  other_contacts TEXT,
  jon_input TEXT,
  ido_input TEXT,
  eimri_input TEXT,
  how_many_people INTEGER,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add tier column to identified_companies table (if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'identified_companies' 
    AND column_name = 'tier'
  ) THEN
    ALTER TABLE identified_companies 
    ADD COLUMN tier TEXT DEFAULT 'Tier 2' CHECK (tier IN ('Tier 1', 'Tier 2'));
  END IF;
END $$;

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_identified_companies_tier ON identified_companies(tier);
CREATE INDEX IF NOT EXISTS idx_tier_one_companies_name ON tier_one_companies(company_name);
CREATE INDEX IF NOT EXISTS idx_tier_one_companies_domain ON tier_one_companies(domain);

-- 4. Create function to automatically set tier based on tier_one_companies table
CREATE OR REPLACE FUNCTION set_company_tier()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the company exists in tier_one_companies
  IF EXISTS (
    SELECT 1 FROM tier_one_companies t1 
    WHERE LOWER(t1.company_name) = LOWER(NEW.company)
  ) THEN
    NEW.tier = 'Tier 1';
  ELSE
    NEW.tier = 'Tier 2';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger to auto-set tier on insert/update
DROP TRIGGER IF EXISTS trigger_set_company_tier ON identified_companies;
CREATE TRIGGER trigger_set_company_tier
  BEFORE INSERT OR UPDATE ON identified_companies
  FOR EACH ROW
  EXECUTE FUNCTION set_company_tier();

-- 6. Update existing records to set proper tiers
UPDATE identified_companies 
SET tier = 'Tier 1'
WHERE EXISTS (
  SELECT 1 FROM tier_one_companies t1 
  WHERE LOWER(t1.company_name) = LOWER(identified_companies.company)
);

-- 7. Create view for comprehensive tier overview
CREATE OR REPLACE VIEW company_tier_overview AS
SELECT 
  t1.company_name,
  t1.domain,
  t1.linkedin_url,
  t1.tool_detected as tier_tool_detected,
  t1.leads_in_system as tier_leads_in_system,
  t1.engaged as tier_engaged,
  ic.id as identified_id,
  ic.tool_detected as detected_tool,
  ic.tier,
  ic.identified_date,
  ic.leads_generated,
  CASE 
    WHEN ic.id IS NULL THEN 'Not Identified Yet'
    WHEN ic.tool_detected IS NULL OR ic.tool_detected = '' THEN 'Not Identified Yet'
    ELSE 'Identified'
  END as identification_status
FROM tier_one_companies t1
LEFT JOIN identified_companies ic ON (
  LOWER(t1.company_name) = LOWER(ic.company)
)
UNION ALL
SELECT 
  ic.company as company_name,
  NULL as domain,
  NULL as linkedin_url,
  NULL as tier_tool_detected,
  0 as tier_leads_in_system,
  false as tier_engaged,
  ic.id as identified_id,
  ic.tool_detected as detected_tool,
  ic.tier,
  ic.identified_date,
  ic.leads_generated,
  'Identified' as identification_status
FROM identified_companies ic
WHERE ic.tier = 'Tier 2'
AND NOT EXISTS (
  SELECT 1 FROM tier_one_companies t1 
  WHERE LOWER(t1.company_name) = LOWER(ic.company)
);

-- 8. Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON tier_one_companies TO authenticated;
-- GRANT SELECT ON company_tier_overview TO authenticated;