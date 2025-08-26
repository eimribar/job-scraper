/**
 * Google Sheets Data Import Script
 * Imports data from CSV exports into Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase credentials not found');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// CSV file paths
const CSV_DIR = '/Users/eimribar/Desktop/Job Scraper csvs';
const FILES = {
  searchTerms: path.join(CSV_DIR, '_Job Scraper - Outreach & SalesLoft Tracker - Search_Terms_Status.csv'),
  identifiedCompanies: path.join(CSV_DIR, '_Job Scraper - Outreach & SalesLoft Tracker - Identified_Companies (1).csv'),
  processedIds: path.join(CSV_DIR, '_Job Scraper - Outreach & SalesLoft Tracker - Processed_IDs.csv'),
  rawJobs: path.join(CSV_DIR, '_Job Scraper - Outreach & SalesLoft Tracker - Raw_Jobs.csv')
};

// Statistics tracking
const stats = {
  searchTerms: { total: 0, imported: 0, updated: 0, errors: 0 },
  companies: { total: 0, imported: 0, updated: 0, errors: 0 },
  processedIds: { total: 0, imported: 0, errors: 0 },
  rawJobs: { total: 0, imported: 0, errors: 0 }
};

/**
 * Import Search Terms
 */
async function importSearchTerms() {
  console.log('\n📋 Importing Search Terms...');
  const searchTerms = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(FILES.searchTerms)
      .pipe(csv())
      .on('data', (row) => {
        searchTerms.push({
          search_term: row.search_term,
          last_scraped_date: row.last_scraped_date || null,
          jobs_found_count: parseInt(row.jobs_found_count) || 0,
          platform_last_scraped: row.platform_last_scraped || 'Both',
          is_active: true,
          scrape_frequency: '7 days'
        });
        stats.searchTerms.total++;
      })
      .on('end', async () => {
        console.log(`  Found ${searchTerms.length} search terms`);
        
        // Insert in batches
        const batchSize = 10;
        for (let i = 0; i < searchTerms.length; i += batchSize) {
          const batch = searchTerms.slice(i, i + batchSize);
          
          try {
            const { data, error } = await supabase
              .from('search_terms')
              .upsert(batch, { 
                onConflict: 'search_term',
                ignoreDuplicates: false 
              })
              .select();

            if (error) {
              console.error(`  ❌ Error importing batch ${i/batchSize + 1}:`, error.message);
              stats.searchTerms.errors += batch.length;
            } else {
              stats.searchTerms.imported += data.length;
              process.stdout.write('.');
            }
          } catch (err) {
            console.error(`  ❌ Batch error:`, err.message);
            stats.searchTerms.errors += batch.length;
          }
        }
        
        console.log(`\n  ✅ Imported ${stats.searchTerms.imported} search terms`);
        resolve();
      })
      .on('error', reject);
  });
}

/**
 * Import Identified Companies
 */
async function importIdentifiedCompanies() {
  console.log('\n🏢 Importing Identified Companies...');
  const companies = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(FILES.identifiedCompanies)
      .pipe(csv())
      .on('data', (row) => {
        // Parse tool detection
        const toolDetected = row.tool_detected ? row.tool_detected.toLowerCase() : '';
        const usesOutreach = toolDetected.includes('outreach');
        const usesSalesloft = toolDetected.includes('salesloft') || toolDetected.includes('sales loft');
        
        // Normalize company name for deduplication
        const normalizedName = row.Company ? 
          row.Company.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim() : '';

        if (row.Company && normalizedName) {
          companies.push({
            name: row.Company,
            normalized_name: normalizedName,
            uses_outreach: usesOutreach,
            uses_salesloft: usesSalesloft,
            uses_both: usesOutreach && usesSalesloft,
            signal_type: row.signal_type || null,
            context: row.context || null,
            detection_confidence: determineConfidence(row.signal_type),
            requirement_level: parseRequirementLevel(row.signal_type),
            job_title: row.job_title || null,
            job_url: row.job_url || null,
            linkedin_url: row['LinkedIn URL'] || null,
            platform: row.platform || null,
            identified_date: row.identified_date || new Date().toISOString(),
            
            // BDR enrichment fields
            leads_uploaded: row['Leads Uploaded?'] === 'TRUE',
            tier_2_leads_uploaded: row['Tier 2 leads Uploaded?'] || null,
            sponsor_1_name: row['SPONSOR 1'] || null,
            sponsor_1_linkedin_url: row['SPONSOR 1 - LI URL'] || null,
            sponsor_2_name: row['SPONSOR 2'] || null,
            sponsor_2_linkedin_url: row['SPONSOR 2 - LI URL'] || null,
            rep_name: row['Rep (SDR/BDR)'] || null,
            rep_linkedin_url: row['REP - LI URL'] || null,
            dashboard_tags: row['tags on the dashboard'] ? 
              row['tags on the dashboard'].split(',').map(t => t.trim()) : [],
            status: row.Status || null,
            
            // Import tracking
            import_source: 'google_sheets',
            import_date: new Date().toISOString()
          });
          stats.companies.total++;
        }
      })
      .on('end', async () => {
        console.log(`  Found ${companies.length} companies to import`);
        
        // Import in batches
        const batchSize = 50;
        for (let i = 0; i < companies.length; i += batchSize) {
          const batch = companies.slice(i, i + batchSize);
          
          try {
            const { data, error } = await supabase
              .from('companies')
              .upsert(batch, { 
                onConflict: 'normalized_name',
                ignoreDuplicates: false 
              })
              .select();

            if (error) {
              console.error(`  ❌ Error importing batch ${i/batchSize + 1}:`, error.message);
              stats.companies.errors += batch.length;
            } else {
              stats.companies.imported += data.length;
              process.stdout.write('.');
            }
          } catch (err) {
            console.error(`  ❌ Batch error:`, err.message);
            stats.companies.errors += batch.length;
          }
        }
        
        console.log(`\n  ✅ Imported ${stats.companies.imported} companies`);
        if (stats.companies.errors > 0) {
          console.log(`  ⚠️  ${stats.companies.errors} companies had errors`);
        }
        resolve();
      })
      .on('error', reject);
  });
}

