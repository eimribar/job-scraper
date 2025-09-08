import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = createApiSupabaseClient();
    const { searchParams } = new URL(request.url);
    
    // Get query parameters
    const search = searchParams.get('search') || undefined;
    const tool = searchParams.get('tool') || undefined;
    const leadStatus = searchParams.get('leadStatus') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    
    // Get all Tier 1 companies first for total count and stats
    let tier1Query = supabase
      .from('tier_one_companies')
      .select('*')
      .order('company_name', { ascending: true });
    
    if (search) {
      tier1Query = tier1Query.ilike('company_name', `%${search}%`);
    }
    
    const { data: allTier1Companies, error: tier1Error } = await tier1Query;
    
    if (tier1Error) {
      throw tier1Error;
    }
    
    // Get all identified companies for Tier 1
    const { data: identifiedCompanies, error: identifiedError } = await supabase
      .from('identified_companies')
      .select('company, tool_detected, identified_date, leads_generated, leads_generated_date')
      .eq('tier', 'Tier 1');
    
    if (identifiedError) {
      throw identifiedError;
    }
    
    // Create a map for quick lookup
    const identifiedMap = new Map(
      identifiedCompanies.map(c => [c.company.toLowerCase().trim(), c])
    );
    
    // Combine the data
    let combinedData = allTier1Companies.map(tier1 => {
      const normalizedName = tier1.company_name.toLowerCase().trim();
      const identified = identifiedMap.get(normalizedName);
      
      return {
        ...tier1,
        is_identified: !!identified,
        identified_date: identified?.identified_date || null,
        detected_tool: identified?.tool_detected || tier1.tool_detected || 'Not Identified Yet',
        leads_generated: identified?.leads_generated || tier1.leads_in_system > 0,
        leads_generated_date: identified?.leads_generated_date || null,
      };
    });
    
    // Apply filters
    if (tool && tool !== 'all') {
      combinedData = combinedData.filter(c => {
        if (!c.is_identified) return false;
        const toolLower = c.detected_tool?.toLowerCase() || '';
        const searchTool = tool.toLowerCase();
        return toolLower.includes(searchTool) || 
               toolLower.includes(searchTool.replace('.io', '')) ||
               toolLower.includes(searchTool.replace('salesloft', 'sales loft'));
      });
    }
    
    if (leadStatus && leadStatus !== 'all') {
      if (leadStatus === 'with_leads') {
        combinedData = combinedData.filter(c => c.leads_generated);
      } else if (leadStatus === 'without_leads') {
        combinedData = combinedData.filter(c => !c.leads_generated);
      }
    }
    
    // Calculate statistics AFTER filtering
    const stats = {
      total: allTier1Companies.length, // Total should always be all Tier 1 companies
      identified: allTier1Companies.filter(c => {
        const normalizedName = c.company_name.toLowerCase().trim();
        return identifiedMap.has(normalizedName);
      }).length,
      unidentified: allTier1Companies.filter(c => {
        const normalizedName = c.company_name.toLowerCase().trim();
        return !identifiedMap.has(normalizedName);
      }).length,
      with_leads: combinedData.filter(c => c.leads_generated).length,
      engaged: combinedData.filter(c => c.engaged).length,
      coverage: Math.round((allTier1Companies.filter(c => {
        const normalizedName = c.company_name.toLowerCase().trim();
        return identifiedMap.has(normalizedName);
      }).length / allTier1Companies.length) * 100),
    };
    
    // Apply pagination to the filtered data
    const paginatedData = combinedData.slice(offset, offset + limit);
    
    return NextResponse.json({
      success: true,
      companies: paginatedData,
      stats,
      totalCount: combinedData.length, // Total count after filtering
      page,
      limit,
    });
    
  } catch (error) {
    console.error('Error fetching Tier 1 companies:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch Tier 1 companies',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}