# 🚀 Vercel Deployment Guide - Sales Tool Detector

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Repository**: Project pushed to https://github.com/eimribar/job-scraper
3. **Environment Variables**: Have all required keys ready

---

## 🔑 Required Environment Variables

You MUST add these environment variables in Vercel Dashboard → Settings → Environment Variables:

### Supabase Configuration
```
NEXT_PUBLIC_SUPABASE_URL=https://nslcadgicgkncajoyyno.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zbGNhZGdpY2drbmNham95eW5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MTEyNTEsImV4cCI6MjA3MjM4NzI1MX0.VygboFJPF_vMdcxVyUVc10IXXmZmSShxbNZfXxng4MA
```

### OpenAI Configuration
```
OPENAI_API_KEY=[Your OpenAI API key from .env.local]
```
**Note**: Get your OpenAI API key from your local `.env.local` file or from [OpenAI Platform](https://platform.openai.com/api-keys)

### Optional (if using Google Sheets sync)
```
GOOGLE_SHEETS_CLIENT_EMAIL=[your-service-account-email]
GOOGLE_SHEETS_PRIVATE_KEY=[your-private-key]
SPREADSHEET_ID=[your-sheet-id]
```

---

## 📋 Step-by-Step Deployment

### 1. Import Project to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click "Import Git Repository"
3. Select `eimribar/job-scraper`
4. Click "Import"

### 2. Configure Build Settings

Vercel should auto-detect Next.js settings:
- **Framework Preset**: Next.js
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

### 3. Add Environment Variables

⚠️ **CRITICAL**: Add these BEFORE deploying!

1. Go to "Environment Variables" section
2. Add each variable one by one:
   - Name: `NEXT_PUBLIC_SUPABASE_URL`
   - Value: `https://nslcadgicgkncajoyyno.supabase.co`
   - Environment: ✅ Production, ✅ Preview, ✅ Development
3. Repeat for all required variables

### 4. Deploy

1. Click "Deploy"
2. Wait for build to complete (2-3 minutes)
3. Your app will be available at: `https://job-scraper-[your-username].vercel.app`

---

## 🔧 Troubleshooting Common Issues

### Error: "Application error: a server-side exception"

**Cause**: Missing environment variables

**Solution**:
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Ensure all required variables are added
3. Redeploy: Deployments → Three dots → Redeploy

### Error: "Invalid Supabase configuration"

**Cause**: Incorrect or missing Supabase URL/Key

**Solution**:
1. Verify `NEXT_PUBLIC_SUPABASE_URL` starts with `https://`
2. Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` is the complete key
3. Redeploy after fixing

### Error: "Build failed"

**Common Causes & Solutions**:

1. **TypeScript errors**:
   - Check build logs for specific errors
   - Fix locally with `npm run build`
   - Push fixes and redeploy

2. **Missing dependencies**:
   - Ensure all packages in package.json
   - Run `npm install` locally to verify

3. **Environment variable issues**:
   - Variables must be added BEFORE deployment
   - Use NEXT_PUBLIC_ prefix for client-side variables

---

## 🚦 Post-Deployment Checklist

- [ ] Visit your deployed URL
- [ ] Check dashboard loads (even with 0 data if no connection)
- [ ] Verify stats display correctly
- [ ] Test export functionality
- [ ] Check API routes: `/api/dashboard`, `/api/companies`

---

## 🔄 Updating Your Deployment

### Automatic Deployments
Every push to `main` branch triggers automatic deployment

### Manual Redeploy
1. Go to Vercel Dashboard
2. Click on your project
3. Go to "Deployments"
4. Click three dots on latest → "Redeploy"

### Rollback
1. Go to "Deployments"
2. Find previous working deployment
3. Click three dots → "Promote to Production"

---

## 🌍 Custom Domain (Optional)

1. Go to Settings → Domains
2. Add your domain: `yourdomain.com`
3. Follow DNS configuration instructions
4. SSL certificate auto-configured

---

## 📊 Monitoring

### View Logs
- Go to Functions → View Logs
- Filter by function or time period
- Check for errors in real-time

### Analytics
- Vercel Analytics shows performance metrics
- Monitor response times and error rates

---

## 🚨 Emergency Fixes

### If Site is Down

1. **Check Environment Variables**:
   ```
   Settings → Environment Variables → Verify all present
   ```

2. **Check Recent Deployments**:
   ```
   Deployments → Check for failed builds
   ```

3. **Rollback if Needed**:
   ```
   Find last working deployment → Promote to Production
   ```

4. **Check Supabase**:
   - Verify project is active at supabase.com
   - Check if within free tier limits

---

## 🔐 Security Notes

- **Never commit** `.env.local` to Git
- **Rotate API keys** regularly
- **Use environment variables** for all secrets
- **Enable Vercel Authentication** for preview deployments

---

## 📞 Getting Help

### Resources
- [Vercel Documentation](https://vercel.com/docs)
- [Next.js on Vercel](https://vercel.com/docs/frameworks/nextjs)
- [Troubleshooting Guide](https://vercel.com/docs/troubleshooting)

### Common Commands for Local Testing
```bash
# Test production build locally
npm run build
npm start

# Check for TypeScript errors
npx tsc --noEmit

# Test with production variables
cp .env.local .env.production.local
npm run build
```

---

## ✅ Deployment Success Indicators

Your deployment is successful when:
1. ✅ Build completes without errors
2. ✅ Site loads without server errors
3. ✅ Dashboard shows (even with 0 data)
4. ✅ No console errors in browser
5. ✅ API routes respond (check /api/dashboard)

---

**Last Updated**: September 3, 2025
**Current Deployment**: https://job-scraper-liard.vercel.app
**Status**: Needs environment variables configured