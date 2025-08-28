# ✅ Production Deployment TODO
## Sales Tool Detector - Step-by-Step Execution Guide

**Target**: Go Live in Next 2 Hours  
**Status**: Ready for Execution  
**Last Updated**: August 27, 2025

---

## 🎯 **EXECUTION SUMMARY**

**What we're deploying**: Fully tested Sales Tool Detector with automated weekly job scraping and company identification  
**Where**: Vercel with Supabase backend  
**When**: Immediate - system is production ready  
**Why**: Every day we wait, we lose potential customer intelligence

---

## 📋 **PHASE 1: PRE-DEPLOYMENT** (15 minutes)

### ✅ **1.1 Verify Local System**
- [ ] Confirm dev server running on port 3001
- [ ] Test dashboard loads at http://localhost:3001
- [ ] Verify 665 companies showing in database
- [ ] Check that pipeline completed successfully in logs

```bash
# Quick verification
curl http://localhost:3001/api/stats
# Should return company counts and recent discoveries
```

### ✅ **1.2 Supabase Service Role Key** ⚠️ **CRITICAL**
- [ ] Go to [Supabase Dashboard](https://supabase.com/dashboard)
- [ ] Select project: `adbcghllcrmcbdunwras`  
- [ ] Navigate: Settings → API
- [ ] Copy the `service_role` key (NOT the anon key)
- [ ] Add to `.env.local` as `SUPABASE_SERVICE_ROLE_KEY`

**⚠️ IMPORTANT**: Without service role key, production deployment will fail

### ✅ **1.3 Generate Cron Security Token**
```bash
# Generate random 32-character string
openssl rand -hex 32
# Copy output and save as CRON_SECRET
```

### ✅ **1.4 Prepare Production Environment Variables**
Create `production-env.txt` with these values:
```
OPENAI_API_KEY=[YOUR_OPENAI_API_KEY]
APIFY_TOKEN=[YOUR_APIFY_TOKEN]
NEXT_PUBLIC_SUPABASE_URL=https://adbcghllcrmcbdunwras.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkYmNnaGxsY3JtY2JkdW53cmFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMDc3NTksImV4cCI6MjA3MTc4Mzc1OX0.4xRHM7fokLsFqybYOh-i1eZ77azy0zABTwuF7SqRHCs
SUPABASE_SERVICE_ROLE_KEY=[PASTE FROM STEP 1.2]
OPENAI_MODEL=gpt-5-mini-2025-08-07
NODE_ENV=production
NEXT_PUBLIC_APP_URL=[WILL GET FROM VERCEL AFTER DEPLOY]
CRON_SECRET=[PASTE FROM STEP 1.3]
```

---

## 🚀 **PHASE 2: VERCEL DEPLOYMENT** (10 minutes)

### ✅ **2.1 Install and Login to Vercel**
```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel (will open browser)
npx vercel login
```

### ✅ **2.2 Link Project to Vercel**
```bash
# Link this directory to Vercel project
npx vercel link

# Answer the prompts:
# ? Set up and deploy "sales-tool-detector"? [Y/n] Y
# ? Which scope? [Your account]
# ? Link to existing project? [Y/n] n
# ? What's your project's name? sales-tool-detector
# ? In which directory is your code located? ./
```

### ✅ **2.3 Deploy to Production**
```bash
# Build and deploy to production
npm run build  # Test build locally first
npx vercel --prod
```

**Expected Output:**
```
✅  Production: https://sales-tool-detector-abc123.vercel.app [copied to clipboard]
```

### ✅ **2.4 Update Production URL**
- [ ] Copy the production URL from deployment
- [ ] Update `NEXT_PUBLIC_APP_URL` in your environment variables
- [ ] Add to Vercel environment variables (next step)

---

## ⚙️ **PHASE 3: ENVIRONMENT CONFIGURATION** (10 minutes)

### ✅ **3.1 Add Environment Variables to Vercel**

**Option A: Via Vercel Dashboard (Recommended)**
- [ ] Go to [Vercel Dashboard](https://vercel.com/dashboard)
- [ ] Select `sales-tool-detector` project
- [ ] Go to Settings → Environment Variables
- [ ] Add each variable from `production-env.txt`
- [ ] Select "Production" environment for each

**Option B: Via CLI (Advanced)**
```bash
npx vercel env add OPENAI_API_KEY
npx vercel env add APIFY_TOKEN
npx vercel env add SUPABASE_SERVICE_ROLE_KEY
npx vercel env add CRON_SECRET
# ... (continue for all variables)
```

### ✅ **3.2 Redeploy with Environment Variables**
```bash
# Redeploy to apply environment variables
npx vercel --prod
```

---

## 🔄 **PHASE 4: CRON JOB VERIFICATION** (5 minutes)

### ✅ **4.1 Verify Cron Configuration**
- [ ] Check `vercel.json` exists with cron config:
```json
{
  "crons": [{
    "path": "/api/cron/weekly",
    "schedule": "0 2 * * 1"
  }]
}
```

### ✅ **4.2 Test Cron Endpoint**
```bash
# Test the cron endpoint manually
curl -X POST https://[YOUR-DOMAIN].vercel.app/api/cron/weekly \
  -H "Authorization: Bearer [YOUR_CRON_SECRET]" \
  -H "Content-Type: application/json"
```

**Expected Response**: `{"message": "Weekly processing started"}`

### ✅ **4.3 Verify Cron Schedule in Vercel**
- [ ] Go to Vercel Dashboard → Functions tab
- [ ] Confirm cron job shows: "Next execution: Monday at 2:00 AM UTC"

---

## 🧪 **PHASE 5: PRODUCTION TESTING** (15 minutes)

### ✅ **5.1 Verify Dashboard Loading**
- [ ] Visit production URL: `https://[your-domain].vercel.app`
- [ ] Confirm dashboard loads with 665+ companies
- [ ] Test companies table pagination and filtering
- [ ] Verify export functionality works

### ✅ **5.2 Test Small Batch Processing**
```bash
# Test manual job processing with 10 jobs
curl -X POST https://[YOUR-DOMAIN].vercel.app/api/scrape/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "searchTerm": "sales engineer", 
    "maxItems": 10
  }'
```

**Expected**: Should return processing status and complete within 2-3 minutes

### ✅ **5.3 Monitor Function Logs**
```bash
# Monitor real-time logs
npx vercel logs --follow

# Or check in Vercel Dashboard → Functions → View Function Logs
```

### ✅ **5.4 Database Verification**
- [ ] Check Supabase dashboard for new entries in `job_queue`
- [ ] Verify any new companies added to `identified_companies`
- [ ] Confirm no errors in Supabase logs

---

## ✅ **PHASE 6: GO LIVE** (5 minutes)

### ✅ **6.1 Production Health Check**
```bash
# Full system health check
curl https://[YOUR-DOMAIN].vercel.app/api/stats
```
**Expected**: Returns JSON with company counts and system stats

### ✅ **6.2 Schedule Next Cron Execution**
- [ ] Current time: [Check current time]
- [ ] Next Monday 2 AM UTC: [Calculate exact date/time]
- [ ] Verify cron is scheduled in Vercel dashboard

### ✅ **6.3 Set Up Monitoring**
```bash
# Run monitoring script (optional)
node scripts/monitor-production.js
```

### ✅ **6.4 Document Production URLs**
- [ ] Production Dashboard: `https://[your-domain].vercel.app`
- [ ] API Base URL: `https://[your-domain].vercel.app/api`
- [ ] Cron Endpoint: `https://[your-domain].vercel.app/api/cron/weekly`

---

## 📊 **PHASE 7: VALIDATION** (10 minutes)

### ✅ **7.1 Performance Validation**
- [ ] Dashboard loads in < 3 seconds
- [ ] API responses in < 1 second
- [ ] Companies table filters work smoothly
- [ ] Export completes in < 10 seconds

### ✅ **7.2 Data Quality Check**
- [ ] Companies show proper tool detection
- [ ] Search terms are all active (37 total)
- [ ] Recent discoveries show actual dates
- [ ] No duplicate companies in display

### ✅ **7.3 Weekly Automation Readiness**
- [ ] Cron job configured for Monday 2 AM UTC
- [ ] All 37 search terms will be processed
- [ ] Expected processing time: 4-6 hours
- [ ] Cost estimate: $3-5 per week

---

## 🚨 **TROUBLESHOOTING CHECKLIST**

### **If Deployment Fails:**
- [ ] Check build logs: `npm run build`
- [ ] Verify all environment variables are set
- [ ] Check TypeScript errors in `/lib` files
- [ ] Ensure Vercel CLI is latest version

### **If APIs Don't Work:**
- [ ] Verify environment variables in Vercel dashboard
- [ ] Check OpenAI API key has GPT-5-mini access
- [ ] Test Supabase connection with service role key
- [ ] Confirm Apify has sufficient credits

### **If Cron Doesn't Run:**
- [ ] Verify `vercel.json` is in project root
- [ ] Check CRON_SECRET is set correctly
- [ ] Monitor function timeout (5-minute limit per function)
- [ ] Verify Vercel account has cron capability

---

## 📈 **POST-DEPLOYMENT MONITORING**

### **Week 1 Goals:**
- [ ] First automated execution completes successfully
- [ ] 50+ new companies identified
- [ ] Zero critical errors in production logs
- [ ] Dashboard accessible 24/7

### **Success Metrics:**
- **Uptime**: 99.9% (Vercel standard)
- **Processing Success Rate**: >95%
- **New Companies/Week**: 50-100
- **Total Cost**: <$40/month

### **Monitoring Tasks:**
- [ ] Set calendar reminder for Tuesday morning (day after cron)
- [ ] Check Vercel function logs weekly
- [ ] Monitor Apify and OpenAI usage
- [ ] Review new companies for quality

---

## 🎯 **FINAL CHECKLIST BEFORE EXECUTION**

**Before starting, confirm:**
- [ ] ✅ Local system fully working (dev server running)
- [ ] ✅ Database has 665+ companies
- [ ] ✅ All API keys are valid and working
- [ ] ✅ Supabase service role key obtained
- [ ] ✅ Cron security token generated
- [ ] ✅ Vercel CLI installed and authenticated

**Ready to execute?** ✅ → Start Phase 1

---

## 🎉 **SUCCESS CRITERIA**

**Deployment Complete When:**
- [ ] Production dashboard accessible at public URL
- [ ] Companies data loading correctly
- [ ] API endpoints responding
- [ ] Cron job scheduled for next Monday
- [ ] No errors in production logs
- [ ] Test batch processing works

**🚀 SYSTEM IS LIVE!**

**Next Monday at 2 AM UTC**, the system will automatically:
1. Scrape 18,500 jobs (37 terms × 500 jobs each)
2. Identify 50-100+ companies using Outreach.io or SalesLoft
3. Update the dashboard with fresh data
4. Continue weekly without manual intervention

**The sales intelligence machine is now operational! 🎯**