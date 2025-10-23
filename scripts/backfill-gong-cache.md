# Gong Cache Backfill

## How to Populate Gong Cache

The Gong cache must be backfilled from an **Amp agent context** due to MCP transport limitations.

### Steps

1. **In this Amp thread**, run:

\`\`\`typescript
import { getGongCacheManager } from './src/gong-cache/manager.js'

const manager = getGongCacheManager()
await manager.backfill({ months: 6 })
\`\`\`

2. This will populate `data/gong-cache/calls-index.json` with ~6 months of call metadata

3. After backfill, the web UI and API server can use the cache (read-only)

### Why?

The direct MCP client (StdioClientTransport) doesn't work outside Amp's execution context. It creates a subprocess that expects MCP protocol handshakes that only work when Amp manages the lifecycle.

### Workaround

- Gong MCP wrapper now uses `globalThis` functions (Amp SDK routing)
- Works perfectly in Amp context
- Fails gracefully outside Amp (returns empty data)
- Cache serves as persistent storage once populated

### Future Improvement

To enable standalone backfill, we'd need:
- HTTP-based MCP client instead of stdio
- Or: Amp SDK thin client for non-interactive tool calls
- Or: Direct Gong REST API client (bypass MCP entirely)
