# Gong Call Retrieval Fix - List + Filter Approach

## Problem

The Gong `search_calls` endpoint returns 405 errors, making it impossible to search for calls by account name directly.

## Solution

Updated the Gong ingestion to use **list_calls** with date ranges and **client-side filtering** by call title.

## Testing Results

### Working Approach
✅ **mcp__gong-extended__list_calls** with params `{fromDateTime, toDateTime}` → Filter by title
```typescript
// Example that works:
mcp__gong-extended__list_calls({
  fromDateTime: "2025-09-01T00:00:00Z",
  toDateTime: "2025-10-23T23:59:59Z"
})
// Returns: { calls: [...] }
// Then filter: calls.filter(call => call.title.toLowerCase().includes("canva"))
```

**Verified Results:**
- Found TTX calls (Oct 14, 2025): "TTX <> Sourcegraph Amp | Demo & Trial Discussion"  
- Found Canva calls (Sept 15, 2025): "Canva<>Sourcegraph: Monthly Cadence"

### Failed Approach  
❌ **search_calls** with query parameter → 405 error "Method 'POST' is not supported"

## Implementation Changes

### 1. Default Date Range: 14 days → 6 months
**File**: `src/phases/ingest/gong.ts`

```typescript
// OLD: 14 days
fromDate.setDate(fromDate.getDate() - 14)

// NEW: 6 months for comprehensive account history
fromDate.setMonth(fromDate.getMonth() - 6)
```

**Why**: 6 months captures the full account relationship and recent activity patterns.

### 2. Cache Manager: Pagination & Rate Limiting
**File**: `src/gong-cache/manager.ts`

- Increased pagination limit: 10 pages → 20 pages (2000 calls) for 6-month backfill
- Added delay between pages to respect rate limits
- Added clear documentation that `search_calls` returns 405

### 3. Documentation Updates

Added comments explaining:
- Why we use `list_calls` (search_calls returns 405)
- Client-side filtering approach by call title
- Cache system maintains 6-month rolling window
- Incremental syncs fetch only new calls

## How It Works

### Initial Backfill (First Time)
```
1. list_calls(fromDateTime: 6 months ago, toDateTime: now)
2. Fetch ALL calls in that range (paginated)
3. Extract company names from titles
4. Cache locally in data/gong-cache/calls-index.json
```

### Incremental Sync (Subsequent Runs)
```
1. list_calls(fromDateTime: lastSyncAt - 5min, toDateTime: now)
2. Fetch only new calls since last sync
3. Update cache with new/changed calls
4. Filter by account name when queried
```

### Account-Specific Query
```
1. Sync cache (incremental)
2. Filter cached calls WHERE title CONTAINS "account name"
3. Return matching calls (up to 50 by default)
```

## Validation

Run this from Amp context to test:

```bash
npx tsx test-gong-canva.ts
```

Expected: Should find the September 15 Canva call when run in Amp context with MCP access.

## Performance

- **Cache hit**: Zero API calls, instant results
- **Cache miss**: 1 API call for incremental sync, then instant filtering
- **Initial backfill**: ~20 API calls for 6 months (2000 calls with pagination)

## Next Steps

If you see "Gong MCP not available" errors, the code must be run from within an Amp agent thread that has MCP tool access. The cache system is designed to be populated by agents, not standalone scripts.
