# 🚀 Sales Tool Detector - Deployment Guide

## 📋 Prerequisites

Before deploying, ensure you have:
- [ ] GitHub account with repository access
- [ ] Vercel account (free tier works)
- [ ] Supabase project created
- [ ] OpenAI API key with GPT-5-mini access
- [ ] Apify account with tokens
- [ ] Domain name (optional)

---

## 🏃 Quick Deploy to Vercel

### Option 1: One-Click Deploy
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/eimribar/sales-tool-detector)

### Option 2: Manual Deploy

1. **Push to GitHub**
```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

2. **Import to Vercel**
- Go to [vercel.com/new](https://vercel.com/new)
- Import your GitHub repository
- Configure environment variables (see below)
- Click "Deploy"

---

## 🔐 Environment Variables Configuration

### Required Variables

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key

# OpenAI Configuration (CRITICAL: GPT-5-mini ONLY)
OPENAI_API_KEY=sk-...your-openai-key
OPENAI_MODEL=gpt-5-mini-2025-08-07

# Apify Configuration
APIFY_TOKEN=apify_api_...your-token
APIFY_INDEED_ACTOR=misceres~indeed-scraper
APIFY_LINKEDIN_ACTOR=bebity~linkedin-jobs-scraper

# Application Configuration
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app

# Feature Flags
ENABLE_AUTH=false
ENABLE_SLACK_NOTIFICATIONS=false
ENABLE_AUTO_SCRAPING=false

# Rate Limiting
SCRAPING_RATE_LIMIT=10
ANALYSIS_RATE_LIMIT=30
API_RATE_LIMIT_PER_MINUTE=100
```

### Setting Variables in Vercel

1. Go to your project settings in Vercel
2. Navigate to "Environment Variables"
3. Add each variable with the appropriate value
4. Select environments (Production, Preview, Development)
5. Save changes

---

## 🗄️ Database Setup

### 1. Create Supabase Project

1. Visit [app.supabase.com](https://app.supabase.com)
2. Create new project
3. Note your project URL and keys
4. Go to SQL Editor

### 2. Run Migration Scripts

Execute these scripts in order:

```sql
-- 1. Run base schema
-- Copy content from migrations/supabase-ready-schema.sql

-- 2. Run import updates
-- Copy content from migrations/import-schema-updates.sql
```

### 3. Import Existing Data (Optional)

If you have existing CSV data:

```bash
# Local machine
npm run import:data
```

Or use the Supabase dashboard CSV import feature.

### 4. Enable Row Level Security (Optional)

```sql
-- Enable RLS on tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_terms ENABLE ROW LEVEL SECURITY;

-- Create policies as needed
```

---

## 🌐 Domain Configuration

### Custom Domain Setup

1. **Add Domain in Vercel**
   - Go to project settings
   - Navigate to "Domains"
   - Add your custom domain
   - Follow DNS configuration instructions

2. **Update Environment Variable**
```env
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

3. **SSL Certificate**
   - Automatically provided by Vercel
   - Usually active within minutes

---

## 📊 Monitoring Setup

### 1. Vercel Analytics

```bash
npm install @vercel/analytics
```

Add to `app/layout.tsx`:
```tsx
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

### 2. Error Tracking (Optional)

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

Add Sentry DSN to environment variables:
```env
SENTRY_DSN=https://...@sentry.io/...
```

---

## 🔄 Continuous Deployment

### GitHub Actions Setup

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests
        run: npm test
        
      - name: Build
        run: npm run build
        
      - name: Deploy to Vercel
        run: vercel --prod --token=${{ secrets.VERCEL_TOKEN }}
```

### Required Secrets

Add to GitHub repository settings:
- `VERCEL_TOKEN`: Get from Vercel account settings

---

## 🧪 Testing Deployment

### 1. Health Checks

```bash
# Check API health
curl https://your-domain.com/api/monitor/health

# Check dashboard stats
curl https://your-domain.com/api/dashboard/stats

# Test export functionality
curl https://your-domain.com/api/export?format=csv
```

### 2. Smoke Tests

- [ ] Dashboard loads correctly
- [ ] Companies table displays data
- [ ] Filtering works
- [ ] Export generates CSV
- [ ] No console errors

### 3. Performance Tests

```bash
# Using lighthouse
npx lighthouse https://your-domain.com --output=json --output-path=./lighthouse-report.json
```

---

## 🛡️ Security Checklist

### Pre-Deployment

- [ ] All sensitive keys in environment variables
- [ ] No hardcoded credentials in code
- [ ] API rate limiting configured
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention verified
- [ ] XSS protection enabled

### Post-Deployment

- [ ] Verify HTTPS is working
- [ ] Check security headers
- [ ] Test authentication (if enabled)
- [ ] Monitor for suspicious activity
- [ ] Regular security updates

---

## 🔧 Troubleshooting

### Common Issues

#### Database Connection Failed
```
Error: Can't reach database server
```
**Solution**: Check Supabase URL and keys in environment variables

#### Build Failed on Vercel
```
Error: Module not found
```
**Solution**: Ensure all dependencies are in package.json

#### API Rate Limiting
```
Error: Too many requests
```
**Solution**: Adjust rate limit settings or implement caching

#### Missing Environment Variables
```
Error: OPENAI_API_KEY is not defined
```
**Solution**: Add all required variables in Vercel dashboard

---

## 📈 Scaling Considerations

### When to Scale

Monitor these metrics:
- Response time > 1s consistently
- Memory usage > 80%
- Database connections > 80
- API errors > 1%

### Scaling Options

1. **Vercel Pro**: More resources and features
2. **Supabase Pro**: Higher limits and performance
3. **Database Optimization**: Indexes and caching
4. **CDN**: Static asset delivery
5. **Load Balancing**: Multiple instances

---

## 🔄 Rollback Procedure

If deployment issues occur:

1. **Immediate Rollback**
```bash
vercel rollback
```

2. **Manual Rollback**
- Go to Vercel dashboard
- Select previous deployment
- Click "Promote to Production"

3. **Database Rollback**
```sql
-- Restore from backup
-- Supabase creates automatic backups
```

---

## 📝 Post-Deployment Checklist

### Immediate Tasks
- [ ] Verify all pages load
- [ ] Test core functionality
- [ ] Check error logs
- [ ] Monitor performance
- [ ] Announce deployment

### Within 24 Hours
- [ ] Review analytics
- [ ] Check for errors
- [ ] Gather user feedback
- [ ] Document issues
- [ ] Plan fixes

### Weekly
- [ ] Performance review
- [ ] Security scan
- [ ] Dependency updates
- [ ] Backup verification
- [ ] Cost analysis

---

## 🆘 Support

### Getting Help

1. **Vercel Support**: [vercel.com/support](https://vercel.com/support)
2. **Supabase Support**: [supabase.com/support](https://supabase.com/support)
3. **GitHub Issues**: Report bugs in repository
4. **Documentation**: Check docs folder

### Emergency Contacts

- **On-Call Developer**: [Your contact]
- **Database Admin**: [DBA contact]
- **Security Team**: [Security contact]

---

## 📋 Deployment Log

Keep track of deployments:

| Date | Version | Deployer | Notes |
|------|---------|----------|-------|
| 2024-08-26 | 1.0.0 | Team | Initial deployment |
| | | | |

---

**Last Updated**: August 26, 2025
**Deployment Version**: 1.0.0
**Status**: Ready for Production