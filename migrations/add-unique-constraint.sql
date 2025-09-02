-- Add unique constraint to prevent duplicate company+tool combinations
-- This ensures each company can only appear once per tool
-- (A company can still have both Outreach.io and SalesLoft entries)

ALTER TABLE identified_companies
ADD CONSTRAINT unique_company_tool 
UNIQUE (company, tool_detected);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_company_tool 
ON identified_companies(company, tool_detected);

-- Also add index on identified_date for sorting
CREATE INDEX IF NOT EXISTS idx_identified_date 
ON identified_companies(identified_date DESC);