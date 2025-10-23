/**
 * Direct MCP Client for API Server
 * 
 * Provides fast, direct access to MCP tools without routing through Amp SDK.
 * This bypasses LLM decision-making for 10-100x speedup on data fetches.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { homedir } from 'os';
import { readFile } from 'fs/promises';
import { join } from 'path';

interface MCPConfig {
  'amp.mcpServers'?: Record<string, {
    command: string;
    args?: string[];
    env?: Record<string, string>;
  }>;
}

let salesforceClient: Client | null = null;
let gongClient: Client | null = null;
let notionClient: Client | null = null;

/**
 * Load MCP server configuration from Amp's config
 */
async function loadMCPConfig(): Promise<MCPConfig> {
  try {
    // Try Amp's settings location
    const configPath = join(homedir(), '.config', 'amp', 'settings.json');
    const content = await readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn('[mcp-client] Could not load Amp settings, MCP servers may not be available:', error);
    return {};
  }
}

/**
 * Initialize MCP client for Salesforce
 */
export async function getSalesforceClient(): Promise<Client | null> {
  if (salesforceClient) return salesforceClient;

  try {
    const config = await loadMCPConfig();
    const sfConfig = config['amp.mcpServers']?.['salesforce'];
    
    if (!sfConfig) {
      console.warn('[mcp-client] Salesforce MCP not configured in Amp settings');
      return null;
    }

    console.log('[mcp-client] Initializing Salesforce MCP client...');
    
    const transport = new StdioClientTransport({
      command: sfConfig.command,
      args: sfConfig.args || [],
      env: { ...process.env as Record<string, string>, ...sfConfig.env }
    });

    salesforceClient = new Client({
      name: 'amp-sales-workbench-api',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await salesforceClient.connect(transport);
    console.log('[mcp-client] Salesforce MCP client connected');
    
    return salesforceClient;
  } catch (error) {
    console.error('[mcp-client] Failed to initialize Salesforce client:', error);
    return null;
  }
}

/**
 * Initialize MCP client for Gong
 */
export async function getGongClient(): Promise<Client | null> {
  if (gongClient) return gongClient;

  try {
    const config = await loadMCPConfig();
    const gongConfig = config['amp.mcpServers']?.['gong-extended'];
    
    if (!gongConfig) {
      console.warn('[mcp-client] Gong MCP not configured in Amp settings');
      return null;
    }

    console.log('[mcp-client] Initializing Gong MCP client...');
    
    const transport = new StdioClientTransport({
      command: gongConfig.command,
      args: gongConfig.args || [],
      env: { ...process.env as Record<string, string>, ...gongConfig.env }
    });

    gongClient = new Client({
      name: 'amp-sales-workbench-api',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await gongClient.connect(transport);
    console.log('[mcp-client] Gong MCP client connected');
    
    // List available tools
    const tools = await gongClient.listTools();
    console.log('[mcp-client] Available Gong tools:', tools.tools.map(t => t.name).join(', '));
    
    return gongClient;
  } catch (error) {
    console.error('[mcp-client] Failed to initialize Gong client:', error);
    return null;
  }
}

/**
 * Call a Salesforce MCP tool directly
 */
export async function callSalesforceTool(toolName: string, args: any): Promise<any> {
  const client = await getSalesforceClient();
  
  if (!client) {
    throw new Error('Salesforce MCP client not available');
  }

  console.log(`[mcp-client] Calling ${toolName} with args:`, JSON.stringify(args).substring(0, 100));
  
  const result = await client.callTool({
    name: toolName,
    arguments: args
  });

  return result.content;
}

/**
 * Call a Gong MCP tool directly
 */
export async function callGongTool(toolName: string, args: any): Promise<any> {
  const client = await getGongClient();
  
  if (!client) {
    throw new Error('Gong MCP client not available');
  }

  console.log(`[mcp-client] Calling ${toolName} with args:`, JSON.stringify(args).substring(0, 100));
  
  try {
    const result = await client.callTool({
      name: toolName,
      arguments: args
    });

    const content = result.content as any[];
    console.log(`[mcp-client] Result type:`, content[0]?.type, 'length:', content.length);
    if (content[0]?.type === 'text') {
      console.log(`[mcp-client] Raw text (first 200 chars):`, content[0].text.substring(0, 200));
    }
    return content;
  } catch (error: any) {
    console.error(`[mcp-client] Tool call failed:`, error.message || error);
    throw error;
  }
}

/**
 * Initialize MCP client for Notion
 */
export async function getNotionClient(): Promise<Client | null> {
  if (notionClient) return notionClient;

  try {
    const config = await loadMCPConfig();
    const notionConfig = config['amp.mcpServers']?.['notion'];
    
    if (!notionConfig) {
      console.warn('[mcp-client] Notion MCP not configured in Amp settings');
      return null;
    }

    console.log('[mcp-client] Initializing Notion MCP client...');
    
    const transport = new StdioClientTransport({
      command: notionConfig.command,
      args: notionConfig.args || [],
      env: { ...process.env as Record<string, string>, ...notionConfig.env }
    });

    notionClient = new Client({
      name: 'amp-sales-workbench-api',
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await notionClient.connect(transport);
    console.log('[mcp-client] Notion MCP client connected');
    
    return notionClient;
  } catch (error) {
    console.error('[mcp-client] Failed to initialize Notion client:', error);
    return null;
  }
}

/**
 * Call a Notion MCP tool directly
 */
export async function callNotionTool(toolName: string, args: any): Promise<any> {
  const client = await getNotionClient();
  
  if (!client) {
    throw new Error('Notion MCP client not available');
  }

  console.log(`[mcp-client] Calling ${toolName} with args:`, JSON.stringify(args).substring(0, 100));
  
  try {
    const result = await client.callTool({
      name: toolName,
      arguments: args
    });

    const content = result.content as any[];
    console.log(`[mcp-client] Result type:`, content[0]?.type, 'length:', content.length);
    return content;
  } catch (error: any) {
    console.error(`[mcp-client] Tool call failed:`, error.message || error);
    throw error;
  }
}

/**
 * Cleanup clients on shutdown
 */
export async function closeMCPClients() {
  if (salesforceClient) {
    await salesforceClient.close();
    salesforceClient = null;
  }
  if (gongClient) {
    await gongClient.close();
    gongClient = null;
  }
  if (notionClient) {
    await notionClient.close();
    notionClient = null;
  }
}
