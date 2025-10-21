# Web UI Architecture

## Overview

The Amp Sales Workbench web UI provides a modern interface for executing sales agents with full MCP (Model Context Protocol) access. This document explains how the system is architected to ensure agents have access to Salesforce, Gong, and Notion data.

## Key Components

### 1. API Server (`api-server.ts`)

The Express API server runs on port 3001 and provides REST endpoints for:
- Account management
- Agent execution
- Data source refresh
- Real-time progress streaming (SSE)

**Critical**: The API server itself does NOT have direct MCP access. It delegates execution to the agent runner which runs in Amp's context.

### 2. Agent Runner (`src/agents/agent-runner.ts`)

Unified interface for executing all agents. Key features:
- **Direct imports**: Imports agent modules directly (no spawning)
- **Amp SDK context**: Runs in Amp's execution context where MCP tools are available
- **Consistent interface**: All agents follow the same execution pattern
- **Error handling**: Provides unified error handling and metadata

### 3. Frontend (`web/`)

Next.js application on port 3000 that provides:
- Modern UI with shadcn/ui components
- Account selector and management
- One-click agent execution buttons
- Data source refresh controls
- Real-time progress updates

## MCP Access Architecture

### The Problem

When running TypeScript files via `npx tsx` or `spawn()`, the code executes in Node.js directly, **outside** of Amp's context. This means:
- `globalThis.mcp__salesforce__*` functions don't exist
- `globalThis.mcp__gong__*` functions don't exist
- `globalThis.mcp__notion__*` functions don't exist

MCP wrappers in `src/phases/ingest/mcp-wrapper.ts` detect this and return empty results, causing data lookups to fail.

### The Solution

All agent execution flows through the **agent-runner** which uses Amp SDK's `execute()`:

```typescript
// API Server calls agent-runner
const result = await executeAgent('salesforce-refresh', {
  accountName: 'General Mills',
  mode: 'auto'
});

// Agent-runner imports and calls agent directly
import { refreshData } from './refreshData.js';
const result = await refreshData(accountKey, options);

// Agent uses MCP wrappers
import { callSalesforceSOQL } from '../phases/ingest/mcp-wrapper.js';
const data = await callSalesforceSOQL({ query: 'SELECT...' });

// MCP wrapper checks globalThis (NOW EXISTS!)
if (typeof globalThis.mcp__salesforce__soql_query === 'function') {
  return await globalThis.mcp__salesforce__soql_query(params);
}
```

## Data Flow

```
┌─────────────┐
│  Web UI     │  User clicks "Refresh Salesforce"
│ (Next.js)   │
└──────┬──────┘
       │ POST /api/accounts/:slug/sources/:source/refresh
       ↓
┌─────────────┐
│ API Server  │  Delegates to agent-runner
│ (Express)   │
└──────┬──────┘
       │ executeAgent('salesforce-refresh', options)
       ↓
┌─────────────┐
│Agent Runner │  Imports agent module
│             │  Runs in Amp SDK context
└──────┬──────┘
       │ refreshData(accountKey, options)
       ↓
┌─────────────┐
│ refreshData │  Uses MCP wrappers
│   Agent     │
└──────┬──────┘
       │ callSalesforceSOQL(query)
       ↓
┌─────────────┐
│ MCP Wrapper │  Checks globalThis.mcp__salesforce__*
│             │  ✓ Functions exist (Amp SDK context)
└──────┬──────┘
       │
       ↓
┌─────────────┐
│ Salesforce  │  MCP server executes query
│     MCP     │
└─────────────┘
```

## Agent Execution Patterns

### Standard Agent

```typescript
// src/agents/preCallBrief.ts
export async function generatePreCallBrief(
  accountKey: AccountKey,
  meetingDate?: string
): Promise<PreCallBrief> {
  // Load data (uses MCP access if needed)
  const snapshot = await loadLatestSnapshot(accountDataDir);
  
  // Execute with Amp SDK
  const brief = await executeGeneration(prompt, context);
  
  // Save and return
  return brief;
}
```

### Data Refresh Agent

