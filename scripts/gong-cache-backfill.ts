#!/usr/bin/env tsx
/**
 * Backfill Gong Call Cache
 * 
 * Performs initial population of the Gong call cache with last 6 months of calls.
 * 
 * IMPORTANT: This must be run INSIDE Amp (not standalone) because it requires
 * access to Gong MCP tools which are only available in Amp's execution context.
 * 
 * Usage (from Amp):
 *   Run this file directly in Amp, or use the workbench integration
 * 
 * Alternative (standalone testing):
 *   npm run gong:backfill -- --test    # Test company extraction only
 */

import { getGongCacheManager } from '../src/gong-cache/manager.js'
import { testExtraction } from '../src/gong-cache/enrichment.js'

async function main() {
	const args = process.argv.slice(2)
	const monthsArg = args.find(a => a.startsWith('--months='))
	const months = monthsArg ? parseInt(monthsArg.split('=')[1]) : 6
	
	const testMode = args.includes('--test')
	
	if (testMode) {
		console.log('Running extraction tests...\n')
		testExtraction()
		return
	}
	
	console.log('=== Gong Call Cache Backfill ===\n')
	console.log(`Fetching last ${months} months of calls...\n`)
	
	const manager = getGongCacheManager()
	
	try {
		const result = await manager.backfill({
			months,
			delayMs: 2000, // 2 second delay to respect rate limits
		})
		
		console.log('\n=== Backfill Complete ===')
		console.log(`New calls added: ${result.newCalls}`)
		console.log(`Total calls in cache: ${result.totalCalls}`)
		console.log(`Last synced: ${result.syncedAt}`)
		
		// Show stats
		const stats = await manager.getStats()
		console.log('\n=== Cache Stats ===')
		console.log(`Total calls: ${stats.totalCalls}`)
		console.log(`Unique companies: ${stats.uniqueCompanies}`)
		console.log(`Date range: ${stats.oldestCall} to ${stats.newestCall}`)
		console.log(`\nCache location: ./data/gong-cache/calls-index.json`)
	} catch (error) {
		console.error('Backfill failed:', error)
		process.exit(1)
	}
}

main()
