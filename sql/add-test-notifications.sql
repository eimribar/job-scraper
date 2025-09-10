-- ========================================
-- ADD TEST NOTIFICATIONS FOR LIVE ACTIVITY FEED
-- Date: 2025-09-10
-- Purpose: Populate notifications table with test data
-- ========================================

-- Clear old test notifications (optional)
-- DELETE FROM notifications WHERE title LIKE 'Test:%';

-- Add recent company discovery notifications
INSERT INTO notifications (notification_type, title, message, metadata, created_at, is_read)
VALUES 
    ('company_discovered', 'New Company: Acme Corp', 'Detected using Outreach.io', 
     '{"company": "Acme Corp", "tool": "Outreach.io"}', NOW() - INTERVAL '5 minutes', false),
    
    ('company_discovered', 'New Company: TechStart', 'Detected using SalesLoft', 
     '{"company": "TechStart", "tool": "SalesLoft"}', NOW() - INTERVAL '10 minutes', false),
    
    ('analysis_complete', 'Batch Analysis Complete', 'Analyzed 50 jobs successfully', 
     '{"jobs_count": 50, "companies_found": 3}', NOW() - INTERVAL '15 minutes', false),
    
    ('company_discovered', 'New Company: GlobalSales', 'Detected using Both tools', 
     '{"company": "GlobalSales", "tool": "Both"}', NOW() - INTERVAL '20 minutes', false),
    
    ('scraping_started', 'Scraping Started', 'Processing search term: Sales Development', 
     '{"search_term": "Sales Development"}', NOW() - INTERVAL '30 minutes', false),
    
    ('scraping_completed', 'Scraping Complete', 'Found 25 new jobs', 
     '{"jobs_found": 25, "search_term": "Sales Development"}', NOW() - INTERVAL '25 minutes', false),
    
    ('company_discovered', 'New Company: StartupXYZ', 'Detected using Outreach.io', 
     '{"company": "StartupXYZ", "tool": "Outreach.io"}', NOW() - INTERVAL '1 hour', false),
    
    ('system', 'System Status', 'All systems operational', 
     '{"status": "healthy"}', NOW() - INTERVAL '2 hours', true),
    
    ('error', 'Processing Error', 'Failed to analyze 2 jobs - retrying', 
     '{"error_count": 2, "retry": true}', NOW() - INTERVAL '3 hours', true),
    
    ('company_discovered', 'New Company: EnterpriseCo', 'Detected using SalesLoft', 
     '{"company": "EnterpriseCo", "tool": "SalesLoft"}', NOW() - INTERVAL '4 hours', false);

-- Verify notifications were added
SELECT 
    'Notifications Added' as status,
    COUNT(*) as count,
    COUNT(CASE WHEN is_read = false THEN 1 END) as unread_count
FROM notifications
WHERE created_at > NOW() - INTERVAL '5 hours';

-- Show recent notifications
SELECT 
    notification_type,
    title,
    message,
    created_at,
    is_read
FROM notifications
ORDER BY created_at DESC
LIMIT 10;