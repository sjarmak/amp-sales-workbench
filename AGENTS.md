# Agent Instructions for Amp Sales Workbench
NEVER RUN SERVERS, LET THE USER RUN ANY LONG RUNNING PROCESSES 
NEVER USE EMOJIS, PREFER ICONS FROM https://lucide.dev/icons/ IF IT MAKES SENSE TO ADD ICONOGRAPHY

## Overview

**Amp Sales Workbench** is a multi-agent sales workflow system that automates prospect research, account enrichment, data consolidation from multiple sources (Gong, Notion, Salesforce), draft generation, and CRM synchronization. It mimics Scratchpad-like workflows while leveraging your existing MCP servers.

## Commands

### Modern Web UI (Recommended)
- **Start UI**: `npm run start:web`
- Frontend: `http://localhost:3000` (Next.js + shadcn/ui)
- API: `http://localhost:3001` (Express)
- Features:
  - Clean, modern interface inspired by shadcn/ui
  - Account selector with capability badges
  - One-click buttons for all agents
  - Tabs for Prep, After Call, CRM, Insights workflows
  - Real-time agent execution
  
**Note:** Data source refresh buttons (Salesforce/Gong/Notion badges) require MCP servers configured in Amp. If MCPs aren't set up, use the "Full Refresh" button in the CRM section instead.

### Streamlit UI (Alternative)
- **Start UI**: `streamlit run streamlit_app.py`
- Access at `http://localhost:8501`
- Python-based UI with emoji-free design

### Main Workbench (CLI)
- **Run for account**: `npm run manage "Acme Corp"` or `npx tsx src/execute-agent.ts "Acme Corp"`
- **Run with options**: `npm run manage "Acme Corp" -- --domain acme.com --sfid 001xx000...`
- **Apply approved changes**: `npm run manage "Acme Corp" -- --apply`
- **Debug mode**: `DEBUG=1 npx tsx src/execute-agent.ts "Company Name"`

### Individual Agents
- **Pre-call brief**: `npm run precall "Acme Corp" "2025-10-22"`
- **Post-call update**: `npx tsx scripts/test-postcall.ts "Acme Corp" [callId]`
- **Qualification (MEDDIC)**: `npx tsx src/agents/qualification.ts "Acme Corp" --method MEDDIC`
- **Deal review**: `npx tsx src/agents/dealReview.ts "Acme Corp"`
- **Executive summary**: `npx tsx src/agents/execSummary.ts "Acme Corp"`
- **Handoff doc**: `npx tsx src/agents/handoff.ts "Acme Corp" --type "SE→AE"`
- **Closed-lost analysis**: `npx tsx src/agents/closedLost.ts "Acme Corp" --opp "006xx..."`
- **Backfill**: `npx tsx src/agents/backfill.ts "Acme Corp"`

### Testing & Utilities
- **Test capabilities**: `npx tsx scripts/test-capabilities.ts`
- **Test MCP servers**: `npx tsx scripts/check-mcp-servers.ts`
- **Test all agents**: `npm run test:agents`
- **Typecheck**: `npm run typecheck`

## Issue Tracking with bd (beads)

**IMPORTANT**: This project uses **bd (beads)** for ALL issue tracking. Do NOT use markdown TODOs, task lists, or other tracking methods.

### Why bd?

- Dependency-aware: Track blockers and relationships between issues
- Git-friendly: Auto-syncs to JSONL for version control
- Agent-optimized: JSON output, ready work detection, discovered-from links
- Prevents duplicate tracking systems and confusion

### Quick Start

**Check for ready work:**
```bash
bd ready --json
```

**Create new issues:**
```bash
bd create "Issue title" -t bug|feature|task -p 0-4 --json
bd create "Issue title" -p 1 --deps discovered-from:bd-123 --json
```

**Claim and update:**
```bash
bd update bd-42 --status in_progress --json
bd update bd-42 --priority 1 --json
```

**Complete work:**
```bash
bd close bd-42 --reason "Completed" --json
```

### Issue Types

- `bug` - Something broken
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `epic` - Large feature with subtasks
- `chore` - Maintenance (dependencies, tooling)

### Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default, nice-to-have)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

### Workflow for AI Agents

1. **Check ready work**: `bd ready` shows unblocked issues
2. **Claim your task**: `bd update <id> --status in_progress`
3. **Work on it**: Implement, test, document
4. **Discover new work?** Create linked issue:
   - `bd create "Found bug" -p 1 --deps discovered-from:<parent-id>`
5. **Complete**: `bd close <id> --reason "Done"`

### Auto-Sync

bd automatically syncs with git:
- Exports to `.beads/issues.jsonl` after changes (5s debounce)
- Imports from JSONL when newer (e.g., after `git pull`)
- No manual export/import needed!

### Important Rules

