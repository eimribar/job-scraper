/**
 * CompanyDeduplicator Service
 * Intelligent company matching with fuzzy logic and normalization
 */

import { createServerSupabaseClient } from '../supabase';

export interface CompanyMatch {
  id?: string;
  company: string;
  normalized: string;
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'domain' | 'none';
  existingData?: {
    uses_outreach: boolean;
    uses_salesloft: boolean;
    detection_confidence: string;
    last_verified: Date;
    times_seen: number;
    signal_strength: number;
  };
}

export interface DeduplicationResult {
  isKnown: boolean;
  shouldRecheck: boolean;
  match?: CompanyMatch;
  reason?: string;
}

export class CompanyDeduplicator {
  private supabase;
  private companyCache: Map<string, CompanyMatch> = new Map();
  private normalizedCache: Map<string, string> = new Map();
  private lastCacheRefresh: Date = new Date();
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  constructor() {
    this.supabase = createServerSupabaseClient();
    this.loadInitialCache();
  }

  /**
   * Load frequently accessed companies into cache
   */
  private async loadInitialCache(): Promise<void> {
    try {
      const { data: companies } = await this.supabase
        .from('companies')
        .select('*')
        .gt('signal_strength', 0.5)
        .limit(500);

      if (companies) {
        companies.forEach(company => {
          const normalized = this.normalize(company.name);
          this.companyCache.set(normalized, {
            id: company.id,
            company: company.name,
            normalized: company.normalized_name,
            confidence: 1.0,
            matchType: 'exact',
            existingData: {
              uses_outreach: company.uses_outreach,
              uses_salesloft: company.uses_salesloft,
              detection_confidence: company.detection_confidence,
              last_verified: company.last_verified,
              times_seen: company.times_seen,
              signal_strength: company.signal_strength,
            }
          });
        });
      }
    } catch (error) {
      console.error('Failed to load company cache:', error);
    }
  }

  /**
   * Normalize company name for matching
   */
  normalize(company: string): string {
    // Check cache first
    if (this.normalizedCache.has(company)) {
      return this.normalizedCache.get(company)!;
    }

    // Common company suffixes to remove
    const suffixes = [
      // English
      'inc', 'incorporated', 'corp', 'corporation', 'llc', 'ltd', 'limited',
      'co', 'company', 'group', 'holding', 'holdings', 'international', 'intl',
      'usa', 'global', 'partners', 'lp', 'plc',
      // German
      'gmbh', 'ag',
      // Spanish/Portuguese
      'sa', 'spa', 'srl', 'ltda', 'sl', 'sarl', 'sas',
      // Dutch
      'bv', 'nv',
      // Other
      'pty', 'pvt', 'pte', 'ab', 'as', 'oy', 'kg', 'kft', 'doo',
      // Japanese
      'kk', 'kabushiki kaisha', 'kaisha',
      // Industry specific
      'technologies', 'technology', 'tech', 'software', 'solutions', 'services',
      'systems', 'consulting', 'consultants', 'associates', 'advisory', 'advisors',
      'digital', 'labs', 'laboratory', 'laboratories', 'studio', 'studios',
      'media', 'interactive', 'creative', 'design', 'development', 'developers',
      'innovations', 'innovative', 'ventures', 'capital', 'investments',
      'financial', 'finance', 'bank', 'insurance', 'healthcare', 'health',
      'medical', 'pharma', 'pharmaceutical', 'biotech', 'biotechnology'
    ];

    // Build regex pattern
    const suffixPattern = suffixes.join('|');
    const regex = new RegExp(`\\s+(${suffixPattern})\\.?$`, 'gi');

    let normalized = company.toLowerCase()
      .replace(regex, '') // Remove suffixes
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    // Cache the result
    this.normalizedCache.set(company, normalized);
    
    return normalized;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];

    // Edge cases
    if (len1 === 0) return 0;
    if (len2 === 0) return 0;
    if (str1 === str2) return 1;

    // Initialize matrix
    for (let i = 0; i <= len2; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j;
    }

