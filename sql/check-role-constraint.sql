-- Check the exact constraint on the role column
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'user_profiles'::regclass
AND contype = 'c';

-- Check column details
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable,
    udt_name
FROM information_schema.columns
WHERE table_name = 'user_profiles' 
AND column_name = 'role';

-- Check what values are actually in the table
SELECT DISTINCT role, COUNT(*) 
FROM user_profiles 
GROUP BY role;