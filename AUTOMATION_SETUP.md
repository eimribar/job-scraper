# 🤖 Automated Weekly Scraping System

## Overview
The system automatically monitors and scrapes 37 search terms, ensuring each term is scraped at least once every 7 days. No manual intervention required!

## 🗂️ Database Structure (Matching Your CSV)

### `search_terms` Table
```sql
- search_term (VARCHAR) - The search term to scrape
- last_scraped_date (TIMESTAMP) - When it was last scraped  
- jobs_found_count (INTEGER) - Jobs found in last scrape
- platform_last_scraped (VARCHAR) - Platform used (LinkedIn)
- needs_scraping (BOOLEAN) - Auto-calculated: true if >7 days old
```

### Additional Tables
- `notifications` - Real-time alerts for discoveries
- `scraping_runs` - Track each automated scraping session

## 🚀 How It Works

### Automatic Detection
The system continuously checks for search terms that:
- Have **never been scraped** (null last_scraped_date)
- Were scraped **more than 7 days ago**

### Processing Flow
1. **Check** - Every 5 minutes, check for terms needing scraping
2. **Scrape** - Automatically scrape the oldest term first
3. **Analyze** - Send jobs to GPT-5 for company detection
4. **Update** - Update last_scraped_date and statistics
5. **Notify** - Send notifications for new discoveries

## 📋 Setup Instructions

### Step 1: Execute SQL Migration
```bash
# Open Supabase SQL editor
open https://supabase.com/dashboard/project/nslcadgicgkncajoyyno/sql/new

# Copy and execute: migrations/create-search-terms-exact.sql
```

### Step 2: Import Your CSV Data
```bash
# This imports your 33 search terms from the CSV
node scripts/import-search-terms-csv.js
```

### Step 3: Start Automation
```bash
# Start the automatic scheduler (checks every 5 minutes)
curl -X POST http://localhost:4001/api/automation \
  -H "Content-Type: application/json" \
  -d '{"action": "start", "intervalMinutes": 5}'
```

## 📊 Your 37 Search Terms

Based on your CSV, the system will track:

### Already Scraped (33 terms from CSV)
- SDR, BDR, Sales Development Representative
- Revenue Operations, RevOps, Sales Operations
- Account Executive, Head of Sales
- VP/Director roles
- And 25 more...

### Added to reach 37 total
- Chief Revenue Officer
- CRO  
- Sales Enablement
- Sales Engineer

## 🔍 Monitoring

### Check Automation Status
```bash
curl http://localhost:4001/api/automation
```

### View Terms Needing Scraping
```sql
SELECT * FROM search_terms 
WHERE last_scraped_date IS NULL 
   OR last_scraped_date < NOW() - INTERVAL '7 days'
ORDER BY last_scraped_date ASC NULLS FIRST;
```

### Check Recent Runs
```sql
SELECT * FROM scraping_runs 
ORDER BY started_at DESC 
LIMIT 10;
```

## 📔 API Endpoints

### Start/Stop Automation
```bash
POST /api/automation
{
  "action": "start" | "stop",
  "intervalMinutes": 5  // How often to check (default: 5)
}
```

### Get Status
```bash
GET /api/automation
# Returns current status, statistics, and terms needing scraping
```

## 🎯 Key Features

1. **Zero-Touch Operation** - Runs 24/7 automatically
2. **Smart Prioritization** - Scrapes oldest terms first
3. **7-Day Guarantee** - Every term scraped weekly
4. **Real-time Notifications** - Alerts for new discoveries
5. **Error Recovery** - Automatic retry on failures
6. **Statistics Tracking** - Monitor performance over time

## 📈 Expected Results

With 37 search terms scraped weekly:
- **~18,500 jobs/week** (500 jobs × 37 terms)
- **~100-200 new companies/week** (based on current detection rate)
- **Automatic deduplication** - No duplicate companies
- **Continuous discovery** - Never miss a new company

## 🔧 Troubleshooting

### Terms Not Being Scraped
```bash
# Check if automation is running
curl http://localhost:4001/api/automation

# Manually trigger for a specific term
curl -X POST http://localhost:4001/api/scrape/trigger \
  -H "Content-Type: application/json" \
  -d '{"searchTerm": "SDR"}'
```

### View Logs
```bash
# Check scraping runs
SELECT * FROM scraping_runs WHERE status = 'failed';

# Check notifications
SELECT * FROM notifications ORDER BY created_at DESC;
```

## ✅ System is Ready!

Once you've executed the SQL and imported the CSV, the system will:
1. **Automatically identify** which terms need scraping (>7 days old)
2. **Process them one by one** throughout the week
3. **Send notifications** for each new company discovered
4. **Maintain a perfect 7-day scraping cycle** for all 37 terms

No manual intervention needed - it runs continuously!