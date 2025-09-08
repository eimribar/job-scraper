import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, leadsGenerated, generatedBy } = body;

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'Company ID is required' },
        { status: 400 }
      );
    }

    const supabase = createApiSupabaseClient();
    
    // First, get the tier_one_company record
    const { data: tierOneCompany, error: fetchError } = await supabase
      .from('tier_one_companies')
      .select('*')
      .eq('id', companyId)
      .single();
    
    if (fetchError || !tierOneCompany) {
      console.error('Error fetching tier one company:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Company not found' },
        { status: 404 }
      );
    }
    
    // Update the tier_one_companies table
    const { error: tier1UpdateError } = await supabase
      .from('tier_one_companies')
      .update({ 
        leads_in_system: leadsGenerated ? (tierOneCompany.leads_in_system || 1) : 0
      })
      .eq('id', companyId);
    
    if (tier1UpdateError) {
      console.error('Error updating tier_one_companies:', tier1UpdateError);
      throw tier1UpdateError;
    }
    
    // Check if there's a corresponding record in identified_companies
    const { data: identifiedCompany } = await supabase
      .from('identified_companies')
      .select('id')
      .ilike('company', tierOneCompany.company_name)
      .eq('tier', 'Tier 1')
      .single();
    
    if (identifiedCompany) {
      // Update the existing identified_companies record
      const updateData: any = {
        leads_generated: leadsGenerated
      };
      
      if (leadsGenerated) {
        updateData.leads_generated_date = new Date().toISOString();
        updateData.leads_generated_by = generatedBy || 'Manual Update - Tier 1';
      } else {
        updateData.leads_generated_date = null;
        updateData.leads_generated_by = null;
      }
      
      const { error: identifiedUpdateError } = await supabase
        .from('identified_companies')
        .update(updateData)
        .eq('id', identifiedCompany.id);
      
      if (identifiedUpdateError) {
        console.error('Error updating identified_companies:', identifiedUpdateError);
        // Don't throw here, as the main update succeeded
      }
    }

    return NextResponse.json({
      success: true,
      message: `Lead status updated for ${tierOneCompany.company_name}`
    });
  } catch (error: any) {
    console.error('Error updating Tier 1 lead status:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update lead status' },
      { status: 500 }
    );
  }
}