# 🔧 API Route Consolidation Plan

## Current State: 42 Routes with Massive Duplication

### Identified Duplicates & Consolidation Plan:

## 1. ❌ PROCESSING/ANALYSIS Routes (7 duplicates → 1)
**Current:**
- `/api/analyze` - Standalone analyzer
- `/api/continuous` - Continuous processing
- `/api/process/start` - Start processing
- `/api/process/status` - Check status
- `/api/process/stop` - Stop processing
- `/api/automation/process-term` - Process by term
- `/api/cron/analyzer` - Cron analyzer

**✅ Consolidate to:**
```
/api/processor
  GET  - Get status
  POST - Start processing (with options)
  DELETE - Stop processing
```

## 2. ❌ SCRAPING Routes (5 duplicates → 1)
**Current:**
- `/api/scrape` - Basic scrape
- `/api/scrape/status` - Scrape status
- `/api/scrape/trigger` - Trigger scrape
- `/api/scrape/weekly` - Weekly scrape
- `/api/cron/scraper` - Cron scraper

**✅ Consolidate to:**
```
/api/scraper
  GET  - Get status
  POST - Trigger scrape (with schedule options)
```

## 3. ❌ HEALTH/MONITORING Routes (5 duplicates → 1)
**Current:**
- `/api/health` - Basic health
- `/api/monitor/health` - Monitor health
- `/api/monitor/metrics` - Metrics
- `/api/cron/health-check` - Cron health
- `/api/debug` - Debug info

**✅ Consolidate to:**
```
/api/health
  GET - Complete health status with metrics
```

## 4. ❌ AUTOMATION Routes (4 duplicates → 1)
**Current:**
- `/api/automation` - Base automation
- `/api/automation/status` - Status
- `/api/automation/metrics` - Metrics
- `/api/automation/trigger` - Trigger

**✅ Consolidate to:**
```
/api/automation
  GET  - Status and metrics
  POST - Trigger automation
```

## 5. ❌ DASHBOARD/STATS Routes (3 duplicates → 1)
**Current:**
- `/api/dashboard` - Dashboard data
- `/api/dashboard/stats` - Stats
- `/api/queue/status` - Queue status

**✅ Consolidate to:**
```
/api/dashboard
  GET - All dashboard data including queue
```

## 6. ❌ COMPANIES Routes (Keep but organize)
**Current structure is OK but needs organization:**
```
/api/companies
  GET    - List companies
  POST   - Update lead status
  /export
    GET  - Export CSV
  /stats
    GET  - Statistics
  /{id}/leads
    POST - Update specific company
```

## 7. ❌ SYNC Routes (4 routes → 1)
**Current:**
- `/api/sync/pull` - Pull data
- `/api/sync/push` - Push data
- `/api/sync/status` - Sync status
- `/api/sync/webhook` - Webhook

**✅ Consolidate to:**
```
/api/sync
  GET  - Status
  POST - Sync (with direction parameter)
  /webhook
    POST - Handle webhooks
```

## 8. ✅ KEEP AS-IS (These are fine):
- `/api/tier-one/*` - Tier one management
- `/api/test` - Testing endpoint
- `/api/test-apify` - Apify testing
- `/api/search-terms/status` - Search terms

## 9. ❌ REMOVE (Obsolete):
- `/api/cron/weekly` - Duplicate of scraper
- `/api/export` - Duplicate of companies/export
- `/api/companies/deduplicate` - Not used
- `/api/companies/lead-stats` - Duplicate of stats

---

## Final Structure (42 → 12 routes):

```
/api
  /processor      - All processing operations
  /scraper        - All scraping operations
  /health         - System health & metrics
  /automation     - Automation control
  /dashboard      - Dashboard data
  /companies      - Company management
    /export
    /stats
    /{id}/leads
  /tier-one       - Tier 1 companies
    /update-lead-status
  /sync           - Data synchronization
    /webhook
  /search-terms   - Search term management
    /status
  /test           - Testing utilities
  /test-apify     - Apify testing
```

## Benefits:
- **70% reduction** in routes (42 → 12)
- **Clear REST semantics** (GET/POST/DELETE)
- **No more confusion** about which endpoint to use
- **Easier maintenance** and documentation
- **Better performance** with fewer route handlers

## Implementation Steps:
1. Create new consolidated routes
2. Update all references in frontend
3. Add deprecation warnings to old routes
4. Test thoroughly
5. Remove old routes after 1 week