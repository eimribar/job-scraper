# ⚙️ Job Processing Documentation - Sales Tool Detector

## Processing Overview

The system uses a multi-stage pipeline to analyze job descriptions and identify companies using sales tools.

## Processing Flow Diagram

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Data Import │────▶│ Pre-Filtering│────▶│   GPT-5      │
│   (CSV/API)  │     │  & Validation│     │   Analysis   │
└──────────────┘     └──────────────┘     └──────────────┘
                                                  │
                            ┌─────────────────────▼
                            ▼                     
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    Store     │◀────│   Duplicate  │◀────│   Pattern    │
│   Results    │     │  Prevention  │     │   Matching   │
└──────────────┘     └──────────────┘     └──────────────┘
```

## Main Processor: `scripts/simple-processor.js`

### Initialization
```javascript
// Load environment and dependencies
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(url, key);

// Initialize counters
let jobsProcessed = 0;
let companiesFound = 0;
let jobsSkipped = 0;
let identifiedCompaniesSet = new Set();
```

### Stage 1: Pre-Loading
```javascript
async function loadIdentifiedCompanies() {
  // Load all identified companies into memory
  const { data: companies } = await supabase
    .from('identified_companies')
    .select('company, tool_detected');
    
  // Store normalized and original names
  companies?.forEach(c => {
    identifiedCompaniesSet.add(c.company);
    identifiedCompaniesSet.add(c.company.toLowerCase().trim());
  });
}
```

### Stage 2: Job Fetching
```javascript
// Get unprocessed jobs in batches
const { data: jobs } = await supabase
  .from('raw_jobs')
  .select('*')
  .eq('processed', false)
  .order('created_at', { ascending: true })
  .limit(25);  // Batch size
```

### Stage 3: Protection Checks
```javascript
// Skip if company already identified
if (identifiedCompaniesSet.has(job.company)) {
  console.log('⏭️ Already identified');
  markAsProcessed(job);
  jobsSkipped++;
  continue;
}

// Double-check if job already processed
const { data: existingJob } = await supabase
  .from('raw_jobs')
  .select('processed')
  .eq('job_id', job.job_id)
  .single();
  
if (existingJob?.processed) {
  continue;
}
```

### Stage 4: GPT-5 Analysis

#### Request Structure
```javascript
const response = await fetch('https://api.openai.com/v1/responses', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${OPENAI_API_KEY}`
  },
  body: JSON.stringify({
    model: 'gpt-5-mini',  // CRITICAL: Only GPT-5
    input: prompt,
    reasoning: { effort: 'minimal' },
    text: { verbosity: 'low' }
  })
});
```

#### Prompt Template
```
Analyze this job description to identify if the company uses Outreach.io or SalesLoft.

Valid indicators for Outreach.io:
- "Outreach.io" (explicit mention)
- "Outreach platform"
- Capitalized "Outreach" when listed with other tools

NOT valid:
- "sales outreach"
- "cold outreach"
- lowercase "outreach" in general context

Company: [COMPANY]
Job Title: [JOB_TITLE]
Description: [DESCRIPTION]

Return JSON:
{
  "uses_tool": true/false,
  "tool_detected": "Outreach.io"|"SalesLoft"|"Both"|"none",
  "signal_type": "required"|"preferred"|"stack_mention"|"none",
  "context": "exact quote",
  "confidence": "high"|"medium"|"low"
}
```

### Stage 5: Result Storage
```javascript
// UPSERT to prevent duplicates
await supabase
  .from('identified_companies')
  .upsert({
    company: job.company,
    tool_detected: analysis.tool_detected,
    signal_type: analysis.signal_type,
    context: analysis.context,
    confidence: analysis.confidence,
    job_title: job.job_title,
    job_url: job.job_url,
    platform: job.platform || 'LinkedIn',
    identified_date: new Date().toISOString()
  }, {
    onConflict: 'company,tool_detected',
    ignoreDuplicates: false
  });
```

### Stage 6: Queue Management
```javascript
// Track in processing queue
await supabase
  .from('processing_queue')
  .upsert({
    job_id: job.job_id,
    status: 'processing',
    started_at: new Date().toISOString()
  });

// Update on completion
await supabase
  .from('processing_queue')
  .update({
    status: 'completed',
    completed_at: new Date().toISOString()
  })
  .eq('job_id', job.job_id);
```

## Advanced Processor: `lib/services/continuousProcessor.ts`

### Features
- TypeScript implementation
- 50 jobs per batch
- Error recovery with retries
- Real-time statistics
- Google Sheets sync integration

### Key Methods
```typescript
class ContinuousProcessor {
  async start(): Promise<void>
  async stop(): Promise<void>
  getStatus(): ProcessorStatus
  async getStats(): Promise<ProcessingStats>
  async reprocessErrors(): Promise<void>
}
```

## Processing Configuration

### Environment Variables
```env
PROCESSING_BATCH_SIZE=25      # Jobs per batch
PROCESSING_RATE_LIMIT=1000    # MS between API calls
MAX_RETRIES=3                 # Retry attempts for failed jobs
```

### Rate Limiting
- **OpenAI API**: 1 request per second (1000ms delay)
- **Supabase**: 100 concurrent connections
- **Google Sheets**: 1000 requests per day

## Error Handling

### Error Types & Recovery

| Error Type | Recovery Strategy | Max Retries |
|------------|------------------|-------------|
| API Rate Limit | Exponential backoff | 5 |
| Network Error | Immediate retry | 3 |
| Invalid Response | Skip and log | 1 |
| Database Error | Transaction rollback | 3 |
| GPT-5 Timeout | Retry with smaller batch | 2 |

### Error Logging
```javascript
catch (error) {
  console.error(`Error processing job ${job.job_id}:`, error);
  
  // Log to processing_queue
  await supabase
    .from('processing_queue')
    .update({
      status: 'error',
      error_message: error.message
    })
    .eq('job_id', job.job_id);
    
  errors++;
}
```

## Performance Optimization

### Current Performance
- **Processing Rate**: 86 jobs per 30 seconds
- **Skip Rate**: ~5% (already identified companies)
- **Success Rate**: >98%
- **API Cost**: ~$0.02 per 100 jobs

### Optimization Strategies

#### 1. Company Pre-Filtering
```javascript
// Skip companies already in database
if (identifiedCompaniesSet.has(company)) {
  skip();  // Saves API call
}
```

#### 2. Batch Processing
```javascript
// Process multiple jobs together
const batchSize = 25;  // Optimal for memory/speed
```

#### 3. Memory Caching
```javascript
// Load identified companies at startup
const identifiedCompaniesSet = new Set(companies);
```

#### 4. Smart Retries
```javascript
// Only retry specific error types
if (error.code === 'RATE_LIMIT') {
  await sleep(exponentialBackoff(attempt));
  retry();
}
```

## Monitoring & Metrics

### Real-Time Monitoring
```javascript
// Status update every batch
console.log(`📈 Progress: ${jobsProcessed} processed, ${jobsSkipped} skipped`);

// Performance metrics
const processingRate = jobsProcessed / (Date.now() - startTime);
console.log(`Rate: ${processingRate} jobs/second`);
```

### Database Queries for Monitoring
```sql
-- Current processing status
SELECT status, COUNT(*) FROM processing_queue GROUP BY status;

-- Processing rate (last hour)
SELECT COUNT(*) / 60.0 as jobs_per_minute
FROM raw_jobs
WHERE analyzed_date > NOW() - INTERVAL '1 hour';

-- Error rate
SELECT 
  COUNT(CASE WHEN status = 'error' THEN 1 END)::float / COUNT(*) as error_rate
FROM processing_queue;
```

## Manual Processing Commands

### Start Processor
```bash
node scripts/simple-processor.js
```

### Process Specific Company
```javascript
node -e "
const processor = require('./scripts/simple-processor.js');
processor.analyzeCompany('Example Corp');
"
```

### Reprocess Errors
```sql
-- Reset failed jobs
UPDATE raw_jobs 
SET processed = false 
WHERE job_id IN (
  SELECT job_id FROM processing_queue 
  WHERE status = 'error'
);
```

## Troubleshooting

### Common Issues

#### 1. Processor Stuck
```bash
# Check for stuck jobs
SELECT * FROM processing_queue 
WHERE status = 'processing' 
AND started_at < NOW() - INTERVAL '10 minutes';

# Reset stuck jobs
UPDATE processing_queue 
SET status = 'pending' 
WHERE status = 'processing' 
AND started_at < NOW() - INTERVAL '10 minutes';
```

#### 2. High Error Rate
```javascript
// Check error messages
SELECT error_message, COUNT(*) 
FROM processing_queue 
WHERE status = 'error' 
GROUP BY error_message 
ORDER BY COUNT(*) DESC;
```

#### 3. Slow Processing
- Reduce batch size
- Increase rate limit delay
- Check OpenAI API status
- Verify database indexes

## Best Practices

### Do's
✅ Always use GPT-5 (never GPT-4)
✅ Check for duplicates before processing
✅ Log all errors with context
✅ Use UPSERT for idempotency
✅ Monitor processing rate
✅ Backup before bulk operations

### Don'ts
❌ Process same job twice
❌ Ignore rate limits
❌ Use synchronous processing for large batches
❌ Store sensitive data in logs
❌ Skip error handling

---

**Processing Version**: 2.0.0
**Last Updated**: September 2, 2025
**Average Processing Time**: 1.5 seconds per job
