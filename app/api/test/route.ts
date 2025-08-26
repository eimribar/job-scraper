import { NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase';

export async function GET() {
  try {
    console.log('Test API: Starting test...');
    
    // Create Supabase client directly
    const supabase = createApiSupabaseClient();
    
    // Test 1: Get search terms count
    const { count: searchTermsCount, error: searchError } = await supabase
      .from('search_terms')
      .select('*', { count: 'exact', head: true });
    
    if (searchError) {
      console.error('Search terms error:', searchError);
      throw searchError;
    }
    
    // Test 2: Get companies count  
    const { count: companiesCount, error: companiesError } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true });
    
    if (companiesError) {
      console.error('Companies error:', companiesError);
      throw companiesError;
    }
    
    return NextResponse.json({
      success: true,
      data: {
        searchTermsCount,
        companiesCount
      }
    });
    
  } catch (error) {
    console.error('Test API error:', error);
    return NextResponse.json(
      { 
        error: 'Test failed',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}