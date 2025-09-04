import { createApiSupabaseClient } from '../supabase';
import { ScrapedJob } from './scraperService';

export interface AnalyzedJob {
  job_id: string;
  platform: string;
  company: string;
  job_title: string;
  location: string;
  description: string;
  job_url: string;
  scraped_date: string;
  search_term: string;
  analysis: {
    uses_tool: boolean;
    tool_detected: string;
    signal_type: string;
    context: string;
    confidence: string;
  };
  analysis_date: string;
}

export class DataService {
  private _supabase: any;
  private isConfigured: boolean;

  constructor() {
    try {
      this._supabase = createApiSupabaseClient();
      this.isConfigured = !!this._supabase;
    } catch (error) {
      // During build time, this is expected
      if (process.env.NODE_ENV !== 'production' || process.env.BUILDING) {
        this._supabase = null;
        this.isConfigured = false;
      } else {
        console.error('Failed to initialize Supabase client:', error);
        this.isConfigured = false;
        this._supabase = null;
      }
    }
  }
  
  // Getter that ensures client is initialized before use
  private get supabase() {
    if (!this._supabase && !this.isConfigured) {
      try {
        this._supabase = createApiSupabaseClient();
        this.isConfigured = !!this._supabase;
      } catch (error) {
        throw new Error('Supabase is not configured. Please check your environment variables.');
      }
    }
    if (!this._supabase) {
      throw new Error('Supabase client is not available');
    }
    return this._supabase;
  }

  // ================================================
  // RAW JOBS MANAGEMENT
  // ================================================

  async saveRawJobs(jobs: ScrapedJob[]): Promise<void> {
    if (jobs.length === 0) {
      console.log('saveRawJobs: No jobs to save (empty array)');
      return;
    }
    
    console.log(`\\nsaveRawJobs: Attempting to save ${jobs.length} job(s) to raw_jobs table`);
    jobs.forEach((job, idx) => {
      console.log(`  [${idx + 1}] Job ID: ${job.job_id} | ${job.company} - ${job.job_title}`);
    });

    // Insert jobs with processed = FALSE (ready for analysis)
    const { error } = await this.supabase
      .from('raw_jobs')
      .upsert(jobs.map(job => ({
        job_id: job.job_id,
        platform: job.platform,
        company: job.company,
        job_title: job.job_title,
        location: job.location,
        description: job.description,
        job_url: job.job_url,
        scraped_date: job.scraped_date,
        search_term: job.search_term,
        processed: false,
        processed_date: null
      })), { onConflict: 'job_id' });

    if (error) {
      console.error('❌ Error saving jobs to raw_jobs:');
      console.error('  Error details:', JSON.stringify(error, null, 2));
      throw error;
    }
    
    console.log(`  ✅ Successfully saved ${jobs.length} job(s) to raw_jobs table\\n`);
  }

  async getUnprocessedJobs(limit: number = 100): Promise<ScrapedJob[]> {
    const { data, error } = await this.supabase
      .from('raw_jobs')
      .select('*')
      .eq('processed', false)
      .order('scraped_date', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Error fetching unprocessed jobs:', error);
      throw error;
    }

    return data || [];
  }

  async markJobAsProcessed(jobId: string): Promise<void> {
    const { error } = await this.supabase
      .from('raw_jobs')
      .update({ 
        processed: true,
        processed_date: new Date().toISOString()
      })
      .eq('job_id', jobId);

    if (error) {
      console.error('Error marking job as processed:', error);
      throw error;
    }

    // Also add to processed_jobs tracking table
    await this.supabase
      .from('processed_jobs')
      .upsert({ 
        job_id: jobId, 
        processed_date: new Date().toISOString() 
      }, { onConflict: 'job_id' });
  }

  // ================================================
  // IDENTIFIED COMPANIES MANAGEMENT
  // ================================================

  async saveIdentifiedCompany(analyzedJob: AnalyzedJob): Promise<void> {
    if (!analyzedJob.analysis.uses_tool) {
      return;
    }

    const { error } = await this.supabase
      .from('identified_companies')
      .upsert({
        company_name: analyzedJob.company,
        tool_detected: analyzedJob.analysis.tool_detected,
        signal_type: analyzedJob.analysis.signal_type,
        context: analyzedJob.analysis.context,
        confidence: analyzedJob.analysis.confidence,
        job_title: analyzedJob.job_title,
        job_url: analyzedJob.job_url,
        linkedin_url: '', // For BDR manual population
        platform: analyzedJob.platform,
        identified_date: analyzedJob.analysis_date,
      }, { 
        onConflict: 'company_name,tool_detected',
        ignoreDuplicates: false 
      });

    if (error) {
      console.error('Error saving identified company:', error);
      throw error;
    }
  }

