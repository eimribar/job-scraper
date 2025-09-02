# Sales Tool Detector - Deployment Guide

## Overview
This guide covers the complete setup and deployment of the Sales Tool Detector system with GPT-5 analysis, Google Sheets synchronization, and continuous processing.

## Key Features
- **GPT-5 ONLY Analysis**: Uses GPT-5 Responses API exclusively (never falls back to other models)
- **Two-Way Sync**: Complete synchronization between Supabase and Google Sheets
- **Continuous Processing**: Runs non-stop until all jobs are analyzed
- **Real-time Updates**: Automatic sync when new data is added to either system

## Prerequisites
1. Node.js 18+ installed
2. Supabase account and project
3. OpenAI API key with GPT-5 access
4. Google Cloud account for Sheets API
5. Vercel account for deployment

## Step 1: Database Setup

### 1.1 Create Supabase Tables
1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Run the migration script:
```bash
psql YOUR_SUPABASE_CONNECTION_STRING < migrations/google-sheets-sync-schema.sql
```

### 1.2 Verify Tables Created
You should have these tables:
- `raw_jobs` - Mirrors Google Sheets Raw_Jobs
- `identified_companies` - Mirrors Google Sheets Identified_Companies
- `sync_status` - Tracks synchronization status
- `processing_queue` - Manages job processing

## Step 2: Google Sheets Setup

### 2.1 Enable Google Sheets API
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google Sheets API and Google Drive API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs: 
     - `http://localhost:3001/api/auth/callback`
     - `https://your-app.vercel.app/api/auth/callback`

### 2.2 Configure Service Account (for server operations)
1. Create a service account in Google Cloud Console
2. Download the JSON key file
3. Share your Google Sheet with the service account email
4. Give it Editor permissions

### 2.3 Google Sheet Structure
Ensure your Google Sheet (ID: `10HAtT2kfXSGSRobC1O_z-TcrOuXg7Yc1hGBwHmD_WY4`) has:
- **Raw_Jobs** sheet with columns:
  - job_id, platform, company, job_title, location, description, job_url, scraped_date, search_term, processed, analyzed_date, _stats, row_number
- **Identified_Companies** sheet with columns:
  - Company, tool_detected, signal_type, context, job_title, job_url, LinkedIn URL, platform, identified_date, Leads Uploaded?, (empty), Tier 2 leads Uploaded?, SPONSOR 1, SPONSOR 1 - LI URL, SPONSOR 2, SPONSOR 2 - LI URL, Rep (SDR/BDR), REP - LI URL, tags on the dashboard

## Step 3: Environment Configuration

### 3.1 Copy Environment Variables
```bash
cp .env.local.example .env.local
```

### 3.2 Configure .env.local
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://nslcadgicgkncajoyyno.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI (GPT-5 ONLY)
OPENAI_API_KEY=your_openai_api_key

# Google Sheets
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
SPREADSHEET_ID=10HAtT2kfXSGSRobC1O_z-TcrOuXg7Yc1hGBwHmD_WY4
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=/path/to/service-account.json

