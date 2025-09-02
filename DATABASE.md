# 🗄️ Database Documentation - Sales Tool Detector

## Database Overview
- **Provider**: Supabase (PostgreSQL)
- **Version**: PostgreSQL 15.x
- **Location**: Cloud-hosted
- **Backup**: Automatic daily backups

## Complete Schema

### Table: `identified_companies`
Primary table for companies identified as using sales tools.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| company | TEXT | NOT NULL | Company name |
| tool_detected | TEXT | NOT NULL | "Outreach.io", "SalesLoft", or "Both" |
| signal_type | TEXT | | "required", "preferred", or "stack_mention" |
| context | TEXT | | Exact quote from job description |
| confidence | TEXT | | "high", "medium", or "low" |
| job_title | TEXT | | Job title from posting |
| job_url | TEXT | | Link to job posting |
| linkedin_url | TEXT | | LinkedIn profile URL |
| platform | TEXT | DEFAULT 'LinkedIn' | Source platform |
| identified_date | TIMESTAMP | DEFAULT NOW() | When company was identified |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation time |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update time |

**Constraints:**
- `UNIQUE(company, tool_detected)` - Prevents duplicate company+tool combinations

**Indexes:**
- `idx_companies_tool` on `tool_detected`
- `idx_companies_date` on `identified_date DESC`

### Table: `raw_jobs`
Stores all job postings before analysis.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| job_id | TEXT | UNIQUE NOT NULL | Unique job identifier |
| platform | TEXT | | "LinkedIn", "Indeed", etc. |
| company | TEXT | NOT NULL | Company name |
| job_title | TEXT | NOT NULL | Job title |
| description | TEXT | | Full job description |
| location | TEXT | | Job location |
| job_url | TEXT | | Link to job posting |
| processed | BOOLEAN | DEFAULT false | Has been analyzed |
| created_at | TIMESTAMP | DEFAULT NOW() | When imported |
| analyzed_date | TIMESTAMP | | When processed |

**Indexes:**
- `idx_raw_jobs_processed` on `processed`
- `idx_raw_jobs_company` on `company`

### Table: `processing_queue`
Tracks job processing status and history.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| job_id | TEXT | UNIQUE NOT NULL | Reference to raw_jobs.job_id |
| status | TEXT | DEFAULT 'pending' | "pending", "processing", "completed", "error" |
| started_at | TIMESTAMP | | Processing start time |
| completed_at | TIMESTAMP | | Processing end time |
| error_message | TEXT | | Error details if failed |
| attempts | INTEGER | DEFAULT 1 | Number of processing attempts |

**Indexes:**
- `idx_processing_queue_status` on `status`
- `idx_processing_queue_job_id` on `job_id`

### Table: `sync_status`
Tracks Google Sheets synchronization.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| sheet_name | TEXT | NOT NULL | Google Sheet identifier |
| last_sync_at | TIMESTAMP | DEFAULT NOW() | Last sync time |
| sync_direction | TEXT | | "pull", "push", or "both" |
| records_synced | INTEGER | DEFAULT 0 | Number of records synced |
| errors | TEXT | | Any sync errors |

## Key Relationships

```sql
-- No foreign keys enforced, but logical relationships:
processing_queue.job_id -> raw_jobs.job_id
identified_companies.job_url -> raw_jobs.job_url (when available)
```

## Data Integrity Rules

### 1. Duplicate Prevention
```sql
-- Company+Tool must be unique
ALTER TABLE identified_companies
ADD CONSTRAINT unique_company_tool 
UNIQUE (company, tool_detected);
```

### 2. Job ID Uniqueness
```sql
-- Job IDs must be unique
ALTER TABLE raw_jobs
ADD CONSTRAINT unique_job_id 
UNIQUE (job_id);
```

### 3. Valid Enumerations
```sql
-- Check constraints for valid values
ALTER TABLE identified_companies
ADD CONSTRAINT valid_tool CHECK (
  tool_detected IN ('Outreach.io', 'SalesLoft', 'Both', 'none')
);

ALTER TABLE identified_companies
ADD CONSTRAINT valid_confidence CHECK (
  confidence IN ('high', 'medium', 'low')
);

ALTER TABLE processing_queue
ADD CONSTRAINT valid_status CHECK (
  status IN ('pending', 'processing', 'completed', 'error')
);
```

## Common Queries