    // Calculate distances
    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    const distance = matrix[len2][len1];
    const maxLength = Math.max(len1, len2);
    return 1 - (distance / maxLength);
  }

  /**
   * Extract domain from company name or URL
   */
  private extractDomain(text: string): string | null {
    // Check if it's already a domain
    const domainRegex = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/;
    const match = text.match(domainRegex);
    
    if (match) {
      return match[1].toLowerCase();
    }

    // Try to construct domain from company name
    const simplified = text.toLowerCase()
      .replace(/[^\w]/g, '')
      .trim();
    
    return simplified.length > 2 ? simplified : null;
  }

  /**
   * Find similar companies using multiple strategies
   */
  async findSimilar(company: string, threshold: number = 0.7): Promise<CompanyMatch[]> {
    const normalized = this.normalize(company);
    const matches: CompanyMatch[] = [];

    // Strategy 1: Check cache for exact match
    if (this.companyCache.has(normalized)) {
      const cached = this.companyCache.get(normalized)!;
      return [{
        ...cached,
        confidence: 1.0,
        matchType: 'exact'
      }];
    }

    // Strategy 2: Database exact match
    try {
      const { data: exactMatch } = await this.supabase
        .from('companies')
        .select('*')
        .eq('normalized_name', normalized)
        .single();

      if (exactMatch) {
        const match: CompanyMatch = {
          id: exactMatch.id,
          company: exactMatch.name,
          normalized: exactMatch.normalized_name,
          confidence: 1.0,
          matchType: 'exact',
          existingData: {
            uses_outreach: exactMatch.uses_outreach,
            uses_salesloft: exactMatch.uses_salesloft,
            detection_confidence: exactMatch.detection_confidence,
            last_verified: exactMatch.last_verified,
            times_seen: exactMatch.times_seen,
            signal_strength: exactMatch.signal_strength,
          }
        };
        matches.push(match);
        return matches;
      }
    } catch (error) {
      // No exact match found
    }

    // Strategy 3: Fuzzy matching in cache
    for (const [cachedNormalized, cachedCompany] of this.companyCache.entries()) {
      const similarity = this.calculateSimilarity(normalized, cachedNormalized);
      
      if (similarity >= threshold) {
        matches.push({
          ...cachedCompany,
          confidence: similarity,
          matchType: 'fuzzy'
        });
      }
    }

    // Strategy 4: Database fuzzy search (if no cache hits)
    if (matches.length === 0) {
      try {
        // PostgreSQL similarity search using trigrams (if extension is available)
        const { data: fuzzyMatches } = await this.supabase
          .rpc('search_similar_companies', {
            search_term: normalized,
            similarity_threshold: threshold
          })
          .limit(5);

        if (fuzzyMatches && fuzzyMatches.length > 0) {
          fuzzyMatches.forEach((match: any) => {
            matches.push({
              id: match.id,
              company: match.name,
              normalized: match.normalized_name,
              confidence: match.similarity,
              matchType: 'fuzzy',
              existingData: {
                uses_outreach: match.uses_outreach,
                uses_salesloft: match.uses_salesloft,
                detection_confidence: match.detection_confidence,
                last_verified: match.last_verified,
                times_seen: match.times_seen,
                signal_strength: match.signal_strength,
              }
            });
          });
        }
      } catch (error) {
        console.warn('Fuzzy search not available, falling back to basic search');
        
        // Fallback: Basic LIKE search
        const searchPattern = `%${normalized.split(' ').join('%')}%`;
        const { data: likeMatches } = await this.supabase
          .from('companies')
          .select('*')
          .ilike('normalized_name', searchPattern)
          .limit(5);

        if (likeMatches) {
          likeMatches.forEach(match => {
            const similarity = this.calculateSimilarity(normalized, match.normalized_name);
            if (similarity >= threshold) {
              matches.push({
                id: match.id,
                company: match.name,
                normalized: match.normalized_name,
                confidence: similarity,
                matchType: 'fuzzy',
                existingData: {
                  uses_outreach: match.uses_outreach,
                  uses_salesloft: match.uses_salesloft,
                  detection_confidence: match.detection_confidence,
                  last_verified: match.last_verified,
                  times_seen: match.times_seen,
                  signal_strength: match.signal_strength,
                }
              });
            }
          });
        }
      }
    }

    // Strategy 5: Domain matching
    const domain = this.extractDomain(company);
    if (domain && matches.length === 0) {
      const { data: domainMatch } = await this.supabase
        .from('companies')
        .select('*')
        .eq('domain', domain)
        .single();

      if (domainMatch) {
        matches.push({
          id: domainMatch.id,
          company: domainMatch.name,
          normalized: domainMatch.normalized_name,
          confidence: 0.8, // Domain matches are pretty reliable
          matchType: 'domain',
          existingData: {
            uses_outreach: domainMatch.uses_outreach,
            uses_salesloft: domainMatch.uses_salesloft,
            detection_confidence: domainMatch.detection_confidence,
            last_verified: domainMatch.last_verified,
            times_seen: domainMatch.times_seen,
            signal_strength: domainMatch.signal_strength,
          }
        });
      }
    }

    // Sort by confidence
    matches.sort((a, b) => b.confidence - a.confidence);
    
    return matches;
  }

  /**
   * Check if company should be rechecked based on confidence and time
   */
  shouldRecheck(company: CompanyMatch): boolean {
    if (!company.existingData) return true;

    const { detection_confidence, last_verified, signal_strength } = company.existingData;
    
    if (!last_verified) return true;

    const daysSinceVerified = (Date.now() - new Date(last_verified).getTime()) / (1000 * 60 * 60 * 24);

    // Recheck strategy based on confidence and signal strength
    if (detection_confidence === 'low' || signal_strength < 0.3) {
      return daysSinceVerified > 7; // Recheck weekly for low confidence
    }
    
    if (detection_confidence === 'medium' || signal_strength < 0.6) {
      return daysSinceVerified > 30; // Recheck monthly for medium confidence
    }
    
    if (detection_confidence === 'high' && signal_strength > 0.8) {
      return daysSinceVerified > 90; // Recheck quarterly for high confidence
    }

    // Default: recheck after 30 days
    return daysSinceVerified > 30;
  }

  /**
   * Main deduplication logic
   */
  async deduplicate(company: string): Promise<DeduplicationResult> {
    // Refresh cache if needed
    if (Date.now() - this.lastCacheRefresh.getTime() > this.CACHE_TTL) {
      await this.loadInitialCache();
      this.lastCacheRefresh = new Date();
    }

    // Find similar companies
    const matches = await this.findSimilar(company, 0.7);

    if (matches.length === 0) {
      return {
        isKnown: false,
        shouldRecheck: false,
        reason: 'New company - no matches found'
      };
    }

    const bestMatch = matches[0];

    // Check if it's a known company
    if (bestMatch.existingData && 
        (bestMatch.existingData.uses_outreach || bestMatch.existingData.uses_salesloft)) {
      
      const shouldRecheck = this.shouldRecheck(bestMatch);
      
      return {
        isKnown: true,
        shouldRecheck,
        match: bestMatch,
        reason: shouldRecheck 
          ? `Known company but needs revalidation (last checked ${bestMatch.existingData.last_verified})`
          : `Known company with ${bestMatch.existingData.detection_confidence} confidence`
      };
    }

    // Company exists but no tools detected yet
    return {
      isKnown: false,
      shouldRecheck: true,
      match: bestMatch,
      reason: 'Company in database but no tools detected yet'
    };
  }

  /**
   * Merge duplicate companies
   */
  async mergeDuplicates(primaryId: string, duplicateIds: string[]): Promise<void> {
    const { error } = await this.supabase.rpc('merge_duplicate_companies', {
      primary_id: primaryId,
      duplicate_ids: duplicateIds
    });

    if (error) {
      throw new Error(`Failed to merge duplicates: ${error.message}`);
    }

    // Refresh cache after merge
    await this.loadInitialCache();
  }

  /**
   * Get deduplication statistics
   */
  async getStats(): Promise<{
    totalCompanies: number;
    uniqueCompanies: number;
    potentialDuplicates: number;
    cacheSize: number;
  }> {
    const { data: stats } = await this.supabase
      .rpc('get_deduplication_stats');

    return {
      totalCompanies: stats?.total_companies || 0,
      uniqueCompanies: stats?.unique_companies || 0,
      potentialDuplicates: stats?.potential_duplicates || 0,
      cacheSize: this.companyCache.size
    };
  }
}