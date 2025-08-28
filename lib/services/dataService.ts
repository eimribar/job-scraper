import { createApiSupabaseClient } from '../supabase';
import { ScrapedJob } from './scraperService';
import { AnalyzedJob } from './analysisService';
import type { Database } from '../database.types';

type JobRow = Database['public']['Tables']['jobs']['Row'];
type IdentifiedCompanyRow = Database['public']['Tables']['identified_companies']['Row'];
type SearchTermRow = Database['public']['Tables']['search_terms']['Row'];

export class DataService {
  private supabase;
  private isConfigured: boolean;

  constructor() {
    try {
      this.supabase = createApiSupabaseClient();
      this.isConfigured = true;
    } catch (error) {
      console.error('Failed to initialize Supabase client:', error);
      this.isConfigured = false;
    }
  }

  // Jobs management
  async saveJobsReadyForAnalysis(jobs: ScrapedJob[]): Promise<void> {
    if (jobs.length === 0) {
      console.log('saveJobsReadyForAnalysis: No jobs to save (empty array)');
      return;
    }
    
    console.log(`saveJobsReadyForAnalysis: Attempting to save ${jobs.length} job(s) marked as ready for analysis`);
    
    const dataToInsert = jobs.map(job => ({
      job_type: 'analyze',
      status: 'pending',
      payload: {
        job_id: job.job_id,
        platform: job.platform,
        company: job.company,
        job_title: job.job_title,
        location: job.location,
        description: job.description,
        job_url: job.job_url,
        scraped_date: job.scraped_date,
        search_term: job.search_term,
        ready_for_analysis: true,  // This is the key flag!
        analyzed: false,
      },
      created_at: job.scraped_date,
    }));
    
    const { error } = await this.supabase
      .from('job_queue')
      .insert(dataToInsert);

    if (error) {
      console.error('❌ Error saving jobs ready for analysis:');
      console.error('  Error details:', JSON.stringify(error, null, 2));
      throw error;
    }
    
    console.log(`  ✅ Successfully saved ${jobs.length} job(s) ready for analysis`);
  }

  async saveJobs(jobs: ScrapedJob[]): Promise<void> {
    if (jobs.length === 0) {
      console.log('saveJobs: No jobs to save (empty array)');
      return;
    }
    
    console.log(`\nsaveJobs: Attempting to save ${jobs.length} job(s) to database`);
    jobs.forEach((job, idx) => {
      console.log(`  [${idx + 1}] Job ID: ${job.job_id} | ${job.company} - ${job.job_title}`);
    });

    const dataToInsert = jobs.map(job => ({
      job_type: 'analyze',
      status: 'pending',
      payload: {
        job_id: job.job_id,
        platform: job.platform,
        company: job.company,
        job_title: job.job_title,
        location: job.location,
        description: job.description,
        job_url: job.job_url,
        scraped_date: job.scraped_date,
        search_term: job.search_term,
      },
      created_at: job.scraped_date,
    }));
    
    console.log('  Inserting into job_queue table...');
    const { error } = await this.supabase
      .from('job_queue')
      .insert(dataToInsert);

    if (error) {
      console.error('❌ Error saving jobs to database:');
      console.error('  Error details:', JSON.stringify(error, null, 2));
      throw error;
    }
    
    console.log(`  ✅ Successfully saved ${jobs.length} job(s) to database\n`);
  }

  async getUnprocessedJobs(limit: number = 100): Promise<JobRow[]> {
    const { data, error } = await this.supabase
      .from('job_queue')
      .select('*')
      .eq('status', 'pending')
      .eq('job_type', 'analyze')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Error fetching unprocessed jobs:', error);
      throw error;
    }

