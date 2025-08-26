# 📊 Sales Tool Detector - Jobs To Be Done (JTBD) Documentation

> **Complete documentation of all JTBDs, setup requirements, and operational workflows**

## 🎯 Executive Summary

**Product**: Sales Tool Detector
**Purpose**: Identify companies using Outreach.io or SalesLoft by analyzing job postings
**Users**: SDR and GTM teams
**Status**: Backend configured, awaiting database setup

---

## 📋 Jobs To Be Done (JTBDs)

### 1. Primary User JTBDs

#### JTBD-001: Identify Target Companies
**When** I'm an SDR looking for new prospects  
**I want to** quickly identify companies using Outreach.io or SalesLoft  
**So that** I can target companies already using tools that integrate with our solution  

**Acceptance Criteria:**
- Can search job postings from Indeed and LinkedIn
- AI analyzes descriptions for tool mentions
- Results show confidence levels (high/medium/low)
- Can export results to CSV for CRM import

#### JTBD-002: Monitor Market Adoption
**When** I'm a GTM leader tracking market trends  
**I want to** see which companies are adopting sales engagement platforms  
**So that** I can identify market opportunities and competitive intelligence  

**Acceptance Criteria:**
- Dashboard shows real-time statistics
- Tracks both Outreach.io and SalesLoft adoption
- Shows trends over time
- Identifies new companies entering the market

#### JTBD-003: Enrich Prospect Data
**When** I have a list of target accounts  
**I want to** know which sales tools they use  
**So that** I can personalize my outreach and value proposition  

**Acceptance Criteria:**
- Can search for specific companies
- Shows confidence level of tool detection
- Provides context (job posting excerpts)
- Integrates with existing CRM workflow

#### JTBD-004: Automate Lead Generation
**When** I need to build pipeline consistently  
**I want to** automatically discover new leads using specific tools  
**So that** I can focus on outreach rather than research  

**Acceptance Criteria:**
- Automated daily/weekly scraping
- Email/Slack notifications for new discoveries
- Filters for high-confidence matches only
- Direct export to CRM systems

---

## 🏗️ System Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │Dashboard │ │Companies │ │ Insights │ │Export/Import │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Layer (Next.js API)                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ /scrape  │ │/analyze  │ │/companies│ │   /health    │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
                               │
                ┌──────────────┼──────────────┐
                ▼              ▼              ▼
┌──────────────────┐ ┌──────────────┐ ┌──────────────┐
│   Apify          │ │   OpenAI     │ │   Supabase   │
│ (Web Scraping)   │ │ (AI Analysis)│ │  (Database)  │
│ • Indeed         │ │ • GPT-5-mini │ │ • PostgreSQL │
│ • LinkedIn       │ │   ONLY!      │ │ • Real-time  │
└──────────────────┘ └──────────────┘ └──────────────┘
```

### Data Flow

1. **Scraping Flow**
   ```
   User triggers scrape → API calls Apify → Jobs saved to Supabase
   ```

2. **Analysis Flow**
   ```
   Unprocessed jobs → OpenAI analysis → Companies identified → Database updated
   ```

3. **Export Flow**
   ```
   User requests export → Query database → Format (CSV/JSON) → Download
   ```

---

## 🔧 Setup Requirements

### ✅ Completed Setup

#### 1. Environment Configuration (.env.local)
```env
# ✅ Configured
NEXT_PUBLIC_SUPABASE_URL=https://pwszwezqrkdqfnparlsh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-5-mini-2025-08-07  # CRITICAL: Never change!
APIFY_TOKEN=apify_api_9kW...
```

#### 2. Backend Services
- ✅ **Rate Limiting**: Configured for all APIs
- ✅ **Retry Logic**: Exponential backoff implemented
- ✅ **Job Queues**: Background processing ready
- ✅ **Health Monitoring**: /api/health endpoint active
- ✅ **Error Handling**: Graceful degradation

#### 3. API Integrations
- ✅ **OpenAI**: Connected with GPT-5-mini (NEVER GPT-4!)
- ✅ **Apify**: LinkedIn scraper configured
- ⚠️ **Supabase**: Credentials set, tables pending

### ⏳ Pending Setup

#### 1. Supabase Database Tables
**Required Action**: Run SQL migration in Supabase dashboard

**Tables to Create**:
- `jobs` - Scraped job postings
- `identified_companies` - Companies using tools
- `search_terms` - Search keywords
- `processed_ids` - Deduplication tracking
- `scraping_runs` - Activity logs

**SQL Script Location**: `/supabase-schema.sql`

#### 2. Optional Enhancements
- [ ] Slack notifications webhook
- [ ] Authentication system
- [ ] Automated scheduling (cron jobs)
- [ ] Analytics tracking
- [ ] Error monitoring (Sentry)

---

## 📊 Core Workflows

### Workflow 1: Manual Scraping
```mermaid
graph LR
    A[User] -->|Triggers| B[/api/scrape]
    B --> C{Apify}
    C -->|Indeed| D[Jobs]
    C -->|LinkedIn| D[Jobs]
    D --> E[Deduplication]
    E --> F[Save to DB]
    F --> G[Ready for Analysis]
```

### Workflow 2: AI Analysis
```mermaid
graph LR
    A[Unprocessed Jobs] --> B[/api/analyze]
    B --> C[Batch Processing]
    C --> D{OpenAI GPT-5}
    D -->|Detects Tools| E[Companies Identified]
    D -->|No Tools| F[Mark Processed]
    E --> G[Save to DB]
    G --> H[Dashboard Update]
