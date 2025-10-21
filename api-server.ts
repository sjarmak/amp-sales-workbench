import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { readMeta, computeStaleness, type SourceStatus } from './src/phases/freshness.js';
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const DATA_DIR = path.join(process.cwd(), 'data/accounts');

// Get MCP availability - for now, assume all configured MCPs are available
// In the future, could add actual health checks
function getMcpCapabilities(): { salesforce: boolean; gong: boolean; notion: boolean } {
	// Assume all MCPs are available
	// User will see errors on refresh if not properly configured
	return { salesforce: true, gong: true, notion: true };
}

// Helper to run agent scripts
async function runAgent(scriptPath: string, args: string[]): Promise<{ success: boolean; output: string; error?: string }> {
  return new Promise((resolve) => {
    const proc = spawn('npx', ['tsx', scriptPath, ...args], {
      cwd: process.cwd(),
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({
        success: code === 0,
        output: stdout,
        error: code !== 0 ? stderr : undefined,
      });
    });
  });
}

// Helper to run agent scripts with streaming
function runAgentStream(scriptPath: string, args: string[], onData: (data: string) => void): Promise<{ success: boolean; output: string; error?: string }> {
  return new Promise((resolve) => {
    const proc = spawn('npx', ['tsx', scriptPath, ...args], {
      cwd: process.cwd(),
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      onData(text);
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      onData(text);
    });

    proc.on('close', (code) => {
      resolve({
        success: code === 0,
        output: stdout,
        error: code !== 0 ? stderr : undefined,
      });
    });
  });
}

