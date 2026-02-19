# Sourcegraph Sales Workbench

Multi-agent sales workflow system that automates account research, deal preparation, and CRM enrichment by consolidating data from Gong, Salesforce, and Notion through a configurable data lake architecture.

## Features

- **25+ Specialized Agents**: Pre-call briefs, deal reviews, coaching, qualification (MEDDIC/BANT/SPICED), win/loss analysis, demo planning, and more
- **Multi-Source Data Layer**: Configurable data routing across BigQuery, Parquet lakehouse, and local CSV indexes
- **Lifecycle Stage Workspace**: Agents organized by deal stage -- prospecting through closed-won/lost
- **Portfolio Knowledge Base**: Cross-account pattern extraction from 1000+ Gong calls
- **Web UI**: Next.js + shadcn/ui frontend with one-click agent execution
- **Smart Caching**: Hash-based transcript deduplication, TTL-based staleness detection, incremental refresh

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Add OPENAI_API_KEY (required)
# Add GCP_PROJECT_ID, GCP_DATASET_ID (for BigQuery mode)
# Add GONG_ACCESS_KEY, GONG_ACCESS_SECRET (for direct Gong API)

# 3. Launch Web UI
npm run start:web
# Frontend: http://localhost:3000
# API: http://localhost:3001
```

## Web UI

The web UI provides:
- Account selector populated from `data/accounts/`
- Lifecycle stage tabs (Prospecting, Qualification, Solution Mapping, Validation, Closing, Post-Mortem)
- One-click agent execution with structured output
- Data source status badges with freshness indicators and manual refresh
- Gong search term configuration per account

## Data Architecture

### Source Router

Data sources are configured via environment variables, enabling different setups for dev, hybrid, and cloud:

```
GONG_SOURCE=parquet|bigquery|events-api|mcp    (default: parquet)
SALESFORCE_SOURCE=local-cache|bigquery|mcp      (default: local-cache)
ENRICHED_SOURCE=local-cache|bigquery            (default: local-cache)
```

| Preset | Gong | Salesforce | Enriched | Use Case |
|--------|------|------------|----------|----------|
| `dev` | parquet | local-cache | local-cache | Local development, no GCP needed |
| `hybrid` | bigquery | bigquery | local-cache | Staging with BQ primary |
| `cloud` | bigquery | bigquery | bigquery | Full cloud deployment |

### Data Clients

- **BigQuery** (`src/clients/gongBigQueryClient.ts`, `salesforceBigQueryClient.ts`) -- SQL queries against GCP datasets
- **Parquet Lakehouse** (`src/clients/gongParquetClient.ts`) -- Local Gong data via Python/Polars subprocess
- **Direct Gong API** (`src/clients/gongApiClient.ts`) -- REST API fallback with batch transcript fetching
- **CSV/Local Cache** (`src/services/csvProcessor.ts`) -- Fuzzy-indexed Salesforce account search

### Data Layer Service

`src/services/dataLayerService.ts` provides a unified interface abstracting over all sources:
- Account search with fuzzy matching (Fuse.js)
- Gong call linkage by account ID
- Portfolio knowledge base loading
- Account enrichment with linked calls

See [docs/DATA_LAYER.md](./docs/DATA_LAYER.md) for full architecture.

### Storage Layout

```
data/
  accounts/<account-slug>/
    metadata.json             # Account name, domain, Salesforce ID
    raw/                      # Cached source data (salesforce.json, gong_calls.json)
    snapshots/                # Consolidated account snapshots
    drafts/                   # Reviewable CRM change proposals
    briefs/                   # Pre-call briefs (JSON + Markdown)
    applied/                  # CRM sync receipts
    runs/<agent>/<run-id>/    # Agent execution outputs
  tables/                     # Data layer indexes
    salesforce_accounts.csv
    salesforce_accounts_index.json
    account_gong_links.jsonl
    portfolio_knowledge.json
  global/                     # Portfolio-level analysis outputs
```

## Agents

All agents use OpenAI (GPT-4 / GPT-4o) with structured prompt templates from `prompts/agents/`.

| Stage | Agents |
|-------|--------|
| Prospecting | Pre-call brief, Prospector research, Prospector target |
| Qualification | Discovery recap, Qualification (MEDDIC/BANT/SPICED), Solution map, Evaluation criteria |
| Solution Mapping | Business case, Demo ideas, Customized demo plan, Executive talking points |
| Validation | Deal review, Coaching feedback, Risk heuristics |
| Closing | Mutual action plan, Follow-up email |
| Post-Mortem | Closed-won analysis, Closed-lost analysis, Win story, Loss analysis |
| Cross-Stage | Post-call update, Meeting summary, Live Q&A, Handoff, Backfill, Executive summary |

### Running Agents

```bash
# Via Web UI (recommended)
npm run start:web

# Via CLI
npm run manage "Acme Corp"
npm run precall "Acme Corp" "2025-10-22"
npm run test:agents
```

## Portfolio Knowledge Base

Extract patterns across all Gong calls to build a searchable knowledge base:

```bash
npm run portfolio:extract    # Extract patterns from calls
npm run portfolio:analyze    # Analyze extracted data
npm run portfolio:build      # Build searchable KB
npm run portfolio:status     # Check KB status
```

The KB feeds into agent context, providing competitive intelligence, objection patterns, and use case frequency data.

## Gong Data Pipeline

```bash
npm run gong:backfill        # Backfill Gong transcript cache
npm run gong:stats           # View cache statistics
npm run gong:bq-sync         # Sync Gong data to BigQuery
npm run lakehouse:sync       # Sync BigQuery to local Parquet lakehouse
```

Transcripts are cached with hash-based deduplication to avoid reprocessing.

## BigQuery Setup

```bash
npm run validate:bigquery    # Validate BQ connectivity and schema
npm run migrate:gong         # Migrate Gong data to BQ
npm run migrate:salesforce   # Migrate Salesforce data to BQ
```

See [docs/BIGQUERY_SETUP.md](./docs/BIGQUERY_SETUP.md) for GCP project configuration.

## Development

```bash
# Typecheck (no build step -- uses tsx to run TypeScript directly)
npm run typecheck

# Debug mode
DEBUG=1 npm run manage "Acme Corp"

# Run API server only
npm run api

# Run frontend only
npm run web
```

### Project Structure

```
src/
  agents/               # 25+ specialized agents with prompt templates
  clients/              # Data source clients (BigQuery, Gong API, Parquet)
  config/               # Data source routing, agent configs, lifecycle stages
  context/              # Account context building for agent injection
  gong-cache/           # Transcript caching with hash-based deduplication
  lake/                 # Data lake export utilities
  phases/               # Pipeline phases (intake, ingest, consolidate, draft, sync)
  portfolio/            # Portfolio-level KB extraction and analysis
  services/             # Data layer service, BigQuery client, CSV processor
web/                    # Next.js + shadcn/ui frontend
api-server.ts           # Express API server (port 3001)
prompts/agents/         # Agent system prompt templates (Markdown)
config/                 # Playbook configs, meeting templates, product knowledge
scripts/                # Data migration, backfill, and validation utilities
```

## Documentation

- [Data Layer Architecture](./docs/DATA_LAYER.md)
- [Data Layer Integration](./docs/DATA_LAYER_INTEGRATION.md)
- [BigQuery Setup](./docs/BIGQUERY_SETUP.md)
- [Web UI Architecture](./docs/WEB_UI_ARCHITECTURE.md)
- [Demo System](./docs/DEMO_SYSTEM_ARCHITECTURE.md)
- [Gong Search Configuration](./docs/gong-search-configuration.md)

## License

MIT