- ✅ Use bd for ALL task tracking
- ✅ Always use `--json` flag for programmatic use
- ✅ Link discovered work with `discovered-from` dependencies
- ✅ Check `bd ready` before asking "what should I work on?"
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT use external issue trackers
- ❌ Do NOT duplicate tracking systems

## Architecture

Multi-agent pipeline orchestrated by [src/orchestrator.ts](file:///Users/sjarmak/amp-sales-workbench/src/orchestrator.ts):

### Agents

1. **Intake Agent** (`src/phases/intake.ts`) - Resolves account keys, looks up Salesforce IDs
2. **Research Agent** (`src/phases/research.ts`) - Wraps amp-prospector for initial prospect research (staleness check, >30 days)
3. **Enrichment Agents** (`src/phases/ingest/`) - Pull data from MCPs:
   - `salesforce.ts` - Account, Contacts, Opportunities, Activities
   - `gong.ts` - Recent calls (10-14 days), transcripts with caching
   - `notion.ts` - Knowledge pages and account-specific content
4. **Consolidation Agent** (`src/phases/consolidate.ts`) - AI-powered data merging using Amp SDK `execute()` with delta analysis
5. **Draft Agent** (`src/phases/draft.ts`) - Generates reviewable YAML patches and markdown summaries via Amp SDK
6. **CRM Sync Agent** (`src/phases/sync/syncSalesforce.ts`) - Applies minimal, idempotent patches with optimistic concurrency

### Smart Data Refresh System

The workbench implements intelligent data caching with staleness detection to minimize API calls while keeping data fresh.

#### TTL Configuration

Data sources have different freshness requirements based on update frequency:

**Salesforce** (entity-level TTLs):
- **Account**: 7 days (rarely changes)
- **Contacts**: 24 hours (moderate activity)
- **Opportunities**: 6 hours (high activity, deal changes)
- **Activities**: 6 hours (recent calls, meetings, tasks)

**Gong**:
- **Call List**: 24 hours (new calls daily)
- **Transcripts**: Cached by hash (never stale)

**Notion**:
- **Knowledge Pages**: 7 days (documentation, competitive analysis)
- **Account Pages**: 14 days (account-specific notes)

#### Staleness Detection

[`src/phases/freshness.ts`](file:///Users/sjarmak/amp-sales-workbench/src/phases/freshness.ts) tracks metadata in `_sources.meta.json`:

```typescript
{
  "version": 1,
  "sources": {
    "salesforce": {
      "lastFullSyncAt": "2025-10-20T10:00:00Z",
      "lastIncrementalSyncAt": "2025-10-20T15:00:00Z",
      "status": "fresh",
      "entityCheckpoints": {
        "Account": { "lastFetchedAt": "2025-10-20T10:00:00Z", "since": "2025-10-19T..." },
        "Contact": { "lastFetchedAt": "2025-10-20T15:00:00Z", "count": 45 },
        "Opportunity": { "lastFetchedAt": "2025-10-20T15:00:00Z", "count": 12 },
        "Activity": { "lastFetchedAt": "2025-10-20T15:00:00Z", "count": 89 }
      }
    },
    "gong": {
      "lastListSyncAt": "2025-10-20T14:00:00Z",
      "callCount": 23,
      "status": "fresh",
      "transcripts": {
        "call-id-1": { "hash": "abc123", "fetchedAt": "2025-10-20T14:00:00Z" }
      }
    },
    "notion": {
      "lastFullSyncAt": "2025-10-18T08:00:00Z",
      "pageCount": 8,
      "status": "fresh"
    }
  }
}
```

`computeStaleness()` checks each source against TTLs:
- Returns `{ any: boolean, reasons: string[], entities?: {...} }`
- Per-entity tracking for Salesforce (only refresh stale entities)
- Source-level tracking for Gong and Notion

#### Incremental Refresh

**Salesforce**: Uses `LastModifiedDate` filters:
```typescript
// Only fetch records modified since last sync
sinceOpportunity: "2025-10-20T09:00:00Z"
```

**Gong**: Uses date range filters:
```typescript
// Only fetch calls since last list sync
fromDateTime: "2025-10-19T14:00:00Z"
```

**Notion**: Re-fetches all pages (Notion API limitations)

#### Refresh Modes

**Auto** (default):
1. Check staleness with `computeStaleness(meta)`
2. If fresh → use cached data
3. If stale → incremental refresh (using `since` checkpoints)
4. If missing → full refresh

**Incremental**:
- Force incremental even if fresh
- Uses entity checkpoints for date filters
- Merges with existing cached data

**Full**:
- Ignore cache, fetch everything
- Resets all checkpoints
- Used for data validation or after errors

#### API Endpoints

**GET** `/api/accounts/:slug/sources`
```json
{
  "salesforce": {
    "status": "stale",
    "lastFetchedAt": "2025-10-20T09:00:00Z",
    "nextRecommended": "incremental",
    "staleReasons": ["Opportunity data stale (8h old)"],
    "entities": { "Opportunity": true, "Activity": true }
  },
  "gong": {
    "status": "fresh",
    "lastFetchedAt": "2025-10-20T14:00:00Z",
    "nextRecommended": "use-cache",
    "callCount": 23
  }
}
```

**POST** `/api/accounts/:slug/sources/:source/refresh`
```json
{
  "mode": "auto" | "incremental" | "full"
}
```

Response:
```json
{
  "success": true,
  "updated": true,
  "modeUsed": "incremental",
  "stats": {
    "opportunitiesAdded": 3,
    "activitiesAdded": 12
  }
}
```

#### Web UI Integration

[`DataSourceBadges.tsx`](file:///Users/sjarmak/amp-sales-workbench/web/components/DataSourceBadges.tsx) displays:
- **Freshness chips**: Green (fresh) / Yellow (stale) / Gray (missing)
- **Refresh dropdown**: Auto / Incremental / Full modes
- **Timestamps**: Relative time since last fetch (e.g., "3h ago")
- **Auto-refresh**: UI updates after manual refresh completes

#### Orchestrator Integration

Phase 3 (Enrichment) checks staleness:
```typescript
const meta = await readMeta(accountDir)
const staleness = computeStaleness(meta)

if (!staleness.salesforce.any) {
  // Use cached salesforce.json
} else {
  // Incremental refresh with entity checkpoints
  await ingestFromSalesforce(accountKey, accountDir, { sinceOpportunity: ... })
}
```

After Phase 6 (CRM Apply), trigger auto-refresh to capture just-written changes.

### Pipeline Flow

```
                    ┌─────────────┐
                    │   Intake    │
                    │   (Resolve  │
                    │  Account)   │
                    └──────┬──────┘
                           │
                           ↓
                  ┌────────────────┐
                  │   Research     │
                  │(amp-prospector)│
                  └────────┬───────┘
                           │
                           ↓
        ┌──────────────────┼──────────────────┐
        ↓                  ↓                  ↓
   ┌────────┐        ┌──────────┐      ┌─────────┐
   │  Gong  │        │Salesforce│      │ Notion  │
   │ Enrich │        │  Enrich  │      │ Enrich  │
   └────┬───┘        └─────┬────┘      └────┬────┘
        │                  │                 │
        └──────────────────┼─────────────────┘
                           │
                           ↓
                  ┌────────────────┐
                  │ Consolidation  │
                  │  (AI Merge +   │
                  │     Deltas)    │
                  └────────┬───────┘
                           │
                           ↓
                  ┌────────────────┐
                  │ Draft Generate │
                  │  (YAML + MD)   │
                  └────────┬───────┘
                           │
                           ↓
                  ┌────────────────┐
                  │   [Approval]   │◄─── User reviews
                  └────────┬───────┘
                           │
                           ↓
        ┌──────────────────┼──────────────────┐
        ↓                                     ↓
   ┌─────────┐                         ┌──────────┐
   │   CRM   │                         │  Notion  │
   │  Sync   │                         │  Mirror  │
   └─────────┘                         └──────────┘
```

### Data Flow

```
data/accounts/<account-slug>/
├── prospecting/          # amp-prospector outputs
├── raw/                  # Raw MCP data (salesforce.json, gong_calls.json, notion_pages.json)
├── snapshots/            # Consolidated snapshots (snapshot-YYYYMMDD.json)
├── drafts/               # Reviewable drafts (crm-draft-YYYYMMDD.yaml, summary.md)
└── applied/              # Applied change receipts (apply-YYYYMMDD.json)
```

## MCP Servers

### Gong Integration
- **Priority data**: Call transcripts, AI summaries, action items, next steps
- **Transcript caching**: Store hashes to avoid reprocessing
- **Rate limiting**: Cap to last 10-14 days or most recent 10 calls
- **Tools used**: `list_calls`, `retrieve_transcripts`, `search_calls`

### Salesforce Integration
- **Objects**: Accounts, Contacts, Opportunities, Activities
- **Key fields for Opportunities**: 
  - General feedback trends
  - Progress toward success criteria
  - Feature requests
  - Likelihood/path to close
- **Write strategy**: Minimal patches only, optimistic concurrency with LastModifiedDate
- **Tools used**: Read via `get_record`, `soql_query`; Write via `update_record`

### Notion Integration

Notion serves **dual purposes** in the workbench:

#### 1. General Knowledge Context (Read-Only)
Used to enrich agent responses with company knowledge:
- **Competitive analysis pages**: Referenced in pre-call briefs and demo prep
- **Product information**: Features, capabilities, positioning
- **Customer wins & success stories**: Similar use cases to reference
- **Configuration**: Defined in `notion-config.json` under `knowledgePages`
- **Usage**: Agents pull context from these pages as needed (e.g., competitor comparisons for demo prep)

#### 2. Account-Specific Write-Back (Read-Write)
Used to share insights and updates with the team:
- **Target**: Accounts database in Notion (defined in `notion-config.json` under `accountsDatabase`)
- **Purpose**: Mirror agent-generated summaries and briefs for team collaboration
- **Write operations**: Account summaries, deal health updates, handoff docs
- **Schema**: Flexible parsing, agent handles varying formats

**Tools used**: `API-post-search`, `API-retrieve-a-page`, `API-get-block-children`, `API-post-page`

## Code Style

- **Module system**: ESM with `.js` extensions in imports (NodeNext resolution)
- **Strict TypeScript**: All `strict` flags enabled, explicit types preferred
- **Amp SDK**: Use `execute()` for orchestration, iterate with `for await` loops
- **Error handling**: Throw errors with descriptive messages, validate at boundaries
- **Naming**: camelCase for functions/vars, PascalCase for types/interfaces
- **No build step**: Use `tsx` to run TypeScript directly
- **Environment**: Requires `AMP_API_KEY` from `.env`; MCP servers configured in Amp settings

## Key Types

See [src/types.ts](file:///Users/sjarmak/amp-sales-workbench/src/types.ts):

- `AccountKey`: Canonical account identifier (name, domain, salesforceId)
- `IngestedData`: Raw data from Salesforce, Gong, Notion MCPs
- `ConsolidatedSnapshot`: Merged account profile with contacts, opportunities, signals, deltas
- `CrmPatchProposal`: Structured change proposals with before/after, confidence, source links
- `Patch`: Individual field-level change with metadata

## Workflow

1. **Trigger**: CLI or event-driven (future)
2. **Intake**: Resolve account key (name → Salesforce ID lookup if needed)
3. **Research**: Run amp-prospector if new or stale (>30 days)
4. **Enrich**: Pull from Gong (recent calls), Salesforce (account/contacts/opps), Notion (relevant pages)
5. **Consolidate**: Merge all sources, detect deltas vs Salesforce current state
6. **Draft**: Generate `crm-draft.yaml` with proposed changes + `summary.md` with deal health/next actions
7. **Review**: User edits YAML or approves as-is
8. **Apply**: Run with `--apply` flag to push changes to Salesforce
9. **Mirror**: Update Notion with summary for team visibility (optional)

## Safety & Guardrails

- **Optimistic concurrency**: Check LastModifiedDate before applying patches
- **Idempotent patches**: Only apply if server value matches expected "before" state
- **Confidence thresholds**: Low-confidence changes require manual review or force flag
- **PII/Compliance**: Redact sensitive data in public artifacts; .gitignore raw data
- **Rate limits**: Respect MCP server rate guidance; batch Salesforce queries
- **Transcript caching**: Hash-based deduplication to avoid token waste

## Approval Workflow

### File-based (v1)
1. Review `drafts/crm-draft-YYYYMMDD.yaml`
2. Edit as needed
3. Run `npm run manage "Acme Corp" -- --apply`

### Web UI (future)
- Simple review interface with diff view
- One-click approve/reject
- Field-level approvals

## Notion Configuration

Create a `notion-config.json` with curated pages:

```json
{
  "knowledgePages": {
    "customerWins": "page-id-here",
    "competitiveAnalysis": "page-id-here",
    "productInfo": "page-id-here"
  },
  "accountsDatabase": "database-id-here"
}
```

## Integration with amp-prospector

- **When**: On-demand for new accounts or when refresh needed
- **How**: Import and call `runProspector()` from amp-prospector
- **Output**: Stored in `data/accounts/<slug>/prospecting/`
- **Reuse**: Prospector outputs feed into Consolidation Agent

## Event-Driven (Future)

- Webhook listeners for Gong, calendar, email
- Queue-based processing (Redis/SQS)
- Background workers for ingest/summarize/sync
- Near-real-time updates

## Debugging

- Set `DEBUG=1` for verbose logging
- Check `data/accounts/<slug>/raw/` for MCP responses
- Review `drafts/*.yaml` for change proposals
- Inspect `applied/*.json` for sync receipts

## Testing

- No formal test framework yet
- Manual testing via CLI with different accounts
- Validate against known Salesforce state

## Resources

- [Scratchpad.com](https://www.scratchpad.com/) - Inspiration for workflow
- [Amp SDK Docs](https://ampcode.com/manual)
- [amp-prospector](file:///Users/sjarmak/amp-prospector/) - Related research agent
- Notion "Using Salesforce" page: [link](https://www.notion.so/Using-Salesforce-b3a97eb1836242c5bd955fba941be9dd)
