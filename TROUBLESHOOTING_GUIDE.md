# 🔧 Troubleshooting Guide - Job Scraper Automation

## Quick Diagnostics

### Check System Health
```bash
# 1. Check current processing status
node scripts/monitor-gpt5.js

# 2. Check if analyzer is running
curl http://localhost:4001/api/cron/analyzer

# 3. Check database connection
node scripts/check-companies.js
```

## Common Issues & Solutions

### 1. Jobs Marked as Processed Without Analysis

**Symptoms:**
- High number of processed jobs but no companies detected
- Detection rate < 5%
- Jobs have `processed = true` but no actual GPT analysis

**Solution:**
```bash
# Reset falsely processed jobs from today
node scripts/reset-false-processed.js

# Reset ALL jobs from today (except CRO)
node scripts/reset-all-today.js
```

**Prevention:**
- The analyzer now validates GPT responses before marking as processed
- Jobs are only marked processed if valid analysis is returned

### 2. GPT-5 API Errors

**Symptoms:**
- "Model not found" errors
- API timeout errors
- Parse errors in responses

**Solutions:**

1. **Verify API Key:**
```bash
# Check if API key is set
echo $OPENAI_API_KEY

# Test API directly
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY" | grep gpt-5
```

2. **Check Model Name:**
- MUST use: `gpt-5-mini-2025-08-07`
- Never change to GPT-4 or other models
- Model is hardcoded in `continuousAnalyzerService.ts`

3. **API Credits:**
```bash
# Check OpenAI usage at:
# https://platform.openai.com/usage
```

### 3. Low Detection Rate

**Normal Range:** 10-35% detection rate is healthy

**If below 10%:**
1. Check if GPT-5 is actually responding
2. Verify prompts are working correctly
3. Check for parsing errors in logs

**Debug Steps:**
```bash
# Watch real-time processing
node scripts/monitor-gpt5.js --watch

# Check recent detections
psql $DATABASE_URL -c "
SELECT company, tool_detected, identified_date 
FROM identified_companies 
ORDER BY identified_date DESC 
LIMIT 10;"
```

### 4. Processing Too Slow

**Current Settings:**
- Analyzer runs every 5 minutes
- Processes 100 jobs per batch
- Each job analyzed individually

**To Speed Up:**
1. Temporarily increase batch size (not recommended long-term):
```javascript
// In app/api/cron/analyzer/route.ts
const result = await analyzer.processBatch(200); // Increased from 100
```

2. Clear backlog manually:
```bash
# Run multiple times to clear faster
curl -X POST http://localhost:4001/api/cron/analyzer \
  -H "Authorization: Bearer $CRON_SECRET"
```

### 5. Duplicate Companies

**Symptoms:**
- Same company appears multiple times
- Database constraint violations

**Solution:**
```bash
# Add unique constraint (if not exists)
psql $DATABASE_URL -c "
ALTER TABLE identified_companies 
ADD CONSTRAINT unique_company_tool 
UNIQUE (company, tool_detected);"
```

### 6. Cron Jobs Not Running

**Check Vercel Cron Status:**
1. Go to Vercel Dashboard
2. Check Functions tab
3. Look for cron execution logs

**Local Testing:**
```bash
# Test scraper (runs hourly)
curl http://localhost:4001/api/cron/scraper

# Test analyzer (runs every 5 min)
curl http://localhost:4001/api/cron/analyzer

# Test health check (runs every 30 min)
curl http://localhost:4001/api/cron/health-check
```

### 7. Database Connection Issues

**Symptoms:**
- "Connection timeout" errors
- "Too many connections" errors

**Solutions:**
1. Check Supabase status: https://status.supabase.com
2. Verify connection string in .env.local
3. Restart the application

### 8. Memory Issues

**Symptoms:**
- Process crashes after running for a while
- "JavaScript heap out of memory" errors

**Solution:**
```bash
# Increase Node memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run dev
```

## Monitoring Commands

### Real-time Monitoring
```bash
# Watch processing in real-time
node scripts/monitor-gpt5.js --watch

# Check automation status
curl http://localhost:4001/api/automation/status

# View recent notifications
psql $DATABASE_URL -c "
SELECT type, title, created_at 
FROM notifications 
ORDER BY created_at DESC 
LIMIT 20;"
```

### Daily Health Checks
```bash
# Morning checklist
1. node scripts/monitor-gpt5.js        # Check overnight processing
2. Check Vercel Dashboard for errors   # Review cron execution
3. Verify detection rate is 10-35%     # Healthy range
4. Check unprocessed backlog < 1000    # Manageable queue size
```

## Emergency Procedures

### Complete System Reset
```bash
# 1. Stop all processing
# 2. Reset all jobs from today
node scripts/reset-all-today.js

# 3. Clear notifications
psql $DATABASE_URL -c "DELETE FROM notifications WHERE created_at > NOW() - INTERVAL '1 day';"

# 4. Restart processing
npm run dev
```

### Rollback Bad Data
```bash
# Remove companies detected today (if bad data)
psql $DATABASE_URL -c "
DELETE FROM identified_companies 
WHERE DATE(identified_date) = CURRENT_DATE;"

# Reset jobs for reprocessing
node scripts/reset-false-processed.js
```

## Configuration Reference

### Critical Settings (DO NOT CHANGE)
- **Model:** `gpt-5-mini-2025-08-07`
- **Processing:** Sequential (one job at a time)
- **Batch Size:** 100 jobs per run
- **Cron Schedule:** Every 5 minutes

### Environment Variables
```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=           # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=      # Supabase anon key
OPENAI_API_KEY=                     # OpenAI API key

# Optional
SUPABASE_SERVICE_ROLE_KEY=          # For admin operations
CRON_SECRET=                        # For cron security
APIFY_API_TOKEN=                    # For scraping
```

## Performance Benchmarks

### Healthy System Metrics
- **Processing Rate:** 800-1200 jobs/hour
- **Detection Rate:** 10-35%
- **Error Rate:** <2%
- **API Response Time:** <2 seconds
- **Database Query Time:** <100ms

### Warning Signs
- Detection rate <5% or >50%
- Error rate >5%
- Unprocessed backlog >5000
- API timeouts >10% of requests

## Contact & Escalation

### For Critical Issues:
1. Check this guide first
2. Review logs in Vercel Dashboard
3. Check OpenAI API status
4. Verify Supabase is operational

### Common Log Locations:
- **Vercel Logs:** Functions tab in dashboard
- **Local Logs:** Console output
- **Database Logs:** Supabase Dashboard > Logs

## Recent Fixes (Updated: <%= new Date().toISOString().split('T')[0] %>)

1. ✅ Standardized GPT model to `gpt-5-mini-2025-08-07`
2. ✅ Fixed hardcoded path references
3. ✅ Removed confidence field (not in schema)
4. ✅ Fixed notification table field naming
5. ✅ Added validation before marking jobs as processed
6. ✅ Updated environment example with all variables

---

Remember: **NEVER change the GPT model from gpt-5-mini-2025-08-07**