import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/client';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { leads_generated } = await request.json();
    const supabase = createClient();

    // Update the lead status
    const { data, error } = await supabase
      .from('identified_companies')
      .update({ leads_generated })
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating lead status:', error);
      return NextResponse.json(
        { error: 'Failed to update lead status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      company: data,
    });
  } catch (error) {
    console.error('Error in PATCH /api/companies/[id]/leads:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}