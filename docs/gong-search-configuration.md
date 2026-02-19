# Gong Search Term Configuration

## Overview

The Gong integration supports custom search terms per account for cases where the formal company name differs from how Gong calls are titled. For example, "International Business Machines" calls are typically titled with "IBM" instead of the full company name.

## How It Works

When fetching Gong calls for an account, the system:
1. Checks if the `AccountKey` has `gongSearchTerms` set
2. Falls back to checking [`config/gong-search-overrides.json`](../config/gong-search-overrides.json)
3. Falls back to using the account name

The search is performed by checking if **any** of the search terms appear in:
- The call title
- Extracted company names from the title
- Participant email domains (if configured)

## Configuration Methods

### Method 1: Config File (Recommended)

Edit [`config/gong-search-overrides.json`](../config/gong-search-overrides.json):

```json
{
  "overrides": {
    "international-business-machines": {
      "searchTerms": ["IBM", "IBM"],
      "reason": "Calls typically use IBM abbreviation instead of full company name"
    },
    "acme-corp": {
      "searchTerms": ["Acme", "ACME"],
      "reason": "Variation in capitalization in call titles"
    }
  }
}
```

**Key format**: Use the account slug (lowercase, spaces replaced with hyphens)

### Method 2: Programmatically Set AccountKey

```typescript
import type { AccountKey } from './src/types.js'

const accountKey: AccountKey = {
  name: 'International Business Machines',
  domain: 'ibm.com',
  gongSearchTerms: ['IBM', 'IBM'],
}
```

## When to Use Custom Search Terms

Configure custom search terms when:
- **Abbreviations are used**: "International Business Machines" → "IBM"
- **Informal names are common**: "International Business Machines" → "IBM"
- **Capitalization varies**: "ACME Corp" vs "Acme Corp"
- **Multiple brand names**: "Facebook" vs "Meta"
- **Acquisition rebranding**: "VMware by Broadcom" → ["VMware", "Broadcom"]

## Testing

Run the test script to validate your configuration:

```bash
npx tsx test-gong-search-config.ts
```

Or test in the context of actual call fetching:

```bash
# Enable debug mode to see search terms in action
DEBUG=1 npm run manage "Acme Corp"
```

Look for log output like:
```
Searching Gong calls with terms: IBM, IBM
Found 8 calls from cache using search terms: IBM, IBM
```

## Implementation Details

- **File**: [`src/gong-search-config.ts`](../src/gong-search-config.ts)
- **Integration points**:
  - [`src/phases/ingest/gong.ts`](../src/phases/ingest/gong.ts) - Call fetching
  - [`src/gong-cache/manager.ts`](../src/gong-cache/manager.ts) - Cache filtering
- **Type definition**: [`src/types.ts`](../src/types.ts) - `AccountKey.gongSearchTerms`

## Examples

### Example 1: International Business Machines

Before configuration:
```
❌ Searching for: "International Business Machines"
❌ Found 0 calls
```

After adding override:
```json
{
  "international-business-machines": {
    "searchTerms": ["IBM", "IBM"]
  }
}
```

Result:
```
✅ Searching for: IBM, IBM
✅ Found 8 calls
```

### Example 2: Multiple Search Terms

For accounts with multiple names or abbreviations:

```json
{
  "vmware-by-broadcom": {
    "searchTerms": ["VMware", "Broadcom", "VMW"],
    "reason": "Recent acquisition, calls may use either brand name"
  }
}
```

This will match calls titled:
- "VMware Technical Deep Dive"
- "Broadcom Strategy Discussion"
- "VMW Q4 Review"

## Troubleshooting

**No calls found after adding override?**
1. Check that the account slug matches the format in config (lowercase, hyphens)
2. Verify search terms actually appear in Gong call titles
3. Run with `DEBUG=1` to see what terms are being searched
4. Check the Gong cache is synced: `npx tsx src/gong-cache/manager.ts sync`

**Too many calls returned?**
- Use more specific search terms
- Add the account domain to filter by participant emails
- Reduce the number of search terms

**Config not loading?**
- Ensure `config/gong-search-overrides.json` exists
- Check JSON syntax is valid
- Restart any running servers/processes
