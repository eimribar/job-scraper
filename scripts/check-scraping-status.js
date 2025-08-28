const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkScrapingStatus() {
  const { data: searchTerms } = await supabase
    .from('search_terms_clean')
    .select('search_term, last_scraped_date, is_active')
    .eq('is_active', true)
    .order('last_scraped_date', { ascending: true, nullsFirst: true })
    .limit(10);
  
  console.log('\n🔍 Search Terms Scraping Status (10 oldest):');
  console.log('=' .repeat(60));
  
  const now = new Date();
  searchTerms.forEach(term => {
    const lastScraped = term.last_scraped_date ? new Date(term.last_scraped_date) : null;
    const daysSince = lastScraped ? Math.round((now - lastScraped) / (1000 * 60 * 60 * 24)) : 'Never';
    const status = daysSince === 'Never' ? '❌ NEVER SCRAPED' : 
                   daysSince > 7 ? `⚠️ ${daysSince} days ago` : 
                   `✅ ${daysSince} days ago`;
    
    console.log(`${term.search_term.padEnd(30)} | ${status}`);
  });
  
  // Check total that need scraping
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: needsScraping } = await supabase
    .from('search_terms_clean')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .or(`last_scraped_date.is.null,last_scraped_date.lt.${oneWeekAgo}`);
  
  console.log('\n📊 Summary:');
  console.log(`Terms needing scraping (>7 days old or never): ${needsScraping || 0}`);
  
  process.exit(0);
}

checkScrapingStatus().catch(console.error);