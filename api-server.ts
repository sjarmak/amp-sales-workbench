import express from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import { execute } from '@sourcegraph/amp-sdk';
import { config } from 'dotenv';
import { readMeta, computeStaleness, type SourceStatus, writeMeta } from './src/phases/freshness.js';
import { probeSalesforce, probeGong, probeNotion, probeSourcegraph, type ProbeResult } from './src/phases/probes.js';
import { runAgent as executeAgent, type AgentName, type AgentOptions } from './src/agents/agent-runner.js';
import { ingestFromSalesforce, type SalesforceIngestOptions } from './src/phases/ingest/salesforce.js';
import { ingestFromGong, type GongIngestOptions } from './src/phases/ingest/gong.js';
import type { AccountKey } from './src/types.js';
import { callSalesforceTool, callGongTool, callNotionTool, closeMCPClients } from './src/mcp-client.js';
import { refreshAccountContext } from './src/context/store.ts';
import { createHash } from 'crypto';
import { AGENTS, getAgentsByStage } from './src/config/agents.js';
import { LIFECYCLE_STAGES } from './src/config/lifecycle.js';
import { getDataSourceConfig, logDataSourceConfig } from './src/config/dataSourceRouter.js';

// Load environment variables
config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const DATA_DIR = path.join(process.cwd(), 'data/accounts');

// Log data source configuration on startup
if (process.env.DEBUG) {
	logDataSourceConfig();
}

// Validate BigQuery setup if cloud mode enabled
async function validateCloudSetup() {
	const config = getDataSourceConfig();
	if (config.gong === 'bigquery' || config.salesforce === 'bigquery' || config.enriched === 'bigquery') {
		try {
			const { getBigQueryClient } = await import('./src/services/bqClient.js');
			const bq = await getBigQueryClient();
			console.log('[startup] ✅ BigQuery connectivity verified');
		} catch (err) {
			console.error('[startup] ❌ BigQuery setup failed:', err instanceof Error ? err.message : String(err));
			console.error('[startup] Falling back to local sources...');
			// Don't exit - allow local fallback
		}
	}
}

validateCloudSetup();

// Get MCP availability - for now, assume all configured MCPs are available
// In the future, could add actual health checks
function getMcpCapabilities(): { salesforce: boolean; gong: boolean; notion: boolean; sourcegraph: boolean } {
	// Assume all MCPs are available
	// User will see errors on refresh if not properly configured
	// Sourcegraph is always available (no MCP required)
	return { salesforce: true, gong: true, notion: true, sourcegraph: true };
}