/**
 * Import Processed IDs
 */
async function importProcessedIds() {
  console.log('\n🆔 Importing Processed IDs...');
  const processedIds = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(FILES.processedIds)
      .pipe(csv())
      .on('data', (row) => {
        // The CSV likely has just the IDs
        const jobId = row[Object.keys(row)[0]]; // Get first column value
        if (jobId && jobId.trim()) {
          processedIds.push({
            job_id: jobId.trim(),
            platform: jobId.includes('indeed') ? 'Indeed' : 
                     jobId.includes('linkedin') ? 'LinkedIn' : 'Unknown',
            processed_date: new Date().toISOString()
          });
          stats.processedIds.total++;
        }
      })
      .on('end', async () => {
        console.log(`  Found ${processedIds.length} processed IDs`);
        
        // Import in batches
        const batchSize = 100;
        for (let i = 0; i < processedIds.length; i += batchSize) {
          const batch = processedIds.slice(i, i + batchSize);
          
          try {
            const { data, error } = await supabase
              .from('processed_jobs')
              .upsert(batch, { 
                onConflict: 'job_id',
                ignoreDuplicates: true 
              })
              .select();

            if (error) {
              console.error(`  ❌ Error importing batch ${i/batchSize + 1}:`, error.message);
              stats.processedIds.errors += batch.length;
            } else {
              stats.processedIds.imported += data.length;
              process.stdout.write('.');
            }
          } catch (err) {
            console.error(`  ❌ Batch error:`, err.message);
            stats.processedIds.errors += batch.length;
          }
        }
        
        console.log(`\n  ✅ Imported ${stats.processedIds.imported} processed IDs`);
        resolve();
      })
      .on('error', reject);
  });
}

/**
 * Helper: Determine confidence level
 */
function determineConfidence(signalType) {
  if (!signalType) return 'low';
  
  const signal = signalType.toLowerCase();
  if (signal.includes('required') || signal.includes('must have')) return 'high';
  if (signal.includes('preferred') || signal.includes('experience')) return 'medium';
  return 'low';
}

/**
 * Helper: Parse requirement level
 */
function parseRequirementLevel(signalType) {
  if (!signalType) return 'mentioned';
  
  const signal = signalType.toLowerCase();
  if (signal.includes('required') || signal.includes('must')) return 'required';
  if (signal.includes('preferred')) return 'preferred';
  if (signal.includes('nice to have') || signal.includes('plus')) return 'nice-to-have';
  return 'mentioned';
}

/**
 * Main import function
 */
async function main() {
  console.log('🚀 Starting Google Sheets Data Import');
  console.log('=====================================\n');

  try {
    // Import in order of priority
    await importSearchTerms();
    await importIdentifiedCompanies();
    await importProcessedIds();
    
    // Note: Skipping raw jobs for now as it's 78MB and might be too large
    console.log('\n⚠️  Skipping Raw Jobs import (file too large - 78MB)');
    console.log('    You can import this separately if needed.\n');

    // Print summary
    console.log('\n📊 Import Summary');
    console.log('=====================================');
    console.log(`Search Terms: ${stats.searchTerms.imported}/${stats.searchTerms.total} imported`);
    console.log(`Companies: ${stats.companies.imported}/${stats.companies.total} imported`);
    console.log(`Processed IDs: ${stats.processedIds.imported}/${stats.processedIds.total} imported`);
    
    const totalErrors = stats.searchTerms.errors + stats.companies.errors + stats.processedIds.errors;
    if (totalErrors > 0) {
      console.log(`\n⚠️  Total errors: ${totalErrors}`);
    }

    console.log('\n✅ Import completed successfully!');
    console.log('\nYour data is now available in the Sales Tool Detector dashboard.');
    console.log('Visit: http://localhost:3001\n');

  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    process.exit(1);
  }
}

// Check if csv-parser is installed
try {
  require.resolve('csv-parser');
  main();
} catch (e) {
  console.log('📦 Installing required dependencies...');
  require('child_process').execSync('npm install csv-parser', { stdio: 'inherit' });
  console.log('✅ Dependencies installed. Please run the script again.');
}