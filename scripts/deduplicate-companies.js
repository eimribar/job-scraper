/**
 * Deduplication Utility for Identified Companies
 * 
 * This script:
 * 1. Finds company name variations
 * 2. Merges duplicates (keeping the oldest)
 * 3. Normalizes company names
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * Normalize company name for comparison
 */
function normalizeCompanyName(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')  // Normalize spaces
    .replace(/[™®©]/g, '') // Remove trademark symbols
    .replace(/,?\s*(inc\.?|llc|corp\.?|corporation|ltd\.?|limited|co\.?|company|plc|gmbh|ag|sa|srl|pvt\.?|private|group|holdings?|international|global|worldwide|solutions?|services?|technologies?|systems?|software|consulting|partners?)\s*$/gi, '') // Remove common suffixes
    .replace(/^(the|a|an)\s+/i, '') // Remove articles
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .trim();
}

/**
 * Check if two company names are likely the same
 */
function areSameCompany(name1, name2) {
  const norm1 = normalizeCompanyName(name1);
  const norm2 = normalizeCompanyName(name2);
  
  // Exact match after normalization
  if (norm1 === norm2) return true;
  
  // Special cases - known variations
  const specialCases = [
    ['opengov', 'opengov inc'],
    ['riskonnect', 'riskonnect inc'],
    ['buxton', 'buxton company'],
    ['cypris', 'cypris '],
    ['outreach', 'outreach '],
    ['precision point staffing', 'precision point staffing tm'],
    ['aci learning', 'itpro from aci learning'],
    ['vector solutions', 'vector solutions k12'],
  ];
  
  for (const [a, b] of specialCases) {
    if ((norm1.includes(a) && norm2.includes(b)) || 
        (norm1.includes(b) && norm2.includes(a))) {
      return true;
    }
  }
  
  // Only treat as same if one is exactly contained in the other
  // AND the difference is just common suffixes/prefixes
  if (norm1.length > 5 && norm2.length > 5) {
    if (norm1 === norm2) return true;
    
    // Check for trailing spaces or minor variations
    if (name1.trim() === name2.trim() + ' ' || 
        name2.trim() === name1.trim() + ' ') {
      return true;
    }
  }
  
  return false;
}

async function deduplicateCompanies() {
  console.log('🔍 Starting deduplication process...\n');
  
  // Get all companies
  const { data: allCompanies, error } = await supabase
    .from('identified_companies')
    .select('*')
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error('Error fetching companies:', error);
    return;
  }
  
  console.log(`Analyzing ${allCompanies.length} companies...\n`);
  
  // Group potential duplicates
  const groups = [];
  const processed = new Set();
  
  for (let i = 0; i < allCompanies.length; i++) {
    if (processed.has(i)) continue;
    
    const company = allCompanies[i];
    const group = [company];
    processed.add(i);
    
    // Find all variations of this company
    for (let j = i + 1; j < allCompanies.length; j++) {
      if (processed.has(j)) continue;
      
      const other = allCompanies[j];
      
      // Same tool required for deduplication
      if (company.tool_detected !== other.tool_detected) continue;
      
      if (areSameCompany(company.company, other.company)) {
        group.push(other);
        processed.add(j);
      }
    }
    
    if (group.length > 1) {
      groups.push(group);
    }
  }
  
  if (groups.length === 0) {
    console.log('✅ No duplicates found!');
    return;
  }
  
  console.log(`Found ${groups.length} groups of potential duplicates:\n`);
  
  // Display duplicates
  groups.forEach((group, idx) => {
    console.log(`Group ${idx + 1} (${group[0].tool_detected}):`);
    group.forEach(company => {
      console.log(`  - "${company.company}" (created: ${company.created_at})`);
    });
    console.log();
  });
  
  // Ask for confirmation
  console.log('Would you like to merge these duplicates? (keeping the oldest record)');
  console.log('Run with --merge flag to proceed with deduplication\n');
  
  if (process.argv.includes('--merge')) {
    console.log('🔄 Merging duplicates...\n');
    
    let merged = 0;
    let deleted = 0;
    
    for (const group of groups) {
      // Keep the first (oldest) record
      const keep = group[0];
      const toDelete = group.slice(1);
      
      console.log(`Keeping: "${keep.company}" (${keep.tool_detected})`);
      
      for (const duplicate of toDelete) {
        console.log(`  Deleting: "${duplicate.company}"`);
        
        const { error: deleteError } = await supabase
          .from('identified_companies')
          .delete()
          .eq('id', duplicate.id);
        
        if (deleteError) {
          console.error(`    ❌ Error deleting: ${deleteError.message}`);
        } else {
          deleted++;
        }
      }
      
      merged++;
      console.log();
    }
    
    console.log(`\n✅ Deduplication complete!`);
    console.log(`   Merged ${merged} groups`);
    console.log(`   Deleted ${deleted} duplicate records`);
    
    // Final count
    const { count } = await supabase
      .from('identified_companies')
      .select('*', { count: 'exact', head: true });
    
    console.log(`   Total companies now: ${count}`);
  } else {
    console.log('To merge duplicates, run: node scripts/deduplicate-companies.js --merge');
  }
}

// Run the deduplication
deduplicateCompanies().catch(console.error);
