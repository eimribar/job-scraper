# 🔧 Troubleshooting Guide - Sales Tool Detector

> **Common issues and solutions with today's fixes**

## 🚨 Critical Issues (Fixed September 2, 2025)

### 1. Schema Mismatch - CONFIDENCE FIELD (FIXED)

**Error**: `Could not find the 'confidence' column of 'identified_companies'`

**Root Cause**: Database doesn't have a confidence field

**Solution Applied**:
```javascript
// ❌ OLD CODE - Remove this
const data = {
  confidence: analysis.confidence,  // DELETE THIS LINE
  ...
}

// ✅ NEW CODE - Use this
const data = {
  company: job.company,
  tool_detected: analysis.tool_detected,
  signal_type: analysis.signal_type,
  context: analysis.context,
  // NO confidence field!
}
```

### 2. Upsert Errors - NO UNIQUE CONSTRAINT (FIXED)

**Error**: `there is no unique or exclusion constraint matching the ON CONFLICT specification`

**Root Cause**: Database missing unique constraint on (company, tool_detected)

**Solution Applied**:
```javascript
// ❌ OLD CODE - Don't use this
await supabase.from('identified_companies').upsert(data, {
  onConflict: 'company,tool_detected'  // Constraint doesn't exist!
});

// ✅ NEW CODE - Check existence first
const { data: existing } = await supabase
  .from('identified_companies')
  .select('id')
  .eq('company', job.company)
  .eq('tool_detected', analysis.tool_detected)
  .single();

if (existing) {
  await supabase.from('identified_companies').update(data).eq('id', existing.id);
} else {
  await supabase.from('identified_companies').insert(data);
}
```

**Permanent Fix** (Run in Supabase SQL Editor):
```sql
ALTER TABLE identified_companies
ADD CONSTRAINT unique_company_tool 
UNIQUE (company, tool_detected);
```

### 3. GPT-5 API Configuration (CRITICAL)

**MUST USE GPT-5 RESPONSES API - NOT CHAT COMPLETIONS!**

```javascript
// ❌ WRONG - This will fail
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  model: 'gpt-4o-mini',  // WRONG MODEL!
  messages: [...]        // WRONG API!
});

// ✅ CORRECT - Use this exactly
const response = await fetch('https://api.openai.com/v1/responses', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${OPENAI_API_KEY}`
  },
  body: JSON.stringify({
    model: 'gpt-5-mini',  // MUST BE GPT-5!
    input: prompt,
    reasoning: { effort: 'minimal' },
    text: { verbosity: 'low' }
  })
});

// Parse response correctly
const data = await response.json();
const result = data.output[1].content[0].text;  // Specific structure!
```

### 3. API Scraping Failures

**Error**: Apify API calls fail

**Solution**:
```bash
# Check Apify token and credits
# 1. Verify APIFY_TOKEN in .env.local
# 2. Check credit balance in Apify console
# 3. Ensure actors are available:
#    - misceres~indeed-scraper
#    - bebity~linkedin-jobs-scraper
```

## 🐛 Common Issues

### Installation Problems

#### Issue: `npm install` fails with dependency conflicts
```bash
# Solution 1: Clear npm cache
npm cache clean --force
rm -rf node_modules package-lock.json
npm install

# Solution 2: Use specific npm version
npm install -g npm@9.8.1
npm install
```

#### Issue: TypeScript compilation errors
```bash
# Check TypeScript version
npx tsc --version

# Reinstall TypeScript
npm install -D typescript@5.2.2
npm run build
```

#### Issue: Tailwind CSS not working
```bash
# Verify tailwind.config.js exists
ls -la tailwind.config.js

# Rebuild CSS
npm run dev
```

### Environment Configuration

#### Issue: Environment variables not loading

**Symptoms**: 
- App loads but shows empty data
- API calls return 500 errors
- Console shows "undefined" for env vars

**Solution**:
```bash
# 1. Verify .env.local exists and has correct format
cat .env.local

