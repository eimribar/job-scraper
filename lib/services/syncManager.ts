/**
 * Sync Manager
 * Handles two-way synchronization between Supabase and Google Sheets
 */

import { createApiSupabaseClient } from '@/lib/supabase';
import { googleSheetsService } from './googleSheetsService';
import { 
  RawJob, 
  IdentifiedCompany, 
  SyncStatus, 
  SyncResult 
} from '@/types';
import { RealtimeChannel } from '@supabase/supabase-js';

export class SyncManager {
  private supabase;
  private sheets;
  private syncChannel: RealtimeChannel | null = null;
  private isSyncing: boolean = false;

  constructor() {
    this.supabase = createApiSupabaseClient();
    this.sheets = googleSheetsService;
  }

  /**
   * Initialize sync manager and set up real-time listeners
   */
  async initialize(): Promise<void> {
    // Initialize Google Sheets service
    await this.sheets.initializeServiceAccount();
    
    // Set up real-time listeners for Supabase changes
    this.subscribeToSupabaseChanges();
    
    console.log('Sync Manager initialized');
  }

  /**
   * Perform initial full sync from Google Sheets to Supabase
   */
  async initialSync(): Promise<SyncResult[]> {
    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    this.isSyncing = true;
    const results: SyncResult[] = [];

    try {
      // Update sync status
      await this.updateSyncStatus('raw_jobs', 'syncing');
      await this.updateSyncStatus('identified_companies', 'syncing');

      // Pull raw jobs from Sheets
      console.log('Pulling raw jobs from Google Sheets...');
      const rawJobs = await this.sheets.pullRawJobs();
      
      // Upsert to Supabase
      if (rawJobs.length > 0) {
        const { error: jobsError } = await this.supabase
          .from('raw_jobs')
          .upsert(rawJobs, { 
            onConflict: 'job_id',
            ignoreDuplicates: false 
          });

        if (jobsError) {
          throw jobsError;
        }

        results.push({
          success: true,
          table: 'raw_jobs',
          rowsAffected: rawJobs.length
        });
      }

      // Pull identified companies from Sheets
      console.log('Pulling identified companies from Google Sheets...');
      const companies = await this.sheets.pullIdentifiedCompanies();
      
      // Upsert to Supabase
      if (companies.length > 0) {
        const { error: companiesError } = await this.supabase
          .from('identified_companies')
          .upsert(companies, { 
            onConflict: 'sheet_row',
            ignoreDuplicates: false 
          });

        if (companiesError) {
          throw companiesError;
        }

        results.push({
          success: true,
          table: 'identified_companies',
          rowsAffected: companies.length
        });
      }

      // Update sync status
      await this.updateSyncStatus('raw_jobs', 'completed', rawJobs.length);
      await this.updateSyncStatus('identified_companies', 'completed', companies.length);

      console.log('Initial sync completed successfully');
      return results;

    } catch (error) {
      console.error('Initial sync error:', error);
      
      // Update sync status with error
      await this.updateSyncStatus('raw_jobs', 'error', 0, String(error));
      await this.updateSyncStatus('identified_companies', 'error', 0, String(error));
      
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync changes from Supabase to Google Sheets
   */
  async syncToSheets(table: string, data: any): Promise<void> {
    try {
      if (table === 'identified_companies' && !data.sheet_row) {
        // New company identified - append to sheet
        await this.sheets.appendIdentifiedCompany(data as IdentifiedCompany);
        
        // Get the new sheet row and update Supabase
        const sheetData = await this.sheets.pullIdentifiedCompanies();
        const lastRow = sheetData[sheetData.length - 1];
        
        if (lastRow && lastRow.sheet_row) {
          await this.supabase
            .from('identified_companies')
            .update({ sheet_row: lastRow.sheet_row })
            .eq('id', data.id);
        }
      } else if (table === 'raw_jobs' && data.processed && data.sheet_row) {
        // Job processed - update sheet
        await this.sheets.updateJobProcessedStatus(data.sheet_row, true);
      }
      
      console.log(`Synced ${table} to Google Sheets`);
    } catch (error) {
      console.error(`Error syncing ${table} to Sheets:`, error);
      throw error;
    }
  }

  /**
   * Sync changes from Google Sheets to Supabase
   */
  async syncFromSheets(): Promise<SyncResult[]> {
    const results: SyncResult[] = [];

    try {
      // Get latest data from Sheets
      const rawJobs = await this.sheets.pullRawJobs();
      const companies = await this.sheets.pullIdentifiedCompanies();

      // Get existing data from Supabase
      const { data: existingJobs } = await this.supabase
        .from('raw_jobs')
        .select('job_id, sheet_row, updated_at');

      const { data: existingCompanies } = await this.supabase
        .from('identified_companies')
        .select('id, sheet_row, updated_at');

      // Find new or updated jobs
      const jobsToUpsert = rawJobs.filter(job => {
        const existing = existingJobs?.find(e => e.job_id === job.job_id);
        return !existing || this.isNewer(job, existing);
      });

      if (jobsToUpsert.length > 0) {
        const { error } = await this.supabase
          .from('raw_jobs')
          .upsert(jobsToUpsert, { onConflict: 'job_id' });

        if (error) throw error;

        results.push({
          success: true,
          table: 'raw_jobs',
          rowsAffected: jobsToUpsert.length
        });
      }

      // Find new or updated companies
      const companiesToUpsert = companies.filter(company => {
        const existing = existingCompanies?.find(e => e.sheet_row === company.sheet_row);
        return !existing || this.isNewer(company, existing);
      });

      if (companiesToUpsert.length > 0) {
        const { error } = await this.supabase
          .from('identified_companies')
          .upsert(companiesToUpsert, { onConflict: 'sheet_row' });

        if (error) throw error;

        results.push({
          success: true,
          table: 'identified_companies',
          rowsAffected: companiesToUpsert.length
        });
      }

      return results;
    } catch (error) {
      console.error('Error syncing from Sheets:', error);
      throw error;
    }
  }

  /**
   * Subscribe to Supabase real-time changes
   */
  private subscribeToSupabaseChanges(): void {
    // Subscribe to raw_jobs changes
    this.syncChannel = this.supabase
      .channel('sync-channel')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'raw_jobs' 
        },
        async (payload) => {
          console.log('Raw jobs change detected:', payload.eventType);
          if (payload.eventType === 'UPDATE' && payload.new.processed) {
            await this.syncToSheets('raw_jobs', payload.new);
          }
        }
      )
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'identified_companies' 
        },
        async (payload) => {
          console.log('New company identified:', payload.new.company);
          await this.syncToSheets('identified_companies', payload.new);
        }
      )
      .subscribe();

    console.log('Subscribed to Supabase real-time changes');
  }

  /**
   * Unsubscribe from real-time changes
   */
  async unsubscribe(): Promise<void> {
    if (this.syncChannel) {
      await this.supabase.removeChannel(this.syncChannel);
      this.syncChannel = null;
    }
  }

  /**
   * Update sync status in database
   */
  private async updateSyncStatus(
    tableName: string, 
    status: 'pending' | 'syncing' | 'completed' | 'error',
    rowsSynced: number = 0,
    errorMessage?: string
  ): Promise<void> {
    const now = new Date().toISOString();
    
    await this.supabase
      .from('sync_status')
      .upsert({
        table_name: tableName,
        sync_status: status,
        last_sync_from_sheets: status === 'completed' ? now : undefined,
        rows_synced: rowsSynced,
        error_message: errorMessage,
        updated_at: now
      }, {
        onConflict: 'table_name'
      });
  }

  /**
   * Get current sync status
   */
  async getSyncStatus(): Promise<SyncStatus[]> {
    const { data, error } = await this.supabase
      .from('sync_status')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  }

  /**
   * Check if source data is newer than target
   */
  private isNewer(source: any, target: any): boolean {
    if (!target.updated_at) return true;
    if (!source.updated_at) return false;
    
    return new Date(source.updated_at) > new Date(target.updated_at);
  }

  /**
   * Handle webhook from Google Sheets
   */
  async handleSheetWebhook(changeData: any): Promise<void> {
    console.log('Sheet webhook received:', changeData);
    
    // Trigger sync from sheets
    await this.syncFromSheets();
  }

  /**
   * Force full re-sync (both directions)
   */
  async forceFullSync(): Promise<SyncResult[]> {
    console.log('Starting forced full sync...');
    
    // First sync from Sheets to Supabase
    const fromSheets = await this.syncFromSheets();
    
    // Then sync any pending changes back to Sheets
    const { data: pendingCompanies } = await this.supabase
      .from('identified_companies')
      .select('*')
      .is('sheet_row', null);

    if (pendingCompanies && pendingCompanies.length > 0) {
      for (const company of pendingCompanies) {
        await this.syncToSheets('identified_companies', company);
      }
    }

    return fromSheets;
  }
}

// Export singleton instance
export const syncManager = new SyncManager();