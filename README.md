# Amp Sales Workbench

Multi-agent sales workflow system that automates prospect research, account enrichment, and CRM updates by connecting Gong, Notion, and Salesforce via Amp SDK and MCP servers.

## Features

- **Automated Research**: Leverages amp-prospector for initial prospect discovery (integration pending)
- **Multi-Source Enrichment**: Pulls data from Salesforce, Gong calls, and Notion knowledge base
- **Smart Consolidation**: AI merges information with delta analysis and conflict resolution
- **Reviewable Drafts**: Generates YAML change proposals with confidence levels
- **Safe CRM Sync**: Idempotent, optimistic-concurrency Salesforce updates
- **Team Visibility**: Mirrors summaries to Notion for collaboration (coming soon)

## Quick Start

```bash
# 1. Install Node dependencies
npm install

# 2. Set up Python virtual environment
python3 -m venv venv
source venv/bin/activate.fish  # fish shell
# source venv/bin/activate     # bash/zsh
# venv\Scripts\activate        # Windows

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env
# Add your AMP_API_KEY to .env
# Configure MCP servers in Amp settings (Gong, Salesforce, Notion)

# 5. Launch Streamlit UI (Recommended)
streamlit run streamlit_app.py

# Or use CLI
npm run manage "Acme Corp"
```

**See [docs/SETUP.md](./docs/SETUP.md) for detailed setup instructions.**

## Streamlit UI

### Overview

```
┌─────────────────────────────────────────────────────────────┐
│  ⚡ Amp Sales Workbench                                     │
├─────────────────────────────────────────────────────────────┤
│  🚀 Quick Actions | 📋 Prep | 📞 After Call | 💾 CRM | 📊  │
│                                                             │
│  ┌───────────────┬───────────────┬───────────────┐         │
│  │ 🔍 Research   │ 📝 Pre-Call   │ 📞 Post-Call  │         │
│  ├───────────────┼───────────────┼───────────────┤         │
│  │ Full Refresh  │ Generate      │ Process       │         │
│  │ Update Gong   │ Brief         │ Latest Call   │         │
│  └───────────────┴───────────────┴───────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

The Streamlit UI provides:
- **Visual dashboard** for all agent workflows
- **One-click actions** for common tasks
- **Capability detection** showing which MCP integrations are active
- **Interactive draft review** with approval checkboxes
- **Real-time execution** of all agents

### Usage

```bash
# Start Streamlit server
streamlit run streamlit_app.py

# Open browser to http://localhost:8501
# Select an account from the sidebar
# Use Quick Actions or tabbed views for workflows
```

### Tabs

- **🚀 Quick Actions**: One-click buttons for all 11+ agents
- **📋 Prep**: Pre-call briefs with MEDDIC, stakeholders, demo focus
- **📞 After Call**: Post-call summaries, follow-up emails, coaching
- **💾 CRM Updates**: Review/approve draft changes before Salesforce sync
- **📊 Insights**: Account health, opportunities, signals, deltas

See [docs/STREAMLIT_UI.md](./docs/STREAMLIT_UI.md) for complete guide.

## CLI Commands

```bash
# Full pipeline
npm run manage "Acme Corp"
npm run manage "Acme Corp" -- --domain acme.com --sfid 001xx000...
npm run manage "Acme Corp" -- --apply

# Individual agents
npm run precall "Acme Corp" "2025-10-22"
npx tsx scripts/test-postcall.ts "Acme Corp" [callId]
npx tsx scripts/test-agents.ts

# Development
npm run typecheck
DEBUG=1 npm run manage "Company"
```

For all agent commands, see [docs/AGENTS_GUIDE.md](./docs/AGENTS_GUIDE.md).

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
├── agents/                # Standalone agents
│   └── preCallBrief.ts    # Pre-call brief generator
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
├── briefs/               # Pre-call briefs (JSON + Markdown)
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

## Capability Detection

The system automatically detects which MCP servers are available:

```bash
# Test capabilities
npx tsx scripts/test-capabilities.ts

# View cached capabilities
cat data/capabilities.json
```

**Graceful Degradation**: When an MCP is unavailable, agents:
- Skip that data source
- Use cached data if available
- Generate results with reduced data set
- Display warnings in UI

See [docs/CAPABILITY_SYSTEM.md](./docs/CAPABILITY_SYSTEM.md) for details.

## Development

```bash
# Typecheck (no build needed - uses tsx)
npm run typecheck

# Run in debug mode
DEBUG=1 npm run manage "Company"

# Track work with beads
bd ready                    # See unblocked tasks
bd show <issue-id>          # View task details
bd close <issue-id>         # Complete a task
```

## Troubleshooting

### MCP Connection Issues

```bash
# Test MCP connections
npx tsx scripts/check-mcp-servers.ts

# Force capability re-detection
rm data/capabilities.json
npx tsx scripts/test-capabilities.ts
```

**Common Issues:**
- **Gong 401**: Check API credentials in Amp settings
- **Salesforce SOQL Error**: Verify object permissions
- **Notion 404**: Update `notion-config.json` with valid page IDs

### Data Issues

```bash
# Check raw data
ls -la data/accounts/<slug>/raw/

# Validate snapshots
cat data/accounts/<slug>/snapshots/snapshot-*.json | jq .

# Clear cache and rebuild
rm -rf data/accounts/<slug>/raw/*.json
npm run manage "<Account Name>"
```

### Streamlit Issues

```bash
# Port already in use
streamlit run streamlit_app.py --server.port 8502

# Clear Streamlit cache
streamlit cache clear

# Dependencies missing
pip install -r requirements.txt
```

For more help, see [docs/WORKFLOWS.md](./docs/WORKFLOWS.md) and [CONTRIBUTING.md](./CONTRIBUTING.md).

## Implementation Notes

### Completed
- ✅ All phase implementations (intake through sync)
- ✅ AI-powered consolidation using Amp SDK execute()
- ✅ Draft generation with detailed prompts
- ✅ Salesforce sync with optimistic concurrency
- ✅ File I/O for all data stages
- ✅ Complete orchestrator integration
- ✅ Pre-Call Brief Agent with MEDDIC framework

### TODO
- 🔲 Wire up actual MCP tool calls (currently stubbed)
- 🔲 Integrate amp-prospector runProspector()
- 🔲 Add YAML parser (js-yaml) for draft loading
- 🔲 Implement Notion mirroring (#13)
- 🔲 End-to-end testing with real data (#7)
- 🔲 Event-driven triggers (#11, future)
- 🔲 Web UI for approvals (#5, future)

## Related Projects

- [amp-prospector](../amp-prospector) - Initial prospect research agent

## License

MIT
