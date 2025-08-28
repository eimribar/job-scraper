#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function createApiSupabaseClient() {
  return createClient(supabaseUrl, supabaseKey);
}

async function analyzeNewDiscoveries() {
  console.log('📊 ANALYZING NEW DISCOVERIES VS GOOGLE SHEETS');
  console.log('='.repeat(60));
  
  const supabase = createApiSupabaseClient();
  
  try {
    // Step 1: Get counts by source (assumes source column exists)
    console.log('\n1️⃣ Analyzing company sources...');
    
    // Note: If source column doesn't exist yet, we'll use identified_date as a proxy
    const googleSheetsCutoff = '2025-07-01T00:00:00Z';
    
    // Count Google Sheets companies (before July 2025)
    const { count: googleSheetsCount, error: gsError } = await supabase
      .from('identified_companies')
      .select('*', { count: 'exact', head: true })
      .lt('identified_date', googleSheetsCutoff);
    
    if (gsError) {
      console.error('Error counting Google Sheets companies:', gsError);
      return;
    }
    
    // Count job analysis companies (after July 2025)
    const { count: jobAnalysisCount, error: jaError } = await supabase
      .from('identified_companies')
      .select('*', { count: 'exact', head: true })
      .gte('identified_date', googleSheetsCutoff);
    
    if (jaError) {
      console.error('Error counting job analysis companies:', jaError);
      return;
    }
    
    console.log(`\n📈 Source Distribution:`);
    console.log(`   Google Sheets (imported June 2025): ${googleSheetsCount} companies`);
    console.log(`   Job Analysis (discovered after July): ${jobAnalysisCount} companies`);
    console.log(`   Total: ${googleSheetsCount + jobAnalysisCount} companies`);
    
    // Step 2: Show new discoveries by tool
    console.log('\n2️⃣ New discoveries by tool (not in Google Sheets):');
    
    const { data: newDiscoveries, error: ndError } = await supabase
      .from('identified_companies')
      .select('tool_detected')
      .gte('identified_date', googleSheetsCutoff);
    
    if (ndError) {
      console.error('Error fetching new discoveries:', ndError);
      return;
    }
    
    const toolCounts = {};
    newDiscoveries.forEach(company => {
      const tool = company.tool_detected || 'Unknown';
      toolCounts[tool] = (toolCounts[tool] || 0) + 1;
    });
    
    Object.entries(toolCounts).forEach(([tool, count]) => {
      console.log(`   ${tool}: ${count} companies`);
    });
    
    // Step 3: Show recent discoveries
    console.log('\n3️⃣ Most recent NEW discoveries (last 10):');
    
    const { data: recentNew, error: recentError } = await supabase
      .from('identified_companies')
      .select('company_name, tool_detected, identified_date, confidence')
      .gte('identified_date', googleSheetsCutoff)
      .order('identified_date', { ascending: false })
      .limit(10);
    
    if (recentError) {
      console.error('Error fetching recent discoveries:', recentError);
      return;
    }
    
    recentNew.forEach(company => {
      const date = new Date(company.identified_date);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      console.log(`   ${company.company_name} (${company.tool_detected}) - ${dateStr} [${company.confidence}]`);
    });
    
    // Step 4: Show breakdown by confidence level
    console.log('\n4️⃣ New discoveries by confidence level:');
    
    const confidenceCounts = { high: 0, medium: 0, low: 0 };
    newDiscoveries.forEach(company => {
      const confidence = company.confidence || 'low';
      confidenceCounts[confidence] = (confidenceCounts[confidence] || 0) + 1;
    });
    
    const { data: confidenceData, error: confError } = await supabase
      .from('identified_companies')
      .select('confidence')
      .gte('identified_date', googleSheetsCutoff);
    
    if (!confError && confidenceData) {
      const counts = { high: 0, medium: 0, low: 0 };
      confidenceData.forEach(c => {
        counts[c.confidence || 'low']++;
      });
      
      Object.entries(counts).forEach(([level, count]) => {
        const percentage = ((count / jobAnalysisCount) * 100).toFixed(1);
        console.log(`   ${level}: ${count} companies (${percentage}%)`);
      });
    }
    
    // Step 5: Value assessment
    console.log('\n5️⃣ VALUE ASSESSMENT:');
    console.log(`   🆕 New companies discovered: ${jobAnalysisCount}`);
    console.log(`   📊 Discovery rate: ${((jobAnalysisCount / (googleSheetsCount + jobAnalysisCount)) * 100).toFixed(1)}% of total`);
    
    // Calculate approximate value
    const avgDealSize = 30000; // Example: $30k average deal
    const conversionRate = 0.02; // Example: 2% conversion rate
    const potentialValue = jobAnalysisCount * avgDealSize * conversionRate;
    
    console.log(`   💰 Potential pipeline value: $${potentialValue.toLocaleString()} (at 2% conversion, $30k ACV)`);
    
    // Step 6: Recommendations
    console.log('\n6️⃣ RECOMMENDATIONS:');
    console.log('   ✅ Show BDRs only "New Discoveries" by default (exclude Google Sheets)');
    console.log('   ✅ Add filter toggle: "Show all" vs "Show new only"');
    console.log('   ✅ Highlight companies discovered in last 7 days');
    console.log('   ✅ Track conversion metrics for new vs imported companies');
    
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

analyzeNewDiscoveries().catch(console.error);