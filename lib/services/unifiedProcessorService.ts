/**
 * Unified Processor Service
 * 
 * This is the SINGLE source of truth for job processing.
 * Combines the best features from all previous processors.
 * 
 * Created: 2025-09-10
 * Model: gpt-5-mini-2025-08-07 (NEVER CHANGE)
 */

import { createApiSupabaseClient } from '../supabase';
// OpenAI client not needed - using Responses API with fetch

export class UnifiedProcessorService {
  private supabase;
  // OpenAI client removed - using fetch with Responses API
  private identifiedCompaniesCache: Set<string> = new Set();
  private lastCacheUpdate: number = 0;
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private isRunning = false;
  private stats = {
    totalAnalyzed: 0,
    toolsDetected: 0,
    errors: 0,
    skippedAlreadyIdentified: 0
  };

  constructor() {
    this.supabase = createApiSupabaseClient();
    // OpenAI client removed - using fetch with Responses API
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required');
    }
  }

  /**
   * System prompt for GPT-5-mini-2025-08-07
   */
  private systemPrompt = `You are an expert at analyzing job descriptions to identify if companies use Outreach.io or SalesLoft.

IMPORTANT: Distinguish between "Outreach" (the tool) and "outreach" (general sales activity).

Valid indicators for Outreach.io:
- "Outreach.io"
- "Outreach platform"
- "Outreach sequences"
- Capitalized "Outreach" listed with other tools
- "experience with Outreach"

Valid indicators for SalesLoft:
- "SalesLoft"
- "Sales Loft"
- "Salesloft"
- "experience with SalesLoft"

NOT valid (just general sales terms):
- "sales outreach"
- "cold outreach"
- "outreach efforts"
- "customer outreach"

You must respond with ONLY valid JSON. No explanation. No markdown. Just the JSON object:

{
  "uses_tool": true,
  "tool_detected": "Outreach.io",
  "signal_type": "required",
  "context": "exact quote mentioning the tool"
}`;

  /**
   * Create notification in database
   */
  private async createNotification(
    type: 'analysis_complete' | 'company_discovered' | 'error',
    title: string,
    message: string,
    metadata?: any
  ): Promise<void> {
    try {
      await this.supabase.from('notifications').insert({
        notification_type: type,  // Fixed: database uses notification_type, not type
        title,
        message,
        metadata,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to create notification:', error);
    }
  }

  /**
   * Refresh the cache of already identified companies
   */
  async refreshCompaniesCache(): Promise<void> {
    const now = Date.now();
    
    // Only refresh if cache is expired
    if (now - this.lastCacheUpdate < this.CACHE_TTL && this.identifiedCompaniesCache.size > 0) {
      return;
    }

    try {
      console.log('🔄 Refreshing identified companies cache...');
      
      // Try to load from master list file first
      const fs = require('fs');
      const path = require('path');
      const masterListPath = path.join(process.cwd(), 'never-analyze-companies.json');
      
      if (fs.existsSync(masterListPath)) {
        const masterList = JSON.parse(fs.readFileSync(masterListPath, 'utf-8'));
        this.identifiedCompaniesCache.clear();
        
        masterList.companies.forEach((company: string) => {
          this.identifiedCompaniesCache.add(company.toLowerCase().trim());
        });
        
        console.log(`✅ Loaded ${this.identifiedCompaniesCache.size} companies from master list`);
      } else {
        // Fallback to database
        const { data, error } = await this.supabase
          .from('identified_companies')
          .select('company');
        
        if (error) {
          console.error('❌ Error fetching identified companies:', error);
          return;
        }

        this.identifiedCompaniesCache.clear();
        
        if (data && data.length > 0) {
          data.forEach(row => {
            if (row.company) {
              this.identifiedCompaniesCache.add(row.company.toLowerCase().trim());
            }
          });
          
          console.log(`✅ Cached ${this.identifiedCompaniesCache.size} companies from database`);
        }
      }
      
      this.lastCacheUpdate = now;
    } catch (error) {
      console.error('❌ Failed to refresh companies cache:', error);
    }
  }

  /**
   * Check if company is already identified
   */
  isCompanyAlreadyIdentified(companyName: string): boolean {
    return this.identifiedCompaniesCache.has(companyName.toLowerCase().trim());
  }

  /**
   * Analyze a single job with GPT-5-mini-2025-08-07
   */
  async analyzeJobWithGPT(job: any): Promise<any> {
    // ⚠️ CRITICAL: USING RESPONSES API WITH HARDCODED CONFIGURATION ⚠️
    // NEVER CHANGE THIS STRUCTURE
    
    // Role-based messages - HARDCODED
    const systemMessage = {
      role: 'developer',  // MUST BE 'developer'
      content: this.systemPrompt
    };
    
    const userMessage = {
      role: 'user',  // MUST BE 'user'
      content: `Company: ${job.company}
Job Title: ${job.job_title}
Job Description: ${job.description}`
    };

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // ⚠️ CRITICAL: Using Responses API - NOT Chat Completions ⚠️
        const response = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-5-mini',  // HARDCODED - NEVER CHANGE
            input: [systemMessage, userMessage],  // ROLE-BASED ARRAY
            reasoning: { 
              effort: 'medium'  // HARDCODED OPTIMAL - NEVER CHANGE
            },
            text: { 
              verbosity: 'low'  // HARDCODED - NEVER CHANGE
            }
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`GPT-5 API error: ${response.status} - ${errorText.substring(0, 200)}`);
        }

        const data = await response.json();
        
        // Extract output from GPT-5 Responses API structure
        let result = '';
        if (data.output && Array.isArray(data.output)) {
          for (const item of data.output) {
            if (item.type === 'message' && item.content) {
              for (const content of item.content) {
                if (content.type === 'output_text' && content.text) {
                  result = content.text;
                  break;
                }
              }
            }
          }
        }
        
        if (!result || result.length === 0) {
          throw new Error('Empty response from GPT API');
        }
        
        console.log(`  ✅ GPT-5-mini responded (${result.length} chars)`);
        
        try {
          return JSON.parse(result);
        } catch (parseError) {
          console.error(`  ❌ JSON parse error:`, result.substring(0, 100));
          return {
            uses_tool: false,
            tool_detected: "None",
            signal_type: "none",
            context: "Parse error"
          };
        }
        
      } catch (error: any) {
        lastError = error;
        console.error(`  ❌ Attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`  ⏳ Retrying in ${delay/1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All retries failed
    console.error(`  ❌ Analysis failed after ${maxRetries} attempts`);
    return {
      uses_tool: false,
      tool_detected: "None",
      signal_type: "none",
      context: "API error: " + (lastError?.message || 'Unknown error')
    };
  }

  /**
   * Process a batch of jobs
   */
  async processBatch(batchSize: number = 100): Promise<any> {
    if (this.isRunning) {
      console.log('⚠️ Processor already running');
      return { 
        success: false, 
        error: 'Already running',
        jobsProcessed: 0 
      };
    }

    console.log(`\n🤖 PROCESSING BATCH (${batchSize} jobs)`);
    console.log('='.repeat(60));
    
    this.isRunning = true;
    
    try {
      // Refresh cache before processing
      await this.refreshCompaniesCache();
      
      // Fetch unprocessed jobs
      const { data: jobs, error } = await this.supabase
        .from('raw_jobs')
        .select('*')
        .eq('processed', false)
        .order('scraped_date', { ascending: true })
        .limit(batchSize);
      
      if (error) {
        throw error;
      }
      
      if (!jobs || jobs.length === 0) {
        console.log('✅ No jobs to process - all caught up!');
        return { 
          success: true, 
          message: 'No jobs to process',
          jobsProcessed: 0
        };
      }
      
      console.log(`📋 Found ${jobs.length} unprocessed jobs\n`);
      
      let processed = 0;
      let toolsFound = 0;
      let skipped = 0;
      let errors = 0;
      
      // Process jobs sequentially
      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        
        console.log(`[${i+1}/${jobs.length}] ${job.company} - ${job.job_title}`);
        
        try {
          // Check if already identified
          if (this.isCompanyAlreadyIdentified(job.company)) {
            console.log(`  ⏭️ SKIPPED: Already identified`);
            skipped++;
            
            // Mark as processed without analyzing
            await this.supabase
              .from('raw_jobs')
              .update({ 
                processed: true,
                analyzed_date: new Date().toISOString()
              })
              .eq('job_id', job.job_id);
            
            processed++;
            continue;
          }
          
          // Analyze with GPT
          console.log(`  🔍 Analyzing with GPT-5-mini-2025-08-07...`);
          const analysis = await this.analyzeJobWithGPT(job);
          
          // Validate response before marking as processed
          if (!analysis || !analysis.hasOwnProperty('uses_tool')) {
            console.error(`  ❌ Invalid analysis - NOT marking as processed`);
            errors++;
            continue;
          }
          
          // Check for API errors
          if (analysis.context && analysis.context.includes('API error')) {
            console.error(`  ❌ API error - NOT marking as processed`);
            errors++;
            continue;
          }
          
          if (analysis.uses_tool) {
            // Only save Outreach.io and SalesLoft
            if (analysis.tool_detected === 'Outreach.io' || 
                analysis.tool_detected === 'SalesLoft' || 
                analysis.tool_detected === 'Both') {
              
              console.log(`  🎯 DETECTED: ${analysis.tool_detected}`);
              toolsFound++;
              
              // Save to database
              await this.supabase
                .from('identified_companies')
                .upsert({
                  company: job.company,
                  tool_detected: analysis.tool_detected,
                  signal_type: analysis.signal_type || 'explicit_mention',
                  context: analysis.context || '',
                  job_title: job.job_title,
                  job_url: job.job_url,
                  platform: job.platform,
                  identified_date: new Date().toISOString()
                }, { 
                  onConflict: 'company,tool_detected',
                  ignoreDuplicates: false 
                });
              
              // Add to cache
              this.identifiedCompaniesCache.add(job.company.toLowerCase().trim());
              
              // Create notification
              await this.createNotification(
                'company_discovered',
                `New company: ${job.company}`,
                `Uses ${analysis.tool_detected}`,
                { company: job.company, tool: analysis.tool_detected }
              );
            }
          } else {
            console.log(`  ✓ No tools detected`);
          }
          
          // Mark job as processed
          await this.supabase
            .from('raw_jobs')
            .update({ 
              processed: true,
              analyzed_date: new Date().toISOString()
            })
            .eq('job_id', job.job_id);
          
          processed++;
          
        } catch (error: any) {
          console.error(`  ❌ Error:`, error.message);
          errors++;
        }
        
        // Small delay between jobs
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Update stats
      this.stats.totalAnalyzed += processed;
      this.stats.toolsDetected += toolsFound;
      this.stats.skippedAlreadyIdentified += skipped;
      this.stats.errors += errors;
      
      console.log('\n✅ BATCH COMPLETE');
      console.log(`   Jobs processed: ${processed}/${jobs.length}`);
      console.log(`   Skipped: ${skipped}`);
      console.log(`   Tools detected: ${toolsFound}`);
      console.log(`   Errors: ${errors}`);
      
      // Check remaining
      const { count: remaining } = await this.supabase
        .from('raw_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('processed', false);
      
      console.log(`   Remaining: ${remaining || 0}`);
      
      return {
        success: true,
        jobsProcessed: processed,
        skippedAlreadyIdentified: skipped,
        toolsDetected: toolsFound,
        errors: errors,
        remainingUnprocessed: remaining || 0
      };
      
    } catch (error: any) {
      console.error('❌ Batch processing failed:', error.message);
      return {
        success: false,
        error: error.message,
        jobsProcessed: 0
      };
      
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      totalAnalyzed: this.stats.totalAnalyzed,
      toolsDetected: this.stats.toolsDetected,
      skippedAlreadyIdentified: this.stats.skippedAlreadyIdentified,
      errors: this.stats.errors,
      cachedCompanies: this.identifiedCompaniesCache.size
    };
  }

  /**
   * Process a single job (for testing)
   */
  async processSingleJob(jobId: string): Promise<any> {
    const { data: job, error } = await this.supabase
      .from('raw_jobs')
      .select('*')
      .eq('job_id', jobId)
      .single();
    
    if (error || !job) {
      return { success: false, error: 'Job not found' };
    }
    
    console.log(`Processing single job: ${job.company}`);
    const analysis = await this.analyzeJobWithGPT(job);
    
    return {
      success: true,
      job: job,
      analysis: analysis
    };
  }
}

// Export singleton instance
export const unifiedProcessor = new UnifiedProcessorService();