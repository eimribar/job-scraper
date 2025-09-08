const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase configuration');
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env.local file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Function to clean and normalize company names
function normalizeCompanyName(name) {
  if (!name) return '';
  return name
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/[^\w\s\-\.]/g, '') // Remove special characters except hyphens and dots
    .toLowerCase();
}

// Function to extract domain from various formats
function extractDomain(domainOrUrl) {
  if (!domainOrUrl) return null;
  
  // Remove protocol if present
  let domain = domainOrUrl.replace(/^https?:\/\//, '');
  
  // Remove www. if present
  domain = domain.replace(/^www\./, '');
  
  // Remove path if present
  domain = domain.split('/')[0];
  
  // Remove port if present
  domain = domain.split(':')[0];
  
  return domain.toLowerCase().trim();
}

// Function to parse CSV and import to Supabase
async function importTierOneCompanies() {
  console.log('🚀 Starting Tier 1 companies import...');
  
  const csvFilePath = path.join(__dirname, '..', '..', 'Desktop', 'Tier_1_Companies_Cleaned.csv');
  
  if (!fs.existsSync(csvFilePath)) {
    console.error(`❌ CSV file not found at: ${csvFilePath}`);
    console.error('Please make sure the Tier_1_Companies_Cleaned.csv file exists in the Desktop folder');
    process.exit(1);
  }

  const companies = [];
  let rowCount = 0;

  return new Promise((resolve, reject) => {
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (row) => {
        rowCount++;
        
        // Skip rows with missing company names
        if (!row.Company || row.Company.trim() === '') {
          console.log(`⚠️  Skipping row ${rowCount}: Missing company name`);
          return;
        }

        const company = {
          company_name: row.Company.trim(),
          domain: extractDomain(row.Domain),
          linkedin_url: row.LinkedIn?.trim() || null,
          tool_detected: row.tool_detected?.trim() || null,
          leads_in_system: parseInt(row['leads in system']) || 0,
          follow_up: row['Follow Up']?.toLowerCase() === 'yes',
          engaged: row['Engaged?']?.toLowerCase() === 'yes',
          engagement_context: row.context?.trim() || null,
          first_person: row['first person']?.trim() || null,
          second_person: row['second person']?.trim() || null,
          third_person: row['third person']?.trim() || null,
          other_contacts: row.Other?.trim() || null,
          jon_input: row["Jon's input"]?.trim() || null,
          ido_input: row["Ido's input"]?.trim() || null,
          eimri_input: row["Eimri's input"]?.trim() || null,
          how_many_people: parseInt(row['how many people?']) || 0,
          processed: row['Processed?']?.toLowerCase() === 'yes'
        };

        companies.push(company);
        
        if (rowCount % 50 === 0) {
          console.log(`📊 Processed ${rowCount} rows...`);
        }
      })
      .on('end', async () => {
        console.log(`📋 Parsed ${companies.length} companies from CSV`);
        
        if (companies.length === 0) {
          console.log('⚠️  No valid companies found in CSV');
          resolve();
          return;
        }

        try {
          // Insert companies in batches of 50
          const batchSize = 50;
          let insertedCount = 0;
          let errorCount = 0;

          for (let i = 0; i < companies.length; i += batchSize) {
            const batch = companies.slice(i, i + batchSize);
            
            console.log(`📤 Inserting batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(companies.length/batchSize)} (${batch.length} companies)...`);
            
            const { data, error } = await supabase
              .from('tier_one_companies')
              .upsert(batch, { 
                onConflict: 'company_name',
                ignoreDuplicates: false 
              })
              .select();

            if (error) {
              console.error(`❌ Error inserting batch:`, error);
              errorCount += batch.length;
            } else {
              insertedCount += data.length;
              console.log(`✅ Successfully inserted/updated ${data.length} companies in this batch`);
            }
          }

          console.log('\n📊 Import Summary:');
          console.log(`   Total companies processed: ${companies.length}`);
          console.log(`   Successfully inserted/updated: ${insertedCount}`);
          console.log(`   Errors: ${errorCount}`);

          // Now update existing identified companies to mark Tier 1
          console.log('\n🔄 Updating existing identified companies tiers...');
          
          const { count: tier1Count, error: updateError } = await supabase
            .from('identified_companies')
            .update({ tier: 'Tier 1' })
            .in('company', companies.map(c => c.company_name))
            .select('*', { count: 'exact', head: true });

          if (updateError) {
            console.error('❌ Error updating existing companies:', updateError);
          } else {
            console.log(`✅ Updated ${tier1Count || 0} existing companies to Tier 1`);
          }

          // Insert ALL Tier 1 companies to identified_companies (both identified and unidentified)
          console.log('\n🔍 Adding ALL Tier 1 companies to identified_companies table...');
          
          const companiesToAdd = [];
          
          for (const company of companies) {
            // Check if company exists in identified_companies (exact match)
            const { data: existing } = await supabase
              .from('identified_companies')
              .select('id, company, tier, tool_detected')
              .eq('company', company.company_name)
              .limit(1);
              
            if (!existing || existing.length === 0) {
              // Company not found, add it with tool detection from CSV
              const toolDetected = company.tool_detected || 'Not Identified Yet';
              
              companiesToAdd.push({
                company: company.company_name,
                tool_detected: toolDetected,
                signal_type: 'Manual Import',
                context: toolDetected === 'Not Identified Yet' 
                  ? 'Tier 1 company - tool identification pending' 
                  : `Tier 1 company confirmed using ${toolDetected}`,
                job_title: 'Manual Import',
                job_url: company.linkedin_url || 'N/A',
                platform: 'Manual Import',
                identified_date: new Date().toISOString(),
                tier: 'Tier 1',
                leads_generated: company.leads_in_system > 0
              });
              
              console.log(`   📝 Will add: ${company.company_name} (${toolDetected})`);
            } else {
              // Company exists, update tier to Tier 1 if not already
              if (existing[0].tier !== 'Tier 1') {
                const { error: updateError } = await supabase
                  .from('identified_companies')
                  .update({ tier: 'Tier 1' })
                  .eq('id', existing[0].id);
                  
                if (!updateError) {
                  console.log(`   🔄 Updated: ${existing[0].company} → Tier 1`);
                }
              } else {
                console.log(`   ✅ Already Tier 1: ${existing[0].company}`);
              }
            }
          }

          if (companiesToAdd.length > 0) {
            console.log(`\n📦 Inserting ${companiesToAdd.length} new Tier 1 companies...`);
            
            // Insert in batches to avoid overwhelming the database
            const insertBatchSize = 25;
            let totalInserted = 0;
            
            for (let i = 0; i < companiesToAdd.length; i += insertBatchSize) {
              const batch = companiesToAdd.slice(i, i + insertBatchSize);
              
              const { data: newData, error: insertError } = await supabase
                .from('identified_companies')
                .insert(batch)
                .select();

              if (insertError) {
                console.error(`❌ Error inserting batch ${Math.floor(i/insertBatchSize) + 1}:`, insertError);
              } else {
                totalInserted += newData.length;
                console.log(`   ✅ Inserted batch ${Math.floor(i/insertBatchSize) + 1}: ${newData.length} companies`);
              }
            }
            
            console.log(`✅ Successfully added ${totalInserted} Tier 1 companies to identified_companies table`);
          } else {
            console.log('ℹ️  All Tier 1 companies are already in the identified_companies table');
          }

          console.log('\n🎉 Tier 1 import completed successfully!');
          resolve();
          
        } catch (error) {
          console.error('❌ Unexpected error during import:', error);
          reject(error);
        }
      })
      .on('error', (error) => {
        console.error('❌ Error reading CSV file:', error);
        reject(error);
      });
  });
}

// Run the import
if (require.main === module) {
  importTierOneCompanies()
    .then(() => {
      console.log('✅ Import process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Import process failed:', error);
      process.exit(1);
    });
}

module.exports = { importTierOneCompanies };