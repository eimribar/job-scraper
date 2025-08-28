-- Create identified_companies table for tracking tool detections
-- This table stores companies where Outreach.io or SalesLoft was detected

CREATE TABLE IF NOT EXISTS public.identified_companies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_name TEXT NOT NULL,
    tool_detected TEXT NOT NULL CHECK (tool_detected IN ('Outreach.io', 'SalesLoft', 'Both', 'None')),
    signal_type TEXT NOT NULL CHECK (signal_type IN ('explicit_mention', 'integration_requirement', 'process_indicator', 'none')),
    context TEXT,
    confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
    job_title TEXT,
    job_url TEXT,
    platform TEXT DEFAULT 'LinkedIn',
    identified_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_identified_companies_company ON identified_companies(company_name);
CREATE INDEX IF NOT EXISTS idx_identified_companies_tool ON identified_companies(tool_detected);
CREATE INDEX IF NOT EXISTS idx_identified_companies_date ON identified_companies(identified_date);

-- Enable RLS (Row Level Security) if needed
-- ALTER TABLE identified_companies ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON identified_companies TO authenticated;
GRANT ALL ON identified_companies TO anon;