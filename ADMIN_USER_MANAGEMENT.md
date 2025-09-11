# Admin User Management System

## Overview
A comprehensive, enterprise-grade user management system for the Job Scraper admin panel. This system provides full control over user accounts, roles, permissions, and activity monitoring.

## Features

### 🎯 Core Functionality
- **User Management**: Complete CRUD operations for user accounts
- **Role-Based Access Control**: Admin, Editor, and Viewer roles
- **Real-time Updates**: Live user status tracking and activity monitoring
- **Invitation System**: Email-based user invitations with expiry tracking
- **Bulk Operations**: Mass delete and export functionality
- **Activity Logging**: Comprehensive audit trail of all user actions
- **Security Features**: Two-factor authentication support, session management

### 📊 User Statistics Dashboard
- Total users count with growth metrics
- Active users (online now)
- Role distribution (Admins, Editors, Viewers)
- Activity metrics (today, this week, this month)
- New user registrations

### 👥 User Table Features
- **Advanced Filtering**: By role, status, department
- **Smart Search**: Search by name, email, or department
- **Sorting**: Multiple column sorting options
- **Bulk Selection**: Select multiple users for batch operations
- **Online Status**: Real-time online/offline indicators
- **Quick Actions**: Role changes, status updates, password resets

### 🔐 Security & Permissions
- Admin-only access control
- Audit logging for all admin actions
- IP address tracking
- Failed login attempt monitoring
- Account suspension with reasons
- Two-factor authentication status

## Database Schema

### Enhanced Tables

```sql
-- user_profiles (enhanced)
- status (active, suspended, pending, inactive)
- last_seen (timestamp)
- login_count (integer)
- failed_login_attempts (integer)
- two_factor_enabled (boolean)
- permissions (JSONB)
- metadata (JSONB)
- department (text)
- job_title (text)
- phone_number (text)

-- user_activity_logs
- user_id (UUID)
- action (varchar)
- resource_type (varchar)
- resource_id (text)
- details (JSONB)
- ip_address (INET)
- user_agent (text)
- created_at (timestamp)

-- user_invitations
- email (text)
- role (varchar)
- invited_by (UUID)
- invitation_token (text)
- expires_at (timestamp)
- accepted_at (timestamp)
- metadata (JSONB)

-- user_sessions
- user_id (UUID)
- session_token (text)
- ip_address (INET)
- user_agent (text)
- last_activity (timestamp)
- is_active (boolean)

-- audit_logs
- admin_id (UUID)
- target_user_id (UUID)
- action (varchar)
- previous_value (JSONB)
- new_value (JSONB)
- reason (text)
```

## Setup Instructions

### 1. Database Setup
Run the migration script in your Supabase SQL editor:

```bash
# Run the admin user management schema
psql -f sql/admin-user-management-schema.sql
```

### 2. Environment Variables
Ensure your `.env.local` has the required Supabase keys:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Access the Admin Panel
Navigate to `/admin/users` to access the user management system.

## Usage Guide

### Inviting Users
1. Click "Invite User" button
2. Choose between single or bulk invite
3. Fill in user details (email, name, role, department)
4. Optional: Add a personal message
5. Send invitation

### Managing Users
1. **View Details**: Click on any user row to see full profile
2. **Edit User**: Use the dropdown menu → Edit User
3. **Change Role**: Quick role change from dropdown
4. **Suspend/Activate**: Toggle user status instantly
5. **Reset Password**: Send password reset email
6. **Delete User**: Remove user (with confirmation)

### Monitoring Activity
1. Switch to "Activity Logs" tab
2. Filter by action type or user
3. View detailed activity timeline
4. Export logs for compliance

### Bulk Operations
1. Select multiple users using checkboxes
2. Choose bulk action (delete, export)
3. Confirm action

## API Endpoints

### User Management
- `POST /api/admin/users/invite` - Send user invitation
- `PUT /api/admin/users/invite` - Bulk invite users
- `GET /api/admin/users` - List all users
- `PATCH /api/admin/users/[id]` - Update user
- `DELETE /api/admin/users/[id]` - Delete user

### Activity & Monitoring
- `GET /api/admin/users/activity` - Get activity logs
- `GET /api/admin/users/sessions` - Get active sessions
- `GET /api/admin/users/stats` - Get user statistics

## Component Structure

```
/app/admin/users/
├── page.tsx                    # Server component (auth & data)
├── components/
│   ├── UserManagementClient.tsx # Main client component
│   ├── UserTable.tsx           # User data table
│   ├── UserStats.tsx           # Statistics cards
│   ├── UserFilters.tsx         # Filter controls
│   ├── UserDetailsDialog.tsx   # User detail view
│   ├── EditUserDialog.tsx      # Edit user form
│   ├── InviteUserDialog.tsx    # Invitation form
│   └── UserActivityLog.tsx     # Activity timeline
```

## Security Considerations

1. **Authentication**: All routes require authentication
2. **Authorization**: Admin role required for all operations
3. **Audit Trail**: All actions are logged with user and IP
4. **Data Protection**: Sensitive data encrypted at rest
5. **Session Management**: Automatic session expiry
6. **Rate Limiting**: API endpoints are rate-limited

## Performance Optimizations

- **Virtual Scrolling**: Large user lists use virtual scrolling
- **Debounced Search**: Search input is debounced (300ms)
- **Optimistic Updates**: UI updates before server confirmation
- **React Query Caching**: Data cached for improved performance
- **Lazy Loading**: User details loaded on demand
- **Real-time Subscriptions**: WebSocket for live updates

## Troubleshooting

### Common Issues

1. **Users not appearing**: Check database connection and RLS policies
2. **Invitations failing**: Verify email service configuration
3. **Real-time updates not working**: Check WebSocket connection
4. **Permission denied**: Ensure user has admin role

### Debug Commands

```sql
-- Check user roles
SELECT email, role, status FROM user_profiles;

-- View recent activity
SELECT * FROM user_activity_logs ORDER BY created_at DESC LIMIT 10;

-- Check pending invitations
SELECT * FROM user_invitations WHERE accepted_at IS NULL;
```

## Future Enhancements

- [ ] Email service integration (SendGrid/Resend)
- [ ] Advanced permission system
- [ ] Custom role creation
- [ ] User impersonation for debugging
- [ ] Advanced analytics dashboard
- [ ] Export to multiple formats (PDF, Excel)
- [ ] Scheduled user reports
- [ ] API key management per user

## Support

For issues or questions, check:
- Database logs in Supabase dashboard
- Browser console for client-side errors
- Network tab for API responses
- Activity logs for audit trail