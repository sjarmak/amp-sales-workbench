# Data Layer Architecture

## Overview

The Data Layer consolidates Salesforce account data with Gong call transcripts for unified querying and enrichment. It provides three main services:

1. **CSV Processor** - Load and index Salesforce account CSV data
2. **Account Linkage** - Link Salesforce accounts to Gong calls via fuzzy matching
3. **Data Layer Service** - Unified query API

## File Organization

```
data/tables/
├── salesforce_accounts.csv             # Source CSV (processed once)
├── salesforce_accounts_index.json      # Indexed account data (regenerated)
└── account_gong_links.jsonl            # Account-Gong call linkages (cached)
```

## Services

### 1. CSV Processor (`src/services/csvProcessor.ts`)

Handles loading and indexing Salesforce account data.

**Features:**
- Parse CSV with configurable field mapping
- Build in-memory indexes by ID, legal name, and domain
- Fuzzy search using Fuse.js
- Save/load indexes for fast initialization

**Key Functions:**
```typescript
// Load CSV and build indexes
const records = loadSalesforceAccountsCSV(csvPath)
const index = buildAccountIndex(records)

// Search with fuzzy matching
const results = searchAccounts(index, 'company name', { limit: 10 })

// Persist index
saveAccountIndex(index, outputPath)

// Load from cache
const index = loadAccountIndex(indexPath)
```

**Schema:**
```typescript
interface SalesforceAccountRecord {
  account_id: string                 // Salesforce 18-char ID
  name: string                       // Account name
  account_name_legal_c?: string      // Legal entity name (custom field)
  company_domain_name_c?: string     // Domain (custom field)
  industry?: string
  number_of_employees?: number
  annual_revenue?: string
  website?: string
  billing_city?: string
  billing_state?: string
  billing_country?: string
  created_date?: string
  last_modified_date?: string
}
```

### 2. Account Linkage Service (`src/services/accountLinkageService.ts`)

Links Salesforce accounts to Gong calls via name matching and caches results.

**Features:**
- Query Gong parquet lakehouse for calls matching account names
- Support multiple matching strategies (exact, fuzzy, domain)
- Cache results in JSONL format
- Merge with existing cache on updates

**Key Functions:**
```typescript
// Find Gong calls for an account (with fuzzy matching)
const results = await findGongCallsForAccount(
  accountIndex,
  'Acme Corp',
  { fuzzyThreshold: 0.3, limit: 100 }
)

// Build linkage index from results
const links = buildAccountGongLinkIndex(results)

// Save/load cache
saveLinkageIndex(links, outputPath)
const cachedLinks = loadLinkageIndex(outputPath)

// Batch link multiple accounts
const allLinks = await batchLinkAccountsToGong(
  accountIndex,
  ['Company A', 'Company B'],
  { outputPath, cacheExisting: true }
)
```

**Output Schema:**
```typescript
interface AccountGongLink {
  account_id: string                 // Salesforce ID
  account_name: string               // Display name
  account_name_legal_c?: string      // Legal name (for matching)
  company_domain_name_c?: string     // Domain
  gong_call_ids: string[]            // Linked call IDs
  gong_call_count: number            // Total calls found
  link_confidence: number            // 0-1 confidence score
  matched_by: 'exact' | 'fuzzy' | 'domain'
  last_updated: string               // ISO 8601 timestamp
  matched_fields: string[]           // Which fields matched
}
```

### 3. Data Layer Service (`src/services/dataLayerService.ts`)

Unified API for account search and enrichment.

**Usage:**
```typescript
import { createDataLayerService } from './src/services/dataLayerService.js'

// Initialize once (loads CSV + indexes)
const service = await createDataLayerService(projectDir)

// Search accounts with fuzzy matching
const results = service.searchAccounts('Acme', { limit: 5 })
// Returns: AccountSearchResult[]
// - account: SalesforceAccountRecord
// - match_type: 'exact' | 'fuzzy'

// Get account by Salesforce ID
const account = service.getAccountById('001xx000...')

// Get linked Gong calls (from cache)
const links = service.getLinkedGongCalls('001xx000...')

// Link account to Gong (queries lakehouse, updates cache)
const freshLinks = await service.refreshAccountLinkage('Acme Corp')

// Get enriched account with Gong calls
const enriched = await service.getEnrichedAccount('001xx000...')

// Statistics
const stats = service.getStats()
// {
//   totalAccounts: 20104,
//   accountsWithGongLinks: 456,
//   totalLinkedCalls: 5678
// }
```

## Initialization

