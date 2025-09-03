# 🚀 Quick Start Guide - Sales Tool Detector

## 📋 Prerequisites
- Node.js 18+ and npm installed
- Supabase account
- OpenAI API key with GPT-5 access
- (Optional) Vercel account for deployment

## ⚡ Quick Setup (5 minutes)

### 1. Clone and Install
```bash
git clone https://github.com/eimribar/job-scraper.git
cd job-scraper
npm install
```

### 2. Configure Environment
Copy `.env.local.example` to `.env.local`:
```bash
cp .env.local.example .env.local
```

Then edit `.env.local` with your actual credentials:
```env
# Get these from https://supabase.com/dashboard
NEXT_PUBLIC_SUPABASE_URL=https://nslcadgicgkncajoyyno.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Get from https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-your-api-key

# Local development
PORT=4001
```

### 3. Run Database Migration
```bash
# Check for duplicates first
node scripts/check-duplicates.js

# If no duplicates, apply the migration in Supabase SQL Editor
# Copy the content from migrations/add-unique-constraint.sql
```

### 4. Start Development Server
```bash
npm run dev
# or with specific port
PORT=4001 npm run dev
```

Open http://localhost:4001 to see the dashboard.

## 🔍 Testing the System

### Test API Health
```bash
curl http://localhost:4001/api/health
```

### Check Dashboard Stats
```bash
curl http://localhost:4001/api/dashboard
```

### Process Jobs Manually
```bash
# Run the simple processor
node scripts/simple-processor.js
```

## 📦 Import Data

### Import CSV Jobs
```bash
node scripts/import-csv-jobs.js path/to/jobs.csv
```

### Import Companies Manually
```bash
node scripts/add-manual-companies.js
```

## 🚀 Deploy to Production

### 1. Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Or deploy to production
vercel --prod
```

### 2. Set Environment Variables
In Vercel Dashboard → Settings → Environment Variables, add all variables from `.env.local`.

### 3. Verify Deployment
```bash
# Replace with your Vercel URL
curl https://your-app.vercel.app/api/health
```

## 📊 Key Features

### Dashboard
- **URL**: `/` or `/dashboard`
- **Features**: Real-time stats, processing status, company counts

### Companies List
- **URL**: `/companies`
- **Features**: Search, filter by tool, export to CSV/JSON

### API Endpoints
- `GET /api/dashboard` - System statistics
- `GET /api/companies` - List all companies
- `POST /api/analyze` - Analyze jobs
- `GET /api/health` - Health check

## 🛠️ Common Operations

### Start Continuous Processing
```bash
curl -X POST http://localhost:4001/api/processor/start
```

### Stop Processing
```bash
curl -X POST http://localhost:4001/api/processor/stop
```

### Export Companies
```bash
# CSV format
curl "http://localhost:4001/api/companies/export?format=csv" -o companies.csv

# JSON format
curl "http://localhost:4001/api/companies/export?format=json" -o companies.json
```

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Kill process on port 4001
lsof -ti:4001 | xargs kill -9

# Or use a different port
PORT=3002 npm run dev
```

### Database Connection Issues
1. Check Supabase credentials in `.env.local`
2. Verify Supabase project is active
3. Test connection:
```bash
node scripts/test-supabase.js
```

### OpenAI API Errors
1. Verify API key has GPT-5 access
2. Check API key in `.env.local`
3. Test API:
```bash
node scripts/test-gpt5-api.js
```

## 📚 Additional Resources

- **Full Documentation**: See [README.md](README.md)
- **Architecture**: See [ARCHITECTURE.md](ARCHITECTURE.md)
- **Troubleshooting**: See [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- **API Reference**: See [API.md](API.md)

## 💡 Next Steps

1. **Import Fresh Data**: Get new job listings to process
2. **Enable Automation**: Set up scheduled job imports
3. **Monitor Performance**: Track API usage and costs
4. **Customize Detection**: Adjust GPT-5 prompts for better accuracy
5. **Scale Up**: Deploy to production and process more jobs

## 🆘 Need Help?

- Check the [Issues](https://github.com/eimribar/job-scraper/issues)
- Review [Current Status](CURRENT_STATUS.md)
- See [Deployment Guide](VERCEL_DEPLOYMENT.md)

---

**Ready to find companies using sales tools!** 🎯