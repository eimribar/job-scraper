require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const companiesToCheck = [
  'Uber', 'Xcede', 'Just Badge', 'Mitratech', 'Blue Onion', 'Fiverr', 
  'Cohere', 'Melio', 'Hirewell', 'Nimble', 'NowVertical Group Inc.', 
  'Sustainment', 'DigitalOcean', 'Precision Point Staffing', 
  'Foundation Health', 'AppDirect', 'BlinkOps', 'Clarify Health Solutions', 
  'Neon One', 'Strike Social', 'Modern Campus', 'Zendesk', 'Bynder', 
  'Panther', 'ControlCase', 'Ironclad', 'NETSCOUT', 'Array', 'Mimica', 
  'Value Creed', 'BlueVoyant', 'Unanet', 'Cayuse', 'Fullbay', 'Corpay', 
  'Vyne', 'WaveRez', 'Lago', 'Oyster®', 'HSP Group', 'Xplor Technologies', 
  'Britive', 'Immuta', 'Configit', 'SheerID', 'Disguise', 'Tavus', 
  'Candid Health', 'Boostlingo', 'Evidenza', 'PayJunction', 
  'Procore Technologies', 'BambooHR', 'Nintex', 'Criteria Corp'
];

async function checkCompanies() {
  console.log('Checking', companiesToCheck.length, 'companies...\n');
  
  const { data: identifiedCompanies, error } = await supabase
    .from('identified_companies')
    .select('company, tool_detected')
    .in('company', companiesToCheck);
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  const foundCompanies = new Set(identifiedCompanies.map(c => c.company));
  
  console.log('✅ FOUND IN DATABASE (' + identifiedCompanies.length + ' companies):');
  console.log('═══════════════════════════════════════════');
  identifiedCompanies.forEach(c => {
    console.log(`  • ${c.company} - Tool: ${c.tool_detected}`);
  });
  
  console.log('\n❌ NOT FOUND IN DATABASE (' + (companiesToCheck.length - identifiedCompanies.length) + ' companies):');
  console.log('═══════════════════════════════════════════');
  companiesToCheck.forEach(company => {
    if (!foundCompanies.has(company)) {
      console.log(`  • ${company}`);
    }
  });
  
  console.log('\nSummary:');
  console.log(`  Total checked: ${companiesToCheck.length}`);
  console.log(`  Found: ${identifiedCompanies.length}`);
  console.log(`  Not found: ${companiesToCheck.length - identifiedCompanies.length}`);
}

checkCompanies();