# 🚀 COMPLETE VERCEL DEPLOYMENT GUIDE
## Sales Tool Detector - Production Setup

**Current Deployment**: https://job-scraper-liard.vercel.app  
**Last Updated**: September 8, 2025  
**Status**: ⚠️ Needs Environment Variables Configuration

---

## 📋 QUICK SETUP (5 Minutes)

### Step 1: Access Vercel Dashboard
1. Go to [https://vercel.com/dashboard](https://vercel.com/dashboard)
2. Find and click on `job-scraper` project
3. Click on **"Settings"** tab

### Step 2: Add Environment Variables
Click **"Environment Variables"** in the left sidebar, then add these EXACT variables:

#### 🔑 COPY THESE EXACT VALUES:

```bash
# 1. Supabase Database (REQUIRED - Copy exactly as shown)
NEXT_PUBLIC_SUPABASE_URL = https://nslcadgicgkncajoyyno.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zbGNhZGdpY2drbmNham95eW5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MTEyNTEsImV4cCI6MjA3MjM4NzI1MX0.VygboFJPF_vMdcxVyUVc10IXXmZmSShxbNZfXxng4MA
SUPABASE_SERVICE_ROLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zbGNhZGdpY2drbmNham95eW5vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjgxMTI1MSwiZXhwIjoyMDcyMzg3MjUxfQ.TaRBcVGLr61yr1gEEPBfPqntpZj3GTaJsNMwla-I2Y4

# 2. OpenAI API (REQUIRED - Get from your .env.local)
OPENAI_API_KEY = [Copy from your .env.local file line 8]

# 3. Apify Token (OPTIONAL - Only if using LinkedIn scraping)
APIFY_TOKEN = [Copy from your .env.local file line 11 if needed]

# 4. Application URL (REQUIRED)
NEXT_PUBLIC_APP_URL = https://job-scraper-liard.vercel.app
NODE_ENV = production
```

### Step 3: How to Add Each Variable
For EACH variable above:
1. Click **"Add New"** button
2. Enter the **Key** (e.g., `NEXT_PUBLIC_SUPABASE_URL`)
3. Paste the **Value** (everything after the = sign)
4. Check all boxes: ✅ Production ✅ Preview ✅ Development
5. Click **"Save"**

### Step 4: Redeploy
1. Go to **"Deployments"** tab
2. Find the latest deployment
3. Click the **"..."** menu → **"Redeploy"**
4. Click **"Redeploy"** in the popup
5. Wait 2-3 minutes for deployment

### Step 5: Verify It's Working
Visit: https://job-scraper-liard.vercel.app
- ✅ Dashboard should load without errors
- ✅ Companies page should show data
- ✅ Tier 1 page should display 188 companies

---

## 🔍 VERIFICATION SCRIPT

After deployment, verify everything works:

```bash
# Clone the repo locally if you haven't
git clone https://github.com/eimribar/job-scraper.git
cd job-scraper

# Run verification
node scripts/verify-deployment.js https://job-scraper-liard.vercel.app
```

Expected output:
```
✅ Home page loads successfully
✅ Companies page loads successfully
✅ Dashboard API responding
✅ Companies API returns data
```

---

## ⚠️ TROUBLESHOOTING

### Problem: "Application error: a server-side exception"
**Solution**: Environment variables are missing
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Make sure ALL variables from Step 2 are added
3. Redeploy the application

### Problem: Page loads but shows "0 companies"
**Solution**: Supabase connection not configured
1. Verify `NEXT_PUBLIC_SUPABASE_URL` starts with `https://`
2. Check that you copied the ENTIRE key for `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Make sure there are no extra spaces before/after the values
4. Redeploy after fixing

### Problem: "Missing configuration" error
**Solution**: 
1. Double-check each environment variable is spelled correctly
2. Ensure you selected all environments (Production, Preview, Development)
3. The keys must be EXACTLY as shown (including NEXT_PUBLIC_ prefix)

### Problem: Build fails
**Solution**:
1. Check the build logs in Vercel Dashboard
2. Look for the specific error message
3. Most common: Missing or incorrect environment variables

---

## 📊 WHAT YOU'LL SEE WHEN IT'S WORKING

### Dashboard (/)
- Live activity feed
- Processing status indicator
- Recent discoveries list
- Statistics cards with real numbers

### Companies Page (/companies)
- Table with 764+ companies
- Working filters (Outreach, SalesLoft, Tier)
- Search functionality
- Lead status management
- CSV export button

### Tier 1 Page (/tier-one)
- 188 priority companies
- 5 statistics cards
- Filtering and search
- Lead management buttons
- Export functionality

---

## 🔐 ENVIRONMENT VARIABLES REFERENCE

| Variable | Required | Description | Where to Find |
|----------|----------|-------------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Yes | Database URL | Provided above |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Yes | Public API key | Provided above |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Yes | Admin API key | Provided above |
| `OPENAI_API_KEY` | ✅ Yes | GPT-5 access | Your .env.local line 8 |
| `APIFY_TOKEN` | ❌ No | Web scraping | Your .env.local line 11 |
| `NEXT_PUBLIC_APP_URL` | ✅ Yes | Your Vercel URL | Use deployment URL |
| `NODE_ENV` | ✅ Yes | Always "production" | Set to: production |

---

## 🎯 SUCCESS CHECKLIST

After following all steps, verify:

- [ ] All environment variables added in Vercel
- [ ] Application redeployed successfully
- [ ] Home page loads without errors
- [ ] Companies page shows data (not just skeletons)
- [ ] Tier 1 page displays 188 companies
- [ ] No error messages on any page
- [ ] API endpoints return data (check /api/dashboard)

---

## 🆘 NEED HELP?

### Quick Fixes:
1. **Missing data?** → Add Supabase variables
2. **Build failing?** → Check OPENAI_API_KEY
3. **Pages not loading?** → Verify NEXT_PUBLIC_APP_URL
4. **Still issues?** → Run verification script

### Resources:
- [Vercel Documentation](https://vercel.com/docs)
- [Project Repository](https://github.com/eimribar/job-scraper)
- [Supabase Dashboard](https://app.supabase.com)

---

## 📝 NOTES

- Environment variables are **case-sensitive**
- The `NEXT_PUBLIC_` prefix is required for client-side variables
- Changes to environment variables require redeployment
- Your OpenAI API key is in your local `.env.local` file
- The Supabase keys provided are for the production database

---

**Remember**: The most common issue is missing or incorrectly copied environment variables. Double-check each one!