    // Map to expected format
    return data?.map(job => ({
      id: job.id,
      job_id: job.payload?.job_id || job.id,
      platform: job.payload?.platform || '',
      company: job.payload?.company || '',
      job_title: job.payload?.job_title || '',
      location: job.payload?.location || '',
      description: job.payload?.description || '',
      job_url: job.payload?.job_url || '',
      scraped_date: job.created_at,
      search_term: job.payload?.search_term || '',
      processed: job.status === 'completed',
      analyzed_date: job.completed_at,
    })) || [];
  }

  async markJobAsProcessed(jobId: string): Promise<void> {
    const { error } = await this.supabase
      .from('job_queue')
      .update({ 
        status: 'completed', 
        completed_at: new Date().toISOString() 
      })
      .eq('id', jobId);

    if (error) {
      console.error('Error marking job as processed:', error);
      throw error;
    }
  }

  // Identified companies management
  async saveIdentifiedCompany(analyzedJob: AnalyzedJob): Promise<void> {
    if (!analyzedJob.analysis.uses_tool) {
      return;
    }

    const { error } = await this.supabase
      .from('identified_companies')
      .insert({
        company_name: analyzedJob.company,
        tool_detected: analyzedJob.analysis.tool_detected,
        signal_type: analyzedJob.analysis.signal_type,
        context: analyzedJob.analysis.context,
        confidence: analyzedJob.analysis.confidence,
        job_title: analyzedJob.job_title,
        job_url: analyzedJob.job_url,
        platform: analyzedJob.platform,
        identified_date: analyzedJob.analysis_date,
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
  ): Promise<IdentifiedCompanyRow[]> {
    if (!this.isConfigured) {
      // Return empty array when not configured
      return [];
    }
    let query = this.supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by tool
    if (tool && tool !== 'all') {
      if (tool === 'Outreach.io') {
        query = query.eq('uses_outreach', true);
      } else if (tool === 'SalesLoft') {
        query = query.eq('uses_salesloft', true);
      } else if (tool === 'Both') {
        query = query.eq('uses_both', true);
      }
    }

    if (confidence && confidence !== 'all') {
      query = query.eq('detection_confidence', confidence);
    }

    // Add search filter
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching identified companies:', error);
      throw error;
    }

    // Map to expected format with all fields
    return data?.map(c => ({
      id: c.id,
      company_name: c.name,
      tool_detected: c.uses_both ? 'Both' : c.uses_outreach ? 'Outreach.io' : c.uses_salesloft ? 'SalesLoft' : 'none',
      signal_type: c.signal_type || c.requirement_level || '',
      context: c.context || '',
      confidence: c.detection_confidence || 'low',
      job_title: c.job_title || '',
      job_url: c.job_url || '',
      platform: c.platform || '',
      identified_date: c.identified_date || c.created_at
    })) || [];
  }

  async getIdentifiedCompaniesCount(tool?: string, confidence?: string, search?: string): Promise<number> {
    if (!this.isConfigured) {
      return 0;
    }
    let query = this.supabase
      .from('companies')
      .select('id', { count: 'exact', head: true });

    if (tool && tool !== 'all') {
      if (tool === 'Outreach.io') {
        query = query.eq('uses_outreach', true);
      } else if (tool === 'SalesLoft') {
        query = query.eq('uses_salesloft', true);
      } else if (tool === 'Both') {
        query = query.eq('uses_both', true);
      }
    }

    if (confidence && confidence !== 'all') {
      query = query.eq('detection_confidence', confidence);
    }

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { count, error } = await query;

    if (error) {
      console.error('Error counting identified companies:', error);
      throw error;
    }

    return count || 0;
  }

  // Search terms management
  async getActiveSearchTerms(): Promise<SearchTermRow[]> {
    const { data, error } = await this.supabase
      .from('search_terms')
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
      .from('search_terms')
      .update({
        last_scraped_date: new Date().toISOString(),
        jobs_found_count: jobsFound,
        platform_last_scraped: 'Indeed, LinkedIn',
      })
      .eq('search_term', searchTerm);

    if (error) {
      console.error('Error updating search term:', error);
      throw error;
    }
  }

  // Dashboard stats
  async getDashboardStats() {
    if (!this.isConfigured) {
      // Return mock data when not configured
      return {
        totalCompanies: 0,
        outreachCount: 0,
        salesLoftCount: 0,
        recentDiscoveries: [],
        jobsProcessedToday: 0,
      };
    }
    
    try {
      // Get total companies by tool from new schema
      const { data: companies, error: companiesError } = await this.supabase!
        .from('companies')
        .select('name, uses_outreach, uses_salesloft, created_at')
        .or('uses_outreach.eq.true,uses_salesloft.eq.true');

      if (companiesError) throw companiesError;

      const outreachCount = companies?.filter(c => c.uses_outreach).length || 0;
      const salesLoftCount = companies?.filter(c => c.uses_salesloft).length || 0;
      const totalCompanies = companies?.length || 0;

      // Get recent discoveries (last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { data: recentCompanies, error: recentError } = await this.supabase
        .from('companies')
        .select('name, uses_outreach, uses_salesloft, created_at')
        .gte('created_at', yesterday.toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      if (recentError) throw recentError;

      // Map to the expected format
      const recentDiscoveries = recentCompanies?.map(c => ({
        company_name: c.name,
        tool_detected: c.uses_outreach && c.uses_salesloft ? 'Both' : 
                      c.uses_outreach ? 'Outreach.io' : 
                      c.uses_salesloft ? 'SalesLoft' : 'none',
        identified_date: c.created_at
      })) || [];

      // Get total jobs processed today from job_queue
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count: jobsProcessedToday, error: jobsError } = await this.supabase
        .from('job_queue')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', today.toISOString())
        .eq('status', 'completed');

      if (jobsError) throw jobsError;

      return {
        totalCompanies,
        outreachCount,
        salesLoftCount,
        recentDiscoveries,
        jobsProcessedToday: jobsProcessedToday || 0,
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  }

  // Check for existing processed jobs and companies (for deduplication)
  async getProcessedJobIds(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('job_queue')
      .select('id')
      .eq('status', 'completed');

    if (error) {
      console.error('Error fetching processed job IDs:', error);
      return [];
    }

    return data?.map(job => job.id) || [];
  }

  // Check if a specific job ID already exists - OPTIMIZED VERSION
  async jobExists(jobId: string): Promise<boolean> {
    try {
      // Use count query for efficiency - doesn't load actual data
      const { count, error } = await this.supabase
        .from('job_queue')
        .select('id', { count: 'exact', head: true })
        .eq('payload->>job_id', jobId);

      if (error) {
        console.log(`  ⚠️ Optimized query failed for job_id: ${jobId}, error:`, error.message);
        return false; // Assume doesn't exist if query fails
      }

      return (count && count > 0);
    } catch (error) {
      console.error(`  ❌ Error checking job existence: ${error}`);
      return false; // Assume doesn't exist if error occurs
    }
  }

  async getKnownCompanies(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('companies')
      .select('name');

    if (error) {
      console.error('Error fetching known companies:', error);
      return [];
    }

    return data?.map(company => company.name.toLowerCase().trim()) || [];
  }

  // Export functionality
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
      'Job URL'
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
        `"${company.job_url}"`
      ].join(','))
    ];

    return csvRows.join('\n');
  }
}