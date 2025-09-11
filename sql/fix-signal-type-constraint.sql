-- ================================================
-- FIX SIGNAL_TYPE CONSTRAINT AND RECOVER MISSING COMPANIES
-- ================================================
-- Problem: CHECK constraint on signal_type is too restrictive
-- It only allows: 'stack_mention', 'required', 'preferred'
-- But the processors use: 'explicit_mention'
-- This caused 20 companies to fail insertion despite being detected

-- Step 1: Check current constraint
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'identified_companies'::regclass
  AND contype = 'c'
  AND conname LIKE '%signal_type%';

-- Step 2: Drop the old restrictive constraint
ALTER TABLE identified_companies 
DROP CONSTRAINT IF EXISTS check_signal_type;

-- Step 3: Add new constraint that includes 'explicit_mention'
ALTER TABLE identified_companies 
ADD CONSTRAINT check_signal_type 
CHECK (signal_type IN ('stack_mention', 'required', 'preferred', 'explicit_mention', 'tool_mention'));

-- Step 4: Verify the new constraint
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'identified_companies'::regclass
  AND contype = 'c'
  AND conname LIKE '%signal_type%';

-- Step 5: Show summary
DO $$
BEGIN
  RAISE NOTICE 'Signal type constraint has been updated!';
  RAISE NOTICE 'Now allows: stack_mention, required, preferred, explicit_mention, tool_mention';
  RAISE NOTICE 'This will allow the 20 missing companies to be inserted';
END $$;