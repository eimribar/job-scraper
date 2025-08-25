-- Create jobs table
CREATE TABLE IF NOT EXISTS jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id TEXT UNIQUE NOT NULL,
    platform TEXT NOT NULL,
    company TEXT NOT NULL,
    job_title TEXT NOT NULL,
    location TEXT,
    description TEXT,
    job_url TEXT,
    scraped_date TIMESTAMP WITH TIME ZONE NOT NULL,
    search_term TEXT NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    analyzed_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create identified_companies table
CREATE TABLE IF NOT EXISTS identified_companies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_name TEXT NOT NULL,
    tool_detected TEXT NOT NULL,
    signal_type TEXT NOT NULL,
    context TEXT,
    confidence TEXT NOT NULL,
    job_title TEXT NOT NULL,
    job_url TEXT,
    platform TEXT NOT NULL,
    identified_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create search_terms table
CREATE TABLE IF NOT EXISTS search_terms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    search_term TEXT UNIQUE NOT NULL,
    last_scraped_date TIMESTAMP WITH TIME ZONE,
    jobs_found_count INTEGER DEFAULT 0,
    platform_last_scraped TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create processed_ids table
CREATE TABLE IF NOT EXISTS processed_ids (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id TEXT NOT NULL,
    processed_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create scraping_runs table
CREATE TABLE IF NOT EXISTS scraping_runs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    run_date TIMESTAMP WITH TIME ZONE NOT NULL,
    search_term TEXT NOT NULL,
    total_scraped INTEGER DEFAULT 0,
    new_jobs INTEGER DEFAULT 0,
    duplicates INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default search terms
INSERT INTO search_terms (search_term) VALUES 
    ('SDR'), 
    ('BDR'), 
    ('Sales Development'),
    ('Revenue Operations'),
    ('Sales Manager')
ON CONFLICT (search_term) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_job_id ON jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company);
CREATE INDEX IF NOT EXISTS idx_jobs_processed ON jobs(processed);
CREATE INDEX IF NOT EXISTS idx_jobs_scraped_date ON jobs(scraped_date);
CREATE INDEX IF NOT EXISTS idx_identified_companies_name ON identified_companies(company_name);
CREATE INDEX IF NOT EXISTS idx_identified_companies_tool ON identified_companies(tool_detected);
CREATE INDEX IF NOT EXISTS idx_identified_companies_date ON identified_companies(identified_date);
CREATE INDEX IF NOT EXISTS idx_search_terms_active ON search_terms(active);
CREATE INDEX IF NOT EXISTS idx_processed_ids_job_id ON processed_ids(job_id);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_jobs_updated_at 
    BEFORE UPDATE ON jobs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_identified_companies_updated_at 
    BEFORE UPDATE ON identified_companies 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_search_terms_updated_at 
    BEFORE UPDATE ON search_terms 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();