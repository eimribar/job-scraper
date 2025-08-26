# ✅ Sales Tool Detector - Setup Checklist

> **Quick reference guide for completing setup and going live**

## 🚦 Current Status

### ✅ Completed
- [x] Project initialized with Next.js
- [x] All dependencies installed
- [x] Environment variables configured (.env.local)
- [x] OpenAI connected (GPT-5-mini ONLY!)
- [x] Apify connected (LinkedIn scraper)
- [x] Backend services implemented
- [x] Rate limiting configured
- [x] Health monitoring active
- [x] API endpoints created
- [x] Dashboard UI built
- [x] Documentation complete

### ⏳ Pending
- [ ] Supabase database tables
- [ ] Production deployment
- [ ] Testing with real data

---

## 📋 Remaining Setup Steps

### Step 1: Create Supabase Tables (Required)

**When you can access Supabase:**

1. Go to: https://app.supabase.com/project/pwszwezqrkdqfnparlsh
2. Click "SQL Editor" in sidebar
3. Click "New query"
4. Paste this SQL and run:

```sql
-- Create all required tables
CREATE TABLE IF NOT EXISTS jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id TEXT UNIQUE NOT NULL,
    platform TEXT NOT NULL,
    company TEXT NOT NULL,
    job_title TEXT NOT NULL,
    location TEXT,
    description TEXT,
    job_url TEXT,
    scraped_date TIMESTAMP WITH TIME ZONE NOT NULL,
    search_term TEXT NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    analyzed_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS identified_companies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_name TEXT NOT NULL,
    tool_detected TEXT NOT NULL,
    signal_type TEXT NOT NULL,
    context TEXT,
    confidence TEXT NOT NULL,
    job_title TEXT NOT NULL,
    job_url TEXT,
    platform TEXT NOT NULL,
    identified_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS search_terms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    search_term TEXT UNIQUE NOT NULL,
    last_scraped_date TIMESTAMP WITH TIME ZONE,
    jobs_found_count INTEGER DEFAULT 0,
    platform_last_scraped TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS processed_ids (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id TEXT NOT NULL,
    processed_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scraping_runs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    run_date TIMESTAMP WITH TIME ZONE NOT NULL,
    search_term TEXT NOT NULL,
    total_scraped INTEGER DEFAULT 0,
    new_jobs INTEGER DEFAULT 0,
    duplicates INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add default search terms
INSERT INTO search_terms (search_term) VALUES 
    ('SDR'), ('BDR'), ('Sales Development'),
    ('Revenue Operations'), ('Sales Manager')
ON CONFLICT (search_term) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_jobs_job_id ON jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company);
CREATE INDEX IF NOT EXISTS idx_jobs_processed ON jobs(processed);
CREATE INDEX IF NOT EXISTS idx_identified_companies_name ON identified_companies(company_name);
CREATE INDEX IF NOT EXISTS idx_identified_companies_tool ON identified_companies(tool_detected);
```

### Step 2: Verify Services (5 mins)

Run these commands to test:

```bash
# 1. Check health status
curl http://localhost:3001/api/health

# 2. Test scraping (will work even without DB)
curl -X POST http://localhost:3001/api/scrape \
  -H 'Content-Type: application/json' \
  -d '{"searchTerm": "SDR", "maxItemsPerPlatform": 5}'

# 3. Test analysis
curl -X POST http://localhost:3001/api/analyze \
  -H 'Content-Type: application/json' \
  -d '{"limit": 5}'
```

### Step 3: First Run Workflow

1. **Start with small test:**
   ```bash
   # Scrape 5 SDR jobs
   npm run test:scrape
   ```

2. **Analyze the jobs:**
   ```bash
   # Process with AI
   npm run test:analyze
   ```

3. **Check results:**
   - Open http://localhost:3001
   - View dashboard stats
   - Check companies tab

4. **Export data:**
   ```bash
   # Get CSV export
   curl "http://localhost:3001/api/companies/export?format=csv" -o results.csv
   ```

---

## 🔑 Key Information

### Your Configuration

| Service | Status | Details |
|---------|--------|---------|
| **Supabase** | ⏳ Tables pending | URL: pwszwezqrkdqfnparlsh.supabase.co |
| **OpenAI** | ✅ Connected | Model: GPT-5-mini (NEVER GPT-4!) |
| **Apify** | ✅ Connected | LinkedIn scraper ready |
| **Server** | ✅ Running | http://localhost:3001 |

### Important Files

| File | Purpose |
|------|---------|
| `.env.local` | Your API keys (DO NOT COMMIT!) |
| `supabase-schema.sql` | Database structure |
| `/api/health` | Service status check |
| `JTBD_DOCUMENTATION.md` | Complete feature docs |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/scrape` | POST | Trigger job scraping |
| `/api/analyze` | POST | Run AI analysis |
| `/api/companies` | GET | Fetch companies |
| `/api/companies/export` | GET | Export CSV/JSON |
| `/api/dashboard` | GET | Dashboard stats |
| `/api/health` | GET | System health |

---

## 🚀 Going to Production

When ready to deploy:

### Option 1: Vercel Deployment (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
# Settings → Environment Variables → Add all from .env.local
```

### Option 2: Docker Deployment

```bash
# Build container
docker build -t sales-tool-detector .

# Run with env file
docker run --env-file .env.local -p 3000:3000 sales-tool-detector
```

---

## 🛡️ Security Reminders

1. **NEVER commit .env.local to Git**
2. **Rotate API keys regularly**
3. **Monitor usage costs:**
   - OpenAI: Check https://platform.openai.com/usage
   - Apify: Check https://console.apify.com/billing
4. **Set up rate limits before going public**
5. **Enable Row Level Security in Supabase**

---

## 📞 Quick Commands Reference

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm run test:health     # Check service health
npm run test:scrape     # Test scraping
npm run test:analyze    # Test analysis

# Database
npm run migrate         # Run DB migration (manual backup)

# Git
git add .
git commit -m "message"
git push origin main

# Deployment
vercel                  # Deploy to Vercel
vercel --prod          # Deploy to production
```

---

## ⚠️ Troubleshooting

### If services show "unhealthy":

1. **Supabase**: Run the SQL migration
2. **OpenAI**: Check API key and credits
3. **Apify**: Verify token and credits

### If no data appears:

1. Check if tables exist in Supabase
2. Verify scraping returned results
3. Check analysis processed jobs
4. Look at browser console for errors

---

## 📊 What Success Looks Like

When everything is working:

- ✅ Health check shows all services "healthy"
- ✅ Scraping returns job listings
- ✅ Analysis identifies companies using tools
- ✅ Dashboard displays statistics
- ✅ Export generates CSV/JSON files
- ✅ No errors in console logs

---

**Remember**: The app works with mock data even without database, so you can test most features immediately!

**Critical**: ONLY use GPT-5-mini model - this is hardcoded per your requirement!