# 2. Restart development server
npm run dev

# 3. Check variable names match exactly:
NEXT_PUBLIC_SUPABASE_URL=...     # ✅ Correct
SUPABASE_URL=...                 # ❌ Wrong (missing NEXT_PUBLIC_)
```

#### Issue: Supabase connection fails

**Symptoms**:
- "Invalid URL" errors
- Database queries timeout
- 401/403 authentication errors

**Solution**:
```bash
# 1. Verify URL format
echo $NEXT_PUBLIC_SUPABASE_URL
# Should be: https://abcd1234.supabase.co

# 2. Check API keys
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY
# Should start with: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9

# 3. Test connection in Supabase dashboard
# Go to SQL Editor and run: SELECT 1;
```

### Scraping Issues

#### Issue: Indeed scraper returns no results

**Symptoms**:
- API calls succeed but return empty arrays
- "No jobs found" in logs

**Solution**:
```bash
# 1. Check Apify actor status
# Visit: https://console.apify.com/actors/misceres~indeed-scraper

# 2. Verify search terms
# Try broader terms: "Sales", "SDR", "Business Development"

# 3. Check rate limits
# Indeed may be blocking requests - wait 1 hour and retry
```

#### Issue: LinkedIn scraper blocked

**Symptoms**:
- 403 Forbidden errors
- "Anti-bot measures" in logs

**Solution**:
```bash
# 1. Use residential proxies (automatically enabled)
# 2. Reduce scraping frequency
# 3. Try different search terms
# 4. Contact Apify support for enterprise proxies
```

### AI Analysis Problems

#### Issue: OpenAI API calls fail

**Symptoms**:
- 401 Authentication errors
- "Insufficient quota" errors
- Analysis never completes

**Solution**:
```bash
# 1. Verify API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# 2. Check usage limits
# Visit: https://platform.openai.com/usage

# 3. Ensure sufficient credits
# Add billing method if needed
```

#### Issue: Analysis produces poor results

**Symptoms**:
- No companies detected despite obvious mentions
- Low confidence scores
- Wrong tool detection

**Solution**:
```bash
# 1. Check job description quality
# Ensure descriptions contain enough detail

# 2. Review detection prompts in:
# lib/services/analysisService.ts

# 3. Adjust confidence thresholds
# Lower from "high" to "medium" for more results
```

## ⚠️ Production Issues

### Deployment Problems

#### Issue: Vercel deployment fails

**Error**: Build fails during deployment

**Solution**:
```bash
# 1. Test build locally first
npm run build

# 2. Check build logs in Vercel dashboard
# Look for specific error messages

# 3. Verify all environment variables are set
# In Vercel dashboard → Settings → Environment Variables

# 4. Check for missing dependencies
npm install --production
```

#### Issue: Environment variables not working in production

**Symptoms**:
- App works locally but fails in production
- API calls return 500 errors

**Solution**:
```bash
# 1. Verify variables in Vercel dashboard
# Settings → Environment Variables

# 2. Ensure variables are available to all environments:
# ☑️ Production
# ☑️ Preview  
# ☑️ Development

# 3. Redeploy after adding variables
# Variables only apply to new deployments
```

### Performance Issues

#### Issue: Slow database queries

**Symptoms**:
- Dashboard takes > 5 seconds to load
- API timeouts

**Solution**:
```sql
-- 1. Check if indexes exist
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public';

-- 2. Add missing indexes
CREATE INDEX CONCURRENTLY idx_jobs_company_processed 
ON jobs(company, processed);

-- 3. Enable connection pooling in Supabase
-- Dashboard → Settings → Database → Connection pooling
```

#### Issue: High OpenAI costs

**Symptoms**:
- Unexpected high bills
- Rate limit warnings

**Solution**:
```bash
# 1. Set usage limits in OpenAI dashboard
# https://platform.openai.com/account/billing/limits

# 2. Monitor usage patterns
# Check which endpoints use most tokens

