#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createApiSupabaseClient } = require('../lib/supabase');

async function addSourceTracking() {
  console.log('🔧 ADDING SOURCE TRACKING TO IDENTIFIED_COMPANIES');
  console.log('='.repeat(60));
  
  const supabase = createApiSupabaseClient();
  
  try {
    // Step 1: Add new columns if they don't exist
    console.log('\n1️⃣ Adding source and import_date columns...');
    
    // Note: Supabase doesn't support ALTER TABLE directly via JS client
    // We'll need to use the Supabase dashboard or raw SQL
    // For now, let's check if columns exist and update data
    
    // First, let's check the current schema
    const { data: testRow, error: testError } = await supabase
      .from('identified_companies')
      .select('*')
      .limit(1);
    
    if (testError) {
      console.error('Error checking table:', testError);
      return;
    }
    
    console.log('Current columns:', testRow.length > 0 ? Object.keys(testRow[0]) : 'No data');
    
    // Check if source column exists
    if (testRow.length > 0 && !('source' in testRow[0])) {
      console.log('\n⚠️ IMPORTANT: Please run this SQL in Supabase dashboard:');
      console.log(`
ALTER TABLE identified_companies 
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'job_analysis',
ADD COLUMN IF NOT EXISTS import_date TIMESTAMP WITH TIME ZONE;

-- Create index for source filtering
CREATE INDEX IF NOT EXISTS idx_identified_companies_source ON identified_companies(source);
      `);
      console.log('\nThen re-run this script.');
      return;
    }
    
    // Step 2: Identify Google Sheets companies (imported in June 2025)
    console.log('\n2️⃣ Identifying Google Sheets companies...');
    
    // Companies imported before July 1, 2025 are from Google Sheets
    const googleSheetsCutoff = '2025-07-01T00:00:00Z';
    
    const { data: googleSheetsCompanies, error: gsError } = await supabase
      .from('identified_companies')
      .select('company_name, identified_date')
      .lt('identified_date', googleSheetsCutoff);
    
    if (gsError) {
      console.error('Error fetching Google Sheets companies:', gsError);
      return;
    }
    
    console.log(`Found ${googleSheetsCompanies.length} companies from Google Sheets import`);
    
    // Step 3: Update source for Google Sheets companies
    console.log('\n3️⃣ Updating source for Google Sheets companies...');
    
    if (googleSheetsCompanies.length > 0) {
      // Update in batches to avoid timeout
      const batchSize = 50;
      let updated = 0;
      
      for (let i = 0; i < googleSheetsCompanies.length; i += batchSize) {
        const batch = googleSheetsCompanies.slice(i, i + batchSize);
        const companyNames = batch.map(c => c.company_name);
        
        const { error: updateError } = await supabase
          .from('identified_companies')
          .update({ 
            source: 'google_sheets',
            import_date: '2025-06-26T00:00:00Z' // Date of original import
          })
          .in('company_name', companyNames);
        
        if (updateError) {
          console.error('Error updating batch:', updateError);
        } else {
          updated += batch.length;
          console.log(`   Updated ${updated}/${googleSheetsCompanies.length} companies...`);
        }
      }
    }
    
    // Step 4: Update source for job analysis companies
    console.log('\n4️⃣ Updating source for job analysis companies...');
    
    const { error: jaError } = await supabase
      .from('identified_companies')
      .update({ 
        source: 'job_analysis',
        import_date: supabase.raw('identified_date') // Use identified_date as import_date
      })
      .gte('identified_date', googleSheetsCutoff)
      .is('source', null); // Only update if source is not set
    
    if (jaError) {
      console.error('Error updating job analysis companies:', jaError);
    } else {
      console.log('   ✅ Updated job analysis companies');
    }
    
    // Step 5: Verify the updates
    console.log('\n5️⃣ Verifying source tracking...');
    
    const { data: sourceCounts, error: countError } = await supabase
      .from('identified_companies')
      .select('source')
      .then(result => {
        if (result.error) return { error: result.error };
        
        const counts = {};
        result.data.forEach(row => {
          const source = row.source || 'unknown';
          counts[source] = (counts[source] || 0) + 1;
        });
        
        return { data: counts };
      });
    
    if (countError) {
      console.error('Error counting sources:', countError);
    } else {
      console.log('\n📊 Source Distribution:');
      Object.entries(sourceCounts).forEach(([source, count]) => {
        console.log(`   ${source}: ${count} companies`);
      });
    }
    
    console.log('\n✅ Source tracking setup complete!');
    console.log('\n📝 Next steps:');
    console.log('   1. Run the deduplication script');
    console.log('   2. Update the API to filter by source');
    console.log('   3. Update the dashboard to show source filters');
    
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

addSourceTracking().catch(console.error);