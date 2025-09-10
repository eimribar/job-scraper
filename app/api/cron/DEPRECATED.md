# ⚠️ DEPRECATED CRON ROUTES

These cron routes are maintained for backward compatibility with Vercel cron configuration.
They now redirect to the consolidated endpoints.

## Migration Map:
- `/api/cron/analyzer` → Uses `/api/processor` (UnifiedProcessorService)
- `/api/cron/scraper` → Redirects to `/api/scraper`
- `/api/cron/health-check` → Redirects to `/api/health`
- `/api/cron/weekly` → REMOVED (duplicate of scraper)

## Vercel Cron Configuration (vercel.json):
```json
"crons": [
  {
    "path": "/api/cron/analyzer",
    "schedule": "*/5 * * * *"  // Every 5 minutes
  },
  {
    "path": "/api/cron/scraper", 
    "schedule": "0 * * * *"     // Every hour
  },
  {
    "path": "/api/cron/health-check",
    "schedule": "*/30 * * * *"  // Every 30 minutes
  }
]
```

These routes remain for Vercel compatibility but internally use the consolidated services.