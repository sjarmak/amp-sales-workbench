#!/usr/bin/env tsx
/**
 * Show Gong Cache Statistics
 * 
 * Usage:
 *   npm run gong:stats
 *   npm run gong:stats -- --account "Canva"
 */

import { getGongCacheManager } from '../src/gong-cache/manager.js'

async function main() {
	const args = process.argv.slice(2)
	const accountArg = args.find(a => a.startsWith('--account='))
	const accountName = accountArg ? accountArg.split('=')[1].replace(/['"]/g, '') : null
	
	const manager = getGongCacheManager()
	
	if (accountName) {
		console.log(`=== Calls for "${accountName}" ===\n`)
		
		const calls = await manager.getCallsForAccount(accountName, {
			maxResults: 20,
		})
		
		if (calls.length === 0) {
			console.log('No calls found')
		} else {
			calls.forEach((call, idx) => {
				const date = new Date(call.scheduled).toLocaleDateString()
				const duration = Math.floor(call.duration / 60)
				console.log(`${idx + 1}. [${date}] ${call.title} (${duration}m)`)
				console.log(`   Companies: ${call.companyNames.join(', ')}`)
			})
			console.log(`\nTotal: ${calls.length} calls`)
		}
	} else {
		console.log('=== Gong Cache Stats ===\n')
		
		const stats = await manager.getStats()
		
		console.log(`Total calls: ${stats.totalCalls}`)
		console.log(`Unique companies: ${stats.uniqueCompanies}`)
		console.log(`Last synced: ${stats.lastSyncAt}`)
		console.log(`Date range: ${stats.oldestCall.split('T')[0]} to ${stats.newestCall.split('T')[0]}`)
		console.log(`\nCache location: ./data/gong-cache/calls-index.json`)
		console.log(`\nTo see calls for a specific account:`)
		console.log(`  npm run gong:stats -- --account="Company Name"`)
	}
}

main()
