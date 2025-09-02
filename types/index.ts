/**
 * Type definitions for Sales Tool Detector
 */

// Raw job from Google Sheets / Supabase
export interface RawJob {
  id?: number;
  job_id: string;
  platform?: string;
  company: string;
  job_title: string;
  location?: string;
  description?: string;
  job_url?: string;
  scraped_date?: Date | string;
  search_term?: string;
  processed?: boolean;
  analyzed_date?: Date | string;
  _stats?: string;
  row_number?: number;
  sheet_row?: number;
  created_at?: Date | string;
  updated_at?: Date | string;
}

// Analysis result from GPT-5
export interface AnalysisResult {
  uses_tool: boolean;
  tool_detected: 'Outreach.io' | 'SalesLoft' | 'Both' | 'none';
  signal_type: 'required' | 'preferred' | 'stack_mention' | 'none';
  context: string;
  confidence: 'high' | 'medium' | 'low';
  job_id: string;
  company: string;
  job_title: string;
  job_url?: string;
  platform?: string;
  error?: string;
}

// Identified company for database
export interface IdentifiedCompany {
  id?: number;
  company: string;
  tool_detected: string;
  signal_type?: string;
  context?: string;
  job_title?: string;
  job_url?: string;
  linkedin_url?: string;
  platform?: string;
  identified_date?: Date | string;
  leads_uploaded?: string;
  tier_2_leads_uploaded?: string;
  sponsor_1?: string;
  sponsor_1_li_url?: string;
  sponsor_2?: string;
  sponsor_2_li_url?: string;
  rep_sdr_bdr?: string;
  rep_li_url?: string;
  tags_on_dashboard?: string;
  sheet_row?: number;
  created_at?: Date | string;
  updated_at?: Date | string;
}

// Sync status tracking
export interface SyncStatus {
  id?: number;
  table_name: string;
  last_sync_from_sheets?: Date | string;
  last_sync_to_sheets?: Date | string;
  sheets_last_modified?: Date | string;
  sync_status: 'pending' | 'syncing' | 'completed' | 'error';
  error_message?: string;
  rows_synced?: number;
  created_at?: Date | string;
  updated_at?: Date | string;
}

// Processing queue item
export interface ProcessingQueueItem {
  id?: number;
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  priority?: number;
  attempts?: number;
  max_attempts?: number;
  error_message?: string;
  started_at?: Date | string;
  completed_at?: Date | string;
  created_at?: Date | string;
}

// Google Sheets range data
export interface SheetRange {
  range: string;
  values: any[][];
}

// Google Sheets update request
export interface SheetUpdate {
  range: string;
  values: any[][];
}

// Sync operation result
export interface SyncResult {
  success: boolean;
  table: string;
  rowsAffected: number;
  error?: string;
}

// Processing statistics
export interface ProcessingStats {
  totalJobs: number;
  processedJobs: number;
  pendingJobs: number;
  errorJobs: number;
  companiesIdentified: number;
  outreachCompanies: number;
  salesloftCompanies: number;
  processingRate: number; // jobs per minute
  lastProcessedAt?: Date | string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Processor status
export interface ProcessorStatus {
  isRunning: boolean;
  currentJob?: string;
  jobsProcessed: number;
  startedAt?: Date | string;
  lastActivityAt?: Date | string;
  errors: number;
}

// Sheet credentials (for OAuth)
export interface SheetCredentials {
  client_id: string;
  client_secret: string;
  refresh_token?: string;
  access_token?: string;
  token_expiry?: Date | string;
}

// Configuration
export interface Config {
  supabase: {
    url: string;
    anonKey: string;
    serviceKey?: string;
  };
  openai: {
    apiKey: string;
    model: 'gpt-5'; // ONLY GPT-5
  };
  google: {
    clientId: string;
    clientSecret: string;
    spreadsheetId: string;
  };
  processing: {
    batchSize: number;
    rateLimit: number; // ms between requests
    maxRetries: number;
  };
}