// Get Salesforce org info endpoint
app.get('/api/mcp/salesforce/org-info', async (req, res) => {
  try {
    console.log('[mcp-test] Fetching Salesforce org info...');
    const result = await callSalesforceTool('soql_query', {
      query: `SELECT Id, Name, InstanceName, OrganizationType, IsSandbox FROM Organization LIMIT 1`
    });
    const data = JSON.parse(result[0].text);
    const org = data.records[0];
    
    res.json({
      success: true,
      org: {
        id: org.Id,
        name: org.Name,
        instance: org.InstanceName,
        type: org.OrganizationType,
        isSandbox: org.IsSandbox
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test MCP connection endpoint
app.get('/api/mcp/test/:source', async (req, res) => {
  const { source } = req.params;
  
  try {
    if (source === 'salesforce') {
      console.log('[mcp-test] Testing Salesforce MCP connection...');
      const result = await callSalesforceTool('list_versions', {});
      res.json({ success: true, message: 'Salesforce MCP is working', data: result });
    } else if (source === 'gong') {
      console.log('[mcp-test] Testing Gong MCP connection...');
      const result = await callGongTool('list_workspaces', {});
      res.json({ success: true, message: 'Gong MCP is working', data: result });
    } else if (source === 'notion') {
      console.log('[mcp-test] Testing Notion MCP connection...');
      const result = await callNotionTool('API-get-self', {});
      res.json({ success: true, message: 'Notion MCP is working', data: result });
    } else {
      res.status(400).json({ error: 'Unknown source. Use salesforce, gong, or notion' });
    }
  } catch (error: any) {
    console.error(`[mcp-test] ${source} test failed:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message || String(error),
      details: error.stack
    });
  }
});

// Get data source configuration (for UI diagnostics)
app.get('/api/status/data-sources', (req, res) => {
  try {
    const config = getDataSourceConfig();
    res.json({
      success: true,
      config: {
        gong: config.gong,
        salesforce: config.salesforce,
        enriched: config.enriched,
      },
      mode: 
        config.gong === 'bigquery' && config.salesforce === 'bigquery' && config.enriched === 'bigquery' 
          ? 'cloud'
          : config.gong === 'bigquery' || config.salesforce === 'bigquery'
          ? 'hybrid'
          : 'local',
      message: 'Data source configuration loaded. Use dev/hybrid/cloud presets.',
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message || String(error) 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '0.1.0'
  });
});

// BigQuery health check endpoint
app.get('/api/health/bigquery', async (req, res) => {
  try {
    const config = getDataSourceConfig();
    if (config.gong !== 'bigquery' && config.salesforce !== 'bigquery' && config.enriched !== 'bigquery') {
      return res.json({ 
        status: 'disabled',
        message: 'BigQuery not enabled in data source configuration'
      });
    }

    const { getBigQueryClient } = await import('./src/services/bqClient.js');
    const bq = await getBigQueryClient();
    const { getGcpConfig } = await import('./src/services/bqClient.js');
    const gcpConfig = getGcpConfig();
    
    await bq.dataset(gcpConfig.datasetId).exists();
    
    res.json({ 
      status: 'healthy',
      project: gcpConfig.projectId,
      dataset: gcpConfig.datasetId,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ 
      status: 'unhealthy',
      error: error.message || String(error),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * NOTE: Agent execution is now handled by src/agents/agent-runner.ts
 * 
 * All agents are executed through the unified agent-runner which:
 * - Imports agent modules directly (no spawn/exec)
 * - Runs in Amp SDK context with MCP access
 * - Provides consistent error handling and metadata
 * 
 * This ensures all agents have access to MCP tools on globalThis
 * when running through the web UI.
 */

// Get all accounts
app.get('/api/accounts', async (req, res) => {
  try {
    const mcpCapabilities = getMcpCapabilities();
    const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
    const accounts = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name);
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
    
    // Log available accounts with data source info
    if (process.env.DEBUG) {
      console.log(`[API] Loaded ${accountData.length} accounts from data/accounts/`);
    }
    
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

// Get account context (consolidated view)
app.get('/api/accounts/:slug/context', async (req, res) => {
  const { slug } = req.params;
  const accountDir = path.join(DATA_DIR, slug);

  try {
    const { getAccountContext } = await import('./src/context/store.ts');
    const context = await getAccountContext(accountDir);

    if (!context) {
      return res.status(404).json({ error: 'Context not found. Run a data refresh first.' });
    }

    res.json(context);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch context' });
  }
});

// Get data source statuses
app.get('/api/accounts/:slug/sources', async (req, res) => {
  const { slug } = req.params;
  const accountDir = path.join(DATA_DIR, slug);

  try {
    console.log(`[sources] Processing request for slug: ${slug}`);
    console.log(`[sources] Account dir: ${accountDir}`);

    // Helper to check if a data file exists and has content
    const hasDataFile = async (filename: string): Promise<boolean> => {
      try {
        const filePath = path.join(accountDir, 'raw', filename);
        console.log(`[sources] Checking file: ${filePath}`);
        const stat = await fs.stat(filePath);
        const hasFile = stat.size > 100;
        console.log(`[sources] ${filename}: exists=${hasFile}, size=${stat.size}`);
        return hasFile;
      } catch (err) {
        console.log(`[sources] ${filename}: error - ${err.message}`);
        return false;
      }
    };

    const [hasSalesforce, hasGong, hasNotion] = await Promise.all([
      hasDataFile('salesforce.json'),
      hasDataFile('gong.json'),
      hasDataFile('notion.json'),
    ]);

    console.log(`[sources] File checks - SF:${hasSalesforce}, Gong:${hasGong}, Notion:${hasNotion}`);

    const meta = await readMeta(accountDir);
    console.log(`[sources] Meta loaded, has sources:`, Object.keys(meta.sources));

    const staleness = computeStaleness(meta);
    console.log(`[sources] Staleness computed: SF=${staleness.salesforce.any}, Gong=${staleness.gong.any}, Notion=${staleness.notion.any}, SG=${staleness.sourcegraph.any}`);

    const { getAccountContext } = await import('./src/context/store.ts');
    console.log(`[sources] Import successful`);

    const context = await getAccountContext(accountDir);
    console.log(`[sources] Context loaded:`, context ? 'object' : 'null');

    const formatTimestamp = (ts: string | null) =>
      ts ? new Date(ts).toISOString() : null;

    const getSuggestion = (stale: boolean): 'use-cache' | 'incremental' | 'full' => {
      if (!stale) return 'use-cache';
      return 'incremental';
    };

    // Extract rich metadata from context
    const transcriptsCount = context?.gong?.summaries?.length || 0;
    const latestCallTime = context?.gong?.calls?.[0]?.startTime;
    const accountPageId = context?.notion?.accountPage?.id;

    console.log(`[sources] Building response object...`);

    const response = {
      salesforce: {
        status: hasSalesforce ? (staleness.salesforce.any ? 'stale' : 'fresh') : 'missing',
        lastFetchedAt: formatTimestamp(
          meta.sources.salesforce?.lastIncrementalSyncAt ||
            meta.sources.salesforce?.lastFullSyncAt
        ),
        nextRecommended: getSuggestion(staleness.salesforce.any),
        staleReasons: staleness.salesforce.reasons,
        entities: staleness.salesforce.entities,
        contactsCount: context?.salesforce?.contacts?.length || 0,
        opportunitiesCount: context?.salesforce?.opportunities?.length || 0,
        activitiesCount: context?.salesforce?.activities?.length || 0,
      },
      gong: {
        status: hasGong ? (staleness.gong.any ? 'stale' : 'fresh') : 'missing',
        lastFetchedAt: formatTimestamp(meta.sources.gong?.lastListSyncAt),
        nextRecommended: getSuggestion(staleness.gong.any),
        staleReasons: staleness.gong.reasons,
        callCount: meta.sources.gong?.callCount || 0,
        transcriptsCount,
        latestCallTime: formatTimestamp(latestCallTime),
      },
      notion: {
        status: hasNotion ? (staleness.notion.any ? 'stale' : 'fresh') : 'missing',
        lastFetchedAt: formatTimestamp(
          meta.sources.notion?.lastFullSyncAt || meta.sources.notion?.lastIncrementalSyncAt
        ),
        nextRecommended: getSuggestion(staleness.notion.any),
        staleReasons: staleness.notion.reasons,
        pageCount: meta.sources.notion?.pageCount || 0,
        accountPageId,
      },
      prospector: {
        status: context?.prospector ? 'fresh' : 'missing',
        ranAt: formatTimestamp(context?.prospector?.ranAt),
        filesCount: context?.prospector?.files?.length || 0,
      },
      sourcegraph: {
        status: meta.sources.sourcegraph?.status || 'missing',
        lastFetchedAt: formatTimestamp(
          meta.sources.sourcegraph?.lastIncrementalSyncAt || meta.sources.sourcegraph?.lastFullSyncAt
        ),
        nextRecommended: getSuggestion(staleness.sourcegraph?.any || false),
        staleReasons: staleness.sourcegraph?.reasons || [],
      },
    };

    console.log(`[sources] Response built successfully`);
    res.json(response);
  } catch (error) {
    console.error(`[sources] Error:`, error);
    res.status(500).json({ error: 'Failed to fetch account data' });
  }
});

// Get Gong search terms for an account
app.get('/api/accounts/:slug/gong-search-terms', async (req, res) => {
  const { slug } = req.params;
  
  try {
    const configPath = path.join(process.cwd(), 'config', 'gong-search-overrides.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);
    
    const override = config.overrides?.[slug];
    
    if (override) {
      res.json({
        searchTerms: override.searchTerms,
        reason: override.reason,
        isDefault: false,
      });
    } else {
      // Return indication that default is being used
      // Client can infer from metadata or we can look it up
      const metadataPath = path.join(DATA_DIR, slug, 'metadata.json');
      let accountName = slug.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
      
      try {
        const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
        if (metadata.name) {
          accountName = metadata.name;
        }
      } catch {}
      
      res.json({
        searchTerms: [accountName],
        reason: 'Using default (account name)',
        isDefault: true,
      });
    }
  } catch (error) {
    console.error('[gong-search-terms] Error:', error);
    res.status(500).json({ error: 'Failed to fetch Gong search terms' });
  }
});

// Update Gong search terms for an account
app.put('/api/accounts/:slug/gong-search-terms', async (req, res) => {
  const { slug } = req.params;
  const { searchTerms, reason } = req.body;
  
  if (!Array.isArray(searchTerms) || searchTerms.length === 0) {
    return res.status(400).json({ error: 'searchTerms must be a non-empty array' });
  }
  
  try {
    const configPath = path.join(process.cwd(), 'config', 'gong-search-overrides.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);
    
    // Ensure overrides object exists
    if (!config.overrides) {
      config.overrides = {};
    }
    
    // Update or create override
    config.overrides[slug] = {
      searchTerms: searchTerms.filter((t: string) => t.trim()).map((t: string) => t.trim()),
      reason: reason || 'Custom search terms',
    };
    
    // Write back to file
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    
    res.json({
      success: true,
      searchTerms: config.overrides[slug].searchTerms,
      reason: config.overrides[slug].reason,
    });
  } catch (error) {
    console.error('[gong-search-terms] Error:', error);
    res.status(500).json({ error: 'Failed to update Gong search terms' });
  }
});

// Probe remote sources for staleness
app.get('/api/accounts/:slug/sources/probe', async (req, res) => {
  const { slug } = req.params;
  const accountDir = path.join(DATA_DIR, slug);

  try {
    const meta = await readMeta(accountDir);

    // MCP call wrapper with error handling
    const mcpCall = async (tool: string, params: any) => {
      try {
        if (tool.includes('salesforce')) {
          return await callSalesforceTool(tool.replace('mcp__salesforce__', ''), params);
        } else if (tool.includes('gong')) {
          return await callGongTool(tool.replace('mcp__gong-extended__', ''), params);
        } else if (tool.includes('notion')) {
          return await callNotionTool(tool.replace('mcp__notion__', ''), params);
        }
        throw new Error(`Unknown MCP tool: ${tool}`);
      } catch (error: any) {
        console.warn(`[probe] MCP call failed for ${tool}:`, error.message);
        throw error;
      }
    };

    // Run probes in parallel with timeout
    const probePromises = {
      salesforce: probeSalesforce(accountDir, meta, mcpCall),
      gong: probeGong(accountDir, meta, mcpCall),
      notion: probeNotion(accountDir, meta, mcpCall),
      sourcegraph: probeSourcegraph(accountDir, meta),
    };

    const results = await Promise.all([
      probePromises.salesforce.catch((err) => ({
        staleOnSource: false,
        reasons: [],
        recommended: 'use-cache' as const,
        error: err.message,
      })),
      probePromises.gong.catch((err) => ({
        staleOnSource: false,
        reasons: [],
        recommended: 'use-cache' as const,
        error: err.message,
      })),
      probePromises.notion.catch((err) => ({
        staleOnSource: false,
        reasons: [],
        recommended: 'use-cache' as const,
        error: err.message,
      })),
      probePromises.sourcegraph.catch((err) => ({
        staleOnSource: false,
        reasons: [],
        recommended: 'use-cache' as const,
        error: err.message,
      })),
    ]);

    const [salesforceResult, gongResult, notionResult, sgResult] = results;

    // Update metadata with probe results
    const now = new Date().toISOString();

    if (meta.sources.salesforce) {
      meta.sources.salesforce.lastProbedAt = now;
    }
    if (meta.sources.gong) {
      meta.sources.gong.lastProbedAt = now;
    }
    if (meta.sources.notion) {
      meta.sources.notion.lastProbedAt = now;
    }
    if (meta.sources.sourcegraph) {
      meta.sources.sourcegraph.lastProbedAt = now;
    }

    await writeMeta(accountDir, meta);

    res.json({
      salesforce: salesforceResult,
      gong: gongResult,
      notion: notionResult,
      sourcegraph: sgResult,
    });
  } catch (error: any) {
    console.error('[probe] Error:', error);
    // Return default safe response instead of 500 error
    res.json({
      salesforce: {
        staleOnSource: false,
        reasons: [],
        recommended: 'use-cache' as const,
        error: 'Probe failed'
      },
      gong: {
        staleOnSource: false,
        reasons: [],
        recommended: 'use-cache' as const,
        error: 'Probe failed'
      },
      notion: {
        staleOnSource: false,
        reasons: [],
        recommended: 'use-cache' as const,
        error: 'Probe failed'
      },
      sourcegraph: {
        staleOnSource: false,
        reasons: [],
        recommended: 'use-cache' as const,
        error: 'Probe failed'
      }
    });
  }
});

const agentScripts: Record<string, string> = {
  'precall-brief': 'scripts/test-precall-brief.ts',
  'postcall': 'scripts/test-postcall.ts',
  'demo-ideas': 'scripts/test-demo-idea.ts',
  'qualification': 'scripts/test-qualification.ts',
  'email': 'scripts/test-followup-email.ts',
  'coaching': 'scripts/test-coaching.ts',
  'exec-summary': 'src/agents/execSummary.ts',
  'deal-review': 'src/agents/dealReview.ts',
  'closedlost': 'scripts/test-closed-lost.ts',
  'backfill': 'scripts/test-backfill.ts',
  'handoff': 'scripts/test-handoff.ts',
  'full-refresh': 'src/agents/refreshData.ts',
  'prospector': 'scripts/test-prospector.ts',
  'risk-heuristics': 'scripts/test-risk-heuristics.ts',
  'meeting-summary': 'src/agents/meetingSummary.ts',
};

// ============================================================================
// Account Signals Endpoint
// ============================================================================

// Get aggregated account signals for the signals panel
app.get('/api/accounts/:slug/signals', async (req, res) => {
  const { slug } = req.params;
  const accountDir = path.join(DATA_DIR, slug);

  try {
    // Load raw data sources
    let sfData: any = null;
    let gongData: any = null;
    
    try {
      const sfPath = path.join(accountDir, 'raw', 'salesforce.json');
      sfData = JSON.parse(await fs.readFile(sfPath, 'utf-8'));
    } catch {}
    
    try {
      const gongPath = path.join(accountDir, 'raw', 'gong.json');
      gongData = JSON.parse(await fs.readFile(gongPath, 'utf-8'));
    } catch {}

    // Build signals response
    const signals: any = {};

    // Account info
    if (sfData?.account) {
      signals.account = {
        name: sfData.account.Name,
        industry: sfData.account.Industry,
        employees: sfData.account.NumberOfEmployees,
        revenue: sfData.account.AnnualRevenue,
        website: sfData.account.Website,
      };
    }

    // Opportunity info
    if (sfData?.opportunities?.[0]) {
      const opp = sfData.opportunities[0];
      signals.opportunity = {
        name: opp.Name,
        stage: opp.StageName,
        amount: opp.Amount,
        closeDate: opp.CloseDate,
        probability: opp.Probability,
      };
    }

    // Key contacts
    if (sfData?.contacts?.length > 0) {
      signals.contacts = sfData.contacts.slice(0, 8).map((c: any) => ({
        name: c.Name,
        title: c.Title,
        role: inferContactRole(c),
      }));
    }

    // Recent calls
    if (gongData?.calls?.length > 0) {
      signals.recentCalls = gongData.calls.slice(0, 5).map((c: any) => ({
        id: c.id,
        title: c.title || c.subject || 'Call',
        date: c.started || c.scheduled,
      }));
    }

    // Deal health (simplified heuristics)
    if (sfData?.opportunities?.[0]) {
      const opp = sfData.opportunities[0];
      const risks: string[] = [];
      let score = 50;
      
      if (opp.Probability) {
        score = Math.min(opp.Probability, 90);
      }
      
      if (opp.CloseDate) {
        const daysToClose = Math.ceil((new Date(opp.CloseDate).getTime() - Date.now()) / 86400000);
        if (daysToClose < 0) {
          risks.push('Close date has passed');
          score -= 20;
        } else if (daysToClose < 14) {
          risks.push('Close date within 2 weeks');
        }
      }
      
      if (!signals.contacts?.some((c: any) => c.role === 'champion')) {
        risks.push('No champion identified');
        score -= 10;
      }
      
      if (!gongData?.calls?.length || gongData.calls.length < 2) {
        risks.push('Limited recent engagement');
        score -= 10;
      }
      
      signals.dealHealth = {
        score: Math.max(0, Math.min(100, score)),
        trend: 'stable' as const,
        risks,
      };
    }

    // Infer lifecycle stage
    if (sfData?.opportunities?.[0]?.StageName) {
      const stage = sfData.opportunities[0].StageName.toLowerCase();
      if (stage.includes('prospect') || stage.includes('qualification')) {
        signals.stage = 'prospecting';
      } else if (stage.includes('discovery') || stage.includes('demo')) {
        signals.stage = 'qualification';
      } else if (stage.includes('proposal') || stage.includes('value')) {
        signals.stage = 'solution_mapping';
      } else if (stage.includes('negotiation') || stage.includes('poc')) {
        signals.stage = 'validation';
      } else if (stage.includes('closed won') || stage.includes('pending')) {
        signals.stage = 'handoff_close';
      } else if (stage.includes('closed')) {
        signals.stage = 'post_mortem';
      } else {
        signals.stage = 'prospecting';
      }
    }

    res.json(signals);
  } catch (error) {
    console.error('Failed to build signals:', error);
    res.status(500).json({ error: 'Failed to fetch account signals' });
  }
});

// Helper to infer contact role from Salesforce data
function inferContactRole(contact: any): string | undefined {
  const title = (contact.Title || '').toLowerCase();
  
  if (title.includes('cto') || title.includes('cio') || title.includes('ceo') || title.includes('vp') || title.includes('director')) {
    return 'decision_maker';
  }
  if (title.includes('manager') || title.includes('lead') || title.includes('architect')) {
    return 'influencer';
  }
  if (title.includes('engineer') || title.includes('developer')) {
    return 'user';
  }
  
  return undefined;
}

// ============================================================================
// Agent Framework V2 Endpoints
// ============================================================================

// Get all agents with their configurations
app.get('/api/agents', (req, res) => {
  const { stage } = req.query;
  
  let agents = AGENTS;
  if (stage && typeof stage === 'string') {
    agents = getAgentsByStage(stage as any);
  }
  
  res.json({
    agents: agents.map(a => ({
      id: a.id,
      label: a.label,
      description: a.description,
      stage: a.stage,
      costTier: a.defaultLlm.costTier,
      model: a.defaultLlm.model,
      requiredInputs: a.requiredInputs,
      optionalInputs: a.optionalInputs,
    })),
    stages: LIFECYCLE_STAGES.map(s => ({
      id: s.id,
      label: s.label,
      description: s.description,
      order: s.order,
      color: s.color,
      quickActions: s.quickActions,
    })),
  });
});

// Get single agent config
app.get('/api/agents/:agentId/config', (req, res) => {
  const { agentId } = req.params;
  const agent = AGENTS.find(a => a.id === agentId);
  
  if (!agent) {
    return res.status(404).json({ error: `Agent not found: ${agentId}` });
  }
  
  res.json({
    id: agent.id,
    label: agent.label,
    description: agent.description,
    stage: agent.stage,
    costTier: agent.defaultLlm.costTier,
    model: agent.defaultLlm.model,
    requiredInputs: agent.requiredInputs,
    optionalInputs: agent.optionalInputs,
    systemPromptPath: agent.systemPromptPath,
  });
});

// ============================================================================
// Legacy Agent Endpoints (to be deprecated)
// ============================================================================

// Run agent via Amp SDK (has MCP access)
app.post('/api/agents/:agent', async (req, res) => {
  const { agent } = req.params;
  const { accountName, ...options } = req.body;

  if (!accountName) {
    return res.status(400).json({ error: 'Account name is required' });
  }

  const scriptPath = agentScripts[agent];
  if (!scriptPath) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  try {
    const cwd = process.cwd();
    const args = [accountName];
    if (options.callId) args.push('--callId', options.callId);
    if (options.apply) args.push('--apply');
    
    // For full-refresh, add mode and sources
    if (agent === 'full-refresh') {
      args.push('--mode', 'full', '--sources', 'all');
    }
    
    const argsStr = args.map(a => `"${a}"`).join(' ');
    
    const prompt = `Run the ${agent} agent for account "${accountName}".

\`\`\`bash
cd ${cwd}
npx tsx ${scriptPath} ${argsStr}
\`\`\`

Execute and return the result.`;

    const stream = execute({ 
      prompt,
      options: { dangerouslyAllowAll: true }
    });
    
    let output = '';
    for await (const message of stream) {
      if (message.type === 'assistant') {
        for (const block of message.message.content) {
          if (block.type === 'text') {
            output += block.text;
          }
        }
      }
    }
    
    res.json({ success: true, output });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Stream agent execution (SSE) - executes agent via Amp SDK with progress updates
app.get('/api/agents/:agent/stream', async (req, res) => {
  const { agent } = req.params;
  const { accountName, callId, apply } = req.query;

  if (!accountName) {
    return res.status(400).json({ error: 'Account name is required' });
  }

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    res.write(`data: ${JSON.stringify({ type: 'log', data: `Starting ${agent} agent...\n` })}\n\n`);
    
    // Intercept console.log to stream output to UI
    const originalLog = console.log;
    const logBuffer: string[] = [];
    
    console.log = (...args: any[]) => {
      const message = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
      logBuffer.push(message);
      
      // Stream to UI
      res.write(`data: ${JSON.stringify({ type: 'log', data: message + '\n' })}\n\n`);
      
      // Also log to server
      originalLog(...args);
    };
    
    try {
      const result = await executeAgent(agent as AgentName, {
        accountName: accountName as string,
        callId: callId as string,
        apply: apply === 'true',
      });

      if (result.success) {
        res.write(`data: ${JSON.stringify({ type: 'log', data: 'Agent completed successfully\n' })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'complete', success: true, result: result.output })}\n\n`);
      } else {
        res.write(`data: ${JSON.stringify({ type: 'error', error: result.error })}\n\n`);
      }
    } finally {
      // Restore original console.log
      console.log = originalLog;
    }
    
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: String(error) })}\n\n`);
    res.end();
  }
});

// Get Gong calls
app.get('/api/accounts/:slug/calls', async (req, res) => {
  const { slug } = req.params;
  const rawDir = path.join(DATA_DIR, slug, 'raw');

  try {
    // Try gong.json first (newer format), then gong_calls.json (legacy)
    let data;
    try {
      data = JSON.parse(await fs.readFile(path.join(rawDir, 'gong.json'), 'utf-8'));
    } catch {
      data = JSON.parse(await fs.readFile(path.join(rawDir, 'gong_calls.json'), 'utf-8'));
    }
    
    // Build a set of call IDs that have transcripts
    const transcriptCallIds = new Set(
      (data.summaries || []).map((s: any) => s.callId)
    );
    
    // Enhance calls with hasTranscript flag
    const callsWithTranscriptInfo = (data.calls || []).map((call: any) => ({
      ...call,
      hasTranscript: transcriptCallIds.has(call.id),
    }));
    
    res.json(callsWithTranscriptInfo);
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

// Get meeting summaries for a call
app.get('/api/accounts/:slug/meetings/:callId/summary', async (req, res) => {
  const { slug, callId } = req.params;
  const summariesDir = path.join(DATA_DIR, slug, 'meeting-summaries');

  try {
    const files = await fs.readdir(summariesDir);
    const matchingFiles = files
      .filter((f) => f.endsWith('.json') && f.includes(callId))
      .sort()
      .reverse();

    if (matchingFiles.length === 0) {
      return res.status(404).json({ error: 'Meeting summary not found' });
    }

    const latestFile = matchingFiles[0];
    const data = JSON.parse(await fs.readFile(path.join(summariesDir, latestFile), 'utf-8'));
    res.json(data);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      res.status(404).json({ error: 'Meeting summary not found' });
    } else {
      res.status(500).json({ error: 'Failed to fetch meeting summary' });
    }
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
      // Try both filenames for backwards compatibility
      let filePath = path.join(rawDir, 'gong.json');
      try {
        await fs.access(filePath);
      } catch {
        filePath = path.join(rawDir, 'gong_calls.json');
      }
      const content = await fs.readFile(filePath, 'utf-8');
      const gong = JSON.parse(content);
      data = {
        callsCount: gong.calls?.length || 0,
        calls: gong.calls?.slice(0, 10).map((c: any) => ({
          id: c.id,
          title: c.title || c.subject || 'Untitled Call',
          started: c.started || c.scheduled || c.startTime,
          duration: c.duration || 0,
          participants: c.participants || c.parties?.map((p: any) => p.name || p.emailAddress).filter(Boolean) || [],
          url: c.url || (c.id ? `https://app.gong.io/call?id=${c.id}` : null)
        })) || [],
        summaries: gong.summaries?.slice(0, 10).map((s: any) => ({
          callId: s.callId,
          summary: s.summary,
          actionItems: s.actionItems,
          nextSteps: s.nextSteps,
          topics: s.topics,
          transcript: s.transcript // Full transcript for expandable view
        })) || []
      };
    } else if (source === 'notion') {
      // Try new filename first, then legacy
      let filePath = path.join(rawDir, 'notion.json');
      try {
        await fs.access(filePath);
      } catch {
        filePath = path.join(rawDir, 'notion_pages.json');
      }
      const content = await fs.readFile(filePath, 'utf-8');
      const notion = JSON.parse(content);
      
      // Handle both new format (relatedPages) and legacy (pages)
      const pages = notion.relatedPages || notion.pages || [];
      
      // Helper to strip emojis and emoji shortcuts
      const stripEmojis = (text: string): string => {
        return text
          .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Remove emoji characters
          .replace(/:[a-z0-9_-]+:/gi, '') // Remove :emoji-shortcodes:
          .replace(/🗺️|🔭|⚡|🎯|💡|📊|✅|❌|⚠️/g, '') // Remove common emojis
          .trim();
      };
      
      // Helper to recursively extract blocks including children with depth tracking
      const extractBlocks = (blocks: any[], depth: number = 0): any[] => {
        const result: any[] = [];
        for (const block of blocks) {
          const supportedTypes = ['paragraph', 'heading_1', 'heading_2', 'heading_3', 'bulleted_list_item', 'numbered_list_item', 'quote', 'callout'];
          if (supportedTypes.includes(block.type)) {
            const richText = block[block.type]?.rich_text || [];
            const text = stripEmojis(richText.map((rt: any) => rt.plain_text || '').join(''));
            if (text.trim()) {
              result.push({ type: block.type, text, depth });
            }
          }
          // Recursively process children with increased depth
          if (block.children && block.children.length > 0) {
            result.push(...extractBlocks(block.children, depth + 1));
          }
        }
        return result;
      };
      
      data = {
        pagesCount: pages.length,
        pages: pages.map((p: any) => {
          const blocks = p.content?.blocks?.results || [];
          const contentBlocks = extractBlocks(blocks);
          
          return {
            id: p.id,
            title: stripEmojis(p.title || p.properties?.title?.title?.[0]?.plain_text || p.properties?.Name?.title?.[0]?.plain_text || 'Untitled'),
            url: p.content?.url || p.url,
            lastEdited: p.lastEdited || p.last_edited_time,
            contentBlocks
          };
        })
      };
    } else if (source === 'sourcegraph') {
      // Load sourcegraph data (global, not account-specific)
      const meta = await readMeta(path.join(DATA_DIR, slug));
      const sgMeta = meta.sources.sourcegraph;
      
      if (!sgMeta || !sgMeta.pages) {
        data = {
          pagesCount: 0,
          featuresCount: 0,
          pages: [],
          features: [],
          content: { docs: '', blog: '' },
          summary: null,
        };
      } else {
        const globalSgDir = path.join(process.cwd(), 'data', 'global', 'sourcegraph');
        const featuresPath = path.join(globalSgDir, 'features.json');
        const summaryPath = path.join(globalSgDir, 'summary.json');
        const docsPath = path.join(globalSgDir, 'docs.md');
        const blogPath = path.join(globalSgDir, 'blog.md');
        
        let features = [];
        try {
          const featuresData = JSON.parse(await fs.readFile(featuresPath, 'utf-8'));
          features = featuresData.features || [];
        } catch {}
        
        let summary = null;
        try {
          summary = JSON.parse(await fs.readFile(summaryPath, 'utf-8'));
        } catch {}
        
        let docsContent = '';
        let blogContent = '';
        try { docsContent = await fs.readFile(docsPath, 'utf-8'); } catch {}
        try { blogContent = await fs.readFile(blogPath, 'utf-8'); } catch {}
        
        data = {
          pagesCount: Object.keys(sgMeta.pages).length,
          featuresCount: sgMeta.featuresCount || 0,
          featuresLastGeneratedAt: sgMeta.featuresLastGeneratedAt,
          pages: Object.entries(sgMeta.pages).map(([key, page]: [string, any]) => ({
            key,
            url: page.url,
            lastFetchedAt: page.lastFetchedAt,
          })),
          features: features.slice(0, 10),
          content: { docs: docsContent, blog: blogContent },
          summary,
        };
      }
    }

    res.json(data);
  } catch (error) {
    res.status(404).json({ error: 'Data not found' });
  }
});

// Get agent outputs (briefs, summaries, etc.)
// Get all artifacts (successful runs) across all agents for an account
// NOTE: This must be BEFORE the catch-all /:outputType route
app.get('/api/accounts/:slug/artifacts', async (req, res) => {
  const { slug } = req.params;
  const runsDir = path.join(DATA_DIR, slug, 'agent-runs');

  try {
    const agents = await fs.readdir(runsDir);
    const artifacts: any[] = [];

    for (const agentId of agents) {
      const agentDir = path.join(runsDir, agentId);
      const stat = await fs.stat(agentDir);
      if (!stat.isDirectory()) continue;

      const runFiles = await fs.readdir(agentDir);
      for (const file of runFiles.filter(f => f.endsWith('.json')).slice(0, 10)) {
        try {
          const data = JSON.parse(await fs.readFile(path.join(agentDir, file), 'utf-8'));
          if (data.success && data.output) {
            artifacts.push({
              id: data.id,
              agentId: data.agentId,
              timestamp: data.metadata?.timestamp || data.id,
              title: getArtifactTitle(data.agentId, data.output),
              summary: getArtifactSummary(data.output),
            });
          }
        } catch (err) {
          console.error(`[artifacts] Error reading ${file}:`, err);
        }
      }
    }

    artifacts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json(artifacts);
  } catch (err) {
    console.error('[artifacts] Error:', err);
    res.json([]);
  }
});

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

// Get post-call update by timestamp
app.get('/api/accounts/:slug/postcall/:timestamp', async (req, res) => {
  const { slug, timestamp } = req.params;
  const postcallDir = path.join(DATA_DIR, slug, 'postcall');

  try {
    const filename = `postcall-${timestamp}.json`;
    const filePath = path.join(postcallDir, filename);
    const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
    res.json(data);
  } catch (error) {
    res.status(404).json({ error: 'Post-call data not found' });
  }
});

// Get demo ideas for an account (latest)
app.get('/api/accounts/:slug/demos', async (req, res) => {
  const { slug } = req.params;
  const demosDir = path.join(DATA_DIR, slug, 'demos');

  try {
    const files = await fs.readdir(demosDir);
    const demoFiles = files.filter((f) => f.startsWith('demo-idea-') && f.endsWith('.json')).sort().reverse();

    if (demoFiles.length === 0) {
      return res.status(404).json({ error: 'No demo ideas found. Run demo-ideas agent first.' });
    }

    const latestFile = demoFiles[0];
    const data = JSON.parse(await fs.readFile(path.join(demosDir, latestFile), 'utf-8'));
    res.json(data);
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      res.status(404).json({ error: 'No demo ideas found. Run demo-ideas agent first.' });
    } else {
      res.status(500).json({ error: 'Failed to fetch demo ideas' });
    }
  }
});