// Get all accounts
app.get('/api/accounts', async (req, res) => {
  try {
    const mcpCapabilities = getMcpCapabilities();
    const accounts = await fs.readdir(DATA_DIR);
    const accountData = await Promise.all(
      accounts.map(async (slug) => {
        const metadataPath = path.join(DATA_DIR, slug, 'metadata.json');
        
        let name = slug.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
        try {
          const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
          if (metadata.name) {
            name = metadata.name;
          }
        } catch {}
        
        return {
          slug,
          name,
          capabilities: mcpCapabilities,
        };
      })
    );
    res.json(accountData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// Create new account
app.post('/api/accounts', async (req, res) => {
  try {
    const { name, domain, salesforceId } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Company name is required' });
    }
    
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const accountDir = path.join(DATA_DIR, slug);
    
    // Check if account already exists
    try {
      await fs.access(accountDir);
      return res.status(400).json({ error: 'Account already exists' });
    } catch {
      // Account doesn't exist, continue
    }
    
    // Create directory structure
    await fs.mkdir(accountDir, { recursive: true });
    await fs.mkdir(path.join(accountDir, 'raw'), { recursive: true });
    await fs.mkdir(path.join(accountDir, 'prospecting'), { recursive: true });
    await fs.mkdir(path.join(accountDir, 'snapshots'), { recursive: true });
    await fs.mkdir(path.join(accountDir, 'drafts'), { recursive: true });
    await fs.mkdir(path.join(accountDir, 'applied'), { recursive: true });
    
    // Write account metadata
    const metadata = {
      name,
      domain: domain || null,
      salesforceId: salesforceId || null,
      createdAt: new Date().toISOString(),
    };
    await fs.writeFile(
      path.join(accountDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
    
    res.json({ success: true, slug });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// Update account name
app.patch('/api/accounts/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Company name is required' });
    }
    
    const accountDir = path.join(DATA_DIR, slug);
    const metadataPath = path.join(accountDir, 'metadata.json');
    
    // Check if account exists
    try {
      await fs.access(accountDir);
    } catch {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // Read existing metadata
    let metadata;
    try {
      metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
    } catch {
      metadata = {};
    }
    
    // Update name
    metadata.name = name;
    metadata.updatedAt = new Date().toISOString();
    
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    
    res.json({ success: true, slug });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update account' });
  }
});

// Get account data
app.get('/api/accounts/:slug', async (req, res) => {
  const { slug } = req.params;
  const accountDir = path.join(DATA_DIR, slug);

  try {
    // Load latest snapshot
    const snapshotsDir = path.join(accountDir, 'snapshots');
    const snapshots = await fs.readdir(snapshotsDir);
    const latestSnapshot = snapshots.sort().reverse()[0];
    const snapshot = latestSnapshot
      ? JSON.parse(await fs.readFile(path.join(snapshotsDir, latestSnapshot), 'utf-8'))
      : null;

    // Load latest draft
    const draftsDir = path.join(accountDir, 'drafts');
    let draft = null;
    try {
      const drafts = await fs.readdir(draftsDir);
      const latestDraft = drafts.filter((f) => f.endsWith('.json')).sort().reverse()[0];
      if (latestDraft) {
        draft = JSON.parse(await fs.readFile(path.join(draftsDir, latestDraft), 'utf-8'));
      }
    } catch {}

    res.json({ snapshot, draft });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch account data' });
  }
});

const agentScripts: Record<string, string> = {
  'precall-brief': 'scripts/test-precall-brief.ts',
  'postcall': 'scripts/test-postcall.ts',
  'demo-ideas': 'scripts/test-demo-idea.ts',
  'qualification': 'src/agents/qualification.ts',
  'email': 'scripts/test-followup-email.ts',
  'coaching': 'scripts/test-coaching.ts',
  'exec-summary': 'src/agents/execSummary.ts',
  'deal-review': 'src/agents/dealReview.ts',
  'closedlost': 'scripts/test-closed-lost.ts',
  'backfill': 'scripts/test-backfill.ts',
  'handoff': 'scripts/test-handoff.ts',
  'full-refresh': 'src/agents/refreshData.ts',
  'prospector': 'scripts/test-prospector.ts',
};

// Run agent
app.post('/api/agents/:agent', async (req, res) => {
  const { agent } = req.params;
  const { accountName, ...options } = req.body;

  const scriptPath = agentScripts[agent];
  if (!scriptPath) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  const args = [accountName];
  if (options.callId) args.push(options.callId);
  if (options.apply) args.push('--apply');
  
  // For full-refresh, add full mode and all sources
  if (agent === 'full-refresh') {
    args.push('--mode', 'full', '--sources', 'all');
  }

  const result = await runAgent(scriptPath, args);

  res.json(result);
});

// Stream agent execution (SSE)
app.get('/api/agents/:agent/stream', async (req, res) => {
  const { agent } = req.params;
  const { accountName, callId, apply } = req.query;

  const scriptPath = agentScripts[agent];
  if (!scriptPath) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const args = [accountName as string];
  if (callId) args.push(callId as string);
  if (apply) args.push('--apply');

  try {
    const result = await runAgentStream(scriptPath, args, (data) => {
      res.write(`data: ${JSON.stringify({ type: 'log', data })}\n\n`);
    });

    res.write(`data: ${JSON.stringify({ type: 'complete', success: result.success, error: result.error })}\n\n`);
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: String(error) })}\n\n`);
    res.end();
  }
});

// Get Gong calls
app.get('/api/accounts/:slug/calls', async (req, res) => {
  const { slug } = req.params;
  const gongFile = path.join(DATA_DIR, slug, 'raw/gong_calls.json');

  try {
    const data = JSON.parse(await fs.readFile(gongFile, 'utf-8'));
    res.json(data.calls || []);
  } catch (error) {
    res.json([]);
  }
});

// Get pre-call briefs
app.get('/api/accounts/:slug/briefs', async (req, res) => {
  const { slug } = req.params;
  const briefsDir = path.join(DATA_DIR, slug, 'briefs');

  try {
    const files = await fs.readdir(briefsDir);
    const jsonFiles = files.filter((f) => f.endsWith('.json') && f.startsWith('precall-')).sort().reverse();

    if (jsonFiles.length === 0) {
      return res.json(null);
    }

    const latestFile = jsonFiles[0];
    const data = JSON.parse(await fs.readFile(path.join(briefsDir, latestFile), 'utf-8'));
    res.json(data);
  } catch (error) {
    res.json(null);
  }
});

// Get prospector markdown files
app.get('/api/accounts/:slug/prospecting', async (req, res) => {
  const { slug } = req.params;
  const prospectingDir = path.join(DATA_DIR, slug, 'prospecting');

  try {
    const files = await fs.readdir(prospectingDir);
    const mdFiles = files.filter((f) => f.endsWith('.md')).sort();

    if (mdFiles.length === 0) {
      return res.json({ files: [] });
    }

    const fileContents = await Promise.all(
      mdFiles.map(async (filename) => {
        const content = await fs.readFile(path.join(prospectingDir, filename), 'utf-8');
        return { filename, content };
      })
    );

    res.json({ files: fileContents });
  } catch (error) {
    res.json({ files: [] });
  }
});

// Get data source details
app.get('/api/accounts/:slug/sources/:source', async (req, res) => {
  const { slug, source } = req.params;
  const rawDir = path.join(DATA_DIR, slug, 'raw');

  try {
    let data = null;
    
    if (source === 'salesforce') {
      const filePath = path.join(rawDir, 'salesforce.json');
      const content = await fs.readFile(filePath, 'utf-8');
      const sf = JSON.parse(content);
      data = {
        account: sf.account ? { id: sf.account.Id, name: sf.account.Name, industry: sf.account.Industry } : null,
        contactsCount: sf.contacts?.length || 0,
        opportunitiesCount: sf.opportunities?.length || 0,
        opportunities: sf.opportunities?.slice(0, 5).map((o: any) => ({
          name: o.Name,
          stage: o.StageName,
          amount: o.Amount,
          closeDate: o.CloseDate
        })) || []
      };
    } else if (source === 'gong') {
      const filePath = path.join(rawDir, 'gong_calls.json');
      const content = await fs.readFile(filePath, 'utf-8');
      const gong = JSON.parse(content);
      data = {
        callsCount: gong.calls?.length || 0,
        calls: gong.calls?.slice(0, 10).map((c: any) => ({
          id: c.id,
          title: c.title,
          started: c.started,
          duration: c.duration,
          participants: c.parties?.map((p: any) => p.name).filter(Boolean) || []
        })) || []
      };
    } else if (source === 'notion') {
      const filePath = path.join(rawDir, 'notion_pages.json');
      const content = await fs.readFile(filePath, 'utf-8');
      const notion = JSON.parse(content);
      data = {
        pagesCount: notion.pages?.length || 0,
        pages: notion.pages?.map((p: any) => ({
          id: p.id,
          title: p.properties?.title?.title?.[0]?.plain_text || p.properties?.Name?.title?.[0]?.plain_text || 'Untitled',
          url: p.url,
          lastEdited: p.last_edited_time
        })) || []
      };
    }

    res.json(data);
  } catch (error) {
    res.status(404).json({ error: 'Data not found' });
  }
});

// Get agent outputs (briefs, summaries, etc.)
app.get('/api/accounts/:slug/:outputType', async (req, res) => {
  const { slug, outputType } = req.params;
  const outputDir = path.join(DATA_DIR, slug, outputType);

  try {
    const files = await fs.readdir(outputDir);
    const jsonFiles = files.filter((f) => f.endsWith('.json')).sort().reverse();

    if (jsonFiles.length === 0) {
      return res.json(null);
    }

    const latestFile = jsonFiles[0];
    const data = JSON.parse(await fs.readFile(path.join(outputDir, latestFile), 'utf-8'));
    res.json(data);
  } catch (error) {
    res.json(null);
  }
});

// Get freshness status for all sources
app.get('/api/accounts/:slug/sources', async (req, res) => {
  const { slug } = req.params;
  const accountDir = path.join(DATA_DIR, slug);

  try {
    const meta = await readMeta(accountDir);
    const staleness = computeStaleness(meta);

    const formatTimestamp = (ts?: string) =>
      ts ? new Date(ts).toISOString() : null;

    const getSuggestion = (stale: boolean): 'use-cache' | 'incremental' | 'full' => {
      if (!stale) return 'use-cache';
      return 'incremental';
    };

    res.json({
      salesforce: {
        status: meta.sources.salesforce?.status || 'missing',
        lastFetchedAt: formatTimestamp(
          meta.sources.salesforce?.lastIncrementalSyncAt ||
            meta.sources.salesforce?.lastFullSyncAt
        ),
        nextRecommended: getSuggestion(staleness.salesforce.any),
        staleReasons: staleness.salesforce.reasons,
        entities: staleness.salesforce.entities,
      },
      gong: {
        status: meta.sources.gong?.status || 'missing',
        lastFetchedAt: formatTimestamp(meta.sources.gong?.lastListSyncAt),
        nextRecommended: getSuggestion(staleness.gong.any),
        staleReasons: staleness.gong.reasons,
        callCount: meta.sources.gong?.callCount || 0,
      },
      notion: {
        status: meta.sources.notion?.status || 'missing',
        lastFetchedAt: formatTimestamp(
          meta.sources.notion?.lastFullSyncAt || meta.sources.notion?.lastIncrementalSyncAt
        ),
        nextRecommended: getSuggestion(staleness.notion.any),
        staleReasons: staleness.notion.reasons,
        pageCount: meta.sources.notion?.pageCount || 0,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get freshness status' });
  }
});

// Get detailed metadata for a specific source
app.get('/api/accounts/:slug/sources/:source/meta', async (req, res) => {
  const { slug, source } = req.params;
  const accountDir = path.join(DATA_DIR, slug);

  try {
    const meta = await readMeta(accountDir);
    const sourceData = meta.sources[source as 'salesforce' | 'gong' | 'notion'];

    if (!sourceData) {
      return res.status(404).json({ error: 'Source metadata not found' });
    }

    res.json(sourceData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get source metadata' });
  }
});

// Helper to send progress update
function sendProgress(res: express.Response, message: string) {
  res.write(`data: ${JSON.stringify({ type: 'progress', message })}\n\n`);
}

// Smart refresh endpoint with SSE (spawns Amp agent with MCP access)
app.post('/api/accounts/:slug/sources/:source/refresh', async (req, res) => {
  const { slug, source } = req.params;
  const { mode = 'auto' } = req.body; // auto | incremental | full
  const accountDir = path.join(DATA_DIR, slug);

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // Load metadata to get account name
    const metadataPath = path.join(accountDir, 'metadata.json');
    const accountMetadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
    
    sendProgress(res, `Starting ${mode} refresh for ${source}...`);
    
    // Validate source
    if (!['salesforce', 'gong', 'notion'].includes(source)) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Invalid source' })}\n\n`);
      return res.end();
    }
    
    // Build args for refreshData agent
    const args = [
      accountMetadata.name,
      '--mode', mode,
      '--sources', source
    ];
    
    // Run refresh agent in Amp context (has MCP access)
    const result = await runAgentStream('src/agents/refreshData.ts', args, (data) => {
      // Forward script output as progress
      const lines = data.split('\n').filter(l => l.trim());
      for (const line of lines) {
        sendProgress(res, line);
      }
    });
    
    if (!result.success) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Refresh failed', details: result.error })}\n\n`);
      return res.end();
    }
    
    // Parse result from agent (last line should be JSON output)
    const outputLines = result.output?.split('\n').filter(l => l.trim()) || [];
    let refreshResult: any = { updated: false, modeUsed: 'unknown', stats: {} };
    
    // Find JSON result in output (agent prints it at the end)
    for (let i = outputLines.length - 1; i >= 0; i--) {
      try {
        const parsed = JSON.parse(outputLines[i]);
        if (parsed.success !== undefined) {
          refreshResult = parsed;
          break;
        }
      } catch {
        // Not JSON, continue
      }
    }
    
    // Reload meta to get updated metadata
    const updatedMeta = await readMeta(accountDir);
    
    sendProgress(res, 'Refresh complete!');
    res.write(`data: ${JSON.stringify({ 
      type: 'complete', 
      success: true, 
      updated: refreshResult.updated,
      modeUsed: refreshResult.modeUsed,
      stats: refreshResult.stats,
      meta: updatedMeta.sources[source as 'salesforce' | 'gong' | 'notion']
    })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Refresh failed:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: 'Failed to refresh data', details: String(error) })}\n\n`);
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
