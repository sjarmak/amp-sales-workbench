# Amp Sales Workbench

Multi-agent sales workflow system that automates prospect research, account enrichment, and CRM updates by connecting Gong, Notion, and Salesforce via Amp SDK and MCP servers.

## Features

- **Automated Research**: Leverages amp-prospector for initial prospect discovery
- **Multi-Source Enrichment**: Pulls data from Salesforce, Gong calls, and Notion knowledge base
- **Smart Consolidation**: Merges information with delta analysis and conflict resolution
- **Reviewable Drafts**: Generates YAML change proposals with confidence levels
- **Safe CRM Sync**: Idempotent, optimistic-concurrency Salesforce updates
- **Team Visibility**: Mirrors summaries to Notion for collaboration

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Add your Amp API key to .env
# Configure MCP servers in your Amp settings (Gong, Salesforce, Notion)

# Run for an account
npm run manage "Acme Corp"

# With options
npm run manage "Acme Corp" -- --domain acme.com --sfid 001xx000...

# Apply approved changes
npm run manage "Acme Corp" -- --apply
```

## Architecture

See [AGENTS.md](./AGENTS.md) for complete documentation.

### Pipeline

```
Intake → Research → Enrichment → Consolidation → Draft → [Approval] → Sync
```

### Directory Structure

```
src/
├── orchestrator.ts        # Main pipeline coordinator
├── execute-agent.ts       # CLI entry point
├── types.ts               # Core type definitions
└── phases/
    ├── intake.ts          # Account resolution
    ├── research.ts        # amp-prospector wrapper
    ├── ingest/            # MCP data fetching
    │   ├── salesforce.ts
    │   ├── gong.ts
    │   └── notion.ts
    ├── consolidate.ts     # Data merging
    ├── draft.ts           # Change proposal generation
    ├── approve.ts         # Approval gate
    └── sync/
        └── syncSalesforce.ts
```

## Data Storage

```
data/accounts/<account-slug>/
├── prospecting/          # amp-prospector outputs
├── raw/                  # Raw MCP data (gitignored)
├── snapshots/            # Consolidated snapshots
├── drafts/               # Reviewable change proposals
└── applied/              # Sync receipts
```

## Configuration

### Notion Config

Create `notion-config.json`:

```json
{
  "knowledgePages": {
    "customerWins": "page-id",
    "competitiveAnalysis": "page-id",
    "productInfo": "page-id"
  },
  "accountsDatabase": "database-id"
}
```

### MCP Servers

Configure in Amp settings:
- **Gong**: For call recordings and transcripts
- **Salesforce**: For CRM data and updates
- **Notion**: For knowledge base and team collaboration

## Workflow

1. **Research**: Initial prospect discovery via amp-prospector
2. **Enrich**: Pull recent Gong calls, Salesforce data, Notion pages
3. **Consolidate**: Merge sources, detect changes vs current CRM state
4. **Draft**: Generate `crm-draft.yaml` with proposed updates
5. **Review**: Edit YAML or approve as-is
6. **Apply**: Push changes to Salesforce with `--apply`
7. **Mirror**: Update Notion for team visibility

## Safety

- Optimistic concurrency checks (LastModifiedDate)
- Idempotent patches (only apply if "before" matches)
- Confidence levels on all changes
- PII redaction in public artifacts
- Rate limiting and caching

## Development

```bash
# Typecheck
npm run typecheck

# Run in debug mode
DEBUG=1 npm run manage "Company"

# Track work with beads
bd quickstart
```

## Related Projects

- [amp-prospector](../amp-prospector) - Initial prospect research agent

## License

MIT