// Get risk heuristics for an account
app.get('/api/accounts/:slug/risks', async (req, res) => {
  const { slug } = req.params;
  const accountDir = path.join(DATA_DIR, slug);
  const reviewsDir = path.join(accountDir, 'reviews');

  try {
    const files = await fs.readdir(reviewsDir);
    const riskFiles = files.filter((f) => f.startsWith('risk-heuristics-') && f.endsWith('.json')).sort().reverse();

    if (riskFiles.length === 0) {
      return res.status(404).json({ error: 'No risk analysis found. Run risk heuristics agent first.' });
    }

    const latestFile = riskFiles[0];
    const data = JSON.parse(await fs.readFile(path.join(reviewsDir, latestFile), 'utf-8'));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch risk analysis' });
  }
});

// Get CRM suggestions (lightweight version of drafts for the panel)
app.get('/api/accounts/:slug/crm/suggestions', async (req, res) => {
  const { slug } = req.params;
  const draftsDir = path.join(DATA_DIR, slug, 'drafts');

  try {
    // Try to load the latest draft and convert to suggestions format
    const files = await fs.readdir(draftsDir);
    const draftFiles = files
      .filter((f) => f.startsWith('crm-draft-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (draftFiles.length === 0) {
      return res.json({ suggestions: [] });
    }

    const latestDraft = draftFiles[0];
    const draftPath = path.join(draftsDir, latestDraft);
    const draftData = JSON.parse(await fs.readFile(draftPath, 'utf-8'));

    // Convert draft patches to suggestions format
    const suggestions = (draftData.patches || [])
      .filter((p: any) => p.status === 'pending')
      .map((p: any, idx: number) => ({
        id: p.id || `suggestion-${idx}`,
        objectType: p.objectType || 'Account',
        objectName: p.objectName || 'Unknown',
        field: p.field || 'Unknown',
        currentValue: p.before,
        suggestedValue: p.after,
        confidence: p.confidence || 'medium',
        reason: p.reasoning || 'Based on recent activity data',
        source: p.source || ['agent'],
      }));

    res.json({ suggestions });
  } catch (error) {
    console.error('Failed to load suggestions:', error);
    res.json({ suggestions: [] });
  }
});

// Get CRM draft patches
app.get('/api/accounts/:slug/crm/drafts', async (req, res) => {
  const { slug } = req.params;
  const draftsDir = path.join(DATA_DIR, slug, 'drafts');

  try {
    const files = await fs.readdir(draftsDir);
    const draftFiles = files
      .filter((f) => f.startsWith('crm-draft-') && f.endsWith('.yaml'))
      .sort()
      .reverse();

    if (draftFiles.length === 0) {
      return res.json({ drafts: [], latest: null });
    }

    const latestFile = draftFiles[0];
    const yaml = await import('yaml');
    const content = await fs.readFile(path.join(draftsDir, latestFile), 'utf-8');
    const draft = yaml.parse(content);

    // Parse all patches from draft
    const patches = [];
    
    // Account patches
    if (draft.account?.changes) {
      for (const [field, change] of Object.entries(draft.account.changes)) {
        patches.push({
          id: `account-${field}`,
          objectType: 'Account',
          objectId: draft.account.id,
          objectName: draft.accountKey?.name || 'Account',
          field,
          before: change.before,
          after: change.after,
          confidence: change.confidence,
          source: change.source,
          reasoning: change.reasoning,
          status: 'pending',
        });
      }
    }

    // Contact patches
    if (draft.contacts) {
      for (const contact of draft.contacts) {
        for (const [field, change] of Object.entries(contact.changes || {})) {
          patches.push({
            id: `contact-${contact.id || contact.email}-${field}`,
            objectType: 'Contact',
            objectId: contact.id,
            objectName: contact.email || 'Contact',
            field,
            before: change.before,
            after: change.after,
            confidence: change.confidence,
            source: change.source,
            reasoning: change.reasoning,
            status: 'pending',
          });
        }
      }
    }

    // Opportunity patches
    if (draft.opportunities) {
      for (const opp of draft.opportunities) {
        for (const [field, change] of Object.entries(opp.changes || {})) {
          patches.push({
            id: `opportunity-${opp.id || opp.name}-${field}`,
            objectType: 'Opportunity',
            objectId: opp.id,
            objectName: opp.name || 'Opportunity',
            field,
            before: change.before,
            after: change.after,
            confidence: change.confidence,
            source: change.source,
            reasoning: change.reasoning,
            status: 'pending',
          });
        }
      }
    }

    res.json({
      drafts: patches,
      latest: {
        file: latestFile,
        generatedAt: draft.generatedAt,
        approved: draft.approved,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch drafts' });
  }
});

// Get CRM change history
app.get('/api/accounts/:slug/crm/history', async (req, res) => {
  const { slug } = req.params;
  const appliedDir = path.join(DATA_DIR, slug, 'applied');

  try {
    const files = await fs.readdir(appliedDir);
    const appliedFiles = files
      .filter((f) => f.startsWith('apply-') && f.endsWith('.json'))
      .sort()
      .reverse();

    const history = [];
    for (const file of appliedFiles) {
      const content = await fs.readFile(path.join(appliedDir, file), 'utf-8');
      const receipt = JSON.parse(content);

      const changes = [];
      
      // Process account changes
      if (receipt.patches?.account) {
        changes.push({
          objectType: 'Account',
          objectId: receipt.patches.account.id,
          success: receipt.patches.account.success,
          fieldsUpdated: receipt.patches.account.fieldsUpdated,
          error: receipt.patches.account.error,
        });
      }

      // Process contact changes
      if (receipt.patches?.contacts) {
        for (const contact of receipt.patches.contacts) {
          changes.push({
            objectType: 'Contact',
            objectId: contact.id,
            success: contact.success,
            fieldsUpdated: contact.fieldsUpdated,
            error: contact.error,
          });
        }
      }

      // Process opportunity changes
      if (receipt.patches?.opportunities) {
        for (const opp of receipt.patches.opportunities) {
          changes.push({
            objectType: 'Opportunity',
            objectId: opp.id,
            success: opp.success,
            fieldsUpdated: opp.fieldsUpdated,
            error: opp.error,
          });
        }
      }

      history.push({
        appliedAt: receipt.appliedAt,
        changes,
        errors: receipt.errors,
      });
    }

    res.json({ history });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Apply CRM patches
app.post('/api/accounts/:slug/crm/apply', async (req, res) => {
  const { slug } = req.params;
  const { patchIds } = req.body; // Optional: apply specific patches only

  try {
    // Read latest draft
    const draftsDir = path.join(DATA_DIR, slug, 'drafts');
    const files = await fs.readdir(draftsDir);
    const draftFiles = files
      .filter((f) => f.startsWith('crm-draft-') && f.endsWith('.yaml'))
      .sort()
      .reverse();

    if (draftFiles.length === 0) {
      return res.status(404).json({ error: 'No draft found' });
    }

    const latestFile = draftFiles[0];
    const yaml = await import('yaml');
    const content = await fs.readFile(path.join(draftsDir, latestFile), 'utf-8');
    const draft = yaml.parse(content);

    // Mark as approved and save
    draft.approved = true;
    await fs.writeFile(
      path.join(draftsDir, latestFile),
      yaml.stringify(draft)
    );

    // Run the sync agent
    const accountName = draft.accountKey.name;
    const result = await executeAgent('syncSalesforce', accountName, { apply: true });

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to apply patches',
    });
  }
});

// Get freshness status for all sources
app.get('/api/accounts/:slug/sources', async (req, res) => {
  const { slug } = req.params;
  const accountDir = path.join(DATA_DIR, slug);

  try {
    console.log(`[api-server] Loading sources metadata for account: ${slug}`);
    console.log(`[api-server] Account directory: ${accountDir}`);
    
    // Helper to check if a data file exists and has content
    const hasDataFile = async (filename: string): Promise<boolean> => {
      try {
        const filePath = path.join(accountDir, 'raw', filename);
        const stat = await fs.promises.stat(filePath);
        const hasFile = stat.size > 100;
        console.log(`[api-server] ${filename}: exists=${hasFile}, size=${stat.size}`);
        return hasFile;
      } catch (err) {
        console.log(`[api-server] ${filename}: not found`);
        return false;
      }
    };

    const [hasSalesforce, hasGong, hasNotion] = await Promise.all([
      hasDataFile('salesforce.json'),
      hasDataFile('gong.json'),
      hasDataFile('notion.json'),
    ]);
    
    console.log(`[api-server] File checks - SF:${hasSalesforce}, Gong:${hasGong}, Notion:${hasNotion}`);

    const meta = await readMeta(accountDir);
    const staleness = computeStaleness(meta);
    const { getAccountContext } = await import('./src/context/store.ts');
    const context = await getAccountContext(accountDir);

    const formatTimestamp = (ts?: string) =>
      ts ? new Date(ts).toISOString() : null;

    const getSuggestion = (stale: boolean): 'use-cache' | 'incremental' | 'full' => {
      if (!stale) return 'use-cache';
      return 'incremental';
    };

    // Extract rich metadata from context
    const transcriptsCount = context?.gong?.summaries?.length || 0;
    const latestCallTime = context?.gong?.calls?.[0]?.startTime;
    const accountPageId = context?.notion?.accountPage?.id;

    res.json({
      salesforce: {
        status: hasSalesforce ? (staleness.salesforce.any ? 'stale' : 'fresh') : 'missing',
        lastFetchedAt: formatTimestamp(
          meta.sources.salesforce?.lastIncrementalSyncAt ||
            meta.sources.salesforce?.lastFullSyncAt
        ),
        nextRecommended: getSuggestion(staleness.salesforce.any),
        staleReasons: staleness.salesforce.reasons,
        entities: staleness.salesforce.entities,
        contactsCount: context?.salesforce?.contacts?.length || 0,
        opportunitiesCount: context?.salesforce?.opportunities?.length || 0,
        activitiesCount: context?.salesforce?.activities?.length || 0,
      },
      gong: {
        status: hasGong ? (staleness.gong.any ? 'stale' : 'fresh') : 'missing',
        lastFetchedAt: formatTimestamp(meta.sources.gong?.lastListSyncAt),
        nextRecommended: getSuggestion(staleness.gong.any),
        lastDataTimestamp: formatTimestamp(meta.sources.gong?.latestCallAtOnSource),
        staleReasons: staleness.gong.reasons,
        callCount: meta.sources.gong?.callCount || 0,
        transcriptsCount,
        latestCallTime: formatTimestamp(latestCallTime),
      },
      notion: {
        status: hasNotion ? (staleness.notion.any ? 'stale' : 'fresh') : 'missing',
        lastFetchedAt: formatTimestamp(
          meta.sources.notion?.lastFullSyncAt || meta.sources.notion?.lastIncrementalSyncAt
        ),
        nextRecommended: getSuggestion(staleness.notion.any),
        staleReasons: staleness.notion.reasons,
        pageCount: meta.sources.notion?.pageCount || 0,
        accountPageId,
      },
      prospector: {
        status: context?.prospector ? 'fresh' : 'missing',
        ranAt: formatTimestamp(context?.prospector?.ranAt),
        filesCount: context?.prospector?.files?.length || 0,
      },
      amp: {
        status: meta.sources.amp?.status || 'missing',
        lastFetchedAt: formatTimestamp(
          meta.sources.amp?.lastIncrementalSyncAt || meta.sources.amp?.lastFullSyncAt
        ),
        nextRecommended: getSuggestion(staleness.amp.any),
        staleReasons: staleness.amp.reasons,
        featuresCount: meta.sources.amp?.featuresCount || 0,
      },
    });
  } catch (error) {
    console.error('[api-server] Error getting sources metadata:', error);
    res.status(500).json({ error: 'Failed to get freshness status', details: String(error) });
  }
});

// Get detailed metadata for a specific source
app.get('/api/accounts/:slug/sources/:source/meta', async (req, res) => {
  const { slug, source } = req.params;
  const accountDir = path.join(DATA_DIR, slug);

  try {
    const meta = await readMeta(accountDir);
    const sourceData = meta.sources[source as 'salesforce' | 'gong' | 'notion' | 'amp'];

    if (!sourceData) {
      return res.status(404).json({ error: 'Source metadata not found' });
    }

    res.json(sourceData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get source metadata' });
  }
});

// Get Amp data details
app.get('/api/accounts/:slug/sources/amp', async (req, res) => {
  const { slug } = req.params;
  const accountDir = path.join(DATA_DIR, slug);

  try {
    console.log(`[api-server] Loading amp data for account: ${slug}`);
    const meta = await readMeta(accountDir);
    console.log(`[api-server] Meta loaded, amp sources:`, meta.sources.amp ? 'present' : 'missing');
    const ampMeta = meta.sources.amp;

    if (!ampMeta || !ampMeta.pages) {
      console.log(`[api-server] No amp metadata, returning empty response`);
      return res.json({
        pagesCount: 0,
        featuresCount: 0,
        pages: [],
        features: [],
        content: { news: '', manual: '' },
        summary: null,
      });
    }

    // Load from global cache (Amp data is global, not account-specific)
    const globalAmpDir = path.join(process.cwd(), 'data', 'global', 'amp');

    // Load features if available
    const featuresPath = path.join(globalAmpDir, 'features.json');
    let features = [];
    try {
      const featuresData = JSON.parse(await fs.readFile(featuresPath, 'utf-8'));
      features = featuresData.features || [];
    } catch {}

    // Load summary table if available
    const summaryPath = path.join(globalAmpDir, 'summary.json');
    let summary = null;
    try {
      summary = JSON.parse(await fs.readFile(summaryPath, 'utf-8'));
    } catch {}

    // Load full markdown content from global cache
    const newsPath = path.join(globalAmpDir, 'news.md');
    const manualPath = path.join(globalAmpDir, 'manual.md');
    
    let newsContent = '';
    let manualContent = '';
    
    try {
      newsContent = await fs.readFile(newsPath, 'utf-8');
    } catch {}
    
    try {
      manualContent = await fs.readFile(manualPath, 'utf-8');
    } catch {}

    res.json({
      pagesCount: Object.keys(ampMeta.pages).length,
      featuresCount: ampMeta.featuresCount || 0,
      featuresLastGeneratedAt: ampMeta.featuresLastGeneratedAt,
      pages: Object.entries(ampMeta.pages).map(([key, page]) => ({
        key,
        url: page.url,
        lastFetchedAt: page.lastFetchedAt,
      })),
      features: features.slice(0, 10), // Return top 10 features for preview
      content: {
        news: newsContent,
        manual: manualContent,
      },
      summary,
    });
  } catch (error) {
    console.error('[api-server] Error loading amp data:', error);
    res.status(500).json({ error: 'Failed to get Amp data', details: String(error) });
  }
});

// Helper to send progress update
function sendProgress(res: express.Response, message: string) {
  res.write(`data: ${JSON.stringify({ type: 'progress', message })}\n\n`);
}

// Smart refresh endpoint with SSE (runs via Amp SDK with MCP access)
app.post('/api/accounts/:slug/sources/:source/refresh', async (req, res) => {
  const { slug, source } = req.params;
  const { mode = 'auto' } = req.body; // auto | incremental | full
  const accountDir = path.join(DATA_DIR, slug);

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // Load metadata to get account name and key
    const metadataPath = path.join(accountDir, 'metadata.json');
    const accountMetadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
    
    console.log(`[api-server] Starting ${mode} refresh for ${source}, account: ${accountMetadata.name}`);
    sendProgress(res, `Starting ${mode} refresh for ${source}...`);
    
    // Validate source
    if (!['salesforce', 'gong', 'notion', 'sourcegraph'].includes(source)) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Invalid source' })}\n\n`);
      return res.end();
    }
    
    // Check staleness first  
    const meta = await readMeta(accountDir);
    const staleness = computeStaleness(meta);
    
    // Skip refresh if data is fresh and mode is auto
    if (mode === 'auto') {
      if (source === 'salesforce' && !staleness.salesforce.any) {
        sendProgress(res, 'Salesforce data is already fresh, using cached data');
        res.write(`data: ${JSON.stringify({ 
          type: 'complete', 
          success: true, 
          updated: false,
          modeUsed: 'cache',
          stats: meta.sources.salesforce?.entityCheckpoints || {},
          meta: meta.sources.salesforce
        })}\n\n`);
        return res.end();
      }
      if (source === 'gong' && !staleness.gong.any) {
        sendProgress(res, 'Gong data is already fresh, using cached data');
        res.write(`data: ${JSON.stringify({ 
          type: 'complete', 
          success: true, 
          updated: false,
          modeUsed: 'cache',
          stats: {
            callsCount: meta.sources.gong?.callCount || 0,
            transcriptsCount: Object.keys(meta.sources.gong?.transcripts || {}).length
          },
          meta: meta.sources.gong
        })}\n\n`);
        return res.end();
      }
      if (source === 'sourcegraph' && !staleness.sourcegraph.any) {
        sendProgress(res, 'Sourcegraph data is already fresh, using cached data');
        res.write(`data: ${JSON.stringify({ 
          type: 'complete', 
          success: true, 
          updated: false,
          modeUsed: 'cache',
          stats: {
            pagesCount: meta.sources.sourcegraph?.pages ? Object.keys(meta.sources.sourcegraph.pages).length : 0,
            featuresCount: meta.sources.sourcegraph?.featuresCount || 0
          },
          meta: meta.sources.sourcegraph
        })}\n\n`);
        return res.end();
      }
    }
    
    // Fast path: Sourcegraph Docs refresh (no MCP required)
    if (source === 'sourcegraph') {
      try {
        const { ingestSourcegraphDocs } = await import('./src/phases/ingest/sourcegraphDocs.js');
        
        const result = await ingestSourcegraphDocs(slug, accountDir, {
          mode: mode as 'auto' | 'incremental' | 'full',
          onProgress: (msg) => sendProgress(res, msg)
        });
        
        // Rebuild context
        sendProgress(res, 'Rebuilding context...');
        await refreshAccountContext(accountDir);
        
        res.write(`data: ${JSON.stringify({ 
          type: 'complete', 
          success: true, 
          updated: result.updated,
          modeUsed: mode,
          stats: result.stats,
          meta: {
            dataPath: path.join(accountDir, 'raw', 'sourcegraph')
          }
        })}\n\n`);
        return res.end();
      } catch (sgError: any) {
        console.error('[api-server] Sourcegraph refresh failed:', sgError);
        res.write(`data: ${JSON.stringify({ 
          type: 'error', 
          error: 'Sourcegraph refresh failed', 
          details: sgError.message || String(sgError)
        })}\n\n`);
        return res.end();
      }
    }
    
    // Fast path: Direct MCP client for Salesforce
    if (source === 'salesforce') {
      try {
        sendProgress(res, 'Connecting to Salesforce MCP...');
        
        // Lookup or use existing SF ID
        let sfId = accountMetadata.salesforceId;
        if (!sfId) {
          sendProgress(res, 'Looking up Salesforce ID...');
          
          // Escape single quotes in account name to prevent SQL injection
          const escapedName = accountMetadata.name.replace(/'/g, "\\'");
          
          // Try exact match first
          let lookupResult = await callSalesforceTool('soql_query', {
            query: `SELECT Id, Name FROM Account WHERE Name = '${escapedName}' LIMIT 1`
          });
          
          // Validate and parse MCP response
          if (!lookupResult || !lookupResult[0] || typeof lookupResult[0].text !== 'string') {
            throw new Error('Invalid response from Salesforce MCP');
          }
          
          const lookupText = lookupResult[0].text;
          // Check if response is an error string (not valid JSON)
          if (lookupText.startsWith('Error:') || lookupText.startsWith('TypeError:')) {
            throw new Error(lookupText);
          }
          
          let lookupData;
          try {
            lookupData = JSON.parse(lookupText);
          } catch (parseError) {
            throw new Error(`Failed to parse Salesforce response: ${lookupText.substring(0, 200)}`);
          }
          
          let records = lookupData.records;
          
          // If no exact match, try fuzzy match
          if (!records || records.length === 0) {
            sendProgress(res, 'No exact match, trying fuzzy search...');
            lookupResult = await callSalesforceTool('soql_query', {
              query: `SELECT Id, Name FROM Account WHERE Name LIKE '%${escapedName}%' ORDER BY Name LIMIT 5`
            });
            
            // Validate fuzzy search response
            if (!lookupResult || !lookupResult[0] || typeof lookupResult[0].text !== 'string') {
              throw new Error('Invalid response from Salesforce MCP');
            }
            
            const fuzzyText = lookupResult[0].text;
            if (fuzzyText.startsWith('Error:') || fuzzyText.startsWith('TypeError:')) {
              throw new Error(fuzzyText);
            }
            
            try {
              lookupData = JSON.parse(fuzzyText);
              records = lookupData.records;
            } catch (parseError) {
              throw new Error(`Failed to parse Salesforce response: ${fuzzyText.substring(0, 200)}`);
            }
            
            if (records && records.length > 0) {
              // Log found accounts for user to review
              console.log(`[SF Lookup] Found ${records.length} potential matches:`, records.map(r => r.Name).join(', '));
              sendProgress(res, `Found ${records.length} potential matches. Using: ${records[0].Name}`);
              sfId = records[0].Id;
            }
          } else {
            sfId = records[0].Id;
          }
          
          if (sfId) {
            accountMetadata.salesforceId = sfId;
            await fs.writeFile(path.join(accountDir, 'metadata.json'), JSON.stringify(accountMetadata, null, 2));
          } else {
            // Log warning but don't throw - allow other sources to proceed
            console.warn(`[SF Lookup] Account "${accountMetadata.name}" not found in Salesforce`);
            sendProgress(res, `⚠ Account not found in Salesforce. Skipping SF refresh.`);
            
            res.write(`data: ${JSON.stringify({ 
              type: 'complete', 
              updated: false,
              warning: 'Account not found in Salesforce',
              stats: { skipped: true }
            })}\n\n`);
            return res.end();
          }
        }
        
        // Build incremental WHERE clauses
        const cp = meta.sources.salesforce?.entityCheckpoints || {};
        const contactWhere = mode !== 'full' && cp.Contact?.lastFetchedAt 
          ? `AND LastModifiedDate > ${cp.Contact.lastFetchedAt}` 
          : '';
        const oppWhere = mode !== 'full' && cp.Opportunity?.lastFetchedAt 
          ? `AND LastModifiedDate > ${cp.Opportunity.lastFetchedAt}` 
          : '';
        const activityWhere = mode !== 'full' && cp.Activity?.lastFetchedAt 
          ? `AND LastModifiedDate > ${cp.Activity.lastFetchedAt}` 
          : '';
        
        if (mode !== 'full' && (contactWhere || oppWhere || activityWhere)) {
          sendProgress(res, 'Using incremental refresh (fetching only changed records)');
        } else {
          sendProgress(res, 'Performing full refresh');
        }
        
        // Helper to safely parse MCP responses
        const parseSalesforceResponse = (result: any, operationName: string) => {
          if (!result || !result[0] || typeof result[0].text !== 'string') {
            throw new Error(`Invalid response from Salesforce MCP for ${operationName}`);
          }
          
          const text = result[0].text;
          // Check if response is an error string
          if (text.startsWith('Error:') || text.startsWith('TypeError:')) {
            throw new Error(text);
          }
          
          try {
            return JSON.parse(text);
          } catch (parseError) {
            throw new Error(`Failed to parse Salesforce ${operationName} response: ${text.substring(0, 200)}`);
          }
        };
        
        // Fetch Account
        sendProgress(res, 'Fetching account details...');
        let accountResult;
        let account;
        
        try {
          accountResult = await callSalesforceTool('get_record', {
            objectType: 'Account',
            id: sfId
          });
          account = parseSalesforceResponse(accountResult, 'account');
        } catch (accountError: any) {
          // Handle "resource does not exist" - Salesforce ID may be stale
          const errorMsg = accountError?.message || String(accountError);
          if (errorMsg.includes('does not exist') || errorMsg.includes('not found')) {
            console.warn(`[SF Refresh] Account ID ${sfId} not found, attempting re-lookup...`);
            sendProgress(res, '⚠ Salesforce ID not found, attempting re-lookup...');
            
            // Clear stale ID and retry lookup
            accountMetadata.salesforceId = undefined;
            sfId = undefined;
            
            // Re-run lookup logic with multiple name variations
            const baseName = accountMetadata.name;
            const searchVariations = [
              baseName, // Full name
              baseName.replace(/\s*\([^)]*\)/g, '').trim(), // Remove parentheticals: "Company (ABC)" → "Company"
              baseName.split(/\s*\(/)[0].trim(), // Before first parenthesis
            ].filter((v, i, arr) => v && arr.indexOf(v) === i); // Dedupe
            
            let records: any[] = [];
            for (const searchName of searchVariations) {
              const escapedName = searchName.replace(/'/g, "\\'");
              sendProgress(res, `Searching for: "${searchName}"...`);
              
              const lookupResult = await callSalesforceTool('soql_query', {
                query: `SELECT Id, Name FROM Account WHERE Name LIKE '%${escapedName}%' ORDER BY Name LIMIT 5`
              });
              
              const lookupText = lookupResult[0]?.text || '';
              if (lookupText.startsWith('Error:')) continue; // Try next variation
              
              try {
                const lookupData = JSON.parse(lookupText);
                records = lookupData.records || [];
                if (records.length > 0) {
                  console.log(`[SF Re-lookup] Found ${records.length} matches for "${searchName}":`, records.map(r => r.Name).join(', '));
                  break; // Found matches, stop searching
                }
              } catch (e) {
                continue; // Try next variation
              }
            }
            
            if (records && records.length > 0) {
              sfId = records[0].Id;
              accountMetadata.salesforceId = sfId;
              await fs.writeFile(path.join(accountDir, 'metadata.json'), JSON.stringify(accountMetadata, null, 2));
              sendProgress(res, `✓ Re-discovered account: ${records[0].Name} (${sfId})`);
              
              // Retry account fetch with new ID
              accountResult = await callSalesforceTool('get_record', {
                objectType: 'Account',
                id: sfId
              });
              account = parseSalesforceResponse(accountResult, 'account');
            } else {
              const variationsList = searchVariations.map(v => `"${v}"`).join(', ');
              throw new Error(
                `Account not found in Salesforce. Tried searching for: ${variationsList}. ` +
                `This usually means: (1) The account doesn't exist in this Salesforce org, ` +
                `(2) You're connected to the wrong Salesforce environment, or ` +
                `(3) The account was deleted. Please verify the account name or create it in Salesforce first.`
              );
            }
          } else {
            // Re-throw other errors
            throw accountError;
          }
        }
        
        // Fetch Contacts
        sendProgress(res, 'Fetching contacts...');
        const contactsResult = await callSalesforceTool('soql_query', {
          query: `SELECT Id, Name, Email, Title, Phone, Department, LastModifiedDate FROM Contact WHERE AccountId = '${sfId}' ${contactWhere} LIMIT 100`
        });
        const contacts = parseSalesforceResponse(contactsResult, 'contacts').records;
        
        // Fetch Opportunities
        sendProgress(res, 'Fetching opportunities...');
        const oppsResult = await callSalesforceTool('soql_query', {
          query: `SELECT Id, Name, StageName, Amount, CloseDate, Probability, NextStep, Type, LeadSource, LastModifiedDate FROM Opportunity WHERE AccountId = '${sfId}' ${oppWhere} LIMIT 100`
        });
        const opportunities = parseSalesforceResponse(oppsResult, 'opportunities').records;
        
        // Fetch Activities
        sendProgress(res, 'Fetching activities...');
        const activitiesResult = await callSalesforceTool('soql_query', {
          query: `SELECT Id, Subject, ActivityDate, Status, Priority, LastModifiedDate FROM Task WHERE AccountId = '${sfId}' ${activityWhere} LIMIT 100`
        });
        const activities = parseSalesforceResponse(activitiesResult, 'activities').records;
        
        // Save to file
        const now = new Date().toISOString();
        const sfData = {
          account,
          contacts,
          opportunities,
          activities,
          lastSyncedAt: now
        };
        
        const rawDir = path.join(accountDir, 'raw');
        await fs.mkdir(rawDir, { recursive: true });
        await fs.writeFile(path.join(rawDir, 'salesforce.json'), JSON.stringify(sfData, null, 2));
        
        // Update meta
        const updatedMeta = await readMeta(accountDir);
        updatedMeta.sources.salesforce = updatedMeta.sources.salesforce || {};
        updatedMeta.sources.salesforce.lastFetchedAt = now;
        updatedMeta.sources.salesforce.lastIncrementalSyncAt = now;
        updatedMeta.sources.salesforce.lastProbedAt = now;
        updatedMeta.sources.salesforce.status = 'fresh';
        updatedMeta.sources.salesforce.entityCheckpoints = {
          Account: { lastFetchedAt: now, remoteLastModifiedAt: account.LastModifiedDate || now },
          Contact: { lastFetchedAt: now, count: contacts?.length || 0 },
          Opportunity: { lastFetchedAt: now, count: opportunities?.length || 0 },
          Activity: { lastFetchedAt: now, count: activities?.length || 0 }
        };
        await writeMeta(accountDir, updatedMeta);
        
        // Rebuild context
        sendProgress(res, 'Rebuilding context...');
        await refreshAccountContext(accountDir);
        
        sendProgress(res, `Complete! Fetched ${contacts?.length || 0} contacts, ${opportunities?.length || 0} opportunities, ${activities?.length || 0} activities`);
        res.write(`data: ${JSON.stringify({ 
          type: 'complete', 
          success: true, 
          updated: true,
          modeUsed: mode,
          stats: {
            contactsCount: contacts?.length || 0,
            opportunitiesCount: opportunities?.length || 0,
            activitiesCount: activities?.length || 0
          },
          meta: updatedMeta.sources.salesforce
        })}\n\n`);
        return res.end();
      } catch (mcpError: any) {
        console.error('[api-server] Salesforce MCP call failed:', mcpError);
        const errorMessage = mcpError?.message || mcpError?.toString() || 'Unknown error';
        res.write(`data: ${JSON.stringify({ 
          type: 'error', 
          error: 'Salesforce MCP refresh failed', 
          details: errorMessage
        })}\n\n`);
        return res.end();
      }
    }
    
    // Gong refresh - use abstraction layer that supports GONG_SOURCE switching (events-api/cache/mcp)
    if (source === 'gong') {
      try {
        console.log('[api-server] Using Gong abstraction layer (respects GONG_SOURCE env var)');
        sendProgress(res, 'Fetching Gong calls...');
        
        const ingestOptions: GongIngestOptions = {
          maxCalls: 50, // Generous limit for refresh
          useCache: true, // Use cache for fast filtering (unless GONG_SOURCE=events-api)
        };
        
        // Derive accountKey from metadata
        const accountKey: AccountKey = {
          name: accountMetadata.name,
          domain: accountMetadata.domain || undefined,
          salesforceId: accountMetadata.salesforceId || undefined,
        };
        
        sendProgress(res, 'Querying Gong data sources...');
        const result = await ingestFromGong(accountKey, accountDir, ingestOptions);
        
        // Save to file
        const now = new Date().toISOString();
        const gongData = {
          calls: result.calls || [],
          summaries: result.summaries || [],
          lastSyncedAt: now,
        };
        
        sendProgress(res, `Fetched ${result.calls?.length || 0} Gong calls`);
        
        const rawDir = path.join(accountDir, 'raw');
        await fs.mkdir(rawDir, { recursive: true });
        await fs.writeFile(path.join(rawDir, 'gong.json'), JSON.stringify(gongData, null, 2));
        
        // Update meta
        const updatedMeta = await readMeta(accountDir);
        updatedMeta.sources.gong = updatedMeta.sources.gong || {};
        updatedMeta.sources.gong.lastListSyncAt = now;
        updatedMeta.sources.gong.lastProbedAt = now;
        updatedMeta.sources.gong.callCount = result.calls?.length || 0;
        updatedMeta.sources.gong.status = 'fresh';
        updatedMeta.sources.gong.transcripts = result.transcripts || {};
        if (result.calls && result.calls.length > 0 && result.calls[0].startTime) {
          updatedMeta.sources.gong.latestCallAtOnSource = result.calls[0].startTime;
        }
        await writeMeta(accountDir, updatedMeta);
        
        // Rebuild context
        sendProgress(res, 'Rebuilding context...');
        await refreshAccountContext(accountDir);
        
        sendProgress(res, `Complete! Fetched ${result.calls?.length || 0} calls, ${result.summaries?.length || 0} transcripts`);
        res.write(`data: ${JSON.stringify({ 
          type: 'complete', 
          success: true, 
          updated: true,
          modeUsed: mode,
          stats: {
            callsCount: result.calls?.length || 0,
            transcriptsCount: result.summaries?.length || 0,
          },
          meta: updatedMeta.sources.gong
        })}\n\n`);
        return res.end();
      } catch (error: any) {
        console.error('[api-server] Gong refresh failed:', error);
        res.write(`data: ${JSON.stringify({ 
          type: 'error', 
          error: 'Gong refresh failed', 
          details: error.message || String(error)
        })}\n\n`);
        return res.end();
      }
    }
    
    // Build incremental filter list for Salesforce (for fallback Amp SDK path)
    const sinceFilters: string[] = [];
    if (source === 'salesforce' && mode !== 'full' && meta.sources.salesforce?.entityCheckpoints) {
      if (meta.sources.salesforce.entityCheckpoints.Contact?.lastFetchedAt) sinceFilters.push('Contacts');
      if (meta.sources.salesforce.entityCheckpoints.Opportunity?.lastFetchedAt) sinceFilters.push('Opportunities');
      if (meta.sources.salesforce.entityCheckpoints.Activity?.lastFetchedAt) sinceFilters.push('Activities');
    }
    
    // For Notion, build prompt to fetch competitive analysis page
    if (source === 'notion') {
      try {
        sendProgress(res, 'Connecting to Notion MCP...');
        
        // Read notion config to get page IDs
        const notionConfigPath = path.join(process.cwd(), 'notion-config.json');
        const notionConfig = JSON.parse(await fs.readFile(notionConfigPath, 'utf-8'));
        
        sendProgress(res, 'Fetching knowledge pages...');
        
        const pages: any[] = [];
        // Helper to recursively fetch child blocks (selective - only toggles and meaningful content)
        const fetchBlocksRecursive = async (blockId: string, depth: number = 0): Promise<any[]> => {
          if (depth > 2) return []; // Limit recursion depth to 2
          
          const blocksResult = await callNotionTool('API-get-block-children', { 
            block_id: blockId,
            page_size: 100
          });
          const blocksData = JSON.parse(blocksResult[0].text);
          const blocks = blocksData.results || [];
          
          // Only fetch children for toggle blocks (heading_1, heading_2, heading_3 with is_toggleable)
          // and skip structural blocks like column_list, table, etc.
          for (const block of blocks) {
            if (block.has_children) {
              const blockType = block.type;
              const isToggle = block[blockType]?.is_toggleable === true;
              
              // Only expand toggleable headings
              if (isToggle && ['heading_1', 'heading_2', 'heading_3'].includes(blockType)) {
                block.children = await fetchBlocksRecursive(block.id, depth + 1);
              }
            }
          }
          
          return blocks;
        };
        
        for (const [key, pageId] of Object.entries(notionConfig.knowledgePages)) {
          if (pageId === 'page-id-here') {
            console.warn(`Skipping ${key}: placeholder ID not replaced`);
            continue;
          }
          
          try {
            const pageResult = await callNotionTool('API-retrieve-a-page', { page_id: pageId as string });
            const page = JSON.parse(pageResult[0].text);
            
            sendProgress(res, `Fetching ${key} content...`);
            const blocks = await fetchBlocksRecursive(pageId as string);
            
            pages.push({
              id: pageId,
              title: key,
              content: { ...page, blocks: { results: blocks } },
              lastEdited: page.last_edited_time || new Date().toISOString()
            });
            
            sendProgress(res, `Fetched ${key} (${blocks.length} blocks)`);
          } catch (pageError) {
            console.error(`Failed to fetch ${key}:`, pageError);
          }
        }
        
        // Save to file
        const now = new Date().toISOString();
        const notionData = {
          relatedPages: pages,
          lastSyncedAt: now
        };
        
        const rawDir = path.join(accountDir, 'raw');
        await fs.mkdir(rawDir, { recursive: true });
        await fs.writeFile(path.join(rawDir, 'notion.json'), JSON.stringify(notionData, null, 2));
        
        // Update meta
        const updatedMeta = await readMeta(accountDir);
        updatedMeta.sources.notion = updatedMeta.sources.notion || {};
        updatedMeta.sources.notion.lastFullSyncAt = now;
        updatedMeta.sources.notion.lastProbedAt = now;
        updatedMeta.sources.notion.pageCount = pages.length;
        updatedMeta.sources.notion.status = 'fresh';
        await writeMeta(accountDir, updatedMeta);
        
        // Rebuild context
        sendProgress(res, 'Rebuilding context...');
        await refreshAccountContext(accountDir);
        
        sendProgress(res, `Complete! Fetched ${pages.length} pages`);
        res.write(`data: ${JSON.stringify({ 
          type: 'complete', 
          success: true, 
          updated: true,
          modeUsed: mode,
          stats: {
            pagesCount: pages.length
          },
          meta: updatedMeta.sources.notion
        })}\n\n`);
        return res.end();
      } catch (mcpError: any) {
        console.error('[api-server] Notion MCP call failed:', mcpError);
        res.write(`data: ${JSON.stringify({ 
          type: 'error', 
          error: 'Notion MCP refresh failed', 
          details: mcpError.message || String(mcpError)
        })}\n\n`);
        return res.end();
      }
    }
    
    // Run refresh using Amp SDK (has MCP access) - fallback for other sources
    const prompt = `Fetch ${source} data for account "${accountMetadata.name}" (SF ID: ${accountMetadata.salesforceId || 'lookup required'}) and save it.

Steps:
${!accountMetadata.salesforceId ? '1. Look up the Salesforce ID for account name "' + accountMetadata.name + '" using mcp__salesforce__soql_query with: SELECT Id, Name FROM Account WHERE Name = \'' + accountMetadata.name + '\' LIMIT 1\n\n2.' : '1.'} If ${source} is "salesforce", fetch:
   - Account details with mcp__salesforce__get_record (ID: ${accountMetadata.salesforceId || '<from step 1>'})
   - Contacts: SELECT Id, Name, Email, Title, Phone, Department, LastModifiedDate FROM Contact WHERE AccountId = '${accountMetadata.salesforceId || '<from step 1>'}' ${sinceFilters.includes('Contacts') ? `AND LastModifiedDate > ${meta.sources.salesforce?.entityCheckpoints.Contact?.lastFetchedAt}` : ''} LIMIT 100
   - Opportunities: SELECT Id, Name, StageName, Amount, CloseDate, Probability, NextStep, Type, LeadSource, LastModifiedDate FROM Opportunity WHERE AccountId = '${accountMetadata.salesforceId || '<from step 1>'}' ${sinceFilters.includes('Opportunities') ? `AND LastModifiedDate > ${meta.sources.salesforce?.entityCheckpoints.Opportunity?.lastFetchedAt}` : ''} LIMIT 100
   - Activities: SELECT Id, Subject, ActivityDate, Status, Priority, LastModifiedDate FROM Task WHERE AccountId = '${accountMetadata.salesforceId || '<from step 1>'}' ${sinceFilters.includes('Activities') ? `AND LastModifiedDate > ${meta.sources.salesforce?.entityCheckpoints.Activity?.lastFetchedAt}` : ''} LIMIT 100

NOTE: If any query returns 0 records, that's OK - it means no new/changed data.

${!accountMetadata.salesforceId ? '3.' : '2.'} Save the results to ${accountDir}/raw/${source}.json as JSON

${!accountMetadata.salesforceId ? '4.' : '3.'} Update ${accountDir}/raw/_sources.meta.json to mark ${source} as "fresh" with current timestamp

${!accountMetadata.salesforceId ? '5.' : '4.'} Return a JSON object: { success: true, updated: true, modeUsed: "${mode}", stats: { contactsCount: X, opportunitiesCount: Y, activitiesCount: Z } }

Execute these steps using the MCP tools and return the final JSON result.`;
    
    console.log(`[api-server] Calling Amp SDK execute() with prompt length: ${prompt.length}`);

    // Set up keep-alive to prevent connection timeout
    const keepAliveInterval = setInterval(() => {
      res.write(': keep-alive\n\n');
    }, 5000);
    
    // Set up progress indicator for long-running queries
    const startTime = Date.now();
    let lastProgressTime = startTime;
    const progressInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastProgressTime) / 1000);
      const totalElapsed = Math.floor((Date.now() - startTime) / 1000);
      if (elapsed > 10) {
        sendProgress(res, `Still running Salesforce queries (${totalElapsed}s total)...`);
      }
    }, 15000);
    
    // Set up timeout (5 minutes max - Amp SDK routing is slow)
    const TIMEOUT_MS = 300000;
    const timeoutHandle = setTimeout(() => {
      clearInterval(keepAliveInterval);
      clearInterval(progressInterval);
      console.error('[api-server] Refresh timed out after 5 minutes');
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Refresh timed out', details: 'Operation took longer than 5 minutes. For faster refresh, use CLI: npm run manage "Account Name"' })}\n\n`);
      res.end();
    }, TIMEOUT_MS);

    try {
      console.log(`[api-server] Starting execute() stream...`);
      const stream = execute({ 
        prompt,
        options: { 
          dangerouslyAllowAll: true
        }
      });
      
      let output = '';
      let messageCount = 0;
      let toolCallCount = 0;
      
      for await (const message of stream) {
        messageCount++;
        lastProgressTime = Date.now();
        console.log(`[api-server] Received message #${messageCount}, type: ${message.type}`);
        
        if (message.type === 'assistant') {
          for (const block of message.message.content) {
            if (block.type === 'text') {
              output += block.text;
              console.log(`[api-server] Assistant text block (${block.text.length} chars):`, block.text.substring(0, 100));
              // Send progress updates
              const lines = block.text.split('\n').filter(l => l.trim());
              for (const line of lines) {
                sendProgress(res, line);
              }
            } else if (block.type === 'tool_use') {
              toolCallCount++;
              sendProgress(res, `Executing ${block.name || 'MCP tool'}... (${toolCallCount} tool calls so far)`);
            }
          }
        }
      }
      
      console.log(`[api-server] Stream complete. Total messages: ${messageCount}, tool calls: ${toolCallCount}, output length: ${output.length}`);
      clearTimeout(timeoutHandle);
      clearInterval(keepAliveInterval);
      clearInterval(progressInterval);
    
    // Parse result from output
    let refreshResult: any = { updated: false, modeUsed: 'unknown', stats: {}, success: false };
    
    // Try to extract JSON from output
    const jsonMatches = output.match(/\{[\s\S]*"success"[\s\S]*\}/g);
    if (jsonMatches) {
      for (const match of jsonMatches) {
        try {
          const parsed = JSON.parse(match);
          if (parsed.success !== undefined) {
            refreshResult = parsed;
            break;
          }
        } catch {}
      }
    }
    
    if (!refreshResult.success) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Refresh failed', details: output })}\n\n`);
      return res.end();
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
    } catch (streamError) {
      clearTimeout(timeoutHandle);
      clearInterval(keepAliveInterval);
      clearInterval(progressInterval);
      console.error('Stream error:', streamError);
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Stream failed', details: String(streamError) })}\n\n`);
      res.end();
    }
  } catch (error) {
    console.error('Refresh failed:', error);
    try {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Failed to refresh data', details: String(error) })}\n\n`);
      res.end();
    } catch (e) {
      // Response already ended
    }
  }
});

// Mirror account data to Notion (main endpoint)
app.post('/api/notion/mirror', async (req, res) => {
  try {
    const { accountSlug, name, domain, salesforceId, callSummary, contacts, opportunities, nextActions } = req.body;

    if (!accountSlug || !name) {
      return res.status(400).json({ error: 'accountSlug and name are required' });
    }

    const { mirrorToNotion } = await import('./src/phases/sync/syncNotion.js');
    const result = await mirrorToNotion({
      accountSlug,
      name,
      domain,
      salesforceId,
      callSummary,
      contacts,
      opportunities,
      nextActions,
    });

    if (!result.success) {
      return res.status(500).json({ 
        success: false, 
        error: result.error || 'Failed to mirror to Notion' 
      });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Mirror specific account to Notion (proxy endpoint for UI)
app.post('/api/accounts/:slug/notion/mirror', async (req, res) => {
  try {
    const { slug } = req.params;
    const { accountName } = req.body;

    // Load account metadata
    const accountDir = path.join(DATA_DIR, slug);
    const metadataPath = path.join(accountDir, 'metadata.json');
    
    let metadata: any = {};
    try {
      metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
    } catch {
      // Use slug as fallback
    }

    const name = accountName || metadata.name || slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    // Load latest consolidated snapshot if available
    const snapshotsDir = path.join(accountDir, 'snapshots');
    let snapshotData: any = {};
    try {
      const files = await fs.readdir(snapshotsDir);
      const snapshotFiles = files.filter(f => f.startsWith('snapshot-') && f.endsWith('.json')).sort().reverse();
      if (snapshotFiles.length > 0) {
        const latestSnapshot = path.join(snapshotsDir, snapshotFiles[0]);
        snapshotData = JSON.parse(await fs.readFile(latestSnapshot, 'utf-8'));
      }
    } catch {}

    // Extract data from snapshot
    const callSummary = snapshotData.callSummary || snapshotData.recentActivity?.lastCallsSummary;
    const contacts = snapshotData.contacts || [];
    const opportunities = snapshotData.opportunities || [];
    const nextActions = snapshotData.nextActions || [];

    const { mirrorToNotion } = await import('./src/phases/sync/syncNotion.js');
    const result = await mirrorToNotion({
      accountSlug: slug,
      name,
      domain: metadata.domain || snapshotData.domain,
      salesforceId: metadata.salesforceId || snapshotData.salesforceId,
      callSummary,
      contacts,
      opportunities,
      nextActions,
    });

    if (!result.success) {
      return res.status(500).json({ 
        success: false, 
        error: result.error || 'Failed to mirror to Notion' 
      });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Debug endpoint
app.get('/api/debug', async (req, res) => {
  const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
  const slugs = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name);
  res.json({
    cwd: process.cwd(),
    dataDir: DATA_DIR,
    accountCount: slugs.length,
    accounts: slugs,
  });
});

// Test endpoint to verify MCP access via Amp SDK
app.get('/api/test-mcp', async (req, res) => {
  try {
    const prompt = `Test Salesforce MCP access by running this query:

\`\`\`typescript
import { execute } from '@sourcegraph/amp-sdk';

// Use MCP tool to query Salesforce
const result = await (globalThis as any).mcp__salesforce__soql_query({
  query: 'SELECT COUNT() FROM Account'
});

result;
\`\`\`

Execute and return the result.`;

    const stream = execute({ 
      prompt,
      options: { dangerouslyAllowAll: true }
    });
    
    let output = '';
    for await (const message of stream) {
      if (message.type === 'assistant') {
        for (const block of message.message.content) {
          if (block.type === 'text') {
            output += block.text;
          }
        }
      }
    }
    
    res.json({ success: true, output, configured: !!process.env.AMP_API_KEY });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
      configured: !!process.env.AMP_API_KEY
    });
  }
});

const server = app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
  console.log(`AMP_API_KEY configured: ${!!process.env.AMP_API_KEY}`);
  console.log(`Direct MCP client enabled for fast data refresh`);
});

// Cleanup MCP clients on shutdown
// Insights API endpoints
app.get('/api/accounts/:slug/insights/exec-summary', async (req, res) => {
  const { slug } = req.params;
  const summariesDir = path.join(DATA_DIR, slug, 'summaries');

  try {
    const files = await fs.readdir(summariesDir);
    const summaryFiles = files.filter(f => f.startsWith('exec-summary-') && f.endsWith('.json')).sort().reverse();

    if (summaryFiles.length === 0) {
      return res.status(404).json({ error: 'No executive summary found' });
    }

    const latestFile = summaryFiles[0];
    const data = JSON.parse(await fs.readFile(path.join(summariesDir, latestFile), 'utf-8'));
    res.json(data);
  } catch (error) {
    res.status(404).json({ error: 'Executive summary not found' });
  }
});

app.get('/api/accounts/:slug/insights/deal-review', async (req, res) => {
  const { slug } = req.params;
  const reviewsDir = path.join(DATA_DIR, slug, 'reviews');

  try {
    const files = await fs.readdir(reviewsDir);
    const reviewFiles = files.filter(f => f.startsWith('deal-review-') && f.endsWith('.json')).sort().reverse();

    if (reviewFiles.length === 0) {
      return res.status(404).json({ error: 'No deal review found' });
    }

    const latestFile = reviewFiles[0];
    const data = JSON.parse(await fs.readFile(path.join(reviewsDir, latestFile), 'utf-8'));
    res.json(data);
  } catch (error) {
    res.status(404).json({ error: 'Deal review not found' });
  }
});

app.get('/api/accounts/:slug/insights/closed-lost', async (req, res) => {
  const { slug } = req.params;
  const closedLostDir = path.join(DATA_DIR, slug, 'closed-lost');

  try {
    const files = await fs.readdir(closedLostDir);
    const analysisFiles = files.filter(f => f.startsWith('closed-lost-') && f.endsWith('.json')).sort().reverse();

    if (analysisFiles.length === 0) {
      return res.status(404).json({ error: 'No closed-lost analysis found' });
    }

    const latestFile = analysisFiles[0];
    const data = JSON.parse(await fs.readFile(path.join(closedLostDir, latestFile), 'utf-8'));
    res.json(data);
  } catch (error) {
    res.status(404).json({ error: 'Closed-lost analysis not found' });
  }
});

app.get('/api/accounts/:slug/insights/qualification', async (req, res) => {
  const { slug } = req.params;
  const qualDir = path.join(DATA_DIR, slug, 'qualification');

  try {
    const files = await fs.readdir(qualDir);
    const qualFiles = files.filter(f => f.startsWith('qual-') && f.endsWith('.json')).sort().reverse();

    if (qualFiles.length === 0) {
      return res.status(404).json({ error: 'No qualification report found' });
    }

    const latestFile = qualFiles[0];
    const data = JSON.parse(await fs.readFile(path.join(qualDir, latestFile), 'utf-8'));
    res.json(data);
  } catch (error) {
    res.status(404).json({ error: 'Qualification report not found' });
  }
});

// ============================================================================
// Live Q&A Endpoint
// ============================================================================

app.post('/api/accounts/:slug/live-qna', async (req, res) => {
  const { slug } = req.params;
  const { question, products, recentTranscript } = req.body;

  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'Question is required' });
  }

  try {
    const { buildOpportunityContext } = await import('./src/context/buildOpportunityContext.js');
    const { executeLiveQna } = await import('./src/agents/liveQna.js');

    // Build context
    const context = await buildOpportunityContext({
      accountSlug: slug,
      products: products || [],
    });

    // Execute Q&A
    const result = await executeLiveQna(context, question, recentTranscript);

    if (result.success) {
      res.json({
        success: true,
        output: result.data,
        metadata: result.metadata,
        createdAt: new Date().toISOString(),
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Q&A failed',
      });
    }
  } catch (error: any) {
    console.error('[live-qna] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal error',
    });
  }
});

// Solution Map endpoint
app.post('/api/accounts/:slug/solution-map', async (req, res) => {
  const { slug } = req.params;
  const { products, focusAreas, competitorContext } = req.body;

  try {
    const { buildOpportunityContext } = await import('./src/context/buildOpportunityContext.js');
    const { executeSolutionMap } = await import('./src/agents/solutionMap.js');

    // Build context
    const context = await buildOpportunityContext({
      accountSlug: slug,
      products: products || [],
    });

    // Execute solution mapping
    const result = await executeSolutionMap(context, {
      products,
      focusAreas,
      competitorContext,
    });

    if (result.success) {
      res.json({
        success: true,
        output: result.data,
        metadata: result.metadata,
        createdAt: new Date().toISOString(),
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Solution mapping failed',
      });
    }
  } catch (error: any) {
    console.error('[solution-map] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal error',
    });
  }
});

