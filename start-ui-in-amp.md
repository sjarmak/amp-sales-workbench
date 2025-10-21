# Starting the Web UI with MCP Access

## The Problem

The API server needs access to MCP tools (Salesforce, Gong, Notion) which are only available when running inside Amp's execution context. Running `npm run start:web` launches the API server with `npx tsx`, which runs outside Amp's context, so MCP tools aren't available.

## Solution: Start API Server Through Amp

You have two options:

### Option 1: Manual Start (Recommended for Testing)

1. **Start the API server in an Amp thread:**
   - In Amp, say: "Start the API server by running the api-server.ts file. Keep it running and listening on port 3001."
   - Amp will execute the server and keep it alive with MCP access

2. **In a separate terminal, start the Next.js frontend:**
   ```bash
   cd web && npm run dev
   ```

3. **Access the UI:**
   - Open http://localhost:3000

### Option 2: Create Start Script for Amp

Create a script that Amp can execute to start both servers:

**File: `scripts/start-ui-servers.ts`**
```typescript
import { spawn } from 'child_process';

// Start API server (this will run in Amp context with MCP access)
console.log('Starting API server on port 3001...');
const apiServer = await import('../api-server.js');

// Start frontend in separate process
console.log('Starting Next.js frontend on port 3000...');
const frontend = spawn('npm', ['run', 'dev'], {
  cwd: 'web',
  stdio: 'inherit'
});

// Keep running
await new Promise(() => {});
```

Then in Amp: "Run scripts/start-ui-servers.ts and keep both servers running"

### Option 3: Use Amp as Reverse Proxy (Advanced)

Instead of running servers directly, create an Amp agent that acts as an API proxy:

1. Frontend calls http://localhost:3001/api/...
2. Simple Express server forwards requests to Amp thread
3. Amp thread executes agents with MCP access
4. Results flow back through proxy

## Current Workaround

Until the server is properly integrated with Amp context:

1. **For data refresh**: Use the "Full Refresh" button which will attempt to use Amp SDK
2. **For initial setup**: Manually create a General Mills account in Salesforce
3. **For testing**: Run individual agent scripts through Amp directly

## Future Enhancement

Ideal architecture:
- API server is a thin HTTP wrapper
- Each endpoint spawns an Amp SDK `execute()` call
- Amp executes the actual agent code with MCP access
- Results stream back via SSE

This requires rearchitecting the execution model to be request-based rather than keeping a long-running server.
