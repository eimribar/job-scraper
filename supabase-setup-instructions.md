# Supabase Database Setup Instructions

## Quick Setup

1. **Open Supabase SQL Editor:**
   https://supabase.com/dashboard/project/nslcadgicgkncajoyyno/sql/new

2. **Copy the entire contents** of `migrations/enhanced-schema.sql`

3. **Paste and execute** in the SQL editor (click "Run" or press Ctrl+Enter)

## What Will Be Created

### Core Tables
- **companies** - Stores company data with tool detection results
- **scraping_intelligence** - Adaptive scheduling and yield tracking
- **job_queue** - Smart queue management with priorities
- **analysis_cache** - Cost optimization through caching
- **audit_log** - Complete system traceability
- **metrics** - Performance and cost tracking
- **company_duplicates** - Fuzzy matching relationships

### Functions & Triggers
- Company name normalization
- Signal strength calculation
- Automatic timestamp updates
- Generated columns for intelligence

### Initial Data
- Default search terms (SDR, BDR, Revenue Operations, etc.)
- Priority settings for each search term

## Verification

After executing the schema, run this command to verify:

```bash
node scripts/init-supabase.js
```

You should see all green checkmarks (✅) for each table.

## Important Notes

1. **Service Role Key**: You'll need to get the service role key from:
   - Supabase Dashboard → Settings → API → Service Role Key
   - Add it to `.env.local` as `SUPABASE_SERVICE_ROLE_KEY`

2. **Row Level Security (RLS)**: Currently disabled for development. Enable for production:
   ```sql
   ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
   ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
   ```

3. **PostgreSQL Extensions**: The schema uses these extensions (auto-enabled):
   - `uuid-ossp` or `pgcrypto` for UUID generation
   - Text search capabilities for fuzzy matching

## Troubleshooting

If you encounter errors:

1. **"function gen_random_uuid() does not exist"**
   - The schema will automatically use `uuid_generate_v4()` as fallback

2. **"relation already exists"**
   - Tables already created, safe to ignore

3. **Permission errors**
   - Make sure you're using the SQL editor in the Supabase dashboard

## Next Steps

After successful setup:

1. Get your service role key from Supabase dashboard
2. Update `.env.local` with the service role key
3. Restart the Next.js development server
4. Test the application at http://localhost:3001

## Direct SQL Link

Click here to go directly to the SQL editor:
https://supabase.com/dashboard/project/nslcadgicgkncajoyyno/sql/new