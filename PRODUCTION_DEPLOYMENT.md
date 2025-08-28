# Production Deployment PRD
## Sales Tool Detector - Production Launch

**Status**: Ready for Production Deployment  
**Last Updated**: August 27, 2025  
**Target Go-Live**: Immediate (Next Few Hours)

---

## 🎯 **EXECUTIVE SUMMARY**

The Sales Tool Detector backend pipeline is **production-ready** and tested. This PRD outlines the exact steps to deploy to Vercel with automated weekly cron jobs to continuously scrape job postings and identify companies using Outreach.io and SalesLoft.

**Business Impact**: Every day we delay, we lose potential customer intelligence. The system is ready to go live immediately.

---

## 🏗️ **SYSTEM OVERVIEW**

### **Core Pipeline**
1. **Weekly Cron Trigger** (Mondays 2 AM UTC)
2. **LinkedIn Job Scraping** (500 jobs per search term via Apify)
3. **Deduplication** (Skip already processed jobs)
4. **GPT-5-mini Analysis** (Sequential, 1 job per second)
5. **Company Detection** (Save to database when tools found)
6. **Dashboard Updates** (Real-time company tracking)

### **Current Status** ✅
- ✅ Job scraping pipeline working
- ✅ GPT-5-mini analysis configured (2000 tokens, no errors)
- ✅ Deduplication logic implemented
- ✅ Database schema ready
- ✅ Frontend dashboard functional
- ✅ Vercel configuration created
- ✅ Cron endpoints implemented
- ✅ Monitoring scripts ready

---

## 📋 **PRODUCTION DEPLOYMENT CHECKLIST**

### **Phase 1: Pre-Deployment Setup** (15 minutes)

#### 1.1 Vercel Account Setup
- [ ] Login to Vercel: `npx vercel login`
- [ ] Link project: `npx vercel link`
- [ ] Verify account has cron job capability

#### 1.2 Environment Variables Setup
**Required for Production:**

```bash
# Core API Keys
OPENAI_API_KEY=[YOUR_OPENAI_API_KEY]

APIFY_TOKEN=[YOUR_APIFY_TOKEN]

# Supabase Production
NEXT_PUBLIC_SUPABASE_URL=https://adbcghllcrmcbdunwras.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkYmNnaGxsY3JtY2JkdW53cmFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMDc3NTksImV4cCI6MjA3MTc4Mzc1OX0.4xRHM7fokLsFqybYOh-i1eZ77azy0zABTwuF7SqRHCs
SUPABASE_SERVICE_ROLE_KEY=[GET FROM SUPABASE DASHBOARD]

# Model Configuration
OPENAI_MODEL=gpt-5-mini-2025-08-07
OPENAI_TEMPERATURE=0.3

# Production Settings
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://sales-tool-detector.vercel.app

# Security
CRON_SECRET=[GENERATE RANDOM 32-CHAR STRING]
```

#### 1.3 Supabase Service Role Key
- [ ] Go to Supabase Dashboard → Settings → API
- [ ] Copy `service_role` key (NOT anon key)
- [ ] Add to Vercel environment variables

#### 1.4 Generate Cron Secret
```bash
# Generate secure random string
openssl rand -hex 32
# Add as CRON_SECRET to Vercel
```

### **Phase 2: Deployment** (10 minutes)

#### 2.1 Deploy to Vercel
```bash
# Build and deploy
npm run build
npx vercel --prod

# Or use deploy script
./scripts/deploy.sh
```

#### 2.2 Configure Environment Variables in Vercel
```bash
# Set each variable in Vercel dashboard or CLI
npx vercel env add OPENAI_API_KEY
npx vercel env add APIFY_TOKEN
npx vercel env add SUPABASE_SERVICE_ROLE_KEY
npx vercel env add CRON_SECRET
# ... (all other variables)
```

#### 2.3 Verify Deployment
- [ ] Check deployment status in Vercel dashboard
- [ ] Verify all environment variables are set
- [ ] Test basic API endpoints

### **Phase 3: Cron Job Setup** (5 minutes)

#### 3.1 Verify Cron Configuration
File: `vercel.json`
```json
{
  "crons": [{
    "path": "/api/cron/weekly",
    "schedule": "0 2 * * 1"
  }]
}
```

