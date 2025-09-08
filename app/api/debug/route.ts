import { NextResponse } from 'next/server';
import { createApiSupabaseClient } from '@/lib/supabase';

export async function GET() {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    isVercel: !!process.env.VERCEL,
    envVars: {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      nodeEnv: process.env.NODE_ENV,
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
    },
    supabase: {
      clientCreated: false,
      connectionTest: null,
      tableTests: {}
    },
    errors: []
  };

  try {
    // Test Supabase client creation
    const supabase = createApiSupabaseClient();
    diagnostics.supabase.clientCreated = !!supabase;
    
    if (!supabase) {
      diagnostics.errors.push('Supabase client is null');
      return NextResponse.json(diagnostics, { status: 500 });
    }

    // Test basic connection
    try {
      const { error: pingError } = await supabase.from('identified_companies').select('id').limit(1);
      diagnostics.supabase.connectionTest = pingError ? `Failed: ${pingError.message}` : 'Success';
    } catch (e) {
      diagnostics.supabase.connectionTest = `Exception: ${e instanceof Error ? e.message : 'Unknown error'}`;
    }

    // Test each table
    const tables = ['identified_companies', 'tier_one_companies', 'raw_jobs'];
    
    for (const table of tables) {
      try {
        const { data, error, count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: false })
          .limit(1);
        
        if (error) {
          diagnostics.supabase.tableTests[table] = {
            status: 'error',
            message: error.message,
            count: 0
          };
        } else {
          diagnostics.supabase.tableTests[table] = {
            status: 'success',
            count: count || 0,
            hasData: (data && data.length > 0) || false
          };
        }
      } catch (e) {
        diagnostics.supabase.tableTests[table] = {
          status: 'exception',
          message: e instanceof Error ? e.message : 'Unknown error',
          count: 0
        };
      }
    }

    // Test specific queries used by the app
    try {
      const { data: dashboardData, error: dashboardError } = await supabase
        .from('identified_companies')
        .select('company, tool_detected, identified_date')
        .limit(5);
      
      diagnostics.queries = {
        dashboard: dashboardError ? `Error: ${dashboardError.message}` : `Success (${dashboardData?.length || 0} rows)`
      };
    } catch (e) {
      diagnostics.queries = {
        dashboard: `Exception: ${e instanceof Error ? e.message : 'Unknown'}`
      };
    }

    // Add summary
    diagnostics.summary = {
      allEnvironmentVarsSet: Object.values(diagnostics.envVars).every(v => v === true),
      supabaseWorking: diagnostics.supabase.clientCreated && diagnostics.supabase.connectionTest === 'Success',
      tablesAccessible: Object.values(diagnostics.supabase.tableTests).every((t: any) => t.status === 'success'),
      totalCompanies: diagnostics.supabase.tableTests.identified_companies?.count || 0,
      totalTier1: diagnostics.supabase.tableTests.tier_one_companies?.count || 0,
      totalJobs: diagnostics.supabase.tableTests.raw_jobs?.count || 0,
    };

    const statusCode = diagnostics.summary.supabaseWorking ? 200 : 500;
    return NextResponse.json(diagnostics, { status: statusCode });

  } catch (error) {
    diagnostics.errors.push(`Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return NextResponse.json(diagnostics, { status: 500 });
  }
}