# App
NEXT_PUBLIC_APP_URL=http://localhost:3001
PORT=3001
WEBHOOK_SECRET=generate_a_random_secret
```

## Step 4: Local Development

### 4.1 Install Dependencies
```bash
npm install
```

### 4.2 Run Database Migration
```bash
npm run migrate
```

### 4.3 Start Development Server
```bash
npm run dev
```

The app will be available at http://localhost:3001

## Step 5: Initial Data Sync

### 5.1 Pull Existing Data from Google Sheets
```bash
curl -X POST http://localhost:3001/api/sync/pull
```

### 5.2 Verify Data in Supabase
Check your Supabase dashboard to confirm data was imported

## Step 6: Start Continuous Processing

### 6.1 Start the Processor
```bash
curl -X POST http://localhost:3001/api/process/start
```

### 6.2 Monitor Processing Status
```bash
curl http://localhost:3001/api/process/status
```

### 6.3 Check Sync Status
```bash
curl http://localhost:3001/api/sync/status
```

## Step 7: Deploy to Vercel

### 7.1 Prepare for Deployment
```bash
git add .
git commit -m "Deploy Sales Tool Detector with GPT-5 and Google Sheets sync"
git push origin main
```

### 7.2 Deploy to Vercel
```bash
vercel --prod
```

### 7.3 Configure Environment Variables in Vercel
1. Go to your Vercel dashboard
2. Navigate to Settings > Environment Variables
3. Add all variables from .env.local
4. Important: Add both OPENAI_API_KEY and VITE_OPENAI_API_KEY with the same value

### 7.4 Configure Vercel Functions
Create `vercel.json`:
```json
{
  "functions": {
    "app/api/process/start/route.ts": {
      "maxDuration": 300
    },
    "app/api/sync/pull/route.ts": {
      "maxDuration": 60
    }
  }
}
```

## Step 8: Set Up Webhooks

### 8.1 Google Sheets Webhook
Set up Google Apps Script to notify your app of changes:
1. Open your Google Sheet
2. Extensions > Apps Script
3. Add this code:
```javascript
function onEdit(e) {
  const webhookUrl = 'https://your-app.vercel.app/api/sync/webhook';
  UrlFetchApp.fetch(webhookUrl, {
    method: 'post',
    headers: {
      'Authorization': 'Bearer YOUR_WEBHOOK_SECRET',
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({
      sheet: e.source.getActiveSheet().getName(),
      range: e.range.getA1Notation(),
      timestamp: new Date().toISOString()
    })
  });
}
```

## Step 9: Testing the Full Pipeline

### 9.1 Add Test Job to Google Sheets
Add a row to Raw_Jobs sheet with a job description containing "Outreach.io" or "SalesLoft"

### 9.2 Verify Processing
1. Check processor picks up the job: `curl https://your-app.vercel.app/api/process/status`
2. Verify GPT-5 analysis completes
3. Check identified company appears in Identified_Companies sheet
4. Confirm Supabase tables are updated

## Step 10: Monitoring & Maintenance

### 10.1 Dashboard Access
Visit https://your-app.vercel.app/dashboard to monitor:
- Processing queue status
- Sync status between systems
- Analytics and metrics
- Error logs

### 10.2 Logs
Check Vercel Functions logs for detailed information:
```bash
vercel logs --prod
```

### 10.3 Troubleshooting Common Issues

**Issue: GPT-5 API errors**
- Solution: Verify API key has GPT-5 access
- Check: Response should use `/v1/responses` endpoint, not `/v1/chat/completions`

**Issue: Sync not working**
- Solution: Check service account has Sheet access
- Verify: SPREADSHEET_ID matches your sheet

**Issue: Processor not finding jobs**
- Solution: Ensure `processed` column is FALSE in Raw_Jobs
- Check: Sync status in dashboard

## API Endpoints Reference

### Sync Endpoints
- `GET/POST /api/sync/pull` - Pull from Sheets to Supabase
- `POST /api/sync/push` - Push from Supabase to Sheets
- `GET /api/sync/status` - Get sync status
- `POST /api/sync/webhook` - Handle Sheet changes

### Processing Endpoints
- `POST /api/process/start` - Start continuous processor
- `POST /api/process/stop` - Stop processor
- `GET /api/process/status` - Get processor status

## Important Notes

### GPT-5 ONLY Policy
- The system is configured to use ONLY GPT-5
- Never modify to use GPT-4, GPT-4.1, or other models
- All analysis uses the Responses API (`/v1/responses`)
- Model is hardcoded as `gpt-5` in the code

### Continuous Processing
- Processor runs until all jobs are analyzed
- No batch limits or scheduled runs
- Automatically processes new jobs as they arrive
- Rate limited to 2 seconds between API calls

### Data Synchronization
- Two-way sync maintains consistency
- Changes in either system sync automatically
- Sheet row numbers are preserved for tracking
- Conflict resolution uses last-write-wins

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review logs in Vercel dashboard
3. Verify environment variables are set correctly
4. Ensure Google Sheets has correct structure

## Security Considerations

1. **API Keys**: Never commit API keys to git
2. **Service Account**: Keep JSON key file secure
3. **Webhook Secret**: Use strong random string
4. **Rate Limiting**: Respect API rate limits
5. **Access Control**: Limit Sheet access to necessary accounts

## Cost Optimization

- **GPT-5 Usage**: ~$0.01 per 100 job analyses
- **Supabase**: Free tier supports up to 500MB
- **Vercel**: Free tier includes 100GB bandwidth
- **Google Sheets API**: 300 requests per minute limit

## Next Steps

After deployment:
1. Monitor initial sync completion
2. Verify continuous processing is running
3. Set up alerts for errors
4. Configure backup strategy
5. Plan for scaling if needed

---

**Last Updated**: 2025-09-02
**Version**: 2.0.0 (GPT-5 + Google Sheets Sync)