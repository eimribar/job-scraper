# 🔧 API Configuration Guide
## Sales Tool Detector - Environment Variables & API Setup

**Last Updated**: August 27, 2025  
**Status**: Production Ready

---

## 🌍 **ENVIRONMENT VARIABLES**

### **Complete .env.local Configuration**

```bash
# ===========================================
# CORE API KEYS (Required for all environments)
# ===========================================

# OpenAI Configuration - CRITICAL: ONLY GPT-5-mini
OPENAI_API_KEY=[YOUR_OPENAI_API_KEY]
OPENAI_MODEL=gpt-5-mini-2025-08-07  # NEVER change this
OPENAI_TEMPERATURE=0.3  # Not used by GPT-5-mini but kept for compatibility

# Apify Configuration - LinkedIn Scraping
APIFY_TOKEN=[YOUR_APIFY_TOKEN]
APIFY_LINKEDIN_ACTOR=bebity~linkedin-jobs-scraper
APIFY_LINKEDIN_ENDPOINT=https://api.apify.com/v2/acts/bebity~linkedin-jobs-scraper/run-sync-get-dataset-items

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://nslcadgicgkncajoyyno.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zbGNhZGdpY2drbmNham95eW5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MTEyNTEsImV4cCI6MjA3MjM4NzI1MX0.VygboFJPF_vMdcxVyUVc10IXXmZmSShxbNZfXxng4MA
SUPABASE_SERVICE_ROLE_KEY=  # REQUIRED FOR PRODUCTION - Get from Supabase Dashboard

# ===========================================
# APPLICATION CONFIGURATION
# ===========================================

# Environment Settings
NODE_ENV=development  # Change to 'production' for production
NEXT_PUBLIC_APP_URL=http://localhost:3001  # Change to production URL
PORT=3001  # Avoid conflicts with other Next.js apps

# Rate Limiting (requests per minute)
SCRAPING_RATE_LIMIT=10
ANALYSIS_RATE_LIMIT=30
API_RATE_LIMIT_PER_MINUTE=100

# Processing Configuration
BATCH_SIZE=20
MAX_CONCURRENT_ANALYSIS=5  # Keep at 5 or lower for GPT-5-mini

# ===========================================
# SECURITY (Production Only)
# ===========================================

# Cron Job Security
CRON_SECRET=  # Generate with: openssl rand -hex 32

# Optional Security Headers
JWT_SECRET=  # If implementing authentication
ADMIN_EMAILS=  # Comma-separated list for admin access

# ===========================================
# FEATURE FLAGS
# ===========================================

ENABLE_AUTH=false
ENABLE_SLACK_NOTIFICATIONS=false
ENABLE_AUTO_SCRAPING=false
ENABLE_ANALYTICS=false
DEBUG=false
MOCK_APIS=false

# ===========================================
# MONITORING & ALERTS (Optional)
# ===========================================

SLACK_WEBHOOK_URL=  # For notifications
SENTRY_DSN=  # For error tracking
NEXT_PUBLIC_POSTHOG_KEY=  # For analytics
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

---

## 🔑 **API KEY SETUP GUIDE**

### **1. OpenAI API Key**

**Required**: GPT-5-mini access (currently limited availability)

1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create new API key
3. **IMPORTANT**: Verify GPT-5-mini model access
4. Set usage limits ($5-10/month recommended for testing)

**Critical Configuration:**
```typescript
// Exact configuration for GPT-5-mini
const response = await openai.chat.completions.create({
  model: 'gpt-5-mini-2025-08-07',  // EXACT model name
  messages: [...],
  max_completion_tokens: 2000,     // High limit for reasoning tokens
  // temperature: omitted (only default supported)
});
```

**Cost Estimates:**
- Input tokens: ~$0.15 per 1M tokens
- Output tokens: ~$0.60 per 1M tokens
- Per job analysis: ~$0.0001 (500 new jobs = ~$0.05)

### **2. Apify API Key**

1. Sign up at [Apify Console](https://console.apify.com/)
2. Go to Settings → Integrations → API tokens
3. Create new token with full access
4. **Budget**: Set to $10-20/month (LinkedIn scraping ~$0.08 per 500 jobs)

**Actor Configuration:**
```javascript
// LinkedIn Jobs Scraper Settings
{
  actorId: 'bebity~linkedin-jobs-scraper',
  input: {
    keyword: 'sales engineer',
    location: 'United States',
    maxItems: 500,
    proxyConfiguration: { useApifyProxy: true },
    // Do NOT use residential proxies (too expensive)
    apifyProxyGroups: []  // Standard datacenter proxies
  }
}
```

### **3. Supabase Configuration**

1. Create project at [Supabase Dashboard](https://supabase.com/dashboard)
2. Go to Settings → API
3. Copy Project URL and anon key (public)
4. **CRITICAL**: Copy service_role key (keep secret)

**Database Setup:**
```sql
-- Run these migrations in SQL Editor:
-- 1. migrations/supabase-ready-schema.sql
-- 2. migrations/import-schema-updates.sql

