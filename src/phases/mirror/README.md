# Notion Mirror Phase

## Overview

The Notion Mirror phase (Phase 7) synchronizes consolidated account data and summaries to a Notion accounts database for team visibility and collaboration.

## Current Implementation Status

**Phase 1: Skeleton Implementation** ✅

- Core module structure created
- Error handling and graceful fallback
- Configuration validation
- Content block preparation logic

**Phase 2: MCP Integration** 🚧 (Pending)

The current implementation prepares all data structures but does not yet execute actual Notion API calls. To complete the integration:

### Required Implementation

1. **Wrap MCP tool calls in Amp SDK `execute()`**
   - Search for existing pages: `mcp__notion__API-post-search`
   - Create new pages: `mcp__notion__API-post-page`  
   - Update content: `mcp__notion__API-patch-block-children`

2. **Example pattern** (from other phases):
   ```typescript
   const prompt = `Use Notion MCP to search for page titled "${accountName}"`
   for await (const message of execute({ prompt })) {
     // Parse tool results from message
   }
   ```

3. **Alternative**: Direct MCP client integration if Amp SDK supports programmatic tool invocation

## Configuration

Set `accountsDatabase` in [`notion-config.json`](file:///Users/sjarmak/amp-sales-workbench/notion-config.json):

```json
{
  "accountsDatabase": "your-notion-database-id",
  "knowledgePages": { ... }
}
```

If not configured, the phase skips gracefully without failing the pipeline.

## Content Mirrored

Each account page includes:

1. **Header**: Last updated timestamp, source file reference
2. **Executive Summary**: High-level account overview
3. **Latest Deal Review**: Active opportunities status
4. **Recent Call Insights**: Last 3 call summaries
5. **Recommended Next Actions**: Prioritized action items
6. **Risks & Objections**: Known blockers
7. **Key Insights**: Strategic observations

All content sourced from `drafts/summary-YYYYMMDD.md` and consolidated snapshot.

## Error Handling

- Missing config → Skip (success=true, no error)
- Invalid database ID → Log warning, continue pipeline
- MCP tool failures → Log error, return `success: false` but don't crash orchestrator

## Testing

Once MCP integration is complete:

```bash
# Configure notion-config.json first
npm run manage "Test Account" -- --apply

# Check console output for Notion page URL
# Verify page created/updated in Notion workspace
```

## Future Enhancements

- [ ] Incremental updates (append-only mode)
- [ ] Rich text formatting (bold, links, callouts)
- [ ] Embedded tables for contacts/opportunities
- [ ] Automatic syncing on schedule
- [ ] Bi-directional sync (Notion → Salesforce)