**First-time setup:**
```bash
npm run typecheck        # Verify types
npx tsx scripts/init-data-layer.ts
```

This:
1. Loads Salesforce CSV (20k+ accounts)
2. Builds search indexes
3. Saves JSON index for fast subsequent loads
4. Verifies with sample search

**Output:**
```
✅ Loaded 20104 accounts
✅ Indexed 20104 accounts by ID
✅ Indexed 9473 accounts by legal name
✅ Indexed 10893 accounts by domain
```

## Integration Points

### In Orchestrator
```typescript
import { createDataLayerService } from './src/services/dataLayerService.js'

const dataLayer = await createDataLayerService(process.cwd())

// In intake phase: resolve account
const matches = dataLayer.searchAccounts(userInput)
if (matches.length === 0) {
  throw new Error('Account not found')
}
const account = matches[0].account

// In consolidation: enrich snapshot
const enriched = dataLayer.enrichAccountWithGongCalls(account.account_id)
if (enriched?.gong_calls) {
  // Attach to snapshot for context
}
```

### In Agents
Agents can use data layer for:
- **Pre-call brief**: Search account, fetch company size/industry from table
- **Account research**: Get linked Gong calls without querying parquet directly
- **Deal review**: Find similar accounts with Gong data
- **Coaching**: Surface account context during call analysis

## Performance

**Benchmarks (on 20k accounts):**
- CSV load: ~500ms
- Index build: ~200ms
- Exact search: <1ms
- Fuzzy search: ~50ms
- Gong query: 2-5s (depends on Parquet size)
- Cache hit: <1ms

**Optimization notes:**
- Index is loaded to memory (~10MB JSON)
- Fuzzy search uses Fuse.js (configurable threshold)
- Gong linkage cached in JSONL (~5MB for 500+ linked accounts)
- Future: Consider Parquet for accounts table if >50k records

## Data Freshness

### CSV Updates
- Source: Salesforce account table export
- Frequency: Manual (run `init-data-layer` after export)
- Cache invalidation: Automatic (overwrites index)

### Gong Linkage
- Computation: On-demand per account (cached)
- Cache location: `data/tables/account_gong_links.jsonl`
- Refresh: `service.refreshAccountLinkage(accountName)`
- TTL: None (sticky cache, refresh manually if needed)

## Extending the Data Layer

### Adding New Fields
1. Update `SalesforceAccountRecord` interface in `csvProcessor.ts`
2. Add field to CSV parse logic
3. Rebuild index: `npx tsx scripts/init-data-layer.ts`

### Custom Search Index
```typescript
// Add to csvProcessor.ts buildAccountIndex()
const accountsByCustomField = new Map<string, SalesforceAccountRecord[]>()
for (const record of records) {
  const key = record.custom_field?.toLowerCase()
  if (key) {
    const existing = accountsByCustomField.get(key) || []
    accountsByCustomField.set(key, [...existing, record])
  }
}
```

### Batch Account Linking
```typescript
// Link all accounts in CSV to Gong calls
const allLinks = await batchLinkAccountsToGong(
  accountIndex,
  Array.from(accountIndex.accountsById.values()).map(a => a.name),
  { outputPath: linkagePath, cacheExisting: true }
)
```

## Troubleshooting

### "CSV not found"
- Ensure `data/tables/salesforce_accounts.csv` exists
- Run: `cp ~/Downloads/Salesforce_Account_Table.csv data/tables/salesforce_accounts.csv`

### "Service not initialized"
- Call `await service.initialize()` before using
- Or use `createDataLayerService()` helper

### Search returns no results
- Try fuzzy search (default threshold: 0.4)
- Check account name spelling
- Query CSV directly: `SELECT * FROM salesforce_accounts WHERE name LIKE '%term%'`

### Gong links stale
- Refresh: `await service.refreshAccountLinkage(accountName)`
- Clear cache: `rm data/tables/account_gong_links.jsonl`
- Rebuild: Run `init-data-layer` (only rebuilds index, not Gong links)

## Next Steps

- [ ] Auto-refresh Gong linkage on Gong call webhook
- [ ] Add support for Salesforce incremental syncs
- [ ] Convert accounts table to Parquet for larger datasets
- [ ] Build UI for account browser / Gong call explorer
- [ ] Add contact-level linking (person → Gong participants)

## See Also

- [gongParquetClient.ts](../src/clients/gongParquetClient.ts) - Gong lakehouse queries
- [orchestrator.ts](../src/orchestrator.ts) - Integration point
- [types.ts](../src/types.ts) - Schema definitions