#### 3.2 Test Cron Endpoint
```bash
# Test cron endpoint manually
curl -X POST https://your-domain.vercel.app/api/cron/weekly \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### **Phase 4: Production Testing** (15 minutes)

#### 4.1 Manual Test Small Batch
```bash
# Test single search term processing
curl -X POST https://your-domain.vercel.app/api/scrape/test \
  -H "Content-Type: application/json" \
  -d '{"searchTerm": "sales engineer", "maxItems": 10}'
```

#### 4.2 Verify Database Updates
- [ ] Check `job_queue` table for new entries
- [ ] Check `identified_companies` table for results
- [ ] Verify dashboard shows new data

#### 4.3 Monitor Logs
```bash
# Monitor deployment logs
npx vercel logs --follow
```

### **Phase 5: Go Live** (Immediate)

#### 5.1 Enable Production Cron
- [ ] Verify cron job is scheduled in Vercel dashboard
- [ ] Confirm next execution time (Monday 2 AM UTC)
- [ ] Set up monitoring alerts

#### 5.2 Production Monitoring
```bash
# Run monitoring script
node scripts/monitor-production.js
```

---

## 🔧 **API ENDPOINTS**

### **Production Endpoints**
- `GET /` - Dashboard (public)
- `POST /api/scrape/trigger` - Manual job trigger
- `POST /api/scrape/weekly` - Process all search terms
- `POST /api/cron/weekly` - Automated weekly cron (secured)
- `GET /api/companies` - Company data API
- `GET /api/stats` - Dashboard statistics

### **Security**
- Cron endpoint protected with `CRON_SECRET`
- Supabase RLS policies active
- Rate limiting configured

---

## 📊 **MONITORING & ALERTS**

### **Health Checks**
- [ ] Weekly cron execution monitoring
- [ ] OpenAI API usage tracking
- [ ] Supabase connection health
- [ ] Error rate monitoring

### **Success Metrics**
- Jobs scraped per week
- New companies identified
- Tool detection accuracy
- Pipeline completion rate

---

## 🚨 **TROUBLESHOOTING**

### **Common Issues**

**1. OpenAI API Errors**
- Check API key validity
- Monitor rate limits (3 RPM for GPT-5-mini)
- Verify 2000 token limit setting

**2. Supabase Connection Issues**
- Verify service role key is set
- Check database connection limits
- Confirm RLS policies

**3. Cron Job Not Running**
- Check CRON_SECRET is set correctly
- Verify Vercel cron configuration
- Monitor function timeout limits (5 minutes)

**4. Build Failures**
- TypeScript errors: Check type definitions
- ESLint errors: Review code quality
- Missing dependencies: Check package.json

---

## 📅 **POST-DEPLOYMENT TASKS**

### **Week 1: Validation**
- [ ] Monitor first automated cron execution
- [ ] Validate data quality in dashboard
- [ ] Check for any API errors
- [ ] Optimize performance if needed

### **Week 2: Scaling**
- [ ] Add more search terms if needed
- [ ] Optimize processing speed
- [ ] Set up advanced monitoring
- [ ] Create backup procedures

---

## 🎯 **SUCCESS CRITERIA**

**Deployment Success:**
- [ ] All environment variables configured
- [ ] Cron job scheduled and running
- [ ] Database receiving new data weekly
- [ ] Dashboard showing real company data
- [ ] Zero critical errors in logs

**Business Success:**
- [ ] 100+ new companies identified per week
- [ ] High-confidence tool detection (>80% accuracy)
- [ ] Automated pipeline running without intervention
- [ ] Sales team can access fresh leads weekly

---

## 🚀 **NEXT STEPS AFTER GO-LIVE**

1. **Scale Search Terms**: Add more job search keywords
2. **Export Functionality**: CSV/Excel export for sales team
3. **Advanced Analytics**: Company size, industry classification
4. **Lead Scoring**: Priority ranking for sales outreach
5. **Integration**: CRM system integration (Salesforce, HubSpot)

---

**🎉 Ready for Production Launch!**

The system is fully tested and ready for immediate deployment. Follow this checklist and we'll be live with automated company intelligence gathering within the next hour.