# 🏗️ System Architecture - Sales Tool Detector

## Overview
Sales Tool Detector is a full-stack application that identifies companies using Outreach.io or SalesLoft by analyzing job descriptions using GPT-5. Built with Next.js 14, TypeScript, Supabase, and OpenAI's latest models.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
├─────────────────────────────────────────────────────────────────┤
│  Dashboard │ Companies Table │ Export Tools │ Real-time Stats   │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Routes (Next.js)                          │
├─────────────────────────────────────────────────────────────────┤
│  /api/dashboard │ /api/companies │ /api/processor │ /api/sync   │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Service Layer                                │
├─────────────────────────────────────────────────────────────────┤
│  DataService │ GPT5Service │ SyncManager │ ContinuousProcessor  │
└────────┬──────────────────┬──────────────────┬─────────────────┘
         │                  │                  │
         ▼                  ▼                  ▼
┌─────────────────┐ ┌──────────────┐ ┌──────────────────┐
│    Supabase     │ │  OpenAI API  │ │  Google Sheets   │
│   PostgreSQL    │ │   GPT-5      │ │      API         │
└─────────────────┘ └──────────────┘ └──────────────────┘
```

## Core Components

### 1. Frontend Layer
- **Technology**: Next.js 14 with App Router, TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui component library
- **Key Pages**:
  - `/` - Dashboard with stats and recent discoveries
  - `/companies` - Full companies table with filtering
  - Components use server-side rendering for optimal performance

### 2. API Layer
- **Framework**: Next.js API Routes (serverless functions)
- **Endpoints**:
  - `/api/dashboard` - Statistics and metrics
  - `/api/companies` - Company data with pagination
  - `/api/companies/export` - CSV/JSON export
  - `/api/processor/*` - Processing control
  - `/api/sync/*` - Google Sheets synchronization
  - `/api/analyze` - Manual job analysis
  - `/api/health` - System health check

### 3. Service Layer

#### DataService (`lib/services/dataService-new.ts`)
- Database operations and queries
- Company deduplication logic
- Statistics aggregation
- Export functionality

#### GPT5AnalysisService (`lib/services/gpt5AnalysisService.ts`)
- OpenAI GPT-5 integration using Responses API
- Tool detection logic
- Confidence scoring
- Pattern matching for Outreach.io and SalesLoft

#### ContinuousProcessor (`lib/services/continuousProcessor.ts`)
- Background job processing
- Batch processing (50 jobs at a time)
- Error recovery and retry logic
- Processing queue management

#### SyncManager (`lib/services/syncManager.ts`)
- Two-way Google Sheets synchronization
- Conflict resolution (last-write-wins)
- Real-time sync using Supabase channels
- Data transformation between formats

### 4. Data Layer

#### Database Schema (Supabase PostgreSQL)

```sql
-- Main tables
identified_companies (
  id, company, tool_detected, signal_type, context, 
  confidence, job_title, job_url, platform, identified_date
  UNIQUE(company, tool_detected)
)

raw_jobs (
  id, job_id (UNIQUE), platform, company, job_title, 
  description, location, job_url, processed, analyzed_date
)

processing_queue (
  id, job_id (UNIQUE), status, started_at, 
  completed_at, error_message, attempts
)

sync_status (
  id, sheet_name, last_sync_at, sync_direction, 
  records_synced, errors
)
```

## Data Flow

### Job Processing Pipeline

```
1. Data Import
   ├─> CSV Import (scripts/import-jobs-data.js)
   └─> Google Sheets Sync (syncManager.pullFromSheets())

2. Pre-Processing Protection
   ├─> Check if job_id already processed
   └─> Check if company already identified (skip)

3. Processing Queue
   └─> Add to processing_queue (status: processing)

4. GPT-5 Analysis
   ├─> Model: gpt-5-mini
   ├─> Endpoint: /v1/responses
   └─> Pattern matching for tools

5. Store Results
   ├─> UPSERT to identified_companies
   └─> Prevents duplicates via constraint

6. Post-Processing
   ├─> Mark job as processed
   ├─> Update processing_queue
   └─> Sync to Google Sheets (optional)
```

## Key Design Decisions

### 1. Duplicate Prevention (Two-Layer Protection)
- **Database Level**: UNIQUE constraint on (company, tool_detected)
- **Application Level**: UPSERT operations with conflict resolution
- **Result**: Mathematically impossible to create duplicates

### 2. Processing Optimization
- **Skip Logic**: Don't re-analyze companies already identified
- **Batch Processing**: 25-50 jobs per batch for efficiency
- **Rate Limiting**: 500-1000ms between API calls
- **Memory Cache**: Load identified companies at startup

### 3. Error Recovery
- **Graceful Failures**: Jobs marked as error, can be retried
- **Transaction Safety**: Database operations are atomic
- **Backup Strategy**: JSON exports before major operations
- **Processing Queue**: Tracks status and allows retry

### 4. GPT-5 Integration
- **Model**: ONLY gpt-5-mini (NEVER GPT-4)
- **API**: Responses API (/v1/responses)
- **Settings**: reasoning.effort: minimal, text.verbosity: low
- **Pattern Matching**: Distinguishes "Outreach" tool from "outreach" activity

## Technology Stack

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Frontend | Next.js | 14 | React framework with SSR |
| Language | TypeScript | 5.x | Type safety |
| Styling | Tailwind CSS | 3.x | Utility-first CSS |
| UI Components | shadcn/ui | Latest | Pre-built components |
| Database | Supabase | Latest | PostgreSQL as a service |
| AI Analysis | OpenAI GPT-5 | gpt-5-mini | Tool detection |
| Data Sync | Google Sheets API | v4 | External data integration |
| Deployment | Vercel | Latest | Serverless hosting |
| Package Manager | npm | 10.x | Dependency management |

## Security Considerations

### API Keys Management
```env
# Critical - Never expose
OPENAI_API_KEY=sk-proj-...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GOOGLE_CLIENT_SECRET=...

# Public - Safe to expose
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### Data Protection
- No PII stored beyond company names and job titles
- Job descriptions processed transiently
- Backup before destructive operations
- Environment-based configuration

## Performance Metrics

### Current Benchmarks
- **Processing Rate**: ~86 jobs per 30 seconds
- **Detection Accuracy**: 95%+ for explicit tool mentions
- **API Response Time**: <500ms average
- **Database Queries**: <50ms with indexes
- **Companies Identified**: 669 unique
- **Jobs Processed**: 13,000+

### Optimization Features
- Company skip protection (saves ~5% of API calls)
- Batch processing for efficiency
- Database indexes on frequently queried columns
- Memory caching of identified companies

## File Structure

```
sales-tool-detector/
├── app/                        # Next.js App Router
│   ├── api/                   # API endpoints
│   │   ├── dashboard/         
│   │   ├── companies/         
│   │   ├── processor/         
│   │   └── sync/             
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Dashboard page
│
├── components/                # React components
│   ├── companies/            
│   │   └── companies-table-wrapper.tsx
│   ├── dashboard/            
│   │   ├── stats-cards.tsx
│   │   └── recent-discoveries.tsx
│   └── ui/                   # shadcn/ui components
│
├── lib/                      
│   ├── services/             # Core services
│   │   ├── dataService-new.ts
│   │   ├── gpt5AnalysisService.ts
│   │   ├── continuousProcessor.ts
│   │   ├── syncManager.ts
│   │   └── googleSheetsService.ts
│   └── supabase.ts          # Database client
│
├── scripts/                  # Utility scripts
│   ├── simple-processor.js  # Main processing script
│   ├── import-jobs-data.js
│   └── test-supabase.js
│
├── migrations/              # Database schemas
│   ├── google-sheets-sync-schema.sql
│   └── add-unique-constraint.sql
│
└── .env.local              # Environment variables
```

## Monitoring & Observability

### Health Checks
- `/api/health` - Overall system status
- `/api/dashboard` - Real-time metrics
- Processing queue status tracking
- Error logging and tracking

### Key Metrics
- Jobs processed per hour
- Companies identified per day
- Skip rate (companies already identified)
- Error rate and types
- API costs (OpenAI usage)

## Deployment

### Development
```bash
PORT=4001 npm run dev       # Start dev server
node scripts/simple-processor.js  # Run processor
```

### Production (Vercel)
- Automatic deployment on git push
- Environment variables in Vercel dashboard
- Serverless functions for API routes
- Edge caching for static assets

## Future Enhancements

### Near Term
- Webhook notifications for new discoveries
- Advanced filtering and search
- Bulk export improvements
- Processing speed optimization

### Long Term
- Multi-tenant support
- CRM integrations (Salesforce, HubSpot)
- Machine learning for improved detection
- Real-time WebSocket updates
- Elasticsearch for full-text search

---

**Last Updated**: September 2, 2025
**Version**: 2.0.0
**Status**: Production Ready