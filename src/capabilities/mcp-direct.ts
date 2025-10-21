/**
 * Direct MCP Capability Detection (FAST)
 * 
 * Uses direct MCP client calls instead of expensive Amp execute() calls.
 * This bypasses LLM overhead for simple availability checks.
 * 
 * Cost comparison:
 * - Old approach (capabilities.ts): 1 execute() call ~$0.26
 * - Current approach (detect.ts): 3 execute() calls ~$0.78
 * - This approach: Direct MCP calls ~$0.00 (no LLM)
 */

import { getSalesforceClient, getGongClient, getNotionClient } from '../mcp-client.js'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import type { Capabilities } from '../types.js'

const CACHE_FILE = 'data/capabilities.json'

/**
 * Test if Salesforce MCP is available (direct client call)
 */
async function testSalesforce(): Promise<boolean> {
	try {
		const client = await getSalesforceClient()
		if (!client) return false

		// Simple test query - just check if we can call a tool
		await client.callTool({
			name: 'mcp__salesforce__soql_query',
			arguments: { query: 'SELECT Id FROM Account LIMIT 1' },
		})
		return true
	} catch (error) {
		console.log('[capabilities] Salesforce test failed:', error)
		return false
	}
}

/**
 * Test if Gong MCP is available (direct client call)
 */
async function testGong(): Promise<boolean> {
	try {
		const client = await getGongClient()
		if (!client) return false

		// Simple test - just check if we can list calls
		await client.callTool({
			name: 'mcp__gong_extended__list_calls',
			arguments: { limit: 1 },
		})
		return true
	} catch (error) {
		console.log('[capabilities] Gong test failed:', error)
		return false
	}
}

/**
 * Test if Notion MCP is available (direct client call)
 */
async function testNotion(): Promise<boolean> {
	try {
		const client = await getNotionClient()
		if (!client) return false

		// Simple test - just check if we can search with empty query
		await client.callTool({
			name: 'mcp__notion__API-post-search',
			arguments: { query: '' },
		})
		return true
	} catch (error) {
		console.log('[capabilities] Notion test failed:', error)
		return false
	}
}

/**
 * Detect capabilities using direct MCP client calls (no LLM overhead)
 */
export async function detectCapabilitiesDirect(useCache = true): Promise<Capabilities> {
	// Try to load from cache if requested
	if (useCache && existsSync(CACHE_FILE)) {
		try {
			const cached = JSON.parse(await readFile(CACHE_FILE, 'utf-8')) as Capabilities
			console.log('✓ Loaded capabilities from cache')
			return cached
		} catch (error) {
			console.log('⚠ Failed to load cache, detecting...')
		}
	}

	console.log('🔍 Detecting MCP capabilities (direct method)...')

	// Test all MCPs in parallel
	const [salesforce, gong, notion] = await Promise.all([
		testSalesforce(),
		testGong(),
		testNotion(),
	])

	const capabilities: Capabilities = {
		gong,
		salesforce,
		notion,
		detectedAt: new Date().toISOString(),
	}

	// Log results
	console.log(`   Salesforce: ${salesforce ? '✓' : '✗'}`)
	console.log(`   Gong:       ${gong ? '✓' : '✗'}`)
	console.log(`   Notion:     ${notion ? '✓' : '✗'}`)

	// Cache the results
	try {
		await mkdir('data', { recursive: true })
		await writeFile(CACHE_FILE, JSON.stringify(capabilities, null, 2))
		console.log('✓ Capabilities cached')
	} catch (error) {
		console.warn('⚠ Failed to cache capabilities:', error)
	}

	return capabilities
}
