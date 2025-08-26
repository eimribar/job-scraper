/**
 * Import Remaining Companies with Better Duplicate Handling
 * This script handles companies that couldn't be imported due to duplicates
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

// CSV file path
const CSV_FILE = '/Users/eimribar/Desktop/Job Scraper csvs/_Job Scraper - Outreach & SalesLoft Tracker - Identified_Companies (1).csv';

// Statistics
const stats = {
  total: 0,
  imported: 0,
  updated: 0,
  skipped: 0,
  errors: 0
};

// Track processed companies to avoid duplicates within the same import
const processedCompanies = new Set();

/**
 * Import Companies with Deduplication
 */
async function importCompanies() {
  console.log('🏢 Importing Remaining Companies with Duplicate Handling...\n');
  
  // First, get existing companies from database
  console.log('📊 Fetching existing companies from database...');
  const { data: existingCompanies } = await supabase
    .from('companies')
    .select('normalized_name');
  
  const existingNormalizedNames = new Set(
    existingCompanies?.map(c => c.normalized_name) || []
  );
  
  console.log(`  Found ${existingNormalizedNames.size} existing companies in database\n`);

  const companiesToImport = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(CSV_FILE)
      .pipe(csv())
      .on('data', (row) => {
        stats.total++;
        
        // Normalize company name
        const normalizedName = row.Company ? 
          row.Company.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim() : '';

        // Skip if already processed in this import or exists in database
        if (!row.Company || !normalizedName) {
          stats.skipped++;
          return;
        }

        if (processedCompanies.has(normalizedName)) {
          stats.skipped++;
          console.log(`  ⏭️  Skipping duplicate: ${row.Company}`);
          return;
        }

        if (existingNormalizedNames.has(normalizedName)) {
          stats.skipped++;
          console.log(`  ✓ Already in database: ${row.Company}`);
          return;
        }

        // Mark as processed
        processedCompanies.add(normalizedName);

        // Parse tool detection
        const toolDetected = row.tool_detected ? row.tool_detected.toLowerCase() : '';
        const usesOutreach = toolDetected.includes('outreach');
        const usesSalesloft = toolDetected.includes('salesloft') || toolDetected.includes('sales loft');
        
        // Create company object
        companiesToImport.push({
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
            row['tags on the dashboard'].split(',').map(t => t.trim()).filter(t => t) : null,
          status: row.Status || null,
          
          // Import tracking
          import_source: 'google_sheets',
          import_date: new Date().toISOString()
        });
      })
      .on('end', async () => {
        console.log(`\n📊 Import Summary:`);
        console.log(`  Total rows in CSV: ${stats.total}`);
        console.log(`  Already in database: ${stats.total - companiesToImport.length - stats.skipped}`);
        console.log(`  New companies to import: ${companiesToImport.length}`);
        console.log(`  Skipped (no name/duplicates): ${stats.skipped}\n`);
        
        if (companiesToImport.length === 0) {
          console.log('✅ All companies are already imported!');
          resolve();
          return;
        }

        // Import new companies one by one to avoid conflicts
        console.log('📥 Starting import...\n');
        
        for (const company of companiesToImport) {
          try {
            const { data, error } = await supabase
              .from('companies')
              .insert(company)
              .select()
              .single();

            if (error) {
              console.error(`  ❌ Error importing ${company.name}: ${error.message}`);
              stats.errors++;
            } else {
              stats.imported++;
              process.stdout.write('.');
              if (stats.imported % 50 === 0) {
                console.log(` ${stats.imported}`);
              }
            }
          } catch (err) {
            console.error(`  ❌ Error: ${err.message}`);
            stats.errors++;
          }
        }
        
        console.log('\n\n✅ Import Complete!');
        console.log('=====================================');
        console.log(`  Successfully imported: ${stats.imported} companies`);
        console.log(`  Errors: ${stats.errors}`);
        console.log(`  Total companies now in database: ${existingNormalizedNames.size + stats.imported}`);
        
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

// Run the import
importCompanies()
  .then(() => {
    console.log('\n🎉 Your data is now available at: http://localhost:3001');
  })
  .catch(error => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  });