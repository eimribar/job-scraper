/**
 * Google Sheets Service
 * Handles all interactions with Google Sheets API
 */

import { google, sheets_v4 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { 
  RawJob, 
  IdentifiedCompany, 
  SheetRange, 
  SheetUpdate 
} from '@/types';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '10HAtT2kfXSGSRobC1O_z-TcrOuXg7Yc1hGBwHmD_WY4';
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

export class GoogleSheetsService {
  private sheets: sheets_v4.Sheets | null = null;
  private auth: OAuth2Client | null = null;
  private spreadsheetId: string;

  constructor() {
    this.spreadsheetId = SPREADSHEET_ID;
  }

  /**
   * Initialize the Google Sheets client with OAuth2
   */
  async initialize(refreshToken?: string): Promise<void> {
    if (!CLIENT_ID || !CLIENT_SECRET) {
      throw new Error('Google OAuth credentials not configured');
    }

    // Create OAuth2 client
    this.auth = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      process.env.NEXT_PUBLIC_APP_URL 
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`
        : 'http://localhost:3001/api/auth/callback'
    );

    // If we have a refresh token, set credentials
    if (refreshToken) {
      this.auth.setCredentials({
        refresh_token: refreshToken
      });
    }

    // Initialize sheets client
    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
  }

  /**
   * Initialize with service account (for server-side operations)
   */
  async initializeServiceAccount(): Promise<void> {
    // Use OAuth2 with client credentials for now
    if (!CLIENT_ID || !CLIENT_SECRET) {
      throw new Error('Google OAuth credentials not configured');
    }

    // Create OAuth2 client
    this.auth = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      'http://localhost:4001/api/auth/callback'
    );

    // For development, we'll use a simpler approach
    // In production, you'd use a service account or stored refresh token
    this.sheets = google.sheets({ version: 'v4' });
  }

  /**
   * Get OAuth URL for user authorization
   */
  getAuthUrl(): string {
    if (!this.auth) {
      throw new Error('Auth client not initialized');
    }

    return this.auth.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file'
      ]
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokens(code: string): Promise<any> {
    if (!this.auth) {
      throw new Error('Auth client not initialized');
    }

    const { tokens } = await this.auth.getToken(code);
    this.auth.setCredentials(tokens);
    return tokens;
  }

  /**
   * Pull all raw jobs from Google Sheets
   */
  async pullRawJobs(): Promise<RawJob[]> {
    if (!this.sheets) {
      throw new Error('Sheets client not initialized');
    }

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Raw_Jobs!A:M' // All columns including row_number
      });

      const rows = response.data.values;
      if (!rows || rows.length <= 1) {
        return [];
      }

      // Skip header row and map to RawJob objects
      return rows.slice(1).map((row, index) => ({
        job_id: row[0] || '',
        platform: row[1] || 'LinkedIn',
        company: row[2] || '',
        job_title: row[3] || '',
        location: row[4] || '',
        description: row[5] || '',
        job_url: row[6] || '',
        scraped_date: row[7] ? new Date(row[7]) : undefined,
        search_term: row[8] || '',
        processed: row[9] === 'TRUE' || row[9] === 'true',
        analyzed_date: row[10] ? new Date(row[10]) : undefined,
        _stats: row[11] || '',
        row_number: row[12] ? parseInt(row[12]) : undefined,
        sheet_row: index + 2 // Row number in sheet (accounting for header)
      }));
    } catch (error) {
      console.error('Error pulling raw jobs:', error);
      throw error;
    }
  }

  /**
   * Pull all identified companies from Google Sheets
   */
  async pullIdentifiedCompanies(): Promise<IdentifiedCompany[]> {
    if (!this.sheets) {
      throw new Error('Sheets client not initialized');
    }

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'Identified_Companies!A:S' // All columns
      });

      const rows = response.data.values;
      if (!rows || rows.length <= 1) {
        return [];
      }

      // Skip header row and map to IdentifiedCompany objects
      return rows.slice(1).map((row, index) => ({
        company: row[0] || '',
        tool_detected: row[1] || '',
        signal_type: row[2] || '',
        context: row[3] || '',
        job_title: row[4] || '',
        job_url: row[5] || '',
        linkedin_url: row[6] || '',
        platform: row[7] || 'LinkedIn',
        identified_date: row[8] ? new Date(row[8]) : new Date(),
        leads_uploaded: row[9] || '',
        // Column 10 is empty in CSV
        tier_2_leads_uploaded: row[11] || '',
        sponsor_1: row[12] || '',
        sponsor_1_li_url: row[13] || '',
        sponsor_2: row[14] || '',
        sponsor_2_li_url: row[15] || '',
        rep_sdr_bdr: row[16] || '',
        rep_li_url: row[17] || '',
        tags_on_dashboard: row[18] || '',
        sheet_row: index + 2 // Row number in sheet
      }));
    } catch (error) {
      console.error('Error pulling identified companies:', error);
      throw error;
    }
  }

  /**
   * Append a new identified company to the sheet
   */
  async appendIdentifiedCompany(company: IdentifiedCompany): Promise<void> {
    if (!this.sheets) {
      throw new Error('Sheets client not initialized');
    }

    try {
      const values = [[
        company.company,
        company.tool_detected,
        company.signal_type || '',
        company.context || '',
        company.job_title || '',
        company.job_url || '',
        company.linkedin_url || '',
        company.platform || 'LinkedIn',
        new Date().toISOString(),
        company.leads_uploaded || '',
        '', // Empty column
        company.tier_2_leads_uploaded || '',
        company.sponsor_1 || '',
        company.sponsor_1_li_url || '',
        company.sponsor_2 || '',
        company.sponsor_2_li_url || '',
        company.rep_sdr_bdr || '',
        company.rep_li_url || '',
        company.tags_on_dashboard || ''
      ]];

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'Identified_Companies!A:S',
        valueInputOption: 'RAW',
        requestBody: {
          values
        }
      });
    } catch (error) {
      console.error('Error appending identified company:', error);
      throw error;
    }
  }

  /**
   * Update a job's processed status in the sheet
   */
  async updateJobProcessedStatus(
    sheetRow: number, 
    processed: boolean = true
  ): Promise<void> {
    if (!this.sheets) {
      throw new Error('Sheets client not initialized');
    }

    try {
      const values = [[
        processed ? 'TRUE' : 'FALSE',
        new Date().toISOString()
      ]];

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `Raw_Jobs!J${sheetRow}:K${sheetRow}`,
        valueInputOption: 'RAW',
        requestBody: {
          values
        }
      });
    } catch (error) {
      console.error('Error updating job processed status:', error);
      throw error;
    }
  }

  /**
   * Batch update multiple rows
   */
  async batchUpdate(updates: SheetUpdate[]): Promise<void> {
    if (!this.sheets) {
      throw new Error('Sheets client not initialized');
    }

    try {
      const data = updates.map(update => ({
        range: update.range,
        values: update.values
      }));

      await this.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data
        }
      });
    } catch (error) {
      console.error('Error batch updating:', error);
      throw error;
    }
  }

  /**
   * Get sheet metadata (last modified time, etc.)
   */
  async getSheetMetadata(): Promise<any> {
    if (!this.sheets) {
      throw new Error('Sheets client not initialized');
    }

    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
        includeGridData: false
      });

      return {
        title: response.data.properties?.title,
        sheets: response.data.sheets?.map(sheet => ({
          id: sheet.properties?.sheetId,
          title: sheet.properties?.title,
          rowCount: sheet.properties?.gridProperties?.rowCount,
          columnCount: sheet.properties?.gridProperties?.columnCount
        }))
      };
    } catch (error) {
      console.error('Error getting sheet metadata:', error);
      throw error;
    }
  }

  /**
   * Watch for changes in the spreadsheet (for webhooks)
   */
  async watchSpreadsheet(webhookUrl: string): Promise<any> {
    if (!this.auth) {
      throw new Error('Auth client not initialized');
    }

    const drive = google.drive({ version: 'v3', auth: this.auth });
    
    try {
      const response = await drive.files.watch({
        fileId: this.spreadsheetId,
        requestBody: {
          id: `watch-${Date.now()}`,
          type: 'web_hook',
          address: webhookUrl
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error setting up watch:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const googleSheetsService = new GoogleSheetsService();