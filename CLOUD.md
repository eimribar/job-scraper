# ☁️ Cloud Deployment Guide

> **Complete guide to deploy Sales Tool Detector to production cloud environments**

## 🎯 Overview

This guide covers deploying the Sales Tool Detector to various cloud platforms with production-ready configurations. The recommended stack is **Vercel + Supabase** for optimal performance and ease of use.

## 🚀 Quick Deploy (Recommended)

### Vercel + Supabase Stack

The fastest way to get Sales Tool Detector running in production:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/eimribar/job-scraper)

## 📋 Pre-Deployment Checklist

- [ ] GitHub repository set up
- [ ] Supabase account created
- [ ] OpenAI API key obtained
- [ ] Apify account with sufficient credits
- [ ] Environment variables documented
- [ ] Domain name ready (optional)

## 🗄️ Database Setup (Supabase)

### 1. Create Supabase Project

1. Visit [Supabase Dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name**: `sales-tool-detector`
   - **Database Password**: Generate strong password
   - **Region**: Choose closest to your users

### 2. Configure Database Schema

1. Navigate to **SQL Editor** in Supabase dashboard
2. Copy the contents of `supabase-schema.sql`
3. Execute the SQL to create tables and indexes
4. Verify tables are created in **Table Editor**

### 3. Get Connection Details

1. Go to **Settings** → **API**
2. Copy the following values:
   - **Project URL**: `https://your-project.supabase.co`
   - **API Key (anon/public)**: `eyJhbGc...`
   - **Service Role Key**: `eyJhbGc...` (keep secret!)

### 4. Configure Row Level Security (Optional)

```sql
-- Enable RLS on all tables
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE identified_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_ids ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraping_runs ENABLE ROW LEVEL SECURITY;

-- Allow read access (modify as needed)
CREATE POLICY "Allow read access" ON jobs FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON identified_companies FOR SELECT USING (true);
```

## 🚀 Vercel Deployment

### 1. Connect Repository to Vercel

1. Visit [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"New Project"**
3. Import your GitHub repository
4. Configure build settings (auto-detected):
   - **Framework**: Next.js
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

### 2. Configure Environment Variables

Add these environment variables in Vercel dashboard:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenAI Configuration
OPENAI_API_KEY=sk-...

# Apify Configuration
APIFY_TOKEN=apify_api_...

# Application Configuration
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

### 3. Deploy

1. Click **"Deploy"**
2. Wait for build to complete (~2-3 minutes)
3. Test deployment at provided URL
4. Configure custom domain (optional)

### 4. Set Up Cron Jobs (Optional)

Create `vercel.json` in project root:

```json
{
  "crons": [
    {
      "path": "/api/scrape",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/analyze", 
      "schedule": "0 */2 * * *"
    }
  ]
}
```

## 🔑 API Keys & Credentials

### OpenAI API Key

1. Visit [OpenAI API Dashboard](https://platform.openai.com/api-keys)
2. Click **"Create new secret key"**
3. Name it `sales-tool-detector`
4. Copy the key (starts with `sk-`)
5. Set usage limits to control costs

**Recommended Settings:**
- Model: `gpt-4o-mini` (cost effective)
- Monthly limit: $50-100 (adjust based on usage)

### Apify Tokens

1. Visit [Apify Console](https://console.apify.com/)
2. Go to **Settings** → **Integrations** 
3. Create new API token
4. Name it `sales-tool-detector`
5. Copy the token (starts with `apify_api_`)

**Required Actors:**
- `misceres~indeed-scraper`
- `bebity~linkedin-jobs-scraper`

## 📊 Alternative Deployment Options

### AWS Deployment

<details>
<summary>Click to expand AWS deployment guide</summary>

#### Using AWS Amplify

1. **Connect Repository**
   ```bash
   npm install -g @aws-amplify/cli
   amplify configure
   amplify init
   ```

2. **Configure Build Settings**
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - npm install
       build:
         commands:
           - npm run build
     artifacts:
       baseDirectory: .next
       files:
         - '**/*'
     cache:
       paths:
         - node_modules/**/*
   ```

3. **Set Environment Variables**
   ```bash
   amplify env add prod
   # Add environment variables through AWS Console
   ```

4. **Deploy**
   ```bash
   amplify publish
   ```

#### Using AWS ECS + RDS

1. **Database Setup (RDS PostgreSQL)**
2. **Container Deployment (ECS Fargate)**
3. **Load Balancer Configuration (ALB)**
4. **DNS Setup (Route 53)**

</details>

### Google Cloud Platform

<details>
<summary>Click to expand GCP deployment guide</summary>

#### Using Cloud Run + Cloud SQL

1. **Build Container**
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY . .
   RUN npm run build
   EXPOSE 3000
   CMD ["npm", "start"]
   ```

2. **Deploy to Cloud Run**
   ```bash
   gcloud run deploy sales-tool-detector \
     --source . \
     --region us-central1 \
     --allow-unauthenticated
   ```

3. **Configure Cloud SQL (PostgreSQL)**
4. **Set Environment Variables**

</details>

### Railway Deployment

<details>
<summary>Click to expand Railway deployment guide</summary>

1. **Connect Repository**
   - Visit [Railway Dashboard](https://railway.app/dashboard)
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository

2. **Configure Environment Variables**
   - Add all required environment variables
   - Railway auto-detects Next.js projects

3. **Deploy**
   - Automatic deployment on git push
   - Custom domain support available

</details>

## 🔧 Production Configuration

### Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL | `https://abc123.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anonymous key | `eyJhbGc...` |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key | `eyJhbGc...` |
| `OPENAI_API_KEY` | ✅ | OpenAI API key | `sk-...` |
| `APIFY_TOKEN` | ✅ | Apify API token | `apify_api_...` |
| `NEXT_PUBLIC_APP_URL` | ✅ | Your app URL | `https://yourdomain.com` |

### Security Best Practices

1. **Environment Variables**
   - Never commit sensitive keys to repository
   - Use platform-specific secret management
   - Rotate keys regularly

2. **Database Security**
   - Enable Row Level Security (RLS)
   - Use connection pooling
   - Regular backups

3. **API Security**
   - Implement rate limiting
   - Add request validation
   - Monitor usage patterns

4. **Monitoring**
   - Set up error tracking (Sentry)
   - Monitor API usage costs
   - Set up health check alerts

## 📈 Performance Optimization

### Caching Strategy

1. **Static Assets**
   ```javascript
   // next.config.js
   module.exports = {
     images: {
       domains: ['your-domain.com'],
     },
     experimental: {
       optimizeCss: true,
       optimizeImages: true,
     }
   }
   ```

2. **Database Queries**
   - Enable Supabase connection pooling
   - Add appropriate indexes
   - Use prepared statements

3. **API Rate Limits**
   - Implement caching for repeated requests
   - Use background jobs for heavy operations
   - Add request queuing

### Scaling Considerations

| Traffic Level | Recommended Setup | Monthly Cost Estimate |
|---------------|-------------------|----------------------|
| **Development** | Vercel Free + Supabase Free | $0 |
| **Small Team** | Vercel Pro + Supabase Pro | $50-100 |
| **Growing Company** | Vercel Team + Supabase Pro | $200-500 |
| **Enterprise** | Custom deployment + dedicated DB | $1000+ |

## 🚨 Troubleshooting

### Common Deployment Issues

1. **Build Failures**
   ```bash
   # Check build logs
   npm run build
   # Fix TypeScript errors
   npm run lint
   ```

2. **Environment Variable Issues**
   - Verify all required variables are set
   - Check for typos in variable names
   - Ensure proper escaping of special characters

3. **Database Connection Issues**
   - Verify Supabase project is active
   - Check connection string format
   - Test database connectivity

4. **API Rate Limits**
   - Monitor OpenAI usage dashboard
   - Check Apify credit balance
   - Implement request queuing

### Health Checks

Add health check endpoint (`/api/health`):

```javascript
export async function GET() {
  return Response.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected',
      openai: 'available',
      apify: 'available'
    }
  })
}
```

## 📞 Support

### Getting Help

- 📖 [Main Documentation](README.md)
- 🐛 [Report Issues](https://github.com/eimribar/job-scraper/issues)
- 💬 [GitHub Discussions](https://github.com/eimribar/job-scraper/discussions)

### Enterprise Support

For enterprise deployments, custom configurations, or dedicated support:
- 📧 Contact: [your-email@domain.com](mailto:your-email@domain.com)
- 🔗 [Schedule consultation](https://calendly.com/your-calendar)

---

<div align="center">

**Ready to deploy? Start with the [Quick Deploy](#-quick-deploy-recommended) option above! 🚀**

</div>