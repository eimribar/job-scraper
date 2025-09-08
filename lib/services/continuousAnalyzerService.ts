import { createApiSupabaseClient } from '../supabase';
import OpenAI from 'openai';

export class ContinuousAnalyzerService {
  private supabase;
  private openai;
  private identifiedCompaniesCache: Set<string> = new Set();
  private lastCacheUpdate: number = 0;
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private stats = {
    totalAnalyzed: 0,
    toolsDetected: 0,
    errors: 0,
    skippedAlreadyIdentified: 0,
    isRunning: false
  };

  constructor() {
    this.supabase = createApiSupabaseClient();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

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
  "context": "exact quote mentioning the tool",
  "confidence": "high"
}`;

  async refreshCompaniesCache(): Promise<void> {
    const now = Date.now();
    
    // Only refresh if cache is older than TTL
    if (now - this.lastCacheUpdate < this.CACHE_TTL && this.identifiedCompaniesCache.size > 0) {
      return;
    }

    try {
      console.log('🔄 Refreshing identified companies cache...');
      
      // FIRST: Load the master never-analyze list if it exists
      const fs = require('fs');
      const masterListPath = '/Users/eimribar/sales-tool-detector/never-analyze-companies.json';
      
      if (fs.existsSync(masterListPath)) {
        const masterList = JSON.parse(fs.readFileSync(masterListPath, 'utf-8'));
        this.identifiedCompaniesCache.clear();
        
        // Load all companies from master list
        masterList.companies.forEach((company: string) => {
          this.identifiedCompaniesCache.add(company.toLowerCase().trim());
        });
        
        console.log(`✅ Loaded ${this.identifiedCompaniesCache.size} companies from master never-analyze list`);
        console.log(`   Sources: ${masterList.sources.csv} from CSV, ${masterList.sources.database} from DB`);
      } else {
        // Fallback: Fetch from database
        const { data, error } = await this.supabase
          .from('identified_companies')
          .select('company_name');
        
        if (error) {
          console.error('❌ Error fetching identified companies:', error);
          return;
        }

        // Clear and rebuild cache
        this.identifiedCompaniesCache.clear();
        
        if (data && data.length > 0) {
          data.forEach(row => {
            if (row.company_name) {
              const normalized = row.company_name.toLowerCase().trim();
              this.identifiedCompaniesCache.add(normalized);
            }
          });
          
          console.log(`✅ Cached ${this.identifiedCompaniesCache.size} unique companies from database`);
        } else {
          console.log('⚠️ No companies found in database');
        }
      }
      
      this.lastCacheUpdate = now;
    } catch (error) {
      console.error('❌ Failed to refresh companies cache:', error);
    }
  }

  isCompanyAlreadyIdentified(companyName: string): boolean {
    // Normalize the company name before checking
    const normalized = companyName.toLowerCase().trim();
    return this.identifiedCompaniesCache.has(normalized);
  }

  async analyzeJobWithGPT(job: any): Promise<any> {
    const userPrompt = `Company: ${job.company}
Job Title: ${job.job_title}
Job Description: ${job.description}`;

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const timeoutMs = 30 * 1000;
        const apiPromise = this.openai.chat.completions.create({
          model: 'gpt-5-2025-08-07',
          messages: [
            { role: 'system', content: this.systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_completion_tokens: 500,
          reasoning_effort: 'low'
        });
        
        const response = await Promise.race([
          apiPromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`OpenAI API timeout after ${timeoutMs/1000}s`)), timeoutMs)
          )
        ]) as any;

        const result = response.choices[0].message.content?.trim();
        
        if (!result || result.length === 0) {
          throw new Error('Empty response from GPT-5');
        }
        
        try {
          const analysis = JSON.parse(result);
          return analysis;
        } catch (parseError) {
          console.error(`  ❌ JSON parse error for ${job.company}:`, result.substring(0, 100));
          return {
            uses_tool: false,
            tool_detected: "None",
            signal_type: "none",
            confidence: "low",
            context: "Parse error: " + result.substring(0, 50)
          };
        }
        
      } catch (error: any) {
        lastError = error;
        console.error(`  ❌ Analysis attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`  ⏳ Retrying in ${delay/1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All retries failed
    console.error(`  ❌ Analysis failed for ${job.company} after ${maxRetries} attempts`);
    return {
      uses_tool: false,
      tool_detected: "None",
      signal_type: "none",
      confidence: "low",
      context: "API error: " + (lastError?.message || 'Unknown error')
    };
  }

  async processBatch(batchSize: number = 100): Promise<any> {
    if (this.stats.isRunning) {
      console.log('⚠️ Analysis already running, skipping');
      return { 
        success: false, 
        error: 'Already running',
        jobsProcessed: 0 
      };
    }

    console.log(`🤖 PROCESSING BATCH (${batchSize} jobs)`);
    console.log('='.repeat(60));
    
    this.stats.isRunning = true;
    
    try {
      // Refresh the companies cache before processing
      await this.refreshCompaniesCache();
      
      // Fetch unprocessed jobs from clean raw_jobs table
      const { data: jobs, error } = await this.supabase
        .from('raw_jobs')
        .select('*')
        .eq('processed', false)
        .order('scraped_date', { ascending: true })
        .limit(batchSize);
      
      if (error) {
        console.error('❌ Error fetching unprocessed jobs:', error);
        throw error;
      }
      
      if (!jobs || jobs.length === 0) {
        console.log('✅ No jobs to process - all caught up!');
        return { 
          success: true, 
          message: 'No jobs to process',
          jobsProcessed: 0,
          toolsDetected: 0,
          skippedAlreadyIdentified: 0
        };
      }
      
      console.log(`📋 Found ${jobs.length} unprocessed jobs to analyze\n`);
      
      let processed = 0;
      let toolsFound = 0;
      let skipped = 0;
      let errors = 0;
      
      // Process jobs sequentially to avoid overwhelming OpenAI
      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        
        console.log(`[${i+1}/${jobs.length}] Checking: ${job.company} - ${job.job_title}`);
        
        try {
          // CHECK IF COMPANY IS ALREADY IDENTIFIED
          if (this.isCompanyAlreadyIdentified(job.company)) {
            console.log(`  ⏭️ SKIPPED: ${job.company} - Already in database/CSV (cache has ${this.identifiedCompaniesCache.size} companies)`);
            skipped++;
            
            // Mark job as processed without analyzing
            const { error: updateError } = await this.supabase
              .from('raw_jobs')
              .update({ 
                processed: true,
                analyzed_date: new Date().toISOString()
              })
              .eq('job_id', job.job_id);
            
            if (updateError) {
              console.error('  ❌ Failed to mark job as processed:', updateError.message);
              errors++;
            } else {
              await this.supabase
                .from('processed_jobs')
                .upsert({ 
                  job_id: job.job_id, 
                  analyzed_date: new Date().toISOString() 
                }, { onConflict: 'job_id' });
              
              processed++;
            }
            
            continue; // Skip to next job
          }
          
          // Company not identified yet, analyze with GPT-5
          console.log(`  🔍 Analyzing with GPT-5...`);
          const analysis = await this.analyzeJobWithGPT(job);
          
          if (analysis.uses_tool) {
            // Only process Outreach.io and SalesLoft
            if (analysis.tool_detected === 'Outreach.io' || 
                analysis.tool_detected === 'SalesLoft' || 
                analysis.tool_detected === 'Both') {
              
              console.log(`  🎯 DETECTED: ${analysis.tool_detected} (${analysis.confidence} confidence)`);
              toolsFound++;
              
              // Save to identified_companies with source tracking
              const { error: companyError } = await this.supabase
                .from('identified_companies')
                .upsert({
                  company_name: job.company,
                  tool_detected: analysis.tool_detected,
                  signal_type: analysis.signal_type || 'explicit_mention',
                  context: analysis.context || '',
                  confidence: analysis.confidence || 'medium',
                  job_title: job.job_title,
                  job_url: job.job_url,
                  linkedin_url: '',
                  platform: job.platform,
                  identified_date: new Date().toISOString(),
                  source: 'job_analysis',  // Mark as discovered from job analysis
                  import_date: new Date().toISOString()  // Track when it was imported
                }, { 
                  onConflict: 'company_name,tool_detected',
                  ignoreDuplicates: false 
                });
              
              if (companyError) {
                console.error('  ❌ Failed to save company:', companyError.message);
                errors++;
              } else {
                // Add to cache immediately with proper normalization
                const normalized = job.company.toLowerCase().trim();
                this.identifiedCompaniesCache.add(normalized);
                console.log(`  📝 Added "${job.company}" to cache as "${normalized}"`);
              }
            }
          } else {
            console.log(`  ✓ No tools detected`);
          }
          
          // Mark job as processed
          const { error: updateError } = await this.supabase
            .from('raw_jobs')
            .update({ 
              processed: true,
              analyzed_date: new Date().toISOString()
            })
            .eq('job_id', job.job_id);
          
          if (updateError) {
            console.error('  ❌ Failed to mark job as processed:', updateError.message);
            errors++;
          } else {
            // Add to processed_jobs tracking
            await this.supabase
              .from('processed_jobs')
              .upsert({ 
                job_id: job.job_id, 
                analyzed_date: new Date().toISOString() 
              }, { onConflict: 'job_id' });
            
            processed++;
          }
          
        } catch (error: any) {
          console.error(`  ❌ Error processing job ${job.job_id}:`, error.message);
          errors++;
        }
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      this.stats.totalAnalyzed += processed;
      this.stats.toolsDetected += toolsFound;
      this.stats.skippedAlreadyIdentified += skipped;
      this.stats.errors += errors;
      
      console.log('\n✅ BATCH COMPLETE');
      console.log(`   Jobs processed: ${processed}/${jobs.length}`);
      console.log(`   Skipped (already identified): ${skipped}`);
      console.log(`   Tools detected: ${toolsFound}`);
      console.log(`   Errors: ${errors}`);
      
      // Check remaining unprocessed jobs
      const { count: remaining } = await this.supabase
        .from('raw_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('processed', false);
      
      console.log(`   Remaining unprocessed: ${remaining || 0}`);
      
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
      this.stats.errors++;
      return {
        success: false,
        error: error.message,
        jobsProcessed: 0
      };
      
    } finally {
      this.stats.isRunning = false;
    }
  }

  getStatus() {
    return {
      isRunning: this.stats.isRunning,
      totalAnalyzed: this.stats.totalAnalyzed,
      toolsDetected: this.stats.toolsDetected,
      skippedAlreadyIdentified: this.stats.skippedAlreadyIdentified,
      errors: this.stats.errors,
      cachedCompanies: this.identifiedCompaniesCache.size
    };
  }
}