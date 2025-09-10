-- ========================================
-- ENABLE SUPABASE REALTIME FOR NOTIFICATIONS
-- Date: 2025-09-10
-- Purpose: Enable real-time updates for Live Activity Feed
-- ========================================

-- Enable realtime for the notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Verify realtime is enabled
SELECT 
    schemaname,
    tablename,
    'Realtime Enabled' as status
FROM 
    pg_publication_tables
WHERE 
    pubname = 'supabase_realtime'
    AND tablename = 'notifications';

-- If the above returns no rows, realtime is not enabled
-- You may need to enable it in Supabase Dashboard:
-- 1. Go to Database > Publications
-- 2. Click on supabase_realtime
-- 3. Add notifications table
-- 4. Save changes

-- Alternative: Enable realtime for all tables (use with caution)
-- ALTER PUBLICATION supabase_realtime SET (publish = 'insert, update, delete');

-- Check if notifications table exists and has data
SELECT 
    'Notifications Table Status' as check,
    COUNT(*) as total_records,
    COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 hour' THEN 1 END) as recent_records,
    COUNT(CASE WHEN is_read = false THEN 1 END) as unread_records
FROM notifications;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'REALTIME CONFIGURATION';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'If you see "Realtime Enabled" above, you''re all set!';
    RAISE NOTICE 'If not, enable realtime in Supabase Dashboard.';
    RAISE NOTICE '';
    RAISE NOTICE 'To test realtime:';
    RAISE NOTICE '1. Open the dashboard in your browser';
    RAISE NOTICE '2. Run: INSERT INTO notifications (notification_type, title, message) VALUES (''test'', ''Test'', ''Test message'');';
    RAISE NOTICE '3. The notification should appear instantly in Live Activity Feed';
    RAISE NOTICE '====================================';
END $$;