# 🚀 Apify LinkedIn Scraper Integration

## ✅ Configuration Complete

### API Details
- **Endpoint**: `https://api.apify.com/v2/acts/bebity~linkedin-jobs-scraper/run-sync-get-dataset-items`
- **Token**: Configured in `.env.local`
- **Actor**: bebity~linkedin-jobs-scraper

## 📝 How It Works

### 1. Request Format
```json
{
    "proxy": {
        "useApifyProxy": true,
        "apifyProxyGroups": []
    },
    "rows": 1000,
    "title": "{{SEARCH_TERM}}"
}
```

### 2. Search Terms (37 Total)
All terms from your CSV are loaded and will be scraped weekly:
- Never scraped: 4 terms
- Need scraping (>7 days): 33 terms

### 3. Automated Process
```
Search Term → Apify Scraper → LinkedIn Jobs → GPT-5 Analysis → Company Detection
```

## 🧪 Test Endpoints

### Quick Test (GET)
```bash
# Test with 5 SDR jobs
curl http://localhost:4001/api/test-apify?term=SDR&rows=5
```

### Full Test (POST)
```bash
curl -X POST http://localhost:4001/api/test-apify \
  -H "Content-Type: application/json" \
  -d '{"searchTerm": "Revenue Operations", "rows": 10}'
```

## 📊 Expected Performance

- **Speed**: ~15 seconds per search term (1000 jobs)
- **Cost**: ~$0.04 per search term
- **Weekly Cost**: 37 terms × $0.04 = ~$1.48
- **Weekly Jobs**: ~37,000 jobs scraped
- **Expected Companies**: 100-200 new per week

## 🔄 Automation Status

### Start Automation
```bash
curl -X POST http://localhost:4001/api/automation \
  -H "Content-Type: application/json" \
  -d '{"action": "start", "intervalMinutes": 5}'
```

### Check Status
```bash
curl http://localhost:4001/api/search-terms/status
```

## 📁 Key Files

- **Scraper Service**: `/lib/services/apifyLinkedInScraper.ts`
- **Auto Scheduler**: `/lib/services/autoScrapingScheduler.ts`
- **Test Endpoint**: `/app/api/test-apify/route.ts`
- **Documentation**: `/docs/APIFY_LINKEDIN_SCRAPER.md`

## ✨ Features

1. **Zero Configuration** - Just the search term changes
2. **Automatic Proxy** - Uses Apify proxy for reliability
3. **1000 Jobs Max** - Per search term per run
4. **Weekly Schedule** - Every term scraped once per week
5. **Smart Detection** - Only scrapes terms >7 days old

## 🎯 Next Steps

1. ✅ Apify token configured
2. ✅ 37 search terms loaded
3. ✅ Integration tested and working
4. ⏳ Start automation to begin weekly scraping
5. ⏳ Monitor dashboard for new company discoveries

The system is now ready to automatically scrape all 37 search terms weekly!