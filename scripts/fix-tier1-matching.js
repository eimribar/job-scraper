const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nslcadgicgkncajoyyno.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zbGNhZGdpY2drbmNham95eW5vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjgxMTI1MSwiZXhwIjoyMDcyMzg3MjUxfQ.TaRBcVGLr61yr1gEEPBfPqntpZj3GTaJsNMwla-I2Y4';

const supabase = createClient(supabaseUrl, supabaseKey);

// Function to normalize company names for better matching
function normalizeCompanyName(name) {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .trim()
    // Remove common business suffixes
    .replace(/\s+(inc\.?|llc\.?|corp\.?|ltd\.?|co\.?|company|technologies|technology|tech|software|solutions|services|systems|group|international|intl)(\s|$)/gi, ' ')
    // Remove special characters except spaces and alphanumeric
    .replace(/[^\w\s]/g, ' ')
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    .trim();
}

// Function to calculate string similarity (Levenshtein distance based)
function stringSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / parseFloat(longer.length);
}

function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

async function fixTier1Matching() {
  console.log('🔍 Fixing Tier 1 company matching with advanced algorithms...\n');

  try {
    // Get all tier_one_companies
    const { data: tier1Companies, error: tier1Error } = await supabase
      .from('tier_one_companies')
      .select('company_name');

    if (tier1Error) {
      console.error('❌ Error fetching tier_one_companies:', tier1Error);
      return;
    }

    console.log(`📋 Found ${tier1Companies.length} companies in tier_one_companies table`);

    // Get all identified_companies currently marked as Tier 2
    const { data: tier2Companies, error: tier2Error } = await supabase
      .from('identified_companies')
      .select('id, company, tier')
      .eq('tier', 'Tier 2');

    if (tier2Error) {
      console.error('❌ Error fetching tier 2 companies:', tier2Error);
      return;
    }

    console.log(`📋 Found ${tier2Companies.length} companies currently marked as Tier 2`);

    let matchesFound = 0;
    let updatesProcessed = 0;
    const matchedPairs = [];

    console.log('\n🤖 Processing company matches...');

    // Process each tier_one_company
    for (const tier1Company of tier1Companies) {
      const tier1Name = tier1Company.company_name;
      const tier1Normalized = normalizeCompanyName(tier1Name);
      
      let bestMatch = null;
      let bestSimilarity = 0;
      let exactMatch = false;

      // Look for matches in tier2Companies
      for (const tier2Company of tier2Companies) {
        if (tier2Company.tier !== 'Tier 2') continue; // Skip if already updated
        
        const tier2Name = tier2Company.company;
        const tier2Normalized = normalizeCompanyName(tier2Name);

        // Check for exact match
        if (tier1Normalized === tier2Normalized) {
          bestMatch = tier2Company;
          bestSimilarity = 1.0;
          exactMatch = true;
          break;
        }

        // Check if one contains the other
        if (tier1Normalized.includes(tier2Normalized) || tier2Normalized.includes(tier1Normalized)) {
          const similarity = Math.min(tier1Normalized.length, tier2Normalized.length) / Math.max(tier1Normalized.length, tier2Normalized.length);
          if (similarity > bestSimilarity && similarity > 0.7) {
            bestMatch = tier2Company;
            bestSimilarity = similarity;
          }
        }

        // Calculate string similarity for fuzzy matching
        const similarity = stringSimilarity(tier1Normalized, tier2Normalized);
        if (similarity > bestSimilarity && similarity > 0.85) {
          bestMatch = tier2Company;
          bestSimilarity = similarity;
        }
      }

      // If we found a good match, update it
      if (bestMatch && bestSimilarity > 0.7) {
        console.log(`   🎯 Match found: "${tier1Name}" → "${bestMatch.company}" (${(bestSimilarity * 100).toFixed(1)}% similarity)`);
        
        // Update the company to Tier 1
        const { error: updateError } = await supabase
          .from('identified_companies')
          .update({ tier: 'Tier 1' })
          .eq('id', bestMatch.id);

        if (updateError) {
          console.error(`   ❌ Error updating ${bestMatch.company}:`, updateError);
        } else {
          updatesProcessed++;
          // Mark this company as updated so we don't match it again
          bestMatch.tier = 'Tier 1';
          matchedPairs.push({
            tier1Name: tier1Name,
            identifiedName: bestMatch.company,
            similarity: bestSimilarity,
            exact: exactMatch
          });
        }
        matchesFound++;
      }
    }

    console.log(`\n✅ Matching completed!`);
    console.log(`   🔍 Matches found: ${matchesFound}`);
    console.log(`   💾 Updates processed: ${updatesProcessed}`);

    // Show some example matches
    if (matchedPairs.length > 0) {
      console.log('\n📝 Example matches:');
      matchedPairs.slice(0, 10).forEach(pair => {
        const exactFlag = pair.exact ? '(exact)' : `(${(pair.similarity * 100).toFixed(1)}%)`;
        console.log(`   • "${pair.tier1Name}" → "${pair.identifiedName}" ${exactFlag}`);
      });
      
      if (matchedPairs.length > 10) {
        console.log(`   ... and ${matchedPairs.length - 10} more matches`);
      }
    }

    // Show final statistics
    const { data: finalStats } = await supabase
      .from('identified_companies')
      .select('tier');

    const finalCounts = {
      tier1: finalStats.filter(c => c.tier === 'Tier 1').length,
      tier2: finalStats.filter(c => c.tier === 'Tier 2').length,
      total: finalStats.length
    };

    console.log('\n📊 FINAL TIER DISTRIBUTION:');
    console.log(`   🥇 Tier 1: ${finalCounts.tier1} companies (${(finalCounts.tier1 / finalCounts.total * 100).toFixed(1)}%)`);
    console.log(`   🥈 Tier 2: ${finalCounts.tier2} companies (${(finalCounts.tier2 / finalCounts.total * 100).toFixed(1)}%)`);
    console.log(`   📈 Total: ${finalCounts.total} companies`);

    // Check for unmatched Tier 1 companies
    const unmatchedTier1 = tier1Companies.length - matchedPairs.length;
    if (unmatchedTier1 > 0) {
      console.log(`\n⚠️  ${unmatchedTier1} Tier 1 companies from the list were not found in identified_companies`);
      console.log('   These companies may need to be processed by the job scraper first.');
    }

    console.log('\n🎉 Tier 1 matching process completed successfully!');

  } catch (error) {
    console.error('❌ Unexpected error during Tier 1 matching:', error);
    throw error;
  }
}

// Run the matching
if (require.main === module) {
  fixTier1Matching()
    .then(() => {
      console.log('\n✅ Tier 1 matching process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Tier 1 matching process failed:', error);
      process.exit(1);
    });
}

module.exports = { fixTier1Matching };