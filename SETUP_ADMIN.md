# Admin Setup Instructions

## Quick Setup (Required for Admin Access)

The admin page requires a `user_profiles` table that doesn't exist yet. Follow these steps:

### Step 1: Run SQL in Supabase Dashboard

1. Go to: https://supabase.com/dashboard/project/nslcadgicgkncajoyyno/sql/new
2. Copy and paste ALL the SQL from: `/supabase/migrations/create_user_profiles_table.sql`
3. Click "Run" to execute

### Step 2: Verify Admin Access

1. Sign in with `eimrib@yess.ai` 
2. Navigate to Admin tab in sidebar
3. You should now see the User Management page

## What This Does

- Creates `user_profiles` table for user management
- Sets up RLS policies for security
- Automatically assigns admin role to `eimrib@yess.ai`
- Creates trigger to auto-create profiles for new users

## Troubleshooting

If you still can't access admin after running the SQL:

1. Check browser console for errors
2. Try signing out and back in
3. Clear browser cache/cookies for the site

## Note

The admin page has fallback logic, so even if the table doesn't exist, `eimrib@yess.ai` will still be treated as admin. However, user management features won't work until the table is created.