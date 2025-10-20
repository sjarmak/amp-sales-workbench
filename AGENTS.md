# Agent Instructions for Amp Sales Workbench

## Overview

**Amp Sales Workbench** is a multi-agent sales workflow system that automates prospect research, account enrichment, data consolidation from multiple sources (Gong, Notion, Salesforce), draft generation, and CRM synchronization. It mimics Scratchpad-like workflows while leveraging your existing MCP servers.

## Commands

- **Run for account**: `npm run manage "Acme Corp"` or `npx tsx src/execute-agent.ts "Acme Corp"`
- **Run with options**: `npm run manage "Acme Corp" -- --domain acme.com --sfid 001xx000...`
- **Apply approved changes**: `npm run manage "Acme Corp" -- --apply`
- **Debug mode**: `DEBUG=1 npx tsx src/execute-agent.ts "Company Name"`
- **Typecheck**: `npx tsc --noEmit` (no build needed - uses tsx for direct TS execution)
- **Track work**: Use `bd` for tracking progress and maintaining memory across agent work

## Architecture

Multi-agent pipeline orchestrated by [src/orchestrator.ts](file:///Users/sjarmak/amp-sales-workbench/src/orchestrator.ts):

### Agents

1. **Research Agent** (`src/phases/research.ts`) - Wraps amp-prospector for initial prospect research (on-demand for new accounts or refresh)
2. **Enrichment Agent** (`src/phases/ingest/`) - Pulls data from Salesforce, Gong, Notion via MCP (read-only)
3. **Consolidation Agent** (`src/phases/consolidate.ts`) - Merges research + enrichment data into unified snapshot with delta analysis
4. **Draft Agent** (`src/phases/draft.ts`) - Generates reviewable YAML change proposals and markdown summaries
5. **Approval Gate** (`src/phases/approve.ts`) - File-based approval workflow (edit YAML, then `--apply`)
6. **CRM Sync Agent** (`src/phases/sync/syncSalesforce.ts`) - Applies minimal, idempotent patches to Salesforce post-approval

### Pipeline Flow

```
Intake → Research (amp-prospector) → Enrichment (MCP reads) 
  → Consolidation → Draft Generation → [Approval] → Salesforce Sync → Notion Mirror
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
- **Knowledge sources**: 
  - Customer wins & success stories
  - Competitive analysis pages
  - Product information
  - Account-specific pages
- **Schema**: Flexible parsing, agent handles varying formats
- **Write back**: Mirror summaries to Accounts database for team sharing
- **Tools used**: `API-post-search`, `API-retrieve-a-page`, `API-get-block-children`, `API-post-page`

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

## Next Steps

1. Implement basic orchestrator and intake
2. Wire up MCP clients for Salesforce, Gong, Notion
3. Build consolidation prompts
4. Create draft generation logic
5. Implement Salesforce patch executor with concurrency checks
6. Add Notion mirroring (optional)
7. Build simple web UI for approvals (future)
8. Add event-driven triggers (future)

## Resources

- [Scratchpad.com](https://www.scratchpad.com/) - Inspiration for workflow
- [Amp SDK Docs](https://ampcode.com/manual)
- [amp-prospector](file:///Users/sjarmak/amp-prospector/) - Related research agent
- Notion "Using Salesforce" page: [link](https://www.notion.so/Using-Salesforce-b3a97eb1836242c5bd955fba941be9dd)

---

**We track work in Beads instead of Markdown. Run `bd quickstart` to see how.**
