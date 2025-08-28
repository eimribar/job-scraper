"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScraperService = void 0;
const apify_client_1 = require("apify-client");
const crypto_1 = require("crypto");
class ScraperService {
    constructor() {
        if (!process.env.APIFY_TOKEN) {
            throw new Error('APIFY_TOKEN is required');
        }
        this.apifyClient = new apify_client_1.ApifyClient({
            token: process.env.APIFY_TOKEN,
        });
    }
    // Indeed scraping removed - LinkedIn only as per requirements
    async scrapeLinkedInJobs(searchTerm, maxItems = 500) {
        try {
            console.log(`Scraping LinkedIn for: ${searchTerm} (max ${maxItems} jobs)`);
            const run = await this.apifyClient.actor('bebity~linkedin-jobs-scraper').call({
                proxy: {
                    useApifyProxy: true,
                    apifyProxyGroups: [], // Standard proxy as per requirements
                },
                rows: maxItems,
                title: searchTerm,
            });
            const { items } = await this.apifyClient.dataset(run.defaultDatasetId).listItems();
            return items.map((item) => {
                const jobItem = item;
                // Generate unique job ID
                let jobId;
                if (jobItem.id) {
                    // Use LinkedIn's provided ID if available
                    jobId = `linkedin_${jobItem.id}`;
                }
                else {
                    // Create deterministic ID using MD5 hash of key fields
                    const company = (jobItem.companyName || 'unknown').trim();
                    const title = (jobItem.title || 'unknown').trim();
                    const location = (jobItem.location || 'unknown').trim();
                    // Create a unique signature including more context
                    const signature = `${company}|${title}|${location}|${jobItem.jobUrl || ''}`;
                    const hash = (0, crypto_1.createHash)('md5').update(signature).digest('hex');
                    // Use first 12 chars of hash for readability
                    jobId = `linkedin_gen_${hash.substring(0, 12)}`;
                    console.log(`  Generated ID for ${company} - ${title}:`);
                    console.log(`    Signature: ${signature.substring(0, 80)}...`);
                    console.log(`    Job ID: ${jobId}`);
                }
                return {
                    job_id: jobId,
                    platform: 'LinkedIn',
                    company: jobItem.companyName || '',
                    job_title: jobItem.title || '',
                    location: jobItem.location || '',
                    description: jobItem.description || '',
                    job_url: jobItem.jobUrl || '',
                    scraped_date: new Date().toISOString(),
                    search_term: searchTerm,
                };
            });
        }
        catch (error) {
            console.error('Error scraping LinkedIn:', error);
            throw error;
        }
    }
    // LinkedIn-only scraping as per requirements
    async scrapeJobs(searchTerm, maxItems = 500) {
        try {
            console.log(`Starting LinkedIn scrape for: ${searchTerm}`);
            // Scrape LinkedIn only
            const linkedinJobs = await this.scrapeLinkedInJobs(searchTerm, maxItems);
            console.log(`Scraped ${linkedinJobs.length} jobs for search term: ${searchTerm}`);
            return linkedinJobs;
        }
        catch (error) {
            console.error('Error scraping jobs:', error);
            throw error;
        }
    }
    deduplicateJobs(jobs) {
        const uniqueJobs = new Map();
        for (const job of jobs) {
            const key = `${job.company.toLowerCase()}_${job.job_title.toLowerCase()}_${job.location.toLowerCase()}`;
            if (!uniqueJobs.has(key)) {
                uniqueJobs.set(key, job);
            }
        }
        return Array.from(uniqueJobs.values());
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.ScraperService = ScraperService;
