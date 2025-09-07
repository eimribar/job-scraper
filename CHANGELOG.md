# Changelog

All notable changes to the Sales Tool Detector project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2025-09-07

### Fixed
- **Critical React Closure Trap**: Fixed processing widget showing stuck job counter at 840
  - Eliminated `useCallback` with empty dependency array causing stale closure
  - Moved `fetchProcessingStatus` function inside `useEffect` for fresh references
  - Jobs analyzed counter now updates live as queue decreases

- **Missing analyzed_date Field**: Fixed dataService.markJobAsProcessed() not setting analyzed_date
  - Added `analyzed_date: new Date().toISOString()` to update query
  - Retroactively updated 390 orphaned jobs with processed=true but analyzed_date=NULL
  - Result: Jobs analyzed today now correctly shows 1,231 (841 + 390 recovered)

- **Dashboard UI White Space**: Eliminated excessive white space throughout dashboard
  - Reduced padding from py-8 to py-3, space-y-8 to space-y-3
  - Compacted Lead Coverage Widget (p-6 to p-3, reduced font sizes)
  - Fixed Live Activity Feed height constraints (removed fixed height)
  - Added items-start to grid for proper alignment

### Added
- **Real-time Subscriptions**: Added Supabase real-time channel subscription to raw_jobs table
  - Processing widget now subscribes to UPDATE events on raw_jobs
  - Dashboard updates instantly when jobs are processed
  - Polling continues every 5 seconds as backup

- **Lead Coverage Widget**: New dashboard widget showing lead coverage statistics
- **Live Activity Feed**: Real-time feed of processing activities
- **Processing Widget**: Enhanced with real-time updates and queue status
- **Automation Features**: New automation page and search terms management

### Changed
- **Dashboard Layout**: Complete redesign for better space utilization
  - Reduced component padding and spacing
  - Optimized grid layout with proper alignment
  - Improved visual hierarchy with consistent sizing

### Technical Details
- Fixed React useEffect dependency array issues
- Improved TypeScript type safety in components
- Enhanced error handling in job processors
- Added comprehensive logging for debugging

## [2.0.0] - 2025-09-02

### Added
- **GPT-5 Integration**: Complete integration with OpenAI's GPT-5 Mini via Responses API
- **Google Sheets Sync**: Two-way synchronization with existing data sources
- **Continuous Processing**: Batch processing of 25-50 jobs with smart deduplication
- **Smart Detection**: High-precision identification with duplicate prevention
- **Real-time Dashboard**: Live processing statistics and company discoveries

### Fixed
- **Schema Mismatch**: Removed confidence field that wasn't in database schema
- **Service Role Key**: Fixed wrong project key, now using anon key
- **Unique Constraint**: Added existence check before insert (constraint to be added manually)

### Stats
- 13,628 jobs processed
- 721 companies identified (504 Outreach.io, 206 SalesLoft, 11 both)
- Processing rate: ~86 jobs per 30 seconds
- Success rate: >98%

## [1.0.0] - 2025-08-28

### Initial Release
- Core scraping and analysis functionality
- Dashboard with filtering capabilities
- CSV/JSON export functionality
- Basic production deployment
- 664 companies imported from Google Sheets
- Complete companies overview table with context
- Advanced filtering and pagination

### Features
- Job data processing from LinkedIn
- AI-powered sales tool detection
- Company identification and tracking
- Export capabilities for CRM integration
- Real-time processing statistics

---

## Upgrade Notes

### From 2.0.0 to 2.1.0
1. Update database to ensure all jobs have analyzed_date:
   ```sql
   UPDATE raw_jobs 
   SET analyzed_date = created_at 
   WHERE processed = true AND analyzed_date IS NULL;
   ```

2. Clear browser cache to ensure new React components load properly

3. Restart any running processors to pick up new dataService fixes

### From 1.0.0 to 2.0.0
1. Update environment variables with GPT-5 API key
2. Run database migrations for new schema
3. Configure Google Sheets integration (optional)
4. Update to use simple-processor.js for production