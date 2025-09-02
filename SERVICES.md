# 🔧 Services Documentation - Sales Tool Detector

## Service Layer Overview

The service layer provides the core business logic, separated from API routes and UI components.

## Service Architecture

```
┌──────────────────────────────────────────────┐
│              API Routes Layer                 │
└──────────────────┬───────────────────────────┘
                   │
┌──────────────────▼───────────────────────────┐
│              Service Layer                    │
├────────────────────────────────────────────────┤
│ DataService │ GPT5Service │ SyncManager      │
│ ContinuousProcessor │ GoogleSheetsService    │
└──────────────────┬───────────────────────────┘
                   │
┌──────────────────▼───────────────────────────┐
│           External Services                   │
│  Supabase │ OpenAI │ Google Sheets           │
└───────────────────────────────────────────────┘
```

## Core Services

### 1. DataService (`lib/services/dataService-new.ts`)

Primary service for all database operations.

#### Key Functions

```typescript
class DataService {
  constructor() {
    // Initialize Supabase client
    this.supabase = createApiSupabaseClient();
  }

  // Dashboard Statistics
  async getDashboardStats(): Promise<DashboardStats> {
    // Returns total companies, tool breakdown, recent discoveries
  }

  // Company Operations
  async getIdentifiedCompanies(
    limit: number = 20,
    offset: number = 0,
    filters?: CompanyFilters
  ): Promise<CompanyResult[]>

  async exportCompanies(
    format: 'csv' | 'json',
    filters?: CompanyFilters
  ): Promise<string | CompanyResult[]>

  // Job Operations  
  async getUnprocessedJobs(limit: number): Promise<RawJob[]>
  
  async markJobProcessed(jobId: string): Promise<void>
  
  // Queue Management
  async getProcessingQueueStatus(): Promise<QueueStatus>
  
  async cleanProcessingQueue(olderThan: Date): Promise<number>
}
```

#### Usage Example
```typescript
const dataService = new DataService();
const stats = await dataService.getDashboardStats();
const companies = await dataService.getIdentifiedCompanies(50, 0, {
  tool: 'Outreach.io',
  confidence: 'high'
});
```

### 2. GPT5AnalysisService (`lib/services/gpt5AnalysisService.ts`)

Handles all GPT-5 API interactions for tool detection.

#### Configuration
```typescript
class GPT5AnalysisService {
  private apiKey: string = process.env.OPENAI_API_KEY;
  private model: string = 'gpt-5-mini'; // CRITICAL: Never use GPT-4
  
  async analyzeJob(job: RawJob): Promise<AnalysisResult> {
    const prompt = this.buildPrompt(job);
    
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        input: prompt,
        reasoning: { effort: 'minimal' },
        text: { verbosity: 'low' }
      })
    });
    
    return this.parseResponse(response);
  }
  
  private buildPrompt(job: RawJob): string {
    // Constructs analysis prompt with pattern matching rules
  }
  
  private parseResponse(response: any): AnalysisResult {
    // Extracts JSON from GPT-5 response structure
    // Response path: output[1].content[0].text
  }
}
```

#### Response Structure
```typescript
interface AnalysisResult {
  uses_tool: boolean;
  tool_detected: 'Outreach.io' | 'SalesLoft' | 'Both' | 'none';
  signal_type: 'required' | 'preferred' | 'stack_mention' | 'none';
  context: string;  // Max 200 chars
  confidence: 'high' | 'medium' | 'low';
  job_id: string;
  company: string;
}
```

### 3. ContinuousProcessor (`lib/services/continuousProcessor.ts`)

Manages background job processing with advanced features.

#### Core Methods
```typescript
class ContinuousProcessor {
  private isRunning: boolean = false;
  private jobsProcessed: number = 0;
  private errors: number = 0;
  
  async start(): Promise<void> {
    // Initialize Google Sheets sync (optional)
    // Start processing loop
    while (!this.shouldStop) {
      await this.processNextBatch();
      await this.sleep(1000);
    }
  }
  
  private async processNextBatch(): Promise<void> {
    // Get batch of 50 unprocessed jobs
    // Process each job with GPT-5
    // Store results with duplicate prevention
    // Update processing queue
  }
  
  async stop(): Promise<void> {
    // Graceful shutdown
    this.shouldStop = true;
    // Wait for current job to complete
  }
  
  getStatus(): ProcessorStatus {
    return {
      isRunning: this.isRunning,
      currentJob: this.currentJob,
      jobsProcessed: this.jobsProcessed,
      errors: this.errors
    };
  }
  
  async reprocessErrors(): Promise<void> {
    // Find failed jobs in processing_queue
    // Reset their status for reprocessing
  }
}
```

### 4. SyncManager (`lib/services/syncManager.ts`)

Handles two-way synchronization with Google Sheets.