// Generic agent execution endpoint
// Get agent run history for an account
app.get('/api/accounts/:slug/agents/:agentId/runs', async (req, res) => {
  const { slug, agentId } = req.params;
  const runsDir = path.join(DATA_DIR, slug, 'agent-runs', agentId);

  try {
    await fs.access(runsDir);
    const files = await fs.readdir(runsDir);
    const runs = await Promise.all(
      files
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, 20) // Last 20 runs
        .map(async (f) => {
          const data = JSON.parse(await fs.readFile(path.join(runsDir, f), 'utf-8'));
          return {
            id: f.replace('.json', ''),
            timestamp: data.metadata?.timestamp || f.replace('.json', ''),
            success: data.success,
            duration: data.metadata?.duration,
            model: data.metadata?.model,
          };
        })
    );
    res.json(runs);
  } catch {
    res.json([]);
  }
});

// Get a specific agent run
app.get('/api/accounts/:slug/agents/:agentId/runs/:runId', async (req, res) => {
  const { slug, agentId, runId } = req.params;
  const runFile = path.join(DATA_DIR, slug, 'agent-runs', agentId, `${runId}.json`);

  try {
    const data = JSON.parse(await fs.readFile(runFile, 'utf-8'));
    res.json(data);
  } catch {
    res.status(404).json({ error: 'Run not found' });
  }
});

