# 🚀 Backend Setup Guide

> **Complete guide to setting up the Sales Tool Detector backend with all required services**

## 📋 Table of Contents
- [Prerequisites](#prerequisites)
- [Quick Setup](#quick-setup)
- [Service Configuration](#service-configuration)
- [Testing](#testing)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

## ✅ Prerequisites

### Required Software
- **Node.js 18+** - [Download](https://nodejs.org)
- **npm 9+** - Included with Node.js
- **Git** - [Download](https://git-scm.com)

### Required Accounts
- **Supabase** - [Sign up](https://supabase.com)
- **OpenAI** - [Sign up](https://platform.openai.com)
- **Apify** - [Sign up](https://apify.com)
- **Vercel** (for deployment) - [Sign up](https://vercel.com)

## 🚀 Quick Setup

### 1. Run the Setup Wizard

```bash
# Install dependencies first
npm install

# Run the interactive setup wizard
npm run setup
```

The wizard will guide you through:
- Creating a Supabase project
- Configuring OpenAI API access
- Setting up Apify scrapers
- Enabling optional features

### 2. Manual Setup (Alternative)

If you prefer manual setup:

```bash
# Copy environment template
cp .env.local.example .env.local

# Edit with your values
nano .env.local
```

## 🔧 Service Configuration

### Supabase Setup

1. **Create a Project**
   ```
   - Go to https://app.supabase.com
   - Click "New project"
   - Name: sales-tool-detector
   - Password: [save securely]
   - Region: [closest to you]
   ```

2. **Get Credentials**
   ```
   Settings → API →
   - Project URL → NEXT_PUBLIC_SUPABASE_URL
   - anon public → NEXT_PUBLIC_SUPABASE_ANON_KEY
   - service_role → SUPABASE_SERVICE_ROLE_KEY
   ```

3. **Run Database Migration**
   ```bash
   # After adding credentials to .env.local
   npm run migrate
   ```

4. **Verify Setup**
   ```bash
   # Check database tables in Supabase dashboard
   Table Editor → Should see:
   - jobs
   - identified_companies
   - search_terms
   - processed_ids
   - scraping_runs
   ```

### OpenAI Setup

1. **Get API Key**
   ```
   https://platform.openai.com/api-keys
   → Create new secret key
   → Copy to OPENAI_API_KEY
   ```

2. **Add Credits**
   ```
   Billing → Add payment method
   → Add initial credits ($10-20 recommended)
   ```

3. **Configure Model**
   ```env
   # Cost-effective option
   OPENAI_MODEL=gpt-4o-mini
   OPENAI_TEMPERATURE=0.3
   
   # Higher quality option
   OPENAI_MODEL=gpt-4o
   OPENAI_TEMPERATURE=0.5
   ```

### Apify Setup

1. **Get API Token**
   ```
   https://console.apify.com
   → Settings → Integrations
   → API token → Copy to APIFY_TOKEN
   ```

2. **Verify Actor Access**
   
   Test these actors work:
   - `misceres~indeed-scraper` - [Test](https://console.apify.com/actors/misceres~indeed-scraper)
   - `bebity~linkedin-jobs-scraper` - [Test](https://console.apify.com/actors/bebity~linkedin-jobs-scraper)

3. **Check Credits**
   ```
   Billing → Ensure you have credits
   Free tier: $5/month included
   ```

## 🧪 Testing

### 1. Health Check

```bash
# Basic health check
npm run test:health

# Detailed metrics
curl http://localhost:3001/api/health?detailed=true | jq
```

Expected healthy response:
```json
{
  "status": "healthy",
  "services": [
    {"name": "Supabase", "status": "healthy"},
    {"name": "OpenAI", "status": "healthy"},
    {"name": "Apify", "status": "healthy"},
    {"name": "Job Queues", "status": "healthy"},
    {"name": "Rate Limiters", "status": "healthy"}
  ]
}
```

### 2. Test Scraping

```bash
# Scrape 5 jobs for "SDR" keyword
npm run test:scrape

# Or with curl
curl -X POST http://localhost:3001/api/scrape \
  -H 'Content-Type: application/json' \
  -d '{
    "searchTerm": "SDR",
    "maxItemsPerPlatform": 5
  }'
```

### 3. Test Analysis

```bash
# Analyze unprocessed jobs
npm run test:analyze

# Or with curl
curl -X POST http://localhost:3001/api/analyze \
  -H 'Content-Type: application/json' \
  -d '{"limit": 5}'
```

### 4. Test Dashboard

```bash
# Get dashboard stats
curl http://localhost:3001/api/dashboard | jq
```

### 5. Test Export

```bash
# Export as CSV
curl "http://localhost:3001/api/companies/export?format=csv" \
  -o companies.csv

# Export as JSON
curl "http://localhost:3001/api/companies/export?format=json" \
  -o companies.json
```

## 🔨 Backend Architecture

### Service Layer
```
lib/services/
├── baseService.ts          # Base class with retry logic
├── rateLimiter.ts          # API rate limiting
├── improvedScraperService.ts  # Apify scraping
├── improvedAnalysisService.ts # OpenAI analysis
├── jobQueue.ts             # Background job processing
└── healthMonitor.ts        # System health monitoring
```

### API Endpoints
```
app/api/
├── scrape/         # POST - Trigger scraping
├── analyze/        # POST - Run AI analysis
├── companies/      # GET - Fetch companies
│   └── export/     # GET - Export data
├── dashboard/      # GET - Dashboard stats
└── health/         # GET - Health check
```

### Key Features
- **Retry Logic**: Automatic retry with exponential backoff
- **Rate Limiting**: Prevents API quota exhaustion
- **Job Queues**: Background processing with status tracking
- **Health Monitoring**: Real-time service health checks
- **Error Recovery**: Graceful degradation when services fail
- **Batch Processing**: Efficient bulk operations

## 📊 Configuration Options

### Rate Limiting
```env
# Requests per minute
SCRAPING_RATE_LIMIT=10      # Apify calls
ANALYSIS_RATE_LIMIT=30      # OpenAI calls
API_RATE_LIMIT_PER_MINUTE=100  # API endpoints
```

### Batch Processing
```env
BATCH_SIZE=20               # Jobs per batch
MAX_CONCURRENT_ANALYSIS=5   # Parallel AI calls
```

### Feature Flags
```env
ENABLE_AUTH=false           # Authentication
ENABLE_SLACK_NOTIFICATIONS=false  # Slack alerts
ENABLE_AUTO_SCRAPING=false  # Automated scraping
ENABLE_ANALYTICS=false      # Usage analytics
```

## 🚢 Production Deployment

### 1. Prepare for Production

```bash
# Build the application
npm run build

# Test production build
npm start
```

### 2. Set Production Environment

```env
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### 3. Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
Settings → Environment Variables → Add all from .env.local
```

### 4. Set Up Monitoring

- **Uptime Monitoring**: Use health endpoint
- **Error Tracking**: Consider Sentry integration
- **Analytics**: Enable PostHog or similar
- **Alerts**: Configure Slack webhooks

## 🐛 Common Issues

### Issue: "Supabase not configured"
```bash
# Verify credentials
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY

# Test connection
curl YOUR_SUPABASE_URL/rest/v1/ \
  -H "apikey: YOUR_ANON_KEY"
```

### Issue: "OpenAI 401 Unauthorized"
```bash
# Test API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Issue: "Apify actors not found"
```bash
# Verify token
curl "https://api.apify.com/v2/acts?token=YOUR_TOKEN"

# Check actor access
# Should list available actors
```

### Issue: "Rate limit exceeded"
```bash
# Adjust rate limits in .env.local
SCRAPING_RATE_LIMIT=5   # Reduce for testing
ANALYSIS_RATE_LIMIT=15  # Reduce for testing
```

## 📈 Monitoring & Optimization

### Check System Status
```bash
# View detailed metrics
curl http://localhost:3001/api/health?detailed=true | jq '.detailed'

# Monitor queues
curl http://localhost:3001/api/health | jq '.services[3].details'

# Check rate limiters
curl http://localhost:3001/api/health | jq '.services[4].details'
```

### Performance Tips
1. **Optimize Batch Sizes**: Adjust based on API limits
2. **Cache Results**: Avoid re-processing same companies
3. **Use Webhooks**: For real-time notifications
4. **Monitor Costs**: Track API usage regularly
5. **Scale Gradually**: Start small, increase limits as needed

## 🔐 Security Best Practices

1. **Never commit .env.local** - Use .gitignore
2. **Rotate API keys** regularly
3. **Use environment variables** in production
4. **Enable Row Level Security** in Supabase
5. **Implement rate limiting** on all endpoints
6. **Add authentication** before going public
7. **Monitor for anomalies** in usage patterns

## 🆘 Getting Help

### Resources
- [Supabase Docs](https://supabase.com/docs)
- [OpenAI API Reference](https://platform.openai.com/docs)
- [Apify Documentation](https://docs.apify.com)
- [Next.js Documentation](https://nextjs.org/docs)

### Support
- **GitHub Issues**: Bug reports and features
- **Discussions**: Questions and help
- **Email**: support@your-domain.com

---

## ✅ Setup Checklist

- [ ] Node.js 18+ installed
- [ ] Project dependencies installed (`npm install`)
- [ ] Supabase project created
- [ ] Database migrations run
- [ ] OpenAI API key configured
- [ ] Apify token configured
- [ ] Health check passing
- [ ] Test scraping working
- [ ] Test analysis working
- [ ] Dashboard loading data

Once all items are checked, your backend is ready! 🎉