-- Add unique constraint to prevent duplicate companies with same tool
-- This constraint ensures we don't have duplicate entries for the same company-tool combination

-- First, check if the constraint already exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'unique_company_tool'
    ) THEN
        -- Add the unique constraint
        ALTER TABLE identified_companies
        ADD CONSTRAINT unique_company_tool 
        UNIQUE (company, tool_detected);
        
        RAISE NOTICE 'Unique constraint "unique_company_tool" has been added successfully';
    ELSE
        RAISE NOTICE 'Unique constraint "unique_company_tool" already exists';
    END IF;
END $$;

-- Create index to improve query performance
CREATE INDEX IF NOT EXISTS idx_identified_companies_company 
ON identified_companies(company);

CREATE INDEX IF NOT EXISTS idx_identified_companies_tool_detected 
ON identified_companies(tool_detected);

CREATE INDEX IF NOT EXISTS idx_identified_companies_identified_date 
ON identified_companies(identified_date DESC);

-- Verify the constraint was added
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'identified_companies'::regclass
AND conname = 'unique_company_tool';