```typescript
// src/agents/refreshData.ts
export async function refreshData(
  accountKey: AccountKey,
  options: RefreshOptions
): Promise<RefreshResult> {
  // Detect capabilities (uses Amp SDK internally)
  const capabilities = await detectCapabilities();
  
  // Ingest from Salesforce (uses MCP wrappers)
  const sfData = await ingestFromSalesforce(accountKey);
  
  // Save and return
  return result;
}
```

## Adding New Agents

1. **Create agent module** in `src/agents/`:

```typescript
// src/agents/myNewAgent.ts
import type { AccountKey } from '../types.js';

export async function runMyNewAgent(
  accountKey: AccountKey,
  accountDataDir: string,
  options?: any
): Promise<any> {
  // Your agent logic here
  // Can use MCP wrappers for data access
  return result;
}
```

2. **Register in agent-runner**:

```typescript
// src/agents/agent-runner.ts

export type AgentName = 
  | 'precall-brief'
  | 'my-new-agent'  // Add here
  | ...;

// In runAgent() switch statement:
case 'my-new-agent':
  const { runMyNewAgent } = await import('./myNewAgent.js');
  result = await runMyNewAgent(accountKey, accountDataDir, options);
  break;
```

3. **Add to API server** (optional, for UI integration):

```typescript
// api-server.ts - agentScripts map
const agentScripts: Record<string, string> = {
  'my-new-agent': 'src/agents/myNewAgent.ts',
  // ...
};
```

4. **Add UI button** in web components (optional):

```typescript
// web/components/AgentButton.tsx
<AgentButton
  agent="my-new-agent"
  accountName={accountName}
  label="My New Agent"
/>
```

## Development vs Production

### Development (This System)

- Runs in Amp's context
- API server delegates to agent-runner
- MCP tools available on `globalThis`
- Full Salesforce, Gong, Notion access

### CLI Execution (Limited)

```bash
npx tsx src/agents/refreshData.ts "General Mills"
```

❌ **No MCP access** - runs outside Amp context
✓ Use CLI only for testing agent logic, not MCP integration

### Testing MCP Integration

Always test through the web UI or by invoking via Amp SDK:

```bash
# Start the web UI
npm run start:web

# Navigate to http://localhost:3000
# Select account and click refresh buttons
```

## Troubleshooting

### Problem: "Could not find Salesforce account"

**Cause**: MCP tools not available (running outside Amp context)

**Solution**: 
- Ensure running through web UI, not direct `npx tsx`
- Check Amp MCP configuration
- Verify MCP servers are connected in Amp settings

### Problem: "Salesforce MCP not available"

**Cause**: MCP server not configured in Amp

**Solution**:
1. Open Amp settings
2. Configure Salesforce MCP server
3. Restart API server
4. Refresh web UI

### Problem: Agent returns empty data

**Cause**: 
- MCP wrappers returning stubs
- Data source cache is empty

**Solution**:
1. Click "Full Refresh" in UI to force data fetch
2. Check Amp MCP server logs
3. Verify account exists in Salesforce

## Performance Considerations

### Caching Strategy

The system implements smart caching with staleness detection:

- **Salesforce**: Entity-level TTLs (6-24 hours)
- **Gong**: 24-hour call list cache, hash-based transcript cache
- **Notion**: 7-14 day page cache

See `src/phases/freshness.ts` for TTL configuration.

### Incremental Refresh

Most agents support incremental refresh:

```typescript
// Auto mode: only refresh stale data
refreshData(accountKey, { mode: 'auto' })

// Incremental: use date filters to fetch only new/modified
refreshData(accountKey, { mode: 'incremental' })

// Full: ignore cache, fetch everything
refreshData(accountKey, { mode: 'full' })
```

## Security

### MCP Access Control

- MCP tools inherit permissions from configured MCP servers
- No elevation of privileges through agent-runner
- All Salesforce writes use optimistic concurrency (LastModifiedDate checks)

### API Endpoints

- No authentication currently implemented (local deployment)
- CORS enabled for localhost development
- Future: Add API key authentication for production

## Future Enhancements

1. **Agent streaming**: Real-time progress updates during long-running agents
2. **Background jobs**: Queue agents for async execution
3. **Webhooks**: Trigger agents from external events (Gong calls, SF updates)
4. **Multi-user**: Per-user MCP configurations and permissions
5. **Monitoring**: Agent execution metrics and error tracking
