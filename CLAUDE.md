# Agent Instructions for Sourcegraph Sales Workbench
NEVER EDIT THIS FILE
NEVER RUN SERVERS (e.g., DO NOT RUN npm run start:web !), LET THE USER RUN ANY LONG RUNNING PROCESSES, IF YOU WANT TO START A SERVER GIVE THE USER THE COMMAND YOU WOULD RUN YOURSELF SO THEY CAN DO IT 
NEVER USE EMOJIS, PREFER ICONS FROM https://lucide.dev/icons/ IF IT MAKES SENSE TO ADD ICONOGRAPHY
### Issue tracking
We track work in Beads instead of Markdown. Run `bd onboard`as the first thing you do to see our current progress. Any time we work on a task, we should have a bd issue to track it's state. When we've made progress or finished a task we should update the bd issue as well.
## Overview

**Sourcegraph Sales Workbench** is a multi-agent sales workflow system that automates prospect research, account enrichment, data consolidation from multiple sources (Gong, Notion, Salesforce), draft generation, and CRM synchronization. It mimics Scratchpad-like workflows while leveraging your existing MCP servers.

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
  
**Note:** Data source refresh buttons (Salesforce/Gong/Notion badges) require MCP servers configured in Amp. You can refresh individual sources or use the "All Sources" button for bulk operations.

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

### Data Layer
- **Initialize data layer**: `npx tsx scripts/init-data-layer.ts` (run once to load Salesforce CSV and build indexes)
- **Data layer docs**: See `docs/DATA_LAYER.md` for full architecture and API
- **Usage**: `import { createDataLayerService } from './src/services/dataLayerService.js'`

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

### MCP Server (Recommended)

If using Claude or MCP-compatible clients, install the beads MCP server:

```bash
pip install beads-mcp
```

Add to MCP config (e.g., `~/.config/claude/config.json`):
```json
{
  "beads": {
    "command": "beads-mcp",
    "args": []
  }
}
```

Then use `mcp__beads__*` functions instead of CLI commands.

### Best Practices

