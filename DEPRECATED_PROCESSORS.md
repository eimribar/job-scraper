# ⚠️ DEPRECATED PROCESSORS

## Status: REPLACED by UnifiedProcessorService

As of September 10, 2025, the following processors are **DEPRECATED** and should not be used:

### Deprecated Files:
1. ❌ `/scripts/simple-processor.js` - Standalone script
2. ❌ `/lib/services/continuousAnalyzerService.ts` - Old analyzer
3. ❌ `/lib/services/continuousProcessor.ts` - Backup processor

### ✅ Use Instead:
```typescript
import { unifiedProcessor } from '@/lib/services/unifiedProcessorService';
```

## Migration Complete

All API routes and cron jobs have been updated to use the unified processor:
- `/api/cron/analyzer` - ✅ Updated
- Processing scripts - ✅ Consolidated

## Unified Processor Benefits

1. **Single source of truth** - One processor to maintain
2. **Consistent behavior** - Same logic everywhere
3. **Better error handling** - Comprehensive validation
4. **Proper caching** - Efficient company lookup
5. **Clear configuration** - gpt-5-mini-2025-08-07 hardcoded

## Testing the Unified Processor

```bash
# Test via API
curl http://localhost:3000/api/cron/analyzer

# Process manually
node -e "
const { unifiedProcessor } = require('./lib/services/unifiedProcessorService');
unifiedProcessor.processBatch(10).then(console.log);
"
```

## Cleanup Plan

After production deployment is stable (1 week):
1. Archive deprecated files to `/deprecated/` folder
2. Remove references from documentation
3. Update all scripts to use unified processor

---

**Note**: The old processors are kept temporarily for rollback purposes only. Do not use them for new development.