# 3. Optimize prompts
# Shorter prompts = lower costs

# 4. Implement caching
# Store analysis results to avoid re-processing
```

## 🔍 Debugging Tools

### Logs and Monitoring

```bash
# 1. Application logs
npm run dev
# Check console for errors and warnings

# 2. Vercel logs (production)
npx vercel logs your-deployment-url

# 3. Supabase logs
# Dashboard → Logs → Database/API/Auth

# 4. OpenAI usage logs
# https://platform.openai.com/usage
```

### Testing Connections

```bash
# Test Supabase connection
curl -X GET 'https://your-project.supabase.co/rest/v1/search_terms' \
  -H "apikey: your-anon-key" \
  -H "Authorization: Bearer your-anon-key"

# Test OpenAI connection
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer your-openai-key"

# Test Apify connection
curl "https://api.apify.com/v2/acts?token=your-apify-token"
```

### Health Check Endpoints

```bash
# Application health
curl https://your-app.vercel.app/api/dashboard

# Database health  
curl https://your-app.vercel.app/api/companies

# Expected response: JSON with data or empty arrays
```

## 📊 Performance Optimization

### Database Optimization

```sql
-- Add performance indexes
CREATE INDEX CONCURRENTLY idx_identified_companies_tool_date 
ON identified_companies(tool_detected, identified_date DESC);

CREATE INDEX CONCURRENTLY idx_jobs_processed_date 
ON jobs(processed, scraped_date DESC) 
WHERE processed = false;

-- Analyze table statistics
ANALYZE identified_companies;
ANALYZE jobs;
```

### Application Optimization

```typescript
// Enable Next.js optimizations
// next.config.ts
export default {
  experimental: {
    optimizePackageImports: ['lucide-react', '@supabase/supabase-js']
  },
  images: {
    domains: ['your-domain.com']
  }
}
```

## 🚨 Emergency Procedures

### If Database is Down

1. **Check Supabase status**: https://status.supabase.com/
2. **Enable maintenance mode** (if implemented)
3. **Switch to cached data** (if available)
4. **Notify users** via status page

### If API Costs Spike

1. **Set immediate usage limits** in OpenAI dashboard
2. **Pause scraping** by disabling cron jobs
3. **Review recent activity** for anomalies
4. **Implement emergency rate limiting**

### If Scraping is Blocked

1. **Switch to backup scrapers** (if available)
2. **Reduce scraping frequency**
3. **Contact Apify support** for assistance
4. **Implement retry logic** with exponential backoff

## 📞 Getting Help

### Self-Help Resources

1. **Documentation**: [README.md](README.md)
2. **API Docs**: Check `/api` endpoints
3. **Community**: [GitHub Discussions](https://github.com/eimribar/job-scraper/discussions)

### Contact Support

| Issue Type | Contact Method | Response Time |
|------------|---------------|---------------|
| **Security** | security@your-domain.com | 24 hours |
| **Bug Reports** | [GitHub Issues](https://github.com/eimribar/job-scraper/issues) | 2-3 days |
| **Questions** | [Discussions](https://github.com/eimribar/job-scraper/discussions) | Community |
| **Enterprise** | support@your-domain.com | 1 business day |

### What to Include in Support Requests

```markdown
## Environment
- OS: [macOS/Windows/Linux]
- Node.js version: [18.17.0]
- Browser: [Chrome 91]
- App version: [1.0.0]

## Issue Description
Clear description of what's not working

## Steps to Reproduce
1. Step one
2. Step two  
3. Expected vs actual result

## Error Messages
Complete error messages and stack traces

## What You've Tried
Solutions you've already attempted
```

---

<div align="center">

**Still having issues?** 

[🐛 Report Bug](https://github.com/eimribar/job-scraper/issues) • [💬 Ask Question](https://github.com/eimribar/job-scraper/discussions) • [📧 Contact Support](mailto:support@your-domain.com)

</div>