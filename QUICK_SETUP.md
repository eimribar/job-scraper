# 🚀 Quick Setup Instructions

## Step 1: Execute SQL Migration

1. **Supabase SQL Editor is now open in your browser**
2. **Copy the entire contents** of: `migrations/create-search-terms-table.sql`
3. **Paste into the SQL editor** and click "Run" (or press Cmd+Enter)

This will create:
- ✅ **search_terms** table with 37 search terms
- ✅ **notifications** table for real-time alerts
- ✅ **processing_runs** table for tracking automation

## Step 2: Verify Setup

After executing the SQL, run this command:

```bash
node scripts/setup-search-terms.js
```

This will:
- Verify tables were created
- Display all 37 search terms organized by priority
- Create a sample notification

## Step 3: Check the Dashboard

The application is running at: http://localhost:4001

## What's Created:

### 37 Search Terms (Weekly Schedule)
- **Monday**: Core SDR/BDR roles (7 terms)
- **Tuesday**: Sales Operations (5 terms)
- **Wednesday**: Account Executive roles (6 terms)
- **Thursday**: Sales Leadership (7 terms)
- **Friday**: Sales Support (5 terms)
- **Weekend**: Specialized roles (7 terms)

### Tables Created:
1. **search_terms** - Automated weekly scraping configuration
2. **notifications** - Real-time discovery alerts
3. **processing_runs** - Track each scraping/analysis run

## Next Steps:
Once the tables are created, we'll continue with:
- Building the automation scheduler
- Creating the live dashboard
- Setting up real-time notifications