- **One agent per module at a time.** Cross-module changes split into separate beads.
- Close beads as soon as work is complete (don't batch).
- Use `bd ready` to find unblocked work.
- Always update status to `in_progress` when starting work.
- Always use `--json` flag for programmatic use.
- Link discovered work with `discovered-from` dependencies.
- Check `bd ready` before asking "what should I work on?"

### Managing AI-Generated Planning Documents

AI assistants often create planning and design documents during development:

- PLAN.md, IMPLEMENTATION.md, ARCHITECTURE.md
- DESIGN.md, CODEBASE_SUMMARY.md, INTEGRATION_PLAN.md
- TESTING_GUIDE.md, TECHNICAL_DESIGN.md, and similar files

**Best Practice: Use a dedicated directory for these ephemeral files**

**Recommended approach:**

- Create a `history/` directory in the project root
- Store ALL AI-generated planning/design docs in `history/`
- Keep the repository root clean and focused on permanent project files
- Only access `history/` when explicitly asked to review past planning

**Example .gitignore entry (optional):**

```
# AI planning documents (ephemeral)
history/
```

**Benefits:**

- ✅ Clean repository root
- ✅ Clear separation between ephemeral and permanent documentation
- ✅ Easy to exclude from version control if desired
- ✅ Preserves planning history for archeological research
- ✅ Reduces noise when browsing the project

### Important Rules

- ✅ Use bd for ALL task tracking
- ✅ Always use `--json` flag for programmatic use
- ✅ Link discovered work with `discovered-from` dependencies
- ✅ Check `bd ready` before asking "what should I work on?"
- ✅ Store AI planning docs in `history/` directory
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT use external issue trackers
- ❌ Do NOT duplicate tracking systems
- ❌ Do NOT clutter repo root with planning documents

### Landing the Plane

**When the user says "let's land the plane"**, follow this clean session-ending protocol:

1. **File beads issues for any remaining work** that needs follow-up
2. **Ensure all quality gates pass** (only if code changes were made) - run tests, linters, builds (file P0 issues if broken)
3. **Update beads issues** - close finished work, update status
4. **Sync the issue tracker carefully** - Work methodically to ensure both local and remote issues merge safely. This may require pulling, handling conflicts (sometimes accepting remote changes and re-importing), syncing the database, and verifying consistency. Be creative and patient - the goal is clean reconciliation where no issues are lost.
5. **Clean up git state** - Clear old stashes and prune dead remote branches:
   ```bash
   git stash clear                    # Remove old stashes
   git remote prune origin            # Clean up deleted remote branches
   ```
6. **Verify clean state** - Ensure all changes are committed and pushed, no untracked files remain
7. **Choose a follow-up issue for next session**
   - Provide a prompt for the user to give to you in the next session
   - Format: "Continue work on bd-X: [issue title]. [Brief context about what's been done and what's next]"

**Example "land the plane" session:**

```bash
# 1. File remaining work
bd create "Add integration tests" -t task -p 2

# 2. Run quality gates (only if code changes were made)
npm test
npm run build

# 3. Close finished issues
bd close bd-42 bd-43 --reason "Completed"

# 4. Sync carefully - example workflow (adapt as needed):
git pull --rebase
# If conflicts in .beads/issues.jsonl, resolve thoughtfully:
#   - Accept remote if needed
#   - Re-import if changed
bd sync

# 5. Verify clean state
git status

# 6. Choose next work
bd ready
```

Then provide the user with:

- Summary of what was completed this session
- What issues were filed for follow-up
- Status of quality gates (all passing / issues filed)
- Recommended prompt for next session

For more details, see README.md and QUICKSTART.md.

## Deep Search CLI (ds)

The `ds` CLI tool provides programmatic access to Sourcegraph Deep Search for AI-powered codebase analysis.

### Setup

Requires `SRC_ACCESS_TOKEN` environment variable. Optional: `SOURCEGRAPH_URL` (defaults to https://sourcegraph.sourcegraph.com)

### Common Usage Patterns

**Start a new conversation:**

```bash
ds start --question "Does the repo have authentication middleware?" | jq -r '.id'
```

**Continue existing conversation (using UUID from web UI):**

```bash
ds ask --id fb1f21bb-07e5-48ff-a4cf-77bd2502c8a8 --question "How does it handle JWT tokens?"
```

**Get conversation by ID or UUID:**

```bash
ds get --id 332  # numeric ID
ds get --id fb1f21bb-07e5-48ff-a4cf-77bd2502c8a8  # UUID from share_url
```

**List recent conversations:**

```bash
ds list --first 5 --sort -created_at
```

**Async mode for long-running queries:**

```bash
ds start --question "Complex question" --async | jq -r '.id'
# Poll for results
ds get --id <id>
```

### Best Practices

- Use `--async` for complex questions that search large codebases
- Parse JSON output with `jq` for extracting specific fields
- Save conversation IDs to continue multi-turn conversations
- UUIDs from web UI share URLs work directly with all commands

## Agent Best Practices

### General Rules

NEVER start development servers for applications you're working on.

### ACE Framework Integration (MANDATORY)

When working in projects with ACE (presence of `.ace.json`, `AGENTS.md`, or `logs/` directory):

#### Before Starting Work
1. **Check for learned patterns**: Run `ace get bullets --sort-by helpful --limit 10` to review relevant patterns
2. **Check delta queue**: Run `ace status` to see pending knowledge updates

#### During Task Execution
1. **After any build/test/lint failure**: Immediately capture the trace:
   ```bash
   # Create execution JSON with errors
   ace capture --bead <current-task-id> --exec <errors.json> --outcome failure
   ```
2. **Format execution JSON** as:
   ```json
   [{
     "runner": "tsc|vitest|eslint",
     "command": "npm run build",
     "status": "fail",
     "errors": [{
       "tool": "tsc",
       "severity": "error",
       "message": "Error message",
       "file": "path/to/file.ts",
       "line": 123
     }]
   }]
   ```

#### After Completing Work
1. **Always run `ace learn`**: After finishing any task:
   ```bash
   ace learn --beads <task-id> --min-confidence 0.8
   ```
2. **Review and apply deltas**: If deltas are generated, run `ace apply` to update knowledge base

#### Task Workflow with Beads
When using Beads (`bd` command available):
1. Start: `bd update <id> --status in_progress`
2. Work on task (tests auto-capture if ACE present)
3. **BEFORE** closing: `ace learn --beads <id> --min-confidence 0.8` (MANDATORY - do NOT skip)
4. Close: `bd close <id> --reason "Description"`

**CRITICAL:** Step 3 is NOT optional. You MUST run `ace learn` before closing ANY bead in ACE-enabled projects. This is how the system learns and improves.

### When to Use ACE Commands

| Situation | Command | Required |
|-----------|---------|----------|
| Before starting work | `ace get bullets` | Recommended |
| After build/test failure | `ace capture --bead <id> --exec <json>` | **MANDATORY** |
| After completing task | `ace learn --beads <id>` | **MANDATORY** |
| To see system status | `ace status` | Optional |
| To apply pending updates | `ace apply` | When prompted |

### Execution Trace Capture Examples

#### TypeScript Build Failure
```bash
# After npm run build fails
ace capture --bead bd-123 --exec build-errors.json --outcome failure
```

#### Test Failure
```bash
# After npm test fails
ace capture --bead bd-123 --exec test-errors.json --outcome failure
```

#### Successful Completion
```bash
# After all checks pass
ace capture --bead bd-123 --outcome success
```

### Key Principles
1. **Never skip `ace learn`** after completing work - this is how the system improves
2. **Always capture failures** - errors are valuable learning signals
3. **Consult learned patterns first** - avoid repeating past mistakes
4. **Trust the feedback loop** - the more traces captured, the better future performance

## Architecture

Multi-agent pipeline orchestrated by [src/orchestrator.ts](src/orchestrator.ts):

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

[`src/phases/freshness.ts`](src/phases/freshness.ts) tracks metadata in `_sources.meta.json`:

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

[`DataSourceBadges.tsx`](web/components/DataSourceBadges.tsx) displays:
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

See [src/types.ts](src/types.ts):

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
- [amp-prospector](../amp-prospector/) - Related research agent
- Notion "Using Salesforce" page (internal)
