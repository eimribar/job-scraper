import { NextRequest, NextResponse } from 'next/server';
import { DataService } from '@/lib/services/dataService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyId, leadsGenerated, notes, generatedBy } = body;

    if (!companyId) {
      return NextResponse.json(
        { success: false, error: 'Company ID is required' },
        { status: 400 }
      );
    }

    const dataService = new DataService();
    await dataService.updateLeadStatus(companyId, leadsGenerated, notes, generatedBy);

    return NextResponse.json({
      success: true,
      message: `Lead status updated for company ${companyId}`
    });
  } catch (error: any) {
    console.error('Error updating lead status:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update lead status' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyIds, leadsGenerated, generatedBy } = body;

    if (!companyIds || !Array.isArray(companyIds) || companyIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Company IDs array is required' },
        { status: 400 }
      );
    }

    const dataService = new DataService();
    await dataService.bulkUpdateLeadStatus(companyIds, leadsGenerated, generatedBy);

    return NextResponse.json({
      success: true,
      message: `Lead status updated for ${companyIds.length} companies`
    });
  } catch (error: any) {
    console.error('Error bulk updating lead status:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to bulk update lead status' },
      { status: 500 }
    );
  }
}