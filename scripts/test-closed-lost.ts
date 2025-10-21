#!/usr/bin/env tsx

/**
 * Test script for Closed-Lost Agent
 * 
 * Analyzes why a deal was lost and extracts lessons learned, competitive intel,
 * and product feedback from the entire opportunity lifecycle.
 * 
 * Usage:
 *   npx tsx scripts/test-closed-lost.ts "Company Name" [opportunityId]
 * 
 * Examples:
 *   npx tsx scripts/test-closed-lost.ts "Acme Corp"
 *   npx tsx scripts/test-closed-lost.ts "TechCorp Inc" "006xx000..."
 */

import { join } from 'path'
import { readFile } from 'fs/promises'
import { runClosedLostAgent } from '../src/agents/closedLost.js'
import type { AccountKey } from '../src/types.js'

async function main() {
	const args = process.argv.slice(2)

	if (args.length < 1) {
		console.error('Usage: npx tsx scripts/test-closed-lost.ts "Company Name" [opportunityId]')
		console.error('')
		console.error('Examples:')
		console.error('  npx tsx scripts/test-closed-lost.ts "Acme Corp"')
		console.error('  npx tsx scripts/test-closed-lost.ts "TechCorp Inc" "006xx000..."')
		process.exit(1)
	}

	const accountName = args[0]
	const opportunityId = args[1]

	console.log('='.repeat(60))
	console.log('Closed-Lost Analysis Agent Test')
	console.log('='.repeat(60))
	console.log(`Account: ${accountName}`)
	if (opportunityId) {
		console.log(`Opportunity ID: ${opportunityId}`)
	}
	console.log('')

	// Resolve account directory
	const slug = accountName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
	const accountDataDir = join(process.cwd(), 'data', 'accounts', slug)

	// Check if account directory exists
	try {
		await readFile(join(accountDataDir, 'raw', 'salesforce.json'), 'utf-8')
	} catch (error) {
		console.error(`❌ Account data not found at ${accountDataDir}`)
		console.error(`   Run the main workbench first: npm run manage "${accountName}"`)
		process.exit(1)
	}

	// Build account key
	const accountKey: AccountKey = { name: accountName }

	try {
		// Try to load Salesforce ID from raw data
		const sfData = JSON.parse(await readFile(join(accountDataDir, 'raw', 'salesforce.json'), 'utf-8'))
		if (sfData.account?.Id) {
			accountKey.salesforceId = sfData.account.Id
		}
		if (sfData.account?.Website) {
			accountKey.domain = sfData.account.Website.replace(/^https?:\/\//, '').replace(/\/$/, '')
		}
	} catch (error) {
		console.warn('⚠️  Could not load Salesforce ID from raw data')
	}

	// If no opportunityId provided, try to find a closed-lost opp
	let targetOppId = opportunityId
	if (!targetOppId) {
		try {
			const sfData = JSON.parse(await readFile(join(accountDataDir, 'raw', 'salesforce.json'), 'utf-8'))
			const closedLostOpps = sfData.opportunities?.filter(
				(opp: any) => opp.IsClosed && !opp.IsWon
			)
			if (closedLostOpps && closedLostOpps.length > 0) {
				targetOppId = closedLostOpps[0].Id
				console.log(`   Found closed-lost opportunity: ${closedLostOpps[0].Name} (${targetOppId})`)
				console.log('')
			}
		} catch (error) {
			// Ignore
		}
	}

	if (!targetOppId) {
		console.error('❌ No opportunity ID provided and no closed-lost opportunities found')
		console.error('   Usage: npx tsx scripts/test-closed-lost.ts "Company Name" "006xx..."')
		process.exit(1)
	}

	console.log('Starting closed-lost analysis...\n')

	try {
		const result = await runClosedLostAgent(
			accountKey,
			targetOppId,
			accountDataDir
		)

		console.log('')
		console.log('='.repeat(60))
		console.log('❌ Closed-Lost Analysis Complete')
		console.log('='.repeat(60))
		console.log('')
		console.log(`Primary Reason: ${result.primaryReason}`)
		console.log('')

		if (result.competitorWon) {
			console.log(`🏆 Competitor Won: ${result.competitorWon}`)
			console.log('')
		}

		if (result.secondaryFactors.length > 0) {
			console.log('Secondary Factors:')
			result.secondaryFactors.slice(0, 5).forEach((factor) => {
				console.log(`  - ${factor}`)
			})
			console.log('')
		}

		if (result.objectionHistory.length > 0) {
			console.log(`Objection History: ${result.objectionHistory.length} objections`)
			const unresolved = result.objectionHistory.filter((o) => !o.resolved)
			console.log(`  - ${unresolved.length} unresolved`)
			console.log('')
		}

		if (result.lessonsLearned.length > 0) {
			console.log('💡 Key Lessons Learned:')
			result.lessonsLearned.slice(0, 3).forEach((lesson) => {
				console.log(`  - ${lesson}`)
			})
			console.log('')
		}

		if (result.productFeedback.length > 0) {
			console.log('Product Feedback:')
			const highPriority = result.productFeedback.filter((f) => f.priority === 'high')
			console.log(`  - ${highPriority.length} high priority issues`)
			highPriority.slice(0, 3).forEach((feedback) => {
				console.log(`    • [${feedback.category}] ${feedback.detail}`)
			})
			console.log('')
		}

		if (result.competitiveIntel.length > 0) {
			console.log('Competitive Intelligence:')
			result.competitiveIntel.forEach((intel) => {
				console.log(`  ${intel.competitor}:`)
				console.log(`    Strengths: ${intel.strengthsTheyLeveraged.length}`)
				console.log(`    Our Weaknesses: ${intel.ourWeaknesses.length}`)
			})
			console.log('')
		}

		console.log('Proposed Salesforce Updates:')
		console.log(`  - Closed Lost Reason: ${result.proposedSalesforceUpdates.closedLostReason}`)
		if (result.proposedSalesforceUpdates.competitor) {
			console.log(`  - Competitor: ${result.proposedSalesforceUpdates.competitor}`)
		}
		console.log('')

		console.log('Files generated:')
		console.log(`  - ${accountDataDir}/closed-lost/closed-lost-*.json`)
		console.log(`  - ${accountDataDir}/closed-lost/closed-lost-*.md`)
		console.log('')
		console.log('Next steps:')
		console.log('  1. Review the detailed markdown analysis')
		console.log('  2. Share lessons learned with sales team')
		console.log('  3. Forward product feedback to PM team')
		console.log('  4. Update Salesforce with proposed field changes')
		console.log('  5. Add competitive intel to battlecards')

	} catch (error) {
		console.error('❌ Closed-lost agent failed:', error)
		process.exit(1)
	}
}

main().catch((error) => {
	console.error('Fatal error:', error)
	process.exit(1)
})
