import express from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import { execute } from '@sourcegraph/amp-sdk';
import { config } from 'dotenv';
import { readMeta, computeStaleness, type SourceStatus, writeMeta } from './src/phases/freshness.js';
import { runAgent as executeAgent, type AgentName, type AgentOptions } from './src/agents/agent-runner.js';
import { ingestFromSalesforce, type SalesforceIngestOptions } from './src/phases/ingest/salesforce.js';
import type { AccountKey } from './src/types.js';
import { callSalesforceTool, callGongTool, callNotionTool, closeMCPClients } from './src/mcp-client.js';
import { refreshAccountContext } from './src/context/store.js';
import { createHash } from 'crypto';

// Load environment variables
config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const DATA_DIR = path.join(process.cwd(), 'data/accounts');

// Get MCP availability - for now, assume all configured MCPs are available
// In the future, could add actual health checks
function getMcpCapabilities(): { salesforce: boolean; gong: boolean; notion: boolean; amp: boolean } {
	// Assume all MCPs are available
	// User will see errors on refresh if not properly configured
	// Amp is always available (no MCP required)
	return { salesforce: true, gong: true, notion: true, amp: true };
}

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

// Get account context (consolidated view)
app.get('/api/accounts/:slug/context', async (req, res) => {
  const { slug } = req.params;
  const accountDir = path.join(DATA_DIR, slug);

  try {
    const { getAccountContext } = await import('./src/context/store.js');
    const context = await getAccountContext(accountDir);

    if (!context) {
      return res.status(404).json({ error: 'Context not found. Run a data refresh first.' });
    }

    res.json(context);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch context' });
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
    } else if (source === 'amp') {
      // Load amp data (global, not account-specific)
      const meta = await readMeta(path.join(DATA_DIR, slug));
      const ampMeta = meta.sources.amp;
      
      if (!ampMeta || !ampMeta.pages) {
        data = {
          pagesCount: 0,
          featuresCount: 0,
          pages: [],
          features: [],
          content: { news: '', manual: '' },
          summary: null,
        };
      } else {
        const globalAmpDir = path.join(process.cwd(), 'data', 'global', 'amp');
        const featuresPath = path.join(globalAmpDir, 'features.json');
        const summaryPath = path.join(globalAmpDir, 'summary.json');
        const newsPath = path.join(globalAmpDir, 'news.md');
        const manualPath = path.join(globalAmpDir, 'manual.md');
        
        let features = [];
        try {
          const featuresData = JSON.parse(await fs.readFile(featuresPath, 'utf-8'));
          features = featuresData.features || [];
        } catch {}
        
        let summary = null;
        try {
          summary = JSON.parse(await fs.readFile(summaryPath, 'utf-8'));
        } catch {}
        
        let newsContent = '';
        let manualContent = '';
        try { newsContent = await fs.readFile(newsPath, 'utf-8'); } catch {}
        try { manualContent = await fs.readFile(manualPath, 'utf-8'); } catch {}
        
        data = {
          pagesCount: Object.keys(ampMeta.pages).length,
          featuresCount: ampMeta.featuresCount || 0,
          featuresLastGeneratedAt: ampMeta.featuresLastGeneratedAt,
          pages: Object.entries(ampMeta.pages).map(([key, page]: [string, any]) => ({
            key,
            url: page.url,
            lastFetchedAt: page.lastFetchedAt,
          })),
          features: features.slice(0, 10),
          content: { news: newsContent, manual: manualContent },
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
    const meta = await readMeta(accountDir);
    const staleness = computeStaleness(meta);
    const { getAccountContext } = await import('./src/context/store.js');
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
        status: meta.sources.salesforce?.status || 'missing',
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
        status: meta.sources.gong?.status || 'missing',
        lastFetchedAt: formatTimestamp(meta.sources.gong?.lastListSyncAt),
        nextRecommended: getSuggestion(staleness.gong.any),
        staleReasons: staleness.gong.reasons,
        callCount: meta.sources.gong?.callCount || 0,
        transcriptsCount,
        latestCallTime: formatTimestamp(latestCallTime),
      },
      notion: {
        status: meta.sources.notion?.status || 'missing',
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
    res.status(500).json({ error: 'Failed to get freshness status' });
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
    if (!['salesforce', 'gong', 'notion', 'amp'].includes(source)) {
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
      if (source === 'amp' && !staleness.amp.any) {
        sendProgress(res, 'Amp data is already fresh, using cached data');
        res.write(`data: ${JSON.stringify({ 
          type: 'complete', 
          success: true, 
          updated: false,
          modeUsed: 'cache',
          stats: {
            pagesCount: meta.sources.amp?.pages ? Object.keys(meta.sources.amp.pages).length : 0,
            featuresCount: meta.sources.amp?.featuresCount || 0
          },
          meta: meta.sources.amp
        })}\n\n`);
        return res.end();
      }
    }
    
    // Fast path: Amp News refresh (no MCP required)
    if (source === 'amp') {
      try {
        const { ingestAmpNews } = await import('./src/phases/ingest/ampNews.js');
        
        const result = await ingestAmpNews(slug, accountDir, {
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
            dataPath: path.join(accountDir, 'raw', 'amp')
          }
        })}\n\n`);
        return res.end();
      } catch (ampError: any) {
        console.error('[api-server] Amp refresh failed:', ampError);
        res.write(`data: ${JSON.stringify({ 
          type: 'error', 
          error: 'Amp refresh failed', 
          details: ampError.message || String(ampError)
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
          const lookupResult = await callSalesforceTool('soql_query', {
            query: `SELECT Id, Name FROM Account WHERE Name = '${accountMetadata.name}' LIMIT 1`
          });
          const records = JSON.parse(lookupResult[0].text).records;
          if (records && records.length > 0) {
            sfId = records[0].Id;
            accountMetadata.salesforceId = sfId;
            await fs.writeFile(path.join(accountDir, 'metadata.json'), JSON.stringify(accountMetadata, null, 2));
          } else {
            throw new Error(`Account "${accountMetadata.name}" not found in Salesforce`);
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
        
        // Fetch Account
        sendProgress(res, 'Fetching account details...');
        const accountResult = await callSalesforceTool('get_record', {
          objectType: 'Account',
          id: sfId
        });
        const account = JSON.parse(accountResult[0].text);
        
        // Fetch Contacts
        sendProgress(res, 'Fetching contacts...');
        const contactsResult = await callSalesforceTool('soql_query', {
          query: `SELECT Id, Name, Email, Title, Phone, Department, LastModifiedDate FROM Contact WHERE AccountId = '${sfId}' ${contactWhere} LIMIT 100`
        });
        const contacts = JSON.parse(contactsResult[0].text).records;
        
        // Fetch Opportunities
        sendProgress(res, 'Fetching opportunities...');
        const oppsResult = await callSalesforceTool('soql_query', {
          query: `SELECT Id, Name, StageName, Amount, CloseDate, Probability, NextStep, Type, LeadSource, LastModifiedDate FROM Opportunity WHERE AccountId = '${sfId}' ${oppWhere} LIMIT 100`
        });
        const opportunities = JSON.parse(oppsResult[0].text).records;
        
        // Fetch Activities
        sendProgress(res, 'Fetching activities...');
        const activitiesResult = await callSalesforceTool('soql_query', {
          query: `SELECT Id, Subject, ActivityDate, Status, Priority, LastModifiedDate FROM Task WHERE AccountId = '${sfId}' ${activityWhere} LIMIT 100`
        });
        const activities = JSON.parse(activitiesResult[0].text).records;
        
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
        updatedMeta.sources.salesforce.status = 'fresh';
        updatedMeta.sources.salesforce.entityCheckpoints = {
          Account: { lastFetchedAt: now },
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
        console.error('[api-server] Direct MCP call failed:', mcpError);
        res.write(`data: ${JSON.stringify({ 
          type: 'error', 
          error: 'MCP refresh failed', 
          details: mcpError.message || String(mcpError)
        })}\n\n`);
        return res.end();
      }
    }
    
    // Fast path: Direct MCP client for Gong (ingestFromGong doesn't work outside Amp context)
    if (source === 'gong') {
      try {
        sendProgress(res, 'Connecting to Gong MCP...');
        
        // Calculate date range
        const toDate = new Date();
        let fromDate: Date;
        
        if (mode !== 'full' && meta.sources.gong?.lastListSyncAt) {
          sendProgress(res, 'Using incremental refresh (fetching only new calls)');
          fromDate = new Date(meta.sources.gong.lastListSyncAt);
          fromDate.setMinutes(fromDate.getMinutes() - 5);
        } else {
          sendProgress(res, 'Performing full refresh (last 14 days)');
          fromDate = new Date();
          fromDate.setDate(fromDate.getDate() - 14);
        }
        
        // List recent calls
        sendProgress(res, 'Fetching call list...');
        const callsResult = await callGongTool('list_calls', {
          fromDateTime: fromDate.toISOString(),
          toDateTime: toDate.toISOString()
        });
        const rawCalls = JSON.parse(callsResult[0].text).calls || [];
        
        sendProgress(res, `Found ${rawCalls.length} calls, fetching transcripts...`);
        
        // Gong API doesn't provide participant names - keep participants empty
        const calls = rawCalls.slice(0, 10).map((call: any) => ({
          id: call.id,
          title: call.title || 'Untitled Call',
          startTime: call.scheduled || call.started || '',
          duration: call.duration || 0,
          participants: [] // Not available in Gong API
        }));
        
        const summaries = [];
        const transcriptsMetadata: Record<string, { hash: string; fetchedAt: string }> = {};
        
        // Fetch transcripts for each call
        for (let i = 0; i < calls.length; i++) {
          const call = calls[i];
          sendProgress(res, `Fetching transcript ${i + 1}/${calls.length}...`);
          
          try {
            const transcriptResult = await callGongTool('retrieve_transcripts', {
              callIds: [call.id]
            });
            const transcriptData = JSON.parse(transcriptResult[0].text);
            
            console.log(`[api-server] Transcript data structure for ${call.id}:`, JSON.stringify(transcriptData).substring(0, 500));
            
            if (transcriptData.callTranscripts && transcriptData.callTranscripts.length > 0) {
              const t = transcriptData.callTranscripts[0];
              
              // Parse transcript - Gong structure: [{speakerId, sentences: [{text}]}]
              // Use shortened IDs for readability since Gong doesn't provide name mappings
              const transcriptLines: string[] = [];
              for (const segment of (t.transcript || [])) {
                const speakerId = String(segment.speakerId || 'Unknown');
                const shortId = speakerId.slice(-4); // Last 4 digits
                const sentences = (segment.sentences || []).map((s: any) => s.text).join(' ');
                if (sentences) {
                  transcriptLines.push(`Speaker ...${shortId}: ${sentences}`);
                }
              }
              const transcript = transcriptLines.join('\n');
              
              const hash = createHash('sha256').update(transcript).digest('hex');
              
              summaries.push({
                callId: call.id,
                transcript,
                summary: t.summary || null,
                actionItems: t.keyPoints || t.actionItems || [],
                nextSteps: t.nextSteps || [],
                topics: [...new Set((t.transcript || []).map((s: any) => s.topic).filter(Boolean))]
              });
              
              transcriptsMetadata[call.id] = {
                hash,
                fetchedAt: new Date().toISOString()
              };
            }
          } catch (transcriptError) {
            console.error(`Failed to fetch transcript for call ${call.id}:`, transcriptError);
            // Continue with other calls
          }
        }
        
        // Save to file
        const now = new Date().toISOString();
        const gongData = {
          calls,
          summaries,
          transcripts: transcriptsMetadata,
          lastSyncedAt: now
        };
        
        const rawDir = path.join(accountDir, 'raw');
        await fs.mkdir(rawDir, { recursive: true });
        await fs.writeFile(path.join(rawDir, 'gong.json'), JSON.stringify(gongData, null, 2));
        
        // Update meta
        const updatedMeta = await readMeta(accountDir);
        updatedMeta.sources.gong = updatedMeta.sources.gong || {};
        updatedMeta.sources.gong.lastListSyncAt = now;
        updatedMeta.sources.gong.callCount = calls.length;
        updatedMeta.sources.gong.transcripts = transcriptsMetadata;
        updatedMeta.sources.gong.status = 'fresh';
        await writeMeta(accountDir, updatedMeta);
        
        // Rebuild context
        sendProgress(res, 'Rebuilding context...');
        await refreshAccountContext(accountDir);
        
        sendProgress(res, `Complete! Fetched ${calls.length} calls with ${summaries.length} transcripts`);
        res.write(`data: ${JSON.stringify({ 
          type: 'complete', 
          success: true, 
          updated: true,
          modeUsed: mode,
          stats: {
            callsCount: calls.length,
            transcriptsCount: summaries.length
          },
          meta: updatedMeta.sources.gong
        })}\n\n`);
        return res.end();
      } catch (mcpError: any) {
        console.error('[api-server] Gong MCP call failed:', mcpError);
        res.write(`data: ${JSON.stringify({ 
          type: 'error', 
          error: 'Gong MCP refresh failed', 
          details: mcpError.message || String(mcpError)
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
        updatedMeta.sources.notion.lastFetchedAt = now;
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
