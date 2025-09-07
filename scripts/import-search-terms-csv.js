#!/usr/bin/env node

/**
 * Import search terms from CSV and set up automatic weekly scraping
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function importSearchTerms() {
  console.log('📁 Importing search terms from CSV...\n');
  
  try {
    // Read CSV file
    const csvPath = '/Users/eimribar/Desktop/_Job Scraper - Outreach & SalesLoft Tracker - Search_Terms_Status.csv';
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    
    // Parse CSV
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true
    });
    
    console.log(`📊 Found ${records.length} search terms in CSV\n`);
    
    // Check if search_terms table exists
    const { error: checkError } = await supabase
      .from('search_terms')
      .select('*')
      .limit(1);
    
    if (checkError && checkError.message.includes('does not exist')) {
      console.log('❌ search_terms table does not exist.');
      console.log('\n📋 Please execute the following SQL first:');
      console.log('URL: https://supabase.com/dashboard/project/nslcadgicgkncajoyyno/sql/new');
      console.log('File: migrations/create-search-terms-exact.sql\n');
      return;
    }
    
    // Process each record
    const searchTerms = records.map(record => ({
      search_term: record.search_term,
      last_scraped_date: record.last_scraped_date || null,
      jobs_found_count: parseInt(record.jobs_found_count) || 0,
      platform_last_scraped: record.platform_last_scraped || 'LinkedIn'
    }));
    
    // Upsert search terms
    console.log('📝 Upserting search terms to database...');
    const { data, error } = await supabase
      .from('search_terms')
      .upsert(searchTerms, { 
        onConflict: 'search_term',
        ignoreDuplicates: false 
      })
      .select();
    
    if (error) {
      console.error('❌ Error upserting search terms:', error.message);
      return;
    }
    
    console.log(`✅ Successfully imported ${searchTerms.length} search terms!\n`);
    
    // Add missing terms to reach 37
    const additionalTerms = [
      'Chief Revenue Officer',
      'CRO',
      'Sales Enablement',
      'Sales Engineer'
    ];
    
    const { data: addedTerms } = await supabase
      .from('search_terms')
      .upsert(
        additionalTerms.map(term => ({ search_term: term })),
        { onConflict: 'search_term', ignoreDuplicates: true }
      )
      .select();
    
    // Get status of all search terms
    const { data: allTerms } = await supabase
      .from('search_terms')
      .select('*')
      .order('last_scraped_date', { ascending: true, nullsFirst: true });
    
    console.log('📊 Search Terms Status:');
    console.log('=' .repeat(80));
    
    // Group by scraping status
    const needsScraping = [];
    const recentlyScraped = [];
    const neverScraped = [];
    
    allTerms?.forEach(term => {
      const daysSinceScraped = term.last_scraped_date 
        ? (Date.now() - new Date(term.last_scraped_date).getTime()) / (1000 * 60 * 60 * 24)
        : null;
      
      if (!term.last_scraped_date) {
        neverScraped.push(term);
      } else if (daysSinceScraped > 7) {
        needsScraping.push({ ...term, daysSinceScraped });
      } else {
        recentlyScraped.push({ ...term, daysSinceScraped });
      }
    });
    
    // Display status
    if (neverScraped.length > 0) {
      console.log('\n🆕 Never Scraped (' + neverScraped.length + ' terms):');
      neverScraped.forEach(term => {
        console.log(`  - ${term.search_term}`);
      });
    }
    
    if (needsScraping.length > 0) {
      console.log('\n⏰ Needs Scraping (>7 days old, ' + needsScraping.length + ' terms):');
      needsScraping
        .sort((a, b) => b.daysSinceScraped - a.daysSinceScraped)
        .forEach(term => {
          console.log(`  - ${term.search_term} (${Math.floor(term.daysSinceScraped)} days ago)`);
        });
    }
    
    if (recentlyScraped.length > 0) {
      console.log('\n✅ Recently Scraped (<7 days old, ' + recentlyScraped.length + ' terms):');
      recentlyScraped
        .sort((a, b) => a.daysSinceScraped - b.daysSinceScraped)
        .forEach(term => {
          console.log(`  - ${term.search_term} (${Math.floor(term.daysSinceScraped)} days ago)`);
        });
    }
    
    // Summary
    console.log('\n' + '=' .repeat(80));
    console.log('📈 Summary:');
    console.log(`  Total Search Terms: ${allTerms?.length || 0}`);
    console.log(`  Needs Immediate Scraping: ${needsScraping.length + neverScraped.length}`);
    console.log(`  Recently Scraped: ${recentlyScraped.length}`);
    
    // Show next term to scrape
    if (needsScraping.length > 0 || neverScraped.length > 0) {
      const nextTerm = needsScraping.length > 0 
        ? needsScraping[0].search_term 
        : neverScraped[0].search_term;
      console.log(`\n🎯 Next term to scrape: "${nextTerm}"`);
    }
    
    console.log('\n✅ Import complete! The system will automatically scrape terms older than 7 days.');
    
  } catch (error) {
    console.error('❌ Error importing search terms:', error.message);
  }
}

// Run import
importSearchTerms();