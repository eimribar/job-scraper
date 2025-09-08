#!/usr/bin/env node

/**
 * Populate search_terms_clean table for production automation
 * This initializes the search terms that will be scraped hourly
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Production-ready search terms for sales tool detection
const searchTerms = [
  // Tier 1: Direct SDR/BDR roles (most likely to use Outreach/SalesLoft)
  { search_term: 'SDR', priority: 10, is_active: true },
  { search_term: 'Sales Development Representative', priority: 10, is_active: true },
  { search_term: 'BDR', priority: 10, is_active: true },
  { search_term: 'Business Development Representative', priority: 10, is_active: true },
  { search_term: 'SDR Manager', priority: 9, is_active: true },
  { search_term: 'BDR Manager', priority: 9, is_active: true },
  { search_term: 'Sales Development Manager', priority: 9, is_active: true },
  
  // Tier 2: Revenue Operations (configure and manage sales tools)
  { search_term: 'Revenue Operations', priority: 8, is_active: true },
  { search_term: 'RevOps', priority: 8, is_active: true },
  { search_term: 'Sales Operations', priority: 8, is_active: true },
  { search_term: 'Sales Ops', priority: 8, is_active: true },
  { search_term: 'Sales Enablement', priority: 8, is_active: true },
  { search_term: 'Revenue Operations Manager', priority: 8, is_active: true },
  
  // Tier 3: Account Executives (use sales tools)
  { search_term: 'Account Executive', priority: 7, is_active: true },
  { search_term: 'Enterprise Account Executive', priority: 7, is_active: true },
  { search_term: 'Inside Sales', priority: 7, is_active: true },
  { search_term: 'Inside Sales Representative', priority: 7, is_active: true },
  
  // Tier 4: Sales Leadership (decision makers)
  { search_term: 'VP Sales', priority: 6, is_active: true },
  { search_term: 'VP Sales Development', priority: 6, is_active: true },
  { search_term: 'Director of Sales', priority: 6, is_active: true },
  { search_term: 'Head of Sales', priority: 6, is_active: true },
  { search_term: 'Chief Revenue Officer', priority: 6, is_active: true },
  { search_term: 'CRO', priority: 6, is_active: true },
  
  // Tier 5: Sales Support roles
  { search_term: 'Sales Engineer', priority: 5, is_active: true },
  { search_term: 'Solutions Engineer', priority: 5, is_active: true },
  { search_term: 'Sales Analyst', priority: 5, is_active: true },
  { search_term: 'Marketing Operations', priority: 5, is_active: true },
  
  // Tier 6: Additional relevant roles
  { search_term: 'Demand Generation', priority: 4, is_active: true },
  { search_term: 'Growth Marketing', priority: 4, is_active: true },
  { search_term: 'Outbound Sales', priority: 4, is_active: true },
  { search_term: 'Lead Generation', priority: 4, is_active: true },
];

async function populateSearchTerms() {
  console.log('🚀 Populating search_terms_clean for production automation...\n');
  
  try {
    // Check current state
    const { count: existingCount } = await supabase
      .from('search_terms_clean')
      .select('*', { count: 'exact', head: true });
    
    if (existingCount > 0) {
      console.log(`⚠️  Table already has ${existingCount} terms. Clearing and repopulating...`);
      
      // Clear existing terms
      const { error: deleteError } = await supabase
        .from('search_terms_clean')
        .delete()
        .neq('id', 0); // Delete all (neq with impossible value)
      
      if (deleteError) {
        console.error('Error clearing table:', deleteError);
        return;
      }
    }
    
    // Insert new terms
    console.log(`📝 Inserting ${searchTerms.length} search terms...`);
    
    const { data, error } = await supabase
      .from('search_terms_clean')
      .insert(searchTerms)
      .select();
    
    if (error) {
      console.error('❌ Error inserting search terms:', error);
      return;
    }
    
    console.log(`✅ Successfully inserted ${data.length} search terms!`);
    
    // Display summary
    console.log('\n📊 Search Terms Summary:');
    console.log('------------------------');
    
    const priorities = {};
    data.forEach(term => {
      if (!priorities[term.priority]) {
        priorities[term.priority] = [];
      }
      priorities[term.priority].push(term.search_term);
    });
    
    Object.keys(priorities)
      .sort((a, b) => b - a)
      .forEach(priority => {
        console.log(`\nPriority ${priority} (${priorities[priority].length} terms):`);
        priorities[priority].forEach(term => {
          console.log(`  - ${term}`);
        });
      });
    
    console.log('\n✅ Automation is ready to start scraping!');
    console.log('📅 The hourly cron job will process these terms sequentially');
    console.log('🔄 Each term will be scraped once per week');
    
    // Check if we have unprocessed jobs
    const { count: unprocessedCount } = await supabase
      .from('raw_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('processed', false);
    
    if (unprocessedCount > 0) {
      console.log(`\n📦 You have ${unprocessedCount} unprocessed jobs ready for analysis`);
      console.log('   The analyzer cron will process these every 5 minutes');
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the population
populateSearchTerms();