-- Verify tables exist:
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';
```

---

## 🔧 **PRODUCTION CONFIGURATION**

### **Vercel Environment Variables**

**Required for Production:**

```bash
# Set in Vercel Dashboard or CLI
npx vercel env add OPENAI_API_KEY
npx vercel env add APIFY_TOKEN  
npx vercel env add SUPABASE_SERVICE_ROLE_KEY
npx vercel env add CRON_SECRET

# Or via Vercel Dashboard:
# Settings → Environment Variables → Add New
```

### **Environment-Specific Values**

| Variable | Development | Production |
|----------|------------|------------|
| `NODE_ENV` | `development` | `production` |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3001` | `https://your-app.vercel.app` |
| `DEBUG` | `true` | `false` |
| `MOCK_APIS` | `false` | `false` |

---

## 🚀 **API ENDPOINTS CONFIGURATION**

### **Core Endpoints**

```typescript
// Production API Routes
POST /api/scrape/trigger        // Manual job processing
POST /api/scrape/weekly         // Process all search terms  
POST /api/cron/weekly           // Automated cron (secured)
GET  /api/companies            // Companies data
GET  /api/stats               // Dashboard statistics
```

### **Cron Job Security**

```typescript
// Secure cron endpoint
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  
  if (!authHeader || !secret) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  if (authHeader !== `Bearer ${secret}`) {
    return new Response('Invalid token', { status: 403 });
  }
  
  // Process jobs...
}
```

---

## 📊 **RATE LIMITING & QUOTAS**

### **OpenAI GPT-5-mini Limits**
- **RPM (Requests Per Minute)**: 3 (very low)
- **TPM (Tokens Per Minute)**: 40,000
- **Context Window**: 400,000 tokens total
- **Max Output**: 16,384 tokens per request

**Our Configuration:**
- 1-second delay between requests (60 RPM max)
- 2000 max_completion_tokens per request
- Sequential processing (no parallel requests)

### **Apify Rate Limits**
- **Concurrent Runs**: 100 (way more than needed)
- **Memory**: 4GB per actor run
- **Timeout**: 3600 seconds (1 hour)

**Our Usage:**
- 1 run per search term (37 total per week)
- ~2-3 minutes per run (500 jobs)
- Standard datacenter proxies (not residential)

### **Supabase Quotas**
- **Database Size**: 500MB (free tier)
- **Bandwidth**: 5GB/month
- **API Requests**: 50,000/month

**Our Usage:**
- ~100MB database (room for 100k+ companies)
- Minimal bandwidth (API-only access)
- ~2000 API requests per week

---

## 🛡️ **SECURITY BEST PRACTICES**

### **API Key Protection**
- ✅ Never commit API keys to git
- ✅ Use environment variables only
- ✅ Rotate keys quarterly
- ✅ Set usage limits and alerts

### **Database Security**
- ✅ Use service_role key only in server-side code
- ✅ Enable Row Level Security (RLS) when adding auth
- ✅ Regular automated backups
- ✅ Monitor query performance

### **Production Hardening**
- ✅ Enable HTTPS only
- ✅ Set security headers
- ✅ Rate limit API endpoints
- ✅ Monitor error rates and alerts

---

## 🔍 **TESTING API CONFIGURATION**

### **Verify OpenAI Setup**
```bash
node scripts/test-openai.js
```

### **Verify Apify Setup**
```bash
node scripts/test-scraping-pipeline.js
```

### **Verify Supabase Setup**
```bash
node scripts/test-data-service.js
```

### **Full System Test**
```bash
# Test complete pipeline with 10 jobs
curl -X POST http://localhost:3001/api/scrape/trigger \
  -H "Content-Type: application/json" \
  -d '{"searchTerm": "sales engineer", "maxItems": 10}'
```

---

## 📈 **COST MONITORING**

### **Monthly Cost Estimates**

| Service | Usage | Cost |
|---------|-------|------|
| **OpenAI GPT-5-mini** | ~2000 jobs/week | $2-3/month |
| **Apify LinkedIn** | 37 runs/week | $10-15/month |
| **Supabase** | Free tier | $0/month |
| **Vercel Pro** | Cron + hosting | $20/month |
| **Total** |  | **~$32-38/month** |

### **Cost Optimization**
- Use standard Apify proxies (not residential)
- Batch job processing to minimize API calls
- Monitor OpenAI token usage
- Use Supabase free tier initially

---

## 🚨 **TROUBLESHOOTING**

### **Common API Issues**

**OpenAI "Model not found"**
- Verify GPT-5-mini access in your account
- Check exact model name: `gpt-5-mini-2025-08-07`
- Ensure API key has model access

**Apify "Actor not found"**
- Verify actor ID: `bebity~linkedin-jobs-scraper`
- Check Apify token permissions
- Ensure sufficient credits

**Supabase Connection Failed**
- Verify project URL and keys
- Check database is not paused
- Test with anon key first, then service role

### **Environment Variable Issues**
```bash
# Check all variables are loaded
node -e "console.log(process.env.OPENAI_API_KEY?.substring(0,10))"
node -e "console.log(process.env.APIFY_TOKEN?.substring(0,10))"
```

---

**🎯 Ready for Production Deployment!**

All API configurations are tested and documented. Follow the [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) checklist to deploy with confidence.