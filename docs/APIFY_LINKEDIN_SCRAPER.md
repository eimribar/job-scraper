# 🔍 Apify LinkedIn Jobs Scraper Documentation

## Overview
We use Apify's LinkedIn Jobs Scraper to automatically collect job postings for our 37 search terms.

## 🔑 Configuration

### Endpoint
```
https://api.apify.com/v2/acts/bebity~linkedin-jobs-scraper/run-sync-get-dataset-items
```

### Authentication
```
Token: [YOUR_APIFY_TOKEN]
```

## 📝 Request Format

### Standard Request Body
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

### Parameters
- **proxy**: Always use Apify proxy for reliability
- **rows**: 1000 (max jobs per search)
- **title**: The search term (e.g., "SDR", "BDR", "Revenue Operations")

## 📊 Response Format

### Job Object Structure
```json
{
    "job_id": "3456789012",
    "title": "Sales Development Representative",
    "company": "TechCorp Inc",
    "location": "San Francisco, CA",
    "description": "We're looking for an SDR with Outreach.io experience...",
    "url": "https://linkedin.com/jobs/view/3456789012",
    "posted_date": "2025-09-07T12:00:00Z"
}
```

## 🔄 Integration with Search Terms

### Automated Flow
1. System checks `search_terms` table for terms older than 7 days
2. Sends request to Apify with the search term
3. Receives up to 1000 jobs
4. Processes each job through GPT-5 for tool detection
5. Updates `last_scraped_date` in database

### Example Implementation
```javascript
const scrapeLinkedInJobs = async (searchTerm) => {
    const response = await fetch(
        'https://api.apify.com/v2/acts/bebity~linkedin-jobs-scraper/run-sync-get-dataset-items?token=[YOUR_APIFY_TOKEN]',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                proxy: { useApifyProxy: true, apifyProxyGroups: [] },
                rows: 1000,
                title: searchTerm
            })
        }
    );
    return await response.json();
};
```

## 📈 Rate Limits & Costs

- **Rate Limit**: 100 requests per minute
- **Cost**: ~$0.04 per 1000 jobs scraped
- **Weekly Estimate**: 37 terms × $0.04 = ~$1.48/week

## 🎯 Our 37 Search Terms

Automatically scraped weekly:
- SDR, BDR, Sales Development Representative
- Revenue Operations, RevOps, Sales Operations
- Account Executive, Enterprise AE
- VP Sales, Director of Sales, CRO
- And 30 more...

## ⚡ Quick Test

Test a single search term:
```bash
curl -X POST "https://api.apify.com/v2/acts/bebity~linkedin-jobs-scraper/run-sync-get-dataset-items?token=[YOUR_APIFY_TOKEN]" \
-H "Content-Type: application/json" \
-d '{
    "proxy": {"useApifyProxy": true, "apifyProxyGroups": []},
    "rows": 10,
    "title": "SDR"
}'
```