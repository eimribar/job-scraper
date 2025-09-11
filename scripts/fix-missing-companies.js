#!/usr/bin/env node

/**
 * Recovery script to fix companies that appear in notifications
 * but are missing from identified_companies table
 * 
 * This script:
 * 1. Finds all companies in notifications that don't exist in identified_companies
 * 2. Recovers them from notification metadata
 * 3. Cleans up duplicate notifications
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findAndFixMissingCompanies() {
  console.log('=== RECOVERY SCRIPT FOR MISSING COMPANIES ===\n');
  console.log('Finding companies in notifications but not in identified_companies...\n');
  
  // Get all 'New company' notifications
  const { data: notifications, error: notifError } = await supabase
    .from('notifications')
    .select('*')
    .ilike('title', 'New company:%')
    .order('created_at', { ascending: false });
  
  if (notifError) {
    console.error('Error fetching notifications:', notifError);
    return;
  }
  
  console.log(`Found ${notifications?.length || 0} 'New company' notifications\n`);
  
  // Extract unique companies from notifications
  const notifiedCompanies = new Map();
  notifications?.forEach(n => {
    const match = n.title.match(/New company: (.+)/);
    if (match) {
      const company = match[1].trim();
      const tool = n.message.includes('Outreach') ? 'Outreach.io' : 
                   n.message.includes('SalesLoft') ? 'SalesLoft' : 
                   n.message.includes('Both') ? 'Both' : null;
      
      if (tool) {
        const key = `${company}|${tool}`;
        if (!notifiedCompanies.has(key)) {
          notifiedCompanies.set(key, { 
            company, 
            tool,
            notificationId: n.id,
            notificationDate: n.created_at,
            metadata: n.metadata
          });
        }
      }
    }
  });
  
  console.log(`Extracted ${notifiedCompanies.size} unique company+tool combinations\n`);
  
  // Check each against identified_companies
  const missingCompanies = [];
  let checkedCount = 0;
  
  for (const [key, info] of notifiedCompanies) {
    checkedCount++;
    if (checkedCount % 10 === 0) {
      process.stdout.write('.');
    }
    
    const { data: existing } = await supabase
      .from('identified_companies')
      .select('id')
      .eq('company', info.company)
      .eq('tool_detected', info.tool)
      .single();
    
    if (!existing) {
      missingCompanies.push(info);
    }
  }
  
  console.log('\n');
  
  if (missingCompanies.length === 0) {
    console.log('✅ All notified companies are already in the database!\n');
    return;
  }
  
  console.log(`❌ Found ${missingCompanies.length} missing companies:\n`);
  missingCompanies.forEach(c => {
    console.log(`  • ${c.company} (${c.tool})`);
  });
  
  console.log('\n=== RECOVERING MISSING COMPANIES ===\n');
  
  let recovered = 0;
  let failed = 0;
  
  for (const missing of missingCompanies) {
    // Try to find a job for this company to get more context
    const { data: job } = await supabase
      .from('raw_jobs')
      .select('*')
      .eq('company', missing.company)
      .limit(1)
      .single();
    
    const insertData = {
      company: missing.company,
      tool_detected: missing.tool,
      signal_type: 'required', // Default since we don't have the original
      context: 'Recovered from notification',
      job_title: job?.job_title || 'Unknown',
      job_url: job?.job_url || '',
      platform: job?.platform || 'LinkedIn',
      identified_date: missing.notificationDate || new Date().toISOString()
    };
    
    console.log(`Recovering: ${missing.company} (${missing.tool})`);
    
    const { data: inserted, error: insertError } = await supabase
      .from('identified_companies')
      .insert(insertData)
      .select()
      .single();
    
    if (!insertError && inserted && inserted.id) {
      console.log(`  ✅ Recovered successfully! ID: ${inserted.id}`);
      recovered++;
    } else {
      console.log(`  ❌ Failed to recover: ${insertError?.message || 'Unknown error'}`);
      if (insertError?.code === '23505') {
        console.log(`     (May already exist with different casing or spacing)`);
      }
      failed++;
    }
  }
  
  console.log('\n=== RECOVERY COMPLETE ===');
  console.log(`✅ Successfully recovered: ${recovered} companies`);
  console.log(`❌ Failed to recover: ${failed} companies`);
  
  // Clean up duplicate notifications
  console.log('\n=== CLEANING UP DUPLICATE NOTIFICATIONS ===\n');
  
  const { data: allNotifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('notification_type', 'company_discovered')
    .order('created_at', { ascending: true });
  
  const seenCompanies = new Set();
  const duplicateIds = [];
  
  allNotifications?.forEach(n => {
    const key = `${n.metadata?.company}|${n.metadata?.tool}`;
    if (seenCompanies.has(key)) {
      duplicateIds.push(n.id);
    } else {
      seenCompanies.add(key);
    }
  });
  
  if (duplicateIds.length > 0) {
    console.log(`Found ${duplicateIds.length} duplicate notifications`);
    
    // Delete duplicates in batches
    const batchSize = 100;
    for (let i = 0; i < duplicateIds.length; i += batchSize) {
      const batch = duplicateIds.slice(i, i + batchSize);
      const { error: deleteError } = await supabase
        .from('notifications')
        .delete()
        .in('id', batch);
      
      if (deleteError) {
        console.error(`Error deleting duplicates: ${deleteError.message}`);
      } else {
        console.log(`  Deleted batch of ${batch.length} duplicates`);
      }
    }
  } else {
    console.log('No duplicate notifications found');
  }
  
  console.log('\n✅ Recovery script complete!');
}

// Run the recovery
findAndFixMissingCompanies().catch(console.error);