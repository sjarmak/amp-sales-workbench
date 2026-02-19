# Data Layer Integration Guide

## Overview

The orchestrator intake phase now uses the DataLayerService for fast, local account resolution before falling back to Salesforce MCP queries. This provides better UX and reduces API calls.

## Lookup Strategy

The `resolveAccountKey()` function in `src/phases/intake.ts` implements a two-phase lookup:

### Phase 1: Local Index Lookup (Fast Path)
1. Load DataLayerService from local CSV index
2. Search for account by name/domain with fuzzy matching
3. Prioritize matches in order:
   - Exact name match (case-insensitive)
   - Exact domain match (if domain provided)
   - Best fuzzy match (Fuse.js, threshold 0.4)
4. Returns instantly if found (~<50ms)

### Phase 2: Salesforce MCP Fallback
1. Queries Salesforce API for real-time data
2. Used only if:
   - Local index not found
   - Local index not available (not initialized)
3. Provides accuracy for new/recently added accounts

## Usage

The intake phase is used automatically by the orchestrator:

```bash
# Fast path: found in local index
npm run manage "Acme Corp"
# Output: ✓ Found account in local index: Acme Corp (001XXXXXXXXXXXXXXXXX)

# Slow path: fallback to Salesforce MCP (only if not in index)
npm run manage "Brand New Company"
# Output: 🔍 Querying Salesforce MCP...
```

## Configuration

### Prerequisites
1. Initialize the data layer once:
   ```bash
   npx tsx scripts/init-data-layer.ts
   ```
   This loads the Salesforce CSV and builds searchable indexes.

2. (Optional) Update CSV:
   ```bash
   # After exporting new data from Salesforce
   cp /path/to/Salesforce_Account_Table_*.csv data/tables/salesforce_accounts.csv
   npx tsx scripts/init-data-layer.ts
   ```

### Fallback Behavior
- If data layer fails to initialize, the system logs a warning and uses Salesforce MCP
- If both fail, the orchestrator continues without a Salesforce ID (graceful degradation)

## Performance

### Benchmarks
- Local lookup hit: <1ms
- Fuzzy search (50 candidates): ~50ms
- Salesforce MCP query: 2-5 seconds (depends on network)

### Typical Workflow
1. First account in session: 50-100ms (index load + search)
2. Subsequent accounts: <1ms (index already loaded)
3. Cache miss (new account): 2-5 seconds (Salesforce MCP)

## Search Behavior

### Exact Match
```typescript
// Finds by exact account name (case-insensitive)
searchAccounts('Acme Corp')  // → Acme Corp (001XXXXXXXXXXXXXXXXX)
```

### Fuzzy Match
```typescript
// Uses Fuse.js for typo tolerance
searchAccounts('TechCorp')     // → TechCorp (001XXXXXXXXXXXXXXXXX)
searchAccounts('TechCorpp')    // → TechCorp (001XXXXXXXXXXXXXXXXX)
searchAccounts('acme')         // → Acme Corp (001XXXXXXXXXXXXXXXXX)
```

### Domain Match
```typescript
// If domain provided, searches company_domain_name_c field
searchAccounts('', domain: 'sourcegraph.com')
```

## Integration Points

### In Orchestrator
The intake phase automatically uses DataLayerService. No changes needed—it's transparent to callers.

### In Agents
Agents can also use DataLayerService for additional context:

```typescript
import { createDataLayerService } from './src/services/dataLayerService.js'

const dataLayer = await createDataLayerService(process.cwd())

// Get account details
const account = dataLayer.getAccountById('001xx000...')
console.log(`Industry: ${account.industry}`)
console.log(`Employees: ${account.number_of_employees}`)

// Find linked Gong calls
const links = dataLayer.getLinkedGongCalls('001xx000...')
if (links?.gong_call_count > 0) {
  console.log(`${links.gong_call_count} Gong calls found`)
}
```

## Troubleshooting

### "Data layer lookup failed: CSV not found"
**Solution**: Run `npx tsx scripts/init-data-layer.ts` to initialize.

### "No results found" for known account
**Possible causes**:
1. Account not in Salesforce account table export (check if it exists in SFDC)
2. Account name has changed in SFDC
3. Fuzzy match threshold too high (try searching with partial name)

**Solution**: Query Salesforce directly or update the CSV export.

### "Salesforce MCP not configured"
**Note**: This is expected in development. The system gracefully continues without it.

**Solution** (production): Configure Salesforce MCP in Amp settings.

## Future Enhancements

- [ ] Pre-compute all Gong links during `init-data-layer` (5-10 min, cached)
- [ ] Contact-level Gong participant matching
- [ ] Domain-level Gong enrichment (calls from company domain)
- [ ] Account similarity search (find accounts with similar profiles)
- [ ] Salesforce incremental sync scheduling

## See Also

- [DATA_LAYER.md](./DATA_LAYER.md) - Full architecture and APIs
- [QUICKSTART_DATA_LAYER.md](../QUICKSTART_DATA_LAYER.md) - Quick reference
- [src/phases/intake.ts](../src/phases/intake.ts) - Intake phase implementation
- [src/services/dataLayerService.ts](../src/services/dataLayerService.ts) - Service API