### Get Dashboard Statistics
```sql
-- Total companies by tool
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN tool_detected = 'Outreach.io' THEN 1 END) as outreach,
  COUNT(CASE WHEN tool_detected = 'SalesLoft' THEN 1 END) as salesloft,
  COUNT(CASE WHEN tool_detected = 'Both' THEN 1 END) as both
FROM identified_companies;

-- Recent discoveries (last 24 hours)
SELECT company, tool_detected, identified_date
FROM identified_companies
WHERE identified_date >= NOW() - INTERVAL '24 hours'
ORDER BY identified_date DESC
LIMIT 10;

-- Processing status
SELECT status, COUNT(*) as count
FROM processing_queue
GROUP BY status;
```

### Find Duplicates
```sql
-- Check for duplicate companies
SELECT company, tool_detected, COUNT(*) as count
FROM identified_companies
GROUP BY company, tool_detected
HAVING COUNT(*) > 1;
```

### Performance Analysis
```sql
-- Jobs processed per day
SELECT 
  DATE(analyzed_date) as date,
  COUNT(*) as jobs_processed
FROM raw_jobs
WHERE processed = true
GROUP BY DATE(analyzed_date)
ORDER BY date DESC
LIMIT 30;

-- Success rate
SELECT 
  COUNT(CASE WHEN processed = true THEN 1 END)::float / COUNT(*) as success_rate
FROM raw_jobs;
```

## Database Maintenance

### Regular Cleanup
```sql
-- Remove old processing queue entries (keep last 7 days)
DELETE FROM processing_queue
WHERE status = 'completed'
AND completed_at < NOW() - INTERVAL '7 days';

-- Archive old jobs (>90 days)
INSERT INTO raw_jobs_archive
SELECT * FROM raw_jobs
WHERE created_at < NOW() - INTERVAL '90 days';

DELETE FROM raw_jobs
WHERE created_at < NOW() - INTERVAL '90 days';
```

### Performance Optimization
```sql
-- Update statistics
ANALYZE identified_companies;
ANALYZE raw_jobs;
ANALYZE processing_queue;

-- Reindex tables
REINDEX TABLE identified_companies;
REINDEX TABLE raw_jobs;

-- Vacuum to reclaim space
VACUUM ANALYZE;
```

## Backup & Recovery

### Manual Backup
```sql
-- Export to CSV via Supabase dashboard
-- Or use pg_dump:
pg_dump -h YOUR_HOST -U postgres -d postgres --table=identified_companies > backup.sql
```

### Recovery Procedure
1. Stop all processors
2. Restore from Supabase dashboard backup
3. Or use pg_restore:
```bash
pg_restore -h YOUR_HOST -U postgres -d postgres backup.sql
```
4. Verify data integrity
5. Restart processors

## Migration History

### Initial Schema (v1.0.0)
- Created base tables
- Added basic indexes

### Duplicate Prevention (v1.1.0)
```sql
ALTER TABLE identified_companies
ADD CONSTRAINT unique_company_tool 
UNIQUE (company, tool_detected);
```

### Performance Indexes (v1.2.0)
```sql
CREATE INDEX idx_raw_jobs_processed ON raw_jobs(processed);
CREATE INDEX idx_companies_date ON identified_companies(identified_date DESC);
```

### Google Sheets Sync (v2.0.0)
- Added sync_status table
- Added processing_queue enhancements

## Row-Level Security (RLS)

Currently disabled for development. For production:

```sql
-- Enable RLS
ALTER TABLE identified_companies ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users (read-only)
CREATE POLICY "Users can view companies" ON identified_companies
FOR SELECT USING (auth.role() = 'authenticated');

-- Policy for service role (full access)
CREATE POLICY "Service role full access" ON identified_companies
FOR ALL USING (auth.role() = 'service_role');
```

## Monitoring Queries

### Health Check
```sql
-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check for stuck jobs
SELECT job_id, status, started_at
FROM processing_queue
WHERE status = 'processing'
AND started_at < NOW() - INTERVAL '1 hour';
```

### Performance Metrics
```sql
-- Query performance
SELECT 
  query,
  calls,
  mean_exec_time,
  total_exec_time
FROM pg_stat_statements
WHERE query LIKE '%identified_companies%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

**Database Version**: 2.0.0
**Last Updated**: September 2, 2025
**Total Tables**: 4
**Total Records**: ~15,000+
