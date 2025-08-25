import { NextRequest, NextResponse } from 'next/server';
import { DataService } from '@/lib/services/dataService';
import { AnalysisService } from '@/lib/services/analysisService';

export async function POST(request: NextRequest) {
  try {
    const { limit = 10 } = await request.json();

    // Initialize services
    const dataService = new DataService();
    const analysisService = new AnalysisService();

    console.log(`Starting analysis of up to ${limit} unprocessed jobs`);

    // Get unprocessed jobs
    const unprocessedJobs = await dataService.getUnprocessedJobs(limit);
    console.log(`Found ${unprocessedJobs.length} unprocessed jobs`);

    if (unprocessedJobs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No unprocessed jobs found',
        jobsAnalyzed: 0,
        companiesIdentified: 0,
      });
    }

    let jobsAnalyzed = 0;
    let companiesIdentified = 0;
    const errors: string[] = [];

    // Process jobs one by one to respect rate limits
    for (const job of unprocessedJobs) {
      try {
        console.log(`Analyzing job: ${job.job_id} - ${job.company}`);

        // Convert database job to scraper format
        const scrapedJob = {
          job_id: job.job_id,
          platform: job.platform,
          company: job.company,
          job_title: job.job_title,
          location: job.location || '',
          description: job.description || '',
          job_url: job.job_url || '',
          scraped_date: job.scraped_date,
          search_term: job.search_term,
        };

        // Analyze the job
        const analyzedJob = await analysisService.analyzeJob(scrapedJob);
        
        // If a tool was detected, save to identified companies
        if (analyzedJob.analysis.uses_tool) {
          await dataService.saveIdentifiedCompany(analyzedJob);
          companiesIdentified++;
          console.log(`✅ Identified ${analyzedJob.company} using ${analyzedJob.analysis.tool_detected}`);
        } else {
          console.log(`❌ No tools detected for ${analyzedJob.company}`);
        }

        // Mark job as processed
        await dataService.markJobAsProcessed(job.job_id);
        jobsAnalyzed++;

        // Add delay between analyses to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        const errorMessage = `Failed to analyze job ${job.job_id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMessage);
        errors.push(errorMessage);
        
        // Still mark as processed to avoid getting stuck
        try {
          await dataService.markJobAsProcessed(job.job_id);
        } catch (markError) {
          console.error(`Failed to mark job as processed: ${markError}`);
        }
      }
    }

    console.log(`Analysis complete: ${jobsAnalyzed} jobs analyzed, ${companiesIdentified} companies identified`);

    return NextResponse.json({
      success: true,
      jobsAnalyzed,
      companiesIdentified,
      errors: errors.length > 0 ? errors : undefined,
      message: `Analyzed ${jobsAnalyzed} jobs and identified ${companiesIdentified} companies using sales tools`,
    });

  } catch (error) {
    console.error('Analysis error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to analyze jobs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const dataService = new DataService();
    
    // Get count of unprocessed jobs
    const unprocessedJobs = await dataService.getUnprocessedJobs(1000); // Get up to 1000 to count
    
    return NextResponse.json({
      unprocessedCount: unprocessedJobs.length,
      nextBatch: unprocessedJobs.slice(0, 10), // Show first 10 for preview
    });

  } catch (error) {
    console.error('Error fetching unprocessed jobs:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch unprocessed jobs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}