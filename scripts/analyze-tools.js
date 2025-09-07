const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function analyzeTools() {
  console.log('Analyzing tool distribution in database...\n');
  
  // Get all companies
  const { data: companies, error } = await supabase
    .from('identified_companies')
    .select('tool_detected');
  
  if (error) {
    console.error('Error fetching companies:', error);
    return;
  }
  
  // Count by tool type
  const counts = {
    'Outreach.io': 0,
    'SalesLoft': 0,
    'Both': 0,
    'outreach': 0,
    'salesloft': 0,
    'both': 0,
    'null': 0,
    'other': 0
  };
  
  companies.forEach(company => {
    const tool = company.tool_detected;
    if (tool === 'Outreach.io') counts['Outreach.io']++;
    else if (tool === 'SalesLoft') counts['SalesLoft']++;
    else if (tool === 'Both') counts['Both']++;
    else if (tool === 'outreach') counts['outreach']++;
    else if (tool === 'salesloft') counts['salesloft']++;
    else if (tool === 'both') counts['both']++;
    else if (tool === null) counts['null']++;
    else {
      counts['other']++;
      console.log('Unknown tool value:', tool);
    }
  });
  
  console.log('Tool Distribution:');
  console.log('=================');
  console.log(`Outreach.io: ${counts['Outreach.io']}`);
  console.log(`SalesLoft: ${counts['SalesLoft']}`);
  console.log(`Both: ${counts['Both']}`);
  console.log(`outreach (lowercase): ${counts['outreach']}`);
  console.log(`salesloft (lowercase): ${counts['salesloft']}`);
  console.log(`both (lowercase): ${counts['both']}`);
  console.log(`null: ${counts['null']}`);
  console.log(`other: ${counts['other']}`);
  
  console.log('\nTotal companies:', companies.length);
  
  // Calculate what the dashboard is showing
  const outreachTotal = counts['Outreach.io'] + counts['outreach'] + counts['Both'] + counts['both'];
  const salesloftTotal = counts['SalesLoft'] + counts['salesloft'] + counts['Both'] + counts['both'];
  
  console.log('\nDashboard would show:');
  console.log(`Outreach users (including Both): ${outreachTotal}`);
  console.log(`SalesLoft users (including Both): ${salesloftTotal}`);
  console.log(`Sum of both: ${outreachTotal + salesloftTotal}`);
  console.log(`Actual total: ${companies.length}`);
  console.log(`Difference (double-counted): ${(outreachTotal + salesloftTotal) - companies.length}`);
  
  // Correct calculation
  const outreachOnly = counts['Outreach.io'] + counts['outreach'];
  const salesloftOnly = counts['SalesLoft'] + counts['salesloft'];
  const bothTools = counts['Both'] + counts['both'];
  
  console.log('\nCorrect breakdown:');
  console.log(`Only Outreach: ${outreachOnly}`);
  console.log(`Only SalesLoft: ${salesloftOnly}`);
  console.log(`Both tools: ${bothTools}`);
  console.log(`Total: ${outreachOnly + salesloftOnly + bothTools}`);
}

analyzeTools();