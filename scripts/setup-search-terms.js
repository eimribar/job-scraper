#!/usr/bin/env node

/**
 * Setup search terms and notification tables using Supabase API
 * This script creates the necessary tables if they don't exist
 * and populates them with initial data
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// 37 search terms for SDR/Sales roles
const searchTerms = [
  // Core SDR/BDR terms (highest priority)
  { term: 'SDR', priority: 10, schedule_day: 1 },
  { term: 'Sales Development Representative', priority: 10, schedule_day: 1 },
  { term: 'BDR', priority: 10, schedule_day: 1 },
  { term: 'Business Development Representative', priority: 10, schedule_day: 1 },
  { term: 'Sales Development Manager', priority: 9, schedule_day: 1 },
  { term: 'SDR Manager', priority: 9, schedule_day: 1 },
  { term: 'BDR Manager', priority: 9, schedule_day: 1 },
  
  // Sales Operations & Enablement (high priority)
  { term: 'Revenue Operations', priority: 8, schedule_day: 2 },
  { term: 'Sales Operations', priority: 8, schedule_day: 2 },
  { term: 'Sales Enablement', priority: 8, schedule_day: 2 },
  { term: 'RevOps', priority: 8, schedule_day: 2 },
  { term: 'Sales Ops', priority: 8, schedule_day: 2 },
  
  // Account Executive roles (medium-high priority)
  { term: 'Account Executive', priority: 7, schedule_day: 3 },
  { term: 'Enterprise Account Executive', priority: 7, schedule_day: 3 },
  { term: 'SMB Account Executive', priority: 7, schedule_day: 3 },
  { term: 'Mid-Market Account Executive', priority: 7, schedule_day: 3 },
  { term: 'Inside Sales Representative', priority: 7, schedule_day: 3 },
  { term: 'ISR', priority: 7, schedule_day: 3 },
  
  // Sales Leadership (medium priority)
  { term: 'VP Sales', priority: 6, schedule_day: 4 },
  { term: 'Vice President Sales', priority: 6, schedule_day: 4 },
  { term: 'Director of Sales', priority: 6, schedule_day: 4 },
  { term: 'Head of Sales', priority: 6, schedule_day: 4 },
  { term: 'Sales Director', priority: 6, schedule_day: 4 },
  { term: 'CRO', priority: 6, schedule_day: 4 },
  { term: 'Chief Revenue Officer', priority: 6, schedule_day: 4 },
  
  // Sales Support & Analytics (medium priority)
  { term: 'Sales Analyst', priority: 5, schedule_day: 5 },
  { term: 'Sales Operations Analyst', priority: 5, schedule_day: 5 },
  { term: 'Sales Engineer', priority: 5, schedule_day: 5 },
  { term: 'Solutions Engineer', priority: 5, schedule_day: 5 },
  { term: 'Sales Coordinator', priority: 5, schedule_day: 5 },
  
  // Specialized Sales Roles (lower priority)
  { term: 'Outbound Sales', priority: 4, schedule_day: 6 },
  { term: 'Inbound Sales', priority: 4, schedule_day: 6 },
  { term: 'Lead Generation Specialist', priority: 4, schedule_day: 6 },
  { term: 'Demand Generation', priority: 4, schedule_day: 7 },
  { term: 'Growth Marketing', priority: 4, schedule_day: 7 },
  { term: 'Pipeline Development', priority: 4, schedule_day: 7 },
];

async function setupSearchTerms() {
  console.log('🚀 Setting up search terms for automated scraping...\n');
  
  try {
    // First, check if search_terms table exists by trying to query it
    const { data: existingTerms, error: checkError } = await supabase
      .from('search_terms')
      .select('*')
      .limit(1);
    
    if (checkError && checkError.message.includes('does not exist')) {
      console.log('❌ search_terms table does not exist.');
      console.log('\n📋 Please execute the following SQL in Supabase Dashboard:');
      console.log('URL: https://supabase.com/dashboard/project/nslcadgicgkncajoyyno/sql/new');
      console.log('File: migrations/create-search-terms-table.sql\n');
      return;
    }
    
    // Get current count
    const { count: currentCount } = await supabase
      .from('search_terms')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 Current search terms in database: ${currentCount || 0}`);
    
    if (currentCount === 0) {
      console.log('\n📝 Inserting 37 search terms...');
      
      // Insert search terms with additional fields
      const termsToInsert = searchTerms.map(term => ({
        ...term,
        is_active: true,
        next_scrape_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        jobs_found_last_run: 0,
        companies_found_last_run: 0,
        total_jobs_found: 0,
        total_companies_found: 0,
        success_rate: 100.00
      }));
      
      const { data: inserted, error: insertError } = await supabase
        .from('search_terms')
        .insert(termsToInsert)
        .select();
      
      if (insertError) {
        console.error('❌ Error inserting search terms:', insertError.message);
        return;
      }
      
      console.log(`✅ Successfully inserted ${inserted.length} search terms!`);
    } else {
      console.log('✅ Search terms already exist in database');
    }
    
    // Display search terms by priority
    const { data: allTerms } = await supabase
      .from('search_terms')
      .select('term, priority, schedule_day')
      .order('priority', { ascending: false })
      .order('term');
    
    console.log('\n📋 Search Terms by Priority:');
    console.log('================================');
    
    const priorities = {
      10: 'Core SDR/BDR',
      9: 'SDR Management',
      8: 'Sales Operations',
      7: 'Account Executive',
      6: 'Sales Leadership',
      5: 'Sales Support',
      4: 'Specialized Sales'
    };
    
    let currentPriority = null;
    allTerms?.forEach(term => {
      if (term.priority !== currentPriority) {
        currentPriority = term.priority;
        console.log(`\n[Priority ${term.priority}] ${priorities[term.priority] || 'Other'}:`);
      }
      const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][term.schedule_day % 7];
      console.log(`  - ${term.term} (${day})`);
    });
    
    console.log('\n✅ Search terms setup complete!');
    console.log('📅 Weekly scraping schedule configured');
    console.log('🚀 Ready for automated processing');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function createNotificationSample() {
  console.log('\n📔 Creating sample notification...');
  
  try {
    // Check if notifications table exists
    const { error: checkError } = await supabase
      .from('notifications')
      .select('*')
      .limit(1);
    
    if (checkError && checkError.message.includes('does not exist')) {
      console.log('❌ notifications table does not exist.');
      console.log('Please create it using the migration file.');
      return;
    }
    
    // Create a sample notification
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        type: 'new_company',
        title: 'New Company Discovered!',
        message: 'System is ready to detect companies using Outreach.io and SalesLoft',
        metadata: {
          company: 'Sample Corp',
          tool_detected: 'Outreach.io',
          confidence: 'high'
        }
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating notification:', error.message);
    } else {
      console.log('✅ Sample notification created');
    }
  } catch (error) {
    console.error('Error with notifications:', error.message);
  }
}

// Run setup
setupSearchTerms().then(() => createNotificationSample());