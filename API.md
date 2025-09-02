# 📡 API Documentation - Sales Tool Detector

## Overview
All API endpoints are serverless functions deployed via Next.js API routes. Base URL: `http://localhost:4001/api` (development) or `https://your-domain.com/api` (production).

## Authentication
Currently using environment-based authentication. Production will use Supabase Auth with JWT tokens.

## Endpoints

### 🎯 Dashboard & Statistics

#### GET /api/dashboard
Returns comprehensive dashboard statistics.

**Response:**
```json
{
  "success": true,
  "totalCompanies": 669,
  "outreachCount": 526,
  "salesLoftCount": 213,
  "bothTools": 6,
  "processingRate": 86.4,
  "recentDiscoveries": [
    {
      "company_name": "Example Corp",
      "tool_detected": "Outreach.io",
      "identified_date": "2025-09-02T10:30:00Z"
    }
  ],
  "jobsProcessedToday": 881
}
```

### 🏢 Companies

#### GET /api/companies
Retrieves paginated list of identified companies.

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 50, max: 100)
- `tool` (string): Filter by tool ("Outreach.io", "SalesLoft", "Both")
- `confidence` (string): Filter by confidence ("high", "medium", "low")
- `search` (string): Search company names
- `startDate` (string): Filter by date (ISO 8601)
- `endDate` (string): Filter by date (ISO 8601)

**Response:**
```json
{
  "companies": [
    {
      "id": 1,
      "company": "Example Corp",
      "tool_detected": "Outreach.io",
      "signal_type": "required",
      "context": "Experience with Outreach.io required",
      "confidence": "high",
      "job_title": "SDR",
      "job_url": "https://...",
      "platform": "LinkedIn",
      "identified_date": "2025-09-02T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 669,
    "totalPages": 14
  }
}
```

#### GET /api/companies/export
Exports companies in CSV or JSON format.

**Query Parameters:**
- `format` (string): "csv" or "json" (required)
- `tool` (string): Filter by tool
- `confidence` (string): Filter by confidence
- `startDate` (string): Filter by date
- `endDate` (string): Filter by date

**Response:**
- CSV: File download with Content-Type: text/csv
- JSON: Array of company objects

### 🔄 Processing Control

#### POST /api/processor/start
Starts the continuous job processor.

**Response:**
```json
{
  "success": true,
  "message": "Processor started",
  "status": {
    "isRunning": true,
    "jobsProcessed": 0,
    "startedAt": "2025-09-02T10:30:00Z"
  }
}
```

#### POST /api/processor/stop
Stops the continuous job processor gracefully.

**Response:**
```json
{
  "success": true,
  "message": "Processor stopped gracefully"
}
```

#### GET /api/processor/status
Gets current processor status.

**Response:**
```json
{
  "isRunning": true,
  "currentJob": "job_12345",
  "jobsProcessed": 150,
  "jobsSkipped": 26,
  "errors": 2,
  "startedAt": "2025-09-02T10:30:00Z",
  "lastActivityAt": "2025-09-02T11:45:00Z"
}
```

### 🤖 Analysis

#### POST /api/analyze
Manually triggers analysis of specific jobs or batch.

**Request Body:**
```json
{
  "jobIds": ["job_123", "job_456"],  // Optional: specific jobs
  "limit": 10,                        // Optional: batch size
  "force": false                      // Re-analyze processed jobs
}
```

**Response:**
```json
{
  "success": true,
  "processed": 10,
  "identified": 3,
  "errors": 0,
  "results": [
    {
      "jobId": "job_123",
      "company": "Example Corp",
      "toolDetected": "Outreach.io",
      "confidence": "high"
    }
  ]
}
```

### 📊 Google Sheets Sync

#### POST /api/sync/manual
Triggers manual synchronization with Google Sheets.

**Request Body:**
```json
{
  "direction": "both",  // "pull" | "push" | "both"
  "force": false        // Override conflict resolution
}
```

**Response:**
```json
{
  "success": true,
  "pullResults": {
    "jobsAdded": 45,
    "companiesAdded": 12,
    "duplicatesSkipped": 8
  },
  "pushResults": {
    "jobsUpdated": 156,
    "companiesUpdated": 23
  }
}
```

#### GET /api/sync/status
Gets current sync status.

**Response:**
```json
{
  "lastSync": "2025-09-02T09:15:00Z",
  "status": "idle",
  "conflicts": 0,
  "pendingOperations": 0,
  "errors": []
}
```

### 🏥 Health & Monitoring

#### GET /api/health
System health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "openai": "operational",
  "googleSheets": "connected",
  "processor": {
    "running": true,
    "lastActivity": "2025-09-02T11:45:00Z"
  },
  "version": "2.0.0"
}
```

## Error Responses

All endpoints follow consistent error response format:

```json
{
  "error": "Error message",
  "details": "Detailed error information",
  "code": "ERROR_CODE",
  "status": 400
}
```

### Common Error Codes
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (missing/invalid auth)
- `404` - Not Found (resource doesn't exist)
- `429` - Rate Limited (too many requests)
- `500` - Internal Server Error
- `503` - Service Unavailable (external service down)

## Rate Limiting

### Current Limits
- General API: 100 requests/minute
- Export endpoints: 10 requests/minute
- Processing control: 5 requests/minute

### Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1693574400
```

## Webhook Events (Future)

### company.identified
Triggered when new company identified.
```json
{
  "event": "company.identified",
  "data": {
    "company": "Example Corp",
    "tool": "Outreach.io",
    "confidence": "high"
  },
  "timestamp": "2025-09-02T10:30:00Z"
}
```

### processing.complete
Triggered when batch processing completes.
```json
{
  "event": "processing.complete",
  "data": {
    "jobsProcessed": 100,
    "companiesFound": 12,
    "duration": 3600
  }
}
```

## Code Examples

### JavaScript/Node.js
```javascript
// Get dashboard stats
const response = await fetch('http://localhost:4001/api/dashboard');
const stats = await response.json();

// Export companies as CSV
const csv = await fetch('http://localhost:4001/api/companies/export?format=csv&tool=Outreach.io');
const blob = await csv.blob();
// Download file...

// Start processor
await fetch('http://localhost:4001/api/processor/start', {
  method: 'POST'
});
```

### cURL
```bash
# Get dashboard
curl http://localhost:4001/api/dashboard

# Export companies
curl "http://localhost:4001/api/companies/export?format=json&confidence=high"

# Start processor
curl -X POST http://localhost:4001/api/processor/start
```

### Python
```python
import requests

# Get companies
response = requests.get('http://localhost:4001/api/companies', 
    params={'page': 1, 'tool': 'SalesLoft'})
data = response.json()

# Trigger analysis
response = requests.post('http://localhost:4001/api/analyze',
    json={'limit': 50})
```

## Testing Endpoints

Use these commands to test API endpoints:

```bash
# Test health
curl http://localhost:4001/api/health

# Test dashboard
curl http://localhost:4001/api/dashboard | jq '.'

# Test companies with filters
curl "http://localhost:4001/api/companies?page=1&limit=10&tool=Outreach.io" | jq '.'

# Test export
curl "http://localhost:4001/api/companies/export?format=json&limit=5" | jq '.'
```

---

**API Version**: 2.0.0
**Last Updated**: September 2, 2025
