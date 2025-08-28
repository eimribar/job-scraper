#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function createApiSupabaseClient() {
  return createClient(supabaseUrl, supabaseKey);
}

async function executeSourceMigration() {
  console.log('🔧 EXECUTING SOURCE TRACKING MIGRATION');
  console.log('='.repeat(60));
  
  const supabase = createApiSupabaseClient();
  
  try {
    // Since Supabase JS client doesn't support ALTER TABLE directly,
    // we'll use RPC or direct database connection
    console.log('\n📝 Migration Steps:');
    console.log('1. Adding source and import_date columns');
    console.log('2. Updating Google Sheets companies (before July 2025)');
    console.log('3. Updating job analysis companies (after July 2025)');
    
    // First, let's check how many companies we have in each category
    const googleSheetsCutoff = '2025-07-01T00:00:00Z';
    
    // Count Google Sheets companies
    const { count: gsCount, error: gsError } = await supabase
      .from('identified_companies')
      .select('*', { count: 'exact', head: true })
      .lt('identified_date', googleSheetsCutoff);
    
    if (gsError) {
      console.error('Error counting Google Sheets companies:', gsError);
      return;
    }
    
    console.log(`\n📊 Found ${gsCount} companies from Google Sheets (before July 2025)`);
    
    // Count job analysis companies
    const { count: jaCount, error: jaError } = await supabase
      .from('identified_companies')
      .select('*', { count: 'exact', head: true })
      .gte('identified_date', googleSheetsCutoff);
    
    if (jaError) {
      console.error('Error counting job analysis companies:', jaError);
      return;
    }
    
    console.log(`📊 Found ${jaCount} companies from job analysis (after July 2025)`);
    
    // Total count
    const { count: totalCount } = await supabase
      .from('identified_companies')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 Total companies: ${totalCount}`);
    
    console.log('\n⚠️ IMPORTANT: To complete the migration, please:');
    console.log('\n1. Go to Supabase Dashboard > SQL Editor');
    console.log('2. Run the following SQL:\n');
    
    const sql = `
-- Add source tracking columns to identified_companies table
ALTER TABLE identified_companies 
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'job_analysis',
ADD COLUMN IF NOT EXISTS import_date TIMESTAMP WITH TIME ZONE;

-- Create index for source filtering
CREATE INDEX IF NOT EXISTS idx_identified_companies_source ON identified_companies(source);

-- Update existing records based on identified_date
-- Companies identified before July 1, 2025 are from Google Sheets (${gsCount} companies)
UPDATE identified_companies 
SET 
  source = 'google_sheets',
  import_date = '2025-06-26T00:00:00Z'
WHERE identified_date < '2025-07-01T00:00:00Z';

-- Companies identified after July 1, 2025 are from job analysis (${jaCount} companies)
UPDATE identified_companies 
SET 
  source = 'job_analysis',
  import_date = identified_date
WHERE identified_date >= '2025-07-01T00:00:00Z';

-- Verify the update
SELECT 
  source,
  COUNT(*) as count
FROM identified_companies
GROUP BY source
ORDER BY source;
    `;
    
    console.log(sql);
    
    console.log('\n3. After running the SQL, verify the results show:');
    console.log(`   - google_sheets: ${gsCount} companies`);
    console.log(`   - job_analysis: ${jaCount} companies`);
    
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

executeSourceMigration().catch(console.error);