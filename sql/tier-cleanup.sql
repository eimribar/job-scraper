-- Comprehensive Tier Classification Cleanup Script
-- This script standardizes all companies to only have Tier 1 or Tier 2 values

BEGIN;

-- Step 1: Display current tier distribution before cleanup
SELECT 
    'BEFORE CLEANUP - Current tier distribution:' as info,
    tier,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM identified_companies), 2) as percentage
FROM identified_companies 
GROUP BY tier 
ORDER BY COUNT(*) DESC;

-- Step 2: Set ALL companies to Tier 2 as the default
UPDATE identified_companies 
SET tier = 'Tier 2' 
WHERE tier IS NULL 
   OR tier NOT IN ('Tier 1', 'Tier 2');

SELECT 'Step 2 completed: Set all invalid/NULL tiers to Tier 2' as status,
       COUNT(*) as companies_updated
FROM identified_companies 
WHERE tier = 'Tier 2';

-- Step 3: Update companies that match tier_one_companies to Tier 1
-- Using multiple matching strategies for better coverage
UPDATE identified_companies ic
SET tier = 'Tier 1'
WHERE EXISTS (
    SELECT 1 FROM tier_one_companies t1
    WHERE LOWER(TRIM(t1.company_name)) = LOWER(TRIM(ic.company))
);

SELECT 'Step 3a completed: Updated exact matches to Tier 1' as status,
       COUNT(*) as tier1_companies
FROM identified_companies 
WHERE tier = 'Tier 1';

-- Step 3b: Handle partial matches for companies with slight name differences
UPDATE identified_companies ic
SET tier = 'Tier 1'
WHERE EXISTS (
    SELECT 1 FROM tier_one_companies t1
    WHERE (
        -- Remove common suffixes and prefixes for better matching
        LOWER(TRIM(REGEXP_REPLACE(t1.company_name, '\s+(Inc\.?|LLC\.?|Corp\.?|Ltd\.?|Co\.?)(\s|$)', '', 'gi'))) = 
        LOWER(TRIM(REGEXP_REPLACE(ic.company, '\s+(Inc\.?|LLC\.?|Corp\.?|Ltd\.?|Co\.?)(\s|$)', '', 'gi')))
        OR
        -- Handle cases where one name contains the other
        (
            LENGTH(TRIM(t1.company_name)) > 3 AND
            LENGTH(TRIM(ic.company)) > 3 AND
            (
                LOWER(TRIM(ic.company)) LIKE '%' || LOWER(TRIM(t1.company_name)) || '%'
                OR
                LOWER(TRIM(t1.company_name)) LIKE '%' || LOWER(TRIM(ic.company)) || '%'
            )
        )
    )
);

SELECT 'Step 3b completed: Updated partial matches to Tier 1' as status,
       COUNT(*) as tier1_companies
FROM identified_companies 
WHERE tier = 'Tier 1';

-- Step 4: Fix database constraint to prevent invalid tier values
ALTER TABLE identified_companies 
DROP CONSTRAINT IF EXISTS identified_companies_tier_check;

ALTER TABLE identified_companies 
ADD CONSTRAINT identified_companies_tier_check 
CHECK (tier IN ('Tier 1', 'Tier 2'));

SELECT 'Step 4 completed: Added tier constraint to prevent invalid values' as status;

-- Step 5: Update the trigger function to ensure only valid tiers
DROP TRIGGER IF EXISTS trigger_set_company_tier ON identified_companies;

CREATE OR REPLACE FUNCTION set_company_tier()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the company exists in tier_one_companies with multiple matching strategies
  IF EXISTS (
    SELECT 1 FROM tier_one_companies t1 
    WHERE LOWER(TRIM(t1.company_name)) = LOWER(TRIM(NEW.company))
    OR (
        LENGTH(TRIM(t1.company_name)) > 3 AND
        LENGTH(TRIM(NEW.company)) > 3 AND
        (
            LOWER(TRIM(NEW.company)) LIKE '%' || LOWER(TRIM(t1.company_name)) || '%'
            OR
            LOWER(TRIM(t1.company_name)) LIKE '%' || LOWER(TRIM(NEW.company)) || '%'
        )
    )
  ) THEN
    NEW.tier = 'Tier 1';
  ELSE
    NEW.tier = 'Tier 2';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_company_tier
  BEFORE INSERT OR UPDATE ON identified_companies
  FOR EACH ROW
  EXECUTE FUNCTION set_company_tier();

SELECT 'Step 5 completed: Updated trigger function with improved matching' as status;

-- Step 6: Display final tier distribution after cleanup
SELECT 
    'AFTER CLEANUP - Final tier distribution:' as info,
    tier,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM identified_companies), 2) as percentage
FROM identified_companies 
GROUP BY tier 
ORDER BY tier;

-- Step 7: Show summary statistics
SELECT 
    'CLEANUP SUMMARY:' as summary,
    (SELECT COUNT(*) FROM identified_companies) as total_companies,
    (SELECT COUNT(*) FROM identified_companies WHERE tier = 'Tier 1') as tier1_count,
    (SELECT COUNT(*) FROM identified_companies WHERE tier = 'Tier 2') as tier2_count,
    (SELECT COUNT(*) FROM identified_companies WHERE tier NOT IN ('Tier 1', 'Tier 2')) as invalid_tiers;

-- Step 8: Show some examples of Tier 1 companies
SELECT 'TIER 1 COMPANIES (Sample):' as info, company, tier
FROM identified_companies 
WHERE tier = 'Tier 1'
ORDER BY company
LIMIT 10;

COMMIT;