// Delete a single agent run
app.delete('/api/accounts/:slug/agents/:agentId/runs/:runId', async (req, res) => {
  const { slug, agentId, runId } = req.params;
  const runFile = path.join(DATA_DIR, slug, 'agent-runs', agentId, `${runId}.json`);

  try {
    await fs.unlink(runFile);
    res.json({ success: true, message: 'Run deleted' });
  } catch (error) {
    res.status(404).json({ error: 'Run not found' });
  }
});

// Clear agent run history
app.delete('/api/accounts/:slug/agents/:agentId/runs', async (req, res) => {
  const { slug, agentId } = req.params;
  const runsDir = path.join(DATA_DIR, slug, 'agent-runs', agentId);

  try {
    await fs.rm(runsDir, { recursive: true, force: true });
    res.json({ success: true, message: 'History cleared' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear history' });
  }
});

app.post('/api/accounts/:slug/agents/:agentId/run', async (req, res) => {
  const { slug, agentId } = req.params;
  const body = req.body;

  try {
    const { isValidAgentId } = await import('./src/config/agents.js');
    const { executeAgent } = await import('./src/agents/registry.js');
    const { buildOpportunityContext } = await import('./src/context/buildOpportunityContext.js');

    if (!isValidAgentId(agentId)) {
      return res.status(400).json({ error: `Unknown agent: ${agentId}` });
    }

    // Build context
    // Handle "_none" as no callId selected
    const effectiveCallId = body.callId && body.callId !== '_none' ? body.callId : undefined;
    // Handle products - can be comma-separated string or array
    const products = typeof body.products === 'string' 
      ? body.products.split(',').filter(Boolean)
      : (body.products || []);
    const context = await buildOpportunityContext({
      accountSlug: slug,
      opportunityId: body.opportunityId,
      products,
      includeTranscript: !!effectiveCallId,
      transcriptCallId: effectiveCallId,
    });

    // Load selected artifacts and add to context
    if (body.selectedArtifacts && body.selectedArtifacts.length > 0) {
      const runsDir = path.join(DATA_DIR, slug, 'agent-runs');
      for (const artifactId of body.selectedArtifacts) {
        // Find the artifact file across all agent directories
        try {
          const agents = await fs.readdir(runsDir);
          for (const agentFolder of agents) {
            const runFile = path.join(runsDir, agentFolder, `${artifactId}.json`);
            try {
              const data = JSON.parse(await fs.readFile(runFile, 'utf-8'));
              if (data.success && data.output) {
                context.artifacts.push({
                  id: data.id,
                  artifactType: data.agentId,
                  stage: 'global',
                  accountId: slug,
                  title: getArtifactTitle(data.agentId, data.output),
                  summary: JSON.stringify(data.output).slice(0, 500),
                  lastRunAt: data.metadata?.timestamp || data.id,
                  lastRunAgentId: data.agentId,
                  version: 1,
                  _fullOutput: data.output, // Include full output for context
                });
                break;
              }
            } catch {}
          }
        } catch {}
      }
    }

    // Execute agent
    const result = await executeAgent(agentId, { context, body });

    // Generate run ID
    const runId = new Date().toISOString().replace(/[:.]/g, '-');
    const runsDir = path.join(DATA_DIR, slug, 'agent-runs', agentId);
    await fs.mkdir(runsDir, { recursive: true });

    // Save the run
    const runData = {
      id: runId,
      agentId,
      accountSlug: slug,
      input: body,
      success: result.success,
      output: result.success ? result.data : null,
      error: result.success ? null : result.error,
      metadata: {
        ...result.metadata,
        timestamp: new Date().toISOString(),
        duration: result.metadata?.executionTimeMs,
      },
    };
    await fs.writeFile(path.join(runsDir, `${runId}.json`), JSON.stringify(runData, null, 2));

    if (result.success) {
      res.json({
        success: true,
        runId,
        output: result.data,
        metadata: runData.metadata,
      });
    } else {
      res.status(500).json({
        success: false,
        runId,
        error: result.error || 'Agent execution failed',
      });
    }
  } catch (error: any) {
    console.error(`[agent:${agentId}] Error:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal error',
    });
  }
});

// Helper to get a human-readable title for an artifact
function getArtifactTitle(agentId: string, output: any): string {
  const agentLabels: Record<string, string> = {
    discovery_recap: 'Discovery Recap',
    precall_brief: 'Pre-Call Brief',
    custom_demo_plan: 'Custom Demo Plan',
    meddpicc_extractor: 'MEDDPICC Analysis',
    solution_map: 'Solution Map',
    business_case: 'Business Case',
    exec_summary: 'Executive Summary',
    deal_review: 'Deal Review',
    qualification: 'Qualification',
    meeting_summary: 'Meeting Summary',
    coaching: 'Call Coaching',
    postcall: 'Post-Call Update',
  };
  return agentLabels[agentId] || agentId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Helper to get a brief summary from artifact output
function getArtifactSummary(output: any): string {
  if (typeof output === 'string') return output.slice(0, 100);
  if (output.executiveSummary) return output.executiveSummary.slice(0, 100);
  if (output.summary) return output.summary.slice(0, 100);
  if (output.painPoints?.length > 0) {
    return `${output.painPoints.length} pain points, ${output.stakeholderMap?.length || 0} stakeholders`;
  }
  if (output.overallScore !== undefined) return `MEDDPICC Score: ${output.overallScore}`;
  return 'Agent output available';
}

process.on('SIGINT', async () => {
  console.log('\nShutting down API server...');
  await closeMCPClients();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down API server...');
  await closeMCPClients();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
