/**
 * Capability Detection Module
 * 
 * Tests which MCP servers are available and working.
 * Results are cached to avoid repeated detection.
 */

import { executeWithMode } from '../lib/amp-executor.js'
import type { AmpOptions } from '@sourcegraph/amp-sdk'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import type { Capabilities } from '../types.js'

const CACHE_FILE = 'data/capabilities.json'
const TEST_TIMEOUT_MS = 5000

const ampOptions: AmpOptions = {
	dangerouslyAllowAll: true,
}

/**
 * Test if Gong MCP is available
 */
async function testGong(): Promise<boolean> {
	try {
		const result = await withTimeout(
			testMcpTool('Test Gong MCP: Use mcp__gong_extended__list_calls with limit 1. Return "SUCCESS" if it works.'),
			TEST_TIMEOUT_MS
		)
		return result.toLowerCase().includes('success')
	} catch (error) {
		return false
	}
}

/**
 * Test if Salesforce MCP is available
 */
async function testSalesforce(): Promise<boolean> {
	try {
		const result = await withTimeout(
			testMcpTool('Test Salesforce MCP: Use mcp__salesforce__soql_query with "SELECT Id FROM Account LIMIT 1". Return "SUCCESS" if it works.'),
			TEST_TIMEOUT_MS
		)
		return result.toLowerCase().includes('success')
	} catch (error) {
		return false
	}
}

/**
 * Test if Notion MCP is available
 */
async function testNotion(): Promise<boolean> {
	try {
		const result = await withTimeout(
			testMcpTool('Test Notion MCP: Use mcp__notion__API_post_search with empty query. Return "SUCCESS" if it works.'),
			TEST_TIMEOUT_MS
		)
		return result.toLowerCase().includes('success')
	} catch (error) {
		return false
	}
}

/**
 * Helper to test an MCP tool via Amp SDK (fast mode for simple testing)
 */
async function testMcpTool(prompt: string): Promise<string> {
	const stream = executeWithMode({
		prompt,
		mode: 'fast',
		options: ampOptions,
	})

	for await (const message of stream) {
		if (message.type === 'result' && !message.is_error) {
			return message.result
		}
		if (message.type === 'result' && message.is_error) {
			throw new Error('MCP test failed')
		}
	}

	throw new Error('No result from MCP test')
}

/**
 * Helper to add timeout to promises
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
	return Promise.race([
		promise,
		new Promise<T>((_, reject) =>
			setTimeout(() => reject(new Error('Timeout')), timeoutMs)
		),
	])
}

/**
 * Detect which MCP servers are available
 * Tests each MCP with a simple query and returns capability flags
 */
export async function detectCapabilities(useCache = true): Promise<Capabilities> {
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

	console.log('🔍 Detecting MCP capabilities...')

	// Test all MCPs in parallel
	const [gong, salesforce, notion] = await Promise.all([
		testGong(),
		testSalesforce(),
		testNotion(),
	])

	const capabilities: Capabilities = {
		gong,
		salesforce,
		notion,
		detectedAt: new Date().toISOString(),
	}

	// Log results
	console.log(`   Gong:       ${gong ? '✓' : '✗'}`)
	console.log(`   Salesforce: ${salesforce ? '✓' : '✗'}`)
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

/**
 * Load cached capabilities without re-detecting
 */
export async function loadCachedCapabilities(): Promise<Capabilities | null> {
	if (!existsSync(CACHE_FILE)) {
		return null
	}

	try {
		return JSON.parse(await readFile(CACHE_FILE, 'utf-8')) as Capabilities
	} catch {
		return null
	}
}