  async getIdentifiedCompanies(
    limit: number = 100, 
    offset: number = 0,
    tool?: string,
    confidence?: string,
    search?: string
  ): Promise<any[]> {
    if (!this.isConfigured || !this.supabase) {
      console.warn('DataService not configured - returning empty companies list');
      return [];
    }

    let query = this.supabase
      .from('identified_companies')
      .select('*')
      .order('identified_date', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by tool
    if (tool && tool !== 'all') {
      query = query.eq('tool_detected', tool);
    }

    // Filter by confidence
    if (confidence && confidence !== 'all') {
      query = query.eq('confidence', confidence);
    }

    // Add search filter
    if (search) {
      query = query.ilike('company_name', `%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching identified companies:', error);
      throw error;
    }

    // Map to expected dashboard format - simplified
    return data?.map(c => ({
      id: c.id,
      company: c.company || c.company_name,  // Support both column names
      tool_detected: c.tool_detected,
      context: c.context,
      job_title: c.job_title,
      job_url: c.job_url,
      identified_date: c.identified_date
    })) || [];
  }

  async getIdentifiedCompaniesCount(tool?: string, confidence?: string, search?: string): Promise<number> {
    if (!this.isConfigured || !this.supabase) {
      console.warn('DataService not configured - returning 0 count');
      return 0;
    }

    let query = this.supabase
      .from('identified_companies')
      .select('id', { count: 'exact', head: true });

    if (tool && tool !== 'all') {
      query = query.eq('tool_detected', tool);
    }

    if (confidence && confidence !== 'all') {
      query = query.eq('confidence', confidence);
    }

    if (search) {
      query = query.ilike('company_name', `%${search}%`);
    }

    const { count, error } = await query;

    if (error) {
      console.error('Error counting identified companies:', error);
      throw error;
    }

    return count || 0;
  }

  // ================================================
  // SEARCH TERMS MANAGEMENT
  // ================================================

  async getActiveSearchTerms(): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('search_terms_clean')
      .select('*')
      .eq('is_active', true)
      .order('search_term');

    if (error) {
      console.error('Error fetching search terms:', error);
      throw error;
    }

    return data || [];
  }

  async updateSearchTermLastScraped(searchTerm: string, jobsFound: number): Promise<void> {
    const { error } = await this.supabase
      .from('search_terms_clean')
      .update({
        last_scraped_date: new Date().toISOString(),
        jobs_found_count: jobsFound,
      })
      .eq('search_term', searchTerm);

    if (error) {
      console.error('Error updating search term:', error);
      throw error;
    }
  }

  // ================================================
  // DASHBOARD STATS
  // ================================================

  async getDashboardStats() {
    if (!this.isConfigured || !this.supabase) {
      console.warn('DataService not configured - returning empty dashboard stats');
      return {
        totalCompanies: 0,
        outreachCount: 0,
        salesLoftCount: 0,
        recentDiscoveries: [],
        jobsProcessedToday: 0,
      };
    }
    
    try {
      // Get total companies by tool
      const { data: companies, error: companiesError } = await this.supabase
        .from('identified_companies')
        .select('company, tool_detected, identified_date');

      if (companiesError) throw companiesError;

      const outreachCount = companies?.filter(c => c.tool_detected === 'Outreach.io' || c.tool_detected === 'Both').length || 0;
      const salesLoftCount = companies?.filter(c => c.tool_detected === 'SalesLoft' || c.tool_detected === 'Both').length || 0;
      const totalCompanies = companies?.length || 0;

      // Get recent discoveries (last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { data: recentCompanies, error: recentError } = await this.supabase
        .from('identified_companies')
        .select('company, tool_detected, identified_date')
        .gte('identified_date', yesterday.toISOString())
        .order('identified_date', { ascending: false })
        .limit(10);

      if (recentError) throw recentError;

      // Map recent discoveries to expected format
      const recentDiscoveries = (recentCompanies || []).map(company => ({
        company_name: company.company,  // Map 'company' to 'company_name'
        tool_detected: company.tool_detected,
        identified_date: company.identified_date
      }));

      // Get total jobs processed today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count: jobsProcessedToday, error: jobsError } = await this.supabase
        .from('raw_jobs')
        .select('job_id', { count: 'exact', head: true })
        .eq('processed', true)
        .gte('analyzed_date', today.toISOString());

      if (jobsError) throw jobsError;

      return {
        totalCompanies,
        outreachCount,
        salesLoftCount,
        recentDiscoveries,
        jobsProcessedToday: jobsProcessedToday || 0,
      };
    } catch (error) {
      console.error('Error fetching dashboard stats - Full error:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  // ================================================
  // DEDUPLICATION HELPERS
  // ================================================

  async jobExists(jobId: string): Promise<boolean> {
    try {
      const { count, error } = await this.supabase
        .from('raw_jobs')
        .select('job_id', { count: 'exact', head: true })
        .eq('job_id', jobId);

      if (error) {
        console.log(`  ⚠️ Query failed for job_id: ${jobId}, error:`, error.message);
        return false;
      }

      return (count && count > 0);
    } catch (error) {
      console.error(`  ❌ Error checking job existence: ${error}`);
      return false;
    }
  }

  async getExistingJobIds(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('raw_jobs')
      .select('job_id');

    if (error) {
      console.error('Error fetching existing job IDs:', error);
      return [];
    }

    return data?.map(job => job.job_id) || [];
  }

  // ================================================
  // EXPORT FUNCTIONALITY
  // ================================================

  async exportIdentifiedCompanies(
    tool?: string,
    confidence?: string,
    format: 'csv' | 'json' = 'csv'
  ): Promise<string> {
    const companies = await this.getIdentifiedCompanies(10000, 0, tool, confidence);
    
    if (format === 'json') {
      return JSON.stringify(companies, null, 2);
    }

    // CSV format
    const headers = [
      'Company Name',
      'Tool Detected',
      'Signal Type',
      'Confidence',
      'Job Title',
      'Platform',
      'Identified Date',
      'Job URL',
      'LinkedIn URL'
    ];

    const csvRows = [
      headers.join(','),
      ...companies.map(company => [
        `"${company.company_name}"`,
        `"${company.tool_detected}"`,
        `"${company.signal_type}"`,
        `"${company.confidence}"`,
        `"${company.job_title}"`,
        `"${company.platform}"`,
        `"${new Date(company.identified_date).toLocaleDateString()}"`,
        `"${company.job_url}"`,
        `"${company.linkedin_url}"`
      ].join(','))
    ];

    return csvRows.join('\\n');
  }
}