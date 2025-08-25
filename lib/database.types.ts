export interface Database {
  public: {
    Tables: {
      jobs: {
        Row: {
          id: string
          job_id: string
          platform: string
          company: string
          job_title: string
          location: string
          description: string
          job_url: string
          scraped_date: string
          search_term: string
          processed: boolean
          analyzed_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          job_id: string
          platform: string
          company: string
          job_title: string
          location: string
          description: string
          job_url: string
          scraped_date: string
          search_term: string
          processed?: boolean
          analyzed_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          job_id?: string
          platform?: string
          company?: string
          job_title?: string
          location?: string
          description?: string
          job_url?: string
          scraped_date?: string
          search_term?: string
          processed?: boolean
          analyzed_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      identified_companies: {
        Row: {
          id: string
          company_name: string
          tool_detected: string
          signal_type: string
          context: string
          confidence: string
          job_title: string
          job_url: string
          platform: string
          identified_date: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_name: string
          tool_detected: string
          signal_type: string
          context: string
          confidence: string
          job_title: string
          job_url: string
          platform: string
          identified_date: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_name?: string
          tool_detected?: string
          signal_type?: string
          context?: string
          confidence?: string
          job_title?: string
          job_url?: string
          platform?: string
          identified_date?: string
          created_at?: string
          updated_at?: string
        }
      }
      search_terms: {
        Row: {
          id: string
          search_term: string
          last_scraped_date: string | null
          jobs_found_count: number
          platform_last_scraped: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          search_term: string
          last_scraped_date?: string | null
          jobs_found_count?: number
          platform_last_scraped?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          search_term?: string
          last_scraped_date?: string | null
          jobs_found_count?: number
          platform_last_scraped?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      processed_ids: {
        Row: {
          id: string
          job_id: string
          processed_date: string
          created_at: string
        }
        Insert: {
          id?: string
          job_id: string
          processed_date: string
          created_at?: string
        }
        Update: {
          id?: string
          job_id?: string
          processed_date?: string
          created_at?: string
        }
      }
      scraping_runs: {
        Row: {
          id: string
          run_date: string
          search_term: string
          total_scraped: number
          new_jobs: number
          duplicates: number
          errors: number
          success: boolean
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          run_date: string
          search_term: string
          total_scraped: number
          new_jobs: number
          duplicates: number
          errors: number
          success: boolean
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          run_date?: string
          search_term?: string
          total_scraped?: number
          new_jobs?: number
          duplicates?: number
          errors?: number
          success?: boolean
          error_message?: string | null
          created_at?: string
        }
      }
    }
  }
}