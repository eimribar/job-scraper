require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function findDuplicates() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  
  console.log('=== ANALYZING DUPLICATES IN IDENTIFIED_COMPANIES ===\n');
  
  // Get all companies
  const { data: allCompanies } = await supabase
    .from('identified_companies')
    .select('company, tool_detected, created_at')
    .order('company');
  
  // Find duplicates
  const companyMap = new Map();
  
  allCompanies?.forEach(c => {
    const key = `${c.company.toLowerCase().trim()}|${c.tool_detected}`;
    if (!companyMap.has(key)) {
      companyMap.set(key, []);
    }
    companyMap.get(key).push(c);
  });
  
  // Show duplicates
  const duplicates = Array.from(companyMap.entries())
    .filter(([_, entries]) => entries.length > 1)
    .sort((a, b) => b[1].length - a[1].length);
  
  console.log(`Total unique company+tool combinations: ${companyMap.size}`);
  console.log(`Total records: ${allCompanies?.length}`);
  console.log(`Duplicate combinations: ${duplicates.length}\n`);
  
  if (duplicates.length > 0) {
    console.log('TOP DUPLICATES (same company + same tool):');
    duplicates.slice(0, 20).forEach(([key, entries]) => {
      const [company, tool] = key.split('|');
      console.log(`\n${entries[0].company} (${tool}): ${entries.length} copies`);
      entries.forEach(e => {
        console.log(`  - Created: ${e.created_at}`);
      });
    });
  }
  
  // Check for slight variations in company names
  console.log('\n=== CHECKING NAME VARIATIONS ===\n');
  
  const nameGroups = new Map();
  allCompanies?.forEach(c => {
    // Normalize: lowercase, remove common suffixes
    const normalized = c.company
      .toLowerCase()
      .replace(/,?\s*(inc|llc|corp|corporation|ltd|limited|co|company)\.?$/i, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
    
    if (!nameGroups.has(normalized)) {
      nameGroups.set(normalized, new Set());
    }
    nameGroups.get(normalized).add(c.company);
  });
  
  const variations = Array.from(nameGroups.entries())
    .filter(([_, names]) => names.size > 1)
    .sort((a, b) => b[1].size - a[1].size);
  
  if (variations.length > 0) {
    console.log('COMPANIES WITH NAME VARIATIONS:');
    variations.slice(0, 15).forEach(([normalized, names]) => {
      console.log(`\nVariations of "${Array.from(names)[0]}":`);
      Array.from(names).forEach(name => console.log(`  - ${name}`));
    });
  }
}

findDuplicates().catch(console.error);
