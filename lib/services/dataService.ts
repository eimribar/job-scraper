import { createServerSupabaseClient } from '../supabase';
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
    this.supabase = createServerSupabaseClient();
    this.isConfigured = !!this.supabase;
  }

  // Jobs management
  async saveJobs(jobs: ScrapedJob[]): Promise<void> {
    if (jobs.length === 0) return;

    const { error } = await this.supabase
      .from('jobs')
      .upsert(
        jobs.map(job => ({
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
        })),
        { onConflict: 'job_id' }
      );

    if (error) {
      console.error('Error saving jobs:', error);
      throw error;
    }
  }

  async getUnprocessedJobs(limit: number = 100): Promise<JobRow[]> {
    const { data, error } = await this.supabase
      .from('jobs')
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
      .from('jobs')
      .update({ 
        processed: true, 
        analyzed_date: new Date().toISOString() 
      })
      .eq('job_id', jobId);

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
    confidence?: string
  ): Promise<IdentifiedCompanyRow[]> {
    if (!this.isConfigured) {
      // Return empty array when not configured
      return [];
    }
    let query = this.supabase
      .from('identified_companies')
      .select('*')
      .order('identified_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (tool && tool !== 'all') {
      query = query.eq('tool_detected', tool);
    }

    if (confidence && confidence !== 'all') {
      query = query.eq('confidence', confidence);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching identified companies:', error);
      throw error;
    }

    return data || [];
  }

  async getIdentifiedCompaniesCount(tool?: string, confidence?: string): Promise<number> {
    if (!this.isConfigured) {
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
      .eq('active', true)
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
      // Get total companies by tool
      const { data: toolStats, error: toolError } = await this.supabase!
        .from('identified_companies')
        .select('tool_detected')
        .not('tool_detected', 'eq', 'none');

      if (toolError) throw toolError;

      const outreachCount = toolStats?.filter(s => s.tool_detected === 'Outreach.io').length || 0;
      const salesLoftCount = toolStats?.filter(s => s.tool_detected === 'SalesLoft').length || 0;
      const totalCompanies = outreachCount + salesLoftCount;

      // Get recent discoveries (last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { data: recentDiscoveries, error: recentError } = await this.supabase
        .from('identified_companies')
        .select('company_name, tool_detected, identified_date')
        .gte('identified_date', yesterday.toISOString())
        .order('identified_date', { ascending: false })
        .limit(10);

      if (recentError) throw recentError;

      // Get total jobs processed today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count: jobsProcessedToday, error: jobsError } = await this.supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .gte('scraped_date', today.toISOString())
        .eq('processed', true);

      if (jobsError) throw jobsError;

      return {
        totalCompanies,
        outreachCount,
        salesLoftCount,
        recentDiscoveries: recentDiscoveries || [],
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
      .from('jobs')
      .select('job_id')
      .eq('processed', true);

    if (error) {
      console.error('Error fetching processed job IDs:', error);
      return [];
    }

    return data?.map(job => job.job_id) || [];
  }

  async getKnownCompanies(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('identified_companies')
      .select('company_name');

    if (error) {
      console.error('Error fetching known companies:', error);
      return [];
    }

    return data?.map(company => company.company_name.toLowerCase().trim()) || [];
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