```

### Workflow 3: Data Export
```mermaid
graph LR
    A[User] -->|Requests| B[/api/companies/export]
    B --> C[Query Database]
    C --> D{Format}
    D -->|CSV| E[Download]
    D -->|JSON| E[Download]
    E --> F[CRM Import]
```

---

## 🚀 Operations Guide

### Daily Operations

1. **Morning Routine**
   - Check health status: `GET /api/health`
   - Review overnight scraping results
   - Process any failed jobs
   - Export new companies for CRM

2. **Scraping Process**
   ```bash
   # Scrape jobs for a search term
   POST /api/scrape
   {
     "searchTerm": "SDR",
     "maxItemsPerPlatform": 50
   }
   ```

3. **Analysis Process**
   ```bash
   # Analyze unprocessed jobs
   POST /api/analyze
   {
     "limit": 100,
     "confidenceThreshold": "medium"
   }
   ```

4. **Export Process**
   ```bash
   # Export companies as CSV
   GET /api/companies/export?format=csv&tool=Outreach.io
   ```

### Monitoring & Maintenance

1. **Health Checks**
   - Monitor service status: `/api/health`
   - Check rate limiter queues
   - Verify API credit usage
   - Database connection status

2. **Performance Metrics**
   - Jobs scraped per day
   - Analysis success rate
   - Tool detection accuracy
   - API costs tracking

3. **Error Recovery**
   - Failed jobs automatically retry (3x)
   - Rate limiting prevents quota exhaustion
   - Graceful degradation with mock data
   - All errors logged for debugging

---

## 💰 Cost Management

### API Usage Estimates

1. **Apify** (Web Scraping)
   - Cost: ~$0.40 per 1000 pages
   - Budget: $5-10/month for moderate use
   - Optimization: Batch requests, cache results

2. **OpenAI** (AI Analysis)
   - Model: GPT-5-mini @ $0.25/1M input tokens
   - Budget: $10-20/month for ~10k analyses
   - Optimization: Batch processing, caching

3. **Supabase** (Database)
   - Free tier: 500MB database, 2GB bandwidth
   - Sufficient for: ~100k job records
   - Upgrade when: >1000 daily analyses

### Cost Optimization Strategies
- Use confidence thresholds to reduce false positives
- Cache company results to avoid re-analysis
- Implement daily/weekly limits
- Monitor usage via health endpoints

---

## 🔐 Security & Compliance

### Security Measures
- ✅ Environment variables for secrets
- ✅ No hardcoded credentials
- ✅ API rate limiting
- ✅ Input validation
- ⏳ Authentication (pending)
- ⏳ Row-level security (pending)

### Data Privacy
- No PII collected from job postings
- Company names are public information
- Job descriptions are publicly available
- No candidate information stored

---

## 📈 Success Metrics

### Key Performance Indicators (KPIs)

1. **Accuracy Metrics**
   - Tool detection accuracy: Target >90%
   - False positive rate: Target <5%
   - Confidence distribution: Monitor high vs low

2. **Operational Metrics**
   - Jobs processed per day: Target 1000+
   - Analysis success rate: Target >95%
   - API error rate: Target <1%

3. **Business Metrics**
   - New companies identified weekly
   - Qualified leads generated
   - CRM integration success rate
   - Time saved vs manual research

---

## 🛠️ Troubleshooting Guide

### Common Issues

1. **Supabase Connection Failed**
   - Verify credentials in .env.local
   - Check if tables exist in dashboard
   - Run migration SQL if needed

2. **OpenAI API Errors**
   - Check API key validity
   - Verify account has credits
   - Monitor rate limits

3. **Apify Scraping Failed**
   - Verify token is valid
   - Check actor availability
   - Monitor credit balance

4. **No Companies Found**
   - Adjust search terms
   - Lower confidence threshold
   - Check if jobs contain tool mentions

---

## 📚 Additional Resources

### Documentation
- [README.md](README.md) - Project overview
- [BACKEND_SETUP.md](BACKEND_SETUP.md) - Backend configuration
- [CLOUD.md](CLOUD.md) - Deployment guide
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Issue resolution

### External Links
- [Supabase Dashboard](https://app.supabase.com)
- [OpenAI Platform](https://platform.openai.com)
- [Apify Console](https://console.apify.com)
- [Vercel Dashboard](https://vercel.com)

---

## 📅 Roadmap

### Phase 1: Foundation (Current)
- ✅ Core scraping functionality
- ✅ AI analysis pipeline
- ✅ Basic dashboard
- ⏳ Database setup
- ⏳ Production deployment

### Phase 2: Enhancement (Next)
- [ ] Slack notifications
- [ ] Advanced filtering
- [ ] Batch processing UI
- [ ] Historical trending
- [ ] Company enrichment

### Phase 3: Scale (Future)
- [ ] Multi-tenant support
- [ ] CRM integrations
- [ ] Custom AI models
- [ ] Territory mapping
- [ ] Competitive intelligence

---

## 🤝 Team Responsibilities

### SDR Team
- Daily scraping execution
- Lead qualification
- CRM data import
- Feedback on accuracy

### GTM Team
- Strategy definition
- KPI monitoring
- Tool evaluation
- Budget management

### Technical Team
- System maintenance
- API management
- Cost optimization
- Feature development

---

## ✅ Setup Checklist

Before going live, ensure:

- [x] Environment variables configured
- [x] OpenAI API key with credits
- [x] Apify token with credits
- [ ] Supabase tables created
- [ ] Health check passing (all green)
- [ ] Test scraping successful
- [ ] Test analysis successful
- [ ] Export functionality working
- [ ] Dashboard loading data
- [ ] Vercel deployment ready

---

**Last Updated**: 2025-08-26
**Version**: 1.0.0
**Status**: Awaiting database setup