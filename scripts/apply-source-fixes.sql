-- Fix the 14 false discoveries (companies from CSV marked as job_analysis)
UPDATE identified_companies
SET source = 'google_sheets'
WHERE id IN (
    '943',
    '753',
    '307',
    '952',
    '306',
    '706',
    '745',
    '153',
    '1006',
    '244',
    '1014',
    '747',
    '399',
    '295'
);

-- Verify the counts after update
SELECT 
  source,
  COUNT(*) as count
FROM identified_companies
GROUP BY source
ORDER BY source;