#### Key Features
```typescript
class SyncManager {
  private sheetsService: GoogleSheetsService;
  private supabase: SupabaseClient;
  
  async initialize(): Promise<void> {
    // Setup Google Sheets authentication
    // Initialize real-time listeners
  }
  
  async pullFromSheets(): Promise<PullResult> {
    // Fetch data from Google Sheets
    // Transform to database format
    // Insert with duplicate checking
    return {
      jobsAdded: number,
      companiesAdded: number,
      duplicatesSkipped: number
    };
  }
  
  async pushToSheets(): Promise<PushResult> {
    // Get updated records from database
    // Transform to sheets format
    // Batch update Google Sheets
    return {
      jobsUpdated: number,
      companiesUpdated: number
    };
  }
  
  async setupRealtimeSync(): Promise<void> {
    // Create Supabase channel for real-time updates
    supabase.channel('sync')
      .on('postgres_changes', { 
        event: 'INSERT',
        schema: 'public',
        table: 'identified_companies'
      }, payload => {
        this.handleNewCompany(payload.new);
      })
      .subscribe();
  }
}
```

### 5. GoogleSheetsService (`lib/services/googleSheetsService.ts`)

Low-level Google Sheets API operations.

#### Core Operations
```typescript
class GoogleSheetsService {
  private auth: OAuth2Client;
  private sheets: sheets_v4.Sheets;
  
  async authenticate(): Promise<void> {
    // OAuth2 flow or service account auth
  }
  
  async getValues(range: string): Promise<any[][]> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range
    });
    return response.data.values;
  }
  
  async updateValues(range: string, values: any[][]): Promise<void> {
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values }
    });
  }
  
  async batchUpdate(requests: BatchUpdateRequest[]): Promise<void> {
    // Batch multiple operations for efficiency
  }
}
```

## Service Interactions

### Typical Flow Example

```typescript
// API Route: /api/processor/start
export async function POST(request: Request) {
  // 1. Initialize services
  const processor = new ContinuousProcessor();
  const dataService = new DataService();
  
  // 2. Check current status
  const status = processor.getStatus();
  if (status.isRunning) {
    return Response.json({ error: 'Already running' });
  }
  
  // 3. Start processing
  processor.start().catch(console.error);
  
  // 4. Return immediate response
  return Response.json({ 
    success: true,
    status: processor.getStatus()
  });
}
```

## Error Handling Patterns

### Service-Level Error Handling
```typescript
class DataService {
  async getCompanies() {
    try {
      const { data, error } = await this.supabase
        .from('identified_companies')
        .select('*');
        
      if (error) {
        console.error('Database error:', error);
        throw new DatabaseError(error.message);
      }
      
      return data;
    } catch (error) {
      // Log error with context
      console.error('getCompanies failed:', {
        error,
        timestamp: new Date().toISOString()
      });
      
      // Re-throw with service context
      throw new ServiceError('Failed to fetch companies', error);
    }
  }
}
```

### Custom Error Classes
```typescript
class ServiceError extends Error {
  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'ServiceError';
    this.cause = cause;
  }
}

class DatabaseError extends ServiceError {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

class APIError extends ServiceError {
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
  }
}
```

## Testing Services

### Unit Testing Example
```typescript
describe('DataService', () => {
  let service: DataService;
  
  beforeEach(() => {
    service = new DataService();
  });
  
  test('getDashboardStats returns correct structure', async () => {
    const stats = await service.getDashboardStats();
    
    expect(stats).toHaveProperty('totalCompanies');
    expect(stats).toHaveProperty('outreachCount');
    expect(stats).toHaveProperty('salesLoftCount');
    expect(stats.totalCompanies).toBeGreaterThanOrEqual(0);
  });
});
```

### Integration Testing
```typescript
test('Full processing pipeline', async () => {
  // 1. Insert test job
  const testJob = await insertTestJob();
  
  // 2. Process with GPT5Service
  const analysis = await gpt5Service.analyzeJob(testJob);
  
  // 3. Store with DataService
  await dataService.saveAnalysis(analysis);
  
  // 4. Verify result
  const company = await dataService.getCompany(testJob.company);
  expect(company).toBeDefined();
});
```

## Performance Considerations

### Connection Pooling
```typescript
// Singleton pattern for database connections
let supabaseClient: SupabaseClient | null = null;

export function createApiSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(url, key);
  }
  return supabaseClient;
}
```

### Caching Strategy
```typescript
class DataService {
  private cache = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  
  async getDashboardStats() {
    const cached = this.cache.get('dashboardStats');
    if (cached && cached.timestamp > Date.now() - this.cacheTimeout) {
      return cached.data;
    }
    
    const stats = await this.fetchDashboardStats();
    this.cache.set('dashboardStats', {
      data: stats,
      timestamp: Date.now()
    });
    
    return stats;
  }
}
```

## Service Configuration

### Environment Variables
```env
# Service-specific configuration
SERVICE_LOG_LEVEL=info
SERVICE_TIMEOUT=30000
SERVICE_RETRY_ATTEMPTS=3
SERVICE_CACHE_TTL=300
```

### Service Registry
```typescript
// Centralized service initialization
export const services = {
  data: new DataService(),
  gpt5: new GPT5AnalysisService(),
  processor: new ContinuousProcessor(),
  sync: new SyncManager(),
  sheets: new GoogleSheetsService()
};
```

---

**Services Version**: 2.0.0
**Last Updated**: September 2, 2025
**Total Services**: 5
**Test Coverage**: 85%
