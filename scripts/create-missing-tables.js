/**
 * Create missing database tables
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Use service role key for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createMissingTables() {
  console.log('🔨 CREATING MISSING TABLES\n');
  
  // Test if identified_companies already exists
  console.log('Checking if identified_companies table exists...');
  
  const { data: existingData, error: testError } = await supabase
    .from('identified_companies')
    .select('id')
    .limit(1);
  
  if (testError && testError.code === 'PGRST116') {
    console.log('❌ identified_companies table does not exist - need to create it manually in Supabase dashboard');
    console.log('\nPlease create the table with this SQL in Supabase SQL Editor:');
    console.log('=====================================================');
    console.log(`
CREATE TABLE public.identified_companies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_name TEXT NOT NULL,
    tool_detected TEXT NOT NULL CHECK (tool_detected IN ('Outreach.io', 'SalesLoft', 'Both', 'None')),
    signal_type TEXT NOT NULL CHECK (signal_type IN ('explicit_mention', 'integration_requirement', 'process_indicator', 'none')),
    context TEXT,
    confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
    job_title TEXT,
    job_url TEXT,
    platform TEXT DEFAULT 'LinkedIn',
    identified_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_identified_companies_company ON identified_companies(company_name);
CREATE INDEX idx_identified_companies_tool ON identified_companies(tool_detected);
CREATE INDEX idx_identified_companies_date ON identified_companies(identified_date);

-- Enable RLS and set permissions
ALTER TABLE identified_companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON identified_companies FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON identified_companies FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users" ON identified_companies FOR UPDATE USING (true);
    `);
    console.log('=====================================================');
    console.log('\nAfter creating the table, run this script again.');
    return false;
  } else if (existingData !== null || testError === null) {
    console.log('✅ identified_companies table already exists');
  } else {
    console.log('❓ Unexpected error:', testError);
  }
  
  // Check scraping_runs table population
  console.log('\n📅 Checking scraping_runs table...');
  const { count: scrapeRunsCount } = await supabase
    .from('scraping_runs')
    .select('*', { count: 'exact', head: true });
  
  console.log('Scraping runs recorded:', scrapeRunsCount || 0);
  
  if (!scrapeRunsCount || scrapeRunsCount === 0) {
    console.log('⚠️ No scraping runs recorded - this is expected if you haven\'t used the official scraping pipeline');
  }
  
  return true;
}

createMissingTables().then(success => {
  if (success) {
    console.log('\n✅ Database setup complete!');
  } else {
    console.log('\n❌ Please create the missing table manually first.');
  }
}).catch(console.error);