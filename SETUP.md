# =€ Complete Setup Guide - Sales Tool Detector

## Prerequisites

Before starting, ensure you have:
- **Node.js 18+** and npm installed
- **Git** for version control
- **Supabase account** (free tier works)
- **OpenAI API key** with GPT-5 access
- **Google Cloud account** (optional, for Sheets sync)
- **Code editor** (VS Code recommended)

## Step 1: Clone and Install

```bash
# Clone the repository
git clone https://github.com/eimribar/sales-tool-detector.git
cd sales-tool-detector

# Install dependencies
npm install
```

## Step 2: Supabase Setup

### 2.1 Create Supabase Project
1. Visit [Supabase Dashboard](https://app.supabase.com)
2. Click "New Project"
3. Enter project details:
   - Name: `sales-tool-detector`
   - Database Password: (save this!)
   - Region: Choose closest to you
4. Wait for project to initialize (~2 minutes)

### 2.2 Get Credentials
From your Supabase project dashboard:
1. Go to Settings ’ API
2. Copy:
   - **Project URL**: `https://YOUR_PROJECT.supabase.co`
   - **Anon Key**: `eyJ...` (public key)
   - **Service Role Key**: `eyJ...` (keep secret!)

### 2.3 Initialize Database Schema
1. Go to SQL Editor in Supabase
2. Run this migration:

```sql
-- Create main tables
CREATE TABLE identified_companies (
  id SERIAL PRIMARY KEY,
  company TEXT NOT NULL,
  tool_detected TEXT NOT NULL,
  signal_type TEXT,
  context TEXT,
  confidence TEXT,
  job_title TEXT,
  job_url TEXT,
  linkedin_url TEXT,
  platform TEXT DEFAULT 'LinkedIn',
  identified_date TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE raw_jobs (
  id SERIAL PRIMARY KEY,
  job_id TEXT UNIQUE NOT NULL,
  platform TEXT,
  company TEXT NOT NULL,
  job_title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  job_url TEXT,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  analyzed_date TIMESTAMP
);

CREATE TABLE processing_queue (
  id SERIAL PRIMARY KEY,
  job_id TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending',
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  attempts INTEGER DEFAULT 1
);

CREATE TABLE sync_status (
  id SERIAL PRIMARY KEY,
  sheet_name TEXT NOT NULL,
  last_sync_at TIMESTAMP DEFAULT NOW(),
  sync_direction TEXT,
  records_synced INTEGER DEFAULT 0,
  errors TEXT
);

-- Add unique constraint to prevent duplicates
ALTER TABLE identified_companies
ADD CONSTRAINT unique_company_tool 
UNIQUE (company, tool_detected);

-- Add indexes for performance
CREATE INDEX idx_raw_jobs_processed ON raw_jobs(processed);
CREATE INDEX idx_companies_tool ON identified_companies(tool_detected);
CREATE INDEX idx_companies_date ON identified_companies(identified_date DESC);
CREATE INDEX idx_processing_queue_status ON processing_queue(status);
```

## Step 3: OpenAI Setup

### 3.1 Get API Key
1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create new API key
3. **IMPORTANT**: Ensure you have GPT-5 access
4. Copy the key (starts with `sk-proj-`)

### 3.2 Verify GPT-5 Access
Test your API key:
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY" | grep gpt-5
```

You should see `gpt-5-mini` in the response.

## Step 4: Google Sheets Setup (Optional)

### 4.1 Create Google Cloud Project
1. Visit [Google Cloud Console](https://console.cloud.google.com)
2. Create new project
3. Enable Google Sheets API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:4001/api/auth/callback`

### 4.2 Get Spreadsheet ID
1. Create a Google Sheet
2. Copy the ID from URL: `docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`

## Step 5: Environment Configuration

Create `.env.local` file in project root:

```bash
# CRITICAL: Copy this exactly, replace with your values

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your_anon_key...
# Remove or comment out service role key if it's from a different project
# SUPABASE_SERVICE_ROLE_KEY=eyJ...your_service_key...

# OpenAI Configuration (MUST BE GPT-5)
OPENAI_API_KEY=sk-proj-your-openai-key-here

# Google Sheets (Optional)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
SPREADSHEET_ID=your-spreadsheet-id

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:4001
PORT=4001

# Processing Configuration
PROCESSING_BATCH_SIZE=25
PROCESSING_RATE_LIMIT=1000
```

## Step 6: Data Import

### Option A: Import from CSV
```bash
# Import job data
node scripts/import-jobs-data.js path/to/jobs.csv

# Import company data
node scripts/import-companies-data.js path/to/companies.csv
```

### Option B: Manual Test Data
```sql
-- Insert test job in Supabase SQL Editor
INSERT INTO raw_jobs (job_id, company, job_title, description, platform)
VALUES (
  'test_001',
  'Example Corp',
  'Sales Development Representative',
  'Looking for SDR with experience in Outreach.io for managing sequences and campaigns.',
  'LinkedIn'
);
```

## Step 7: Start the Application

### 7.1 Start Development Server
```bash
# Terminal 1: Start Next.js
PORT=4001 npm run dev
```

### 7.2 Start Job Processor
```bash
# Terminal 2: Start processor
node scripts/simple-processor.js
```

### 7.3 Open Dashboard
Visit [http://localhost:4001](http://localhost:4001)

## Step 8: Verify Setup

### 8.1 Test Database Connection
```bash
node scripts/test-supabase.js
```
Expected output:
```
 Connection successful!
Total jobs in database: X
Unprocessed jobs: Y
```

### 8.2 Test GPT-5 API
```bash
node -e "
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'YOUR_KEY';
fetch('https://api.openai.com/v1/responses', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': \`Bearer \${OPENAI_API_KEY}\`
  },
  body: JSON.stringify({
    model: 'gpt-5-mini',
    input: 'Test',
    reasoning: { effort: 'minimal' },
    text: { verbosity: 'low' }
  })
}).then(r => r.json()).then(console.log);
"
```

### 8.3 Check Dashboard
- Stats cards should show data
- Recent discoveries should update
- Companies table should load

## Troubleshooting

### Common Issues

#### 1. "Invalid API key" Error
- Check if service role key is from different project
- Comment out `SUPABASE_SERVICE_ROLE_KEY` if not matching your project

#### 2. GPT-5 Not Working
- Verify API key has GPT-5 access
- Ensure using `/v1/responses` endpoint, not `/v1/chat/completions`
- Model must be `gpt-5-mini`, never GPT-4

#### 3. Port Already in Use
```bash
# Kill process on port 4001
lsof -i :4001 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

#### 4. Database Connection Failed
- Check Supabase project is active
- Verify URL and keys are correct
- Ensure no extra spaces in .env.local

## Production Deployment

### Vercel Deployment
1. Push code to GitHub
2. Connect repo to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Environment Variables for Production
- Use production Supabase instance
- Set `NODE_ENV=production`
- Update `NEXT_PUBLIC_APP_URL` to production domain
- Ensure all API keys are set

## Maintenance

### Daily Tasks
- Monitor processing queue
- Check error logs
- Verify new companies identified

### Weekly Tasks
- Clean old processing_queue entries
- Backup identified_companies table
- Review detection accuracy

### Database Maintenance
```sql
-- Clean old processing queue entries
DELETE FROM processing_queue 
WHERE status = 'completed' 
AND completed_at < NOW() - INTERVAL '7 days';

-- Check for duplicates
SELECT company, tool_detected, COUNT(*) 
FROM identified_companies 
GROUP BY company, tool_detected 
HAVING COUNT(*) > 1;
```

## Security Checklist

- [ ] Never commit `.env.local` to git
- [ ] Keep `OPENAI_API_KEY` secret
- [ ] Keep `SUPABASE_SERVICE_ROLE_KEY` secret
- [ ] Use environment variables for all secrets
- [ ] Enable Row Level Security in production
- [ ] Regularly rotate API keys
- [ ] Monitor API usage for anomalies

## Support & Resources

- **Documentation**: See README.md
- **Architecture**: See ARCHITECTURE.md
- **API Reference**: See API.md
- **Database Schema**: See DATABASE.md
- **GitHub Issues**: Report bugs and request features
- **Supabase Docs**: https://supabase.com/docs
- **OpenAI Docs**: https://platform.openai.com/docs

---

**Setup Version**: 2.0.0
**Last Updated**: September 2, 2025
**Estimated Setup Time**: 30-45 minutes