#!/usr/bin/env tsx

/**
 * Test script for Handoff Agent
 * 
 * Tests generating handoff context packs for deal transitions:
 * - SE→AE (Sales Engineer to Account Executive)
 * - AE→CS (Account Executive to Customer Success)
 * - CS→Support (Customer Success to Support)
 * 
 * Usage:
 *   npx tsx scripts/test-handoff.ts "Company Name" "SE→AE"
 *   npx tsx scripts/test-handoff.ts "Company Name" "AE→CS" [opportunityId]
 *   npx tsx scripts/test-handoff.ts "Company Name" "CS→Support" [opportunityId]
 * 
 * Examples:
 *   npx tsx scripts/test-handoff.ts "Acme Corp" "SE→AE"
 *   npx tsx scripts/test-handoff.ts "TechCorp Inc" "AE→CS" "006xx000..."
 */

import { join } from 'path'
import { readFile } from 'fs/promises'
import { runHandoffAgent, type HandoffType } from '../src/agents/handoff.js'
import type { AccountKey } from '../src/types.js'

async function main() {
	const args = process.argv.slice(2)

	if (args.length < 2) {
		console.error('Usage: npx tsx scripts/test-handoff.ts "Company Name" "HandoffType" [opportunityId]')
		console.error('HandoffType must be one of: "SE→AE", "AE→CS", "CS→Support"')
		console.error('')
		console.error('Examples:')
		console.error('  npx tsx scripts/test-handoff.ts "Acme Corp" "SE→AE"')
		console.error('  npx tsx scripts/test-handoff.ts "TechCorp Inc" "AE→CS" "006xx000..."')
		process.exit(1)
	}

	const accountName = args[0]
	const handoffType = args[1] as HandoffType
	const opportunityId = args[2]

	// Validate handoff type
	const validTypes: HandoffType[] = ['SE→AE', 'AE→CS', 'CS→Support']
	if (!validTypes.includes(handoffType)) {
		console.error(`Invalid handoff type: ${handoffType}`)
		console.error(`Must be one of: ${validTypes.join(', ')}`)
		process.exit(1)
	}

	console.log('='.repeat(60))
	console.log('Handoff Agent Test')
	console.log('='.repeat(60))
	console.log(`Account: ${accountName}`)
	console.log(`Handoff Type: ${handoffType}`)
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

	console.log('Starting handoff agent...\n')

	try {
		const result = await runHandoffAgent(
			accountKey,
			handoffType,
			accountDataDir,
			opportunityId
		)

		console.log('')
		console.log('='.repeat(60))
		console.log('✅ Handoff Context Generated')
		console.log('='.repeat(60))
		console.log('')
		console.log('Problem Summary:')
		console.log(result.problemSummary)
		console.log('')
		console.log(`Stakeholders: ${result.stakeholders.length}`)
		result.stakeholders.forEach((s) => {
			console.log(`  - ${s.name} (${s.role})`)
		})
		console.log('')
		console.log(`Success Criteria: ${result.successCriteria.length}`)
		result.successCriteria.slice(0, 3).forEach((c) => {
			console.log(`  - ${c}`)
		})
		console.log('')
		console.log(`Completed Work: ${result.completedWork.length}`)
		console.log(`Known Blockers: ${result.knownBlockers.length}`)
		console.log(`Open Questions: ${result.openQuestions.length}`)
		console.log(`Next Actions: ${result.nextActions.length}`)
		console.log(`Key Artifacts: ${result.artifacts.length}`)
		console.log('')

		if (result.nextActions.length > 0) {
			console.log('Recommended Next Actions:')
			result.nextActions.slice(0, 5).forEach((action, i) => {
				console.log(`  ${i + 1}. ${action}`)
			})
			console.log('')
		}

		if (result.knownBlockers.length > 0) {
			console.log('⚠️  Known Blockers:')
			result.knownBlockers.forEach((blocker) => {
				console.log(`  - ${blocker}`)
			})
			console.log('')
		}

		console.log('Files generated:')
		console.log(`  - ${accountDataDir}/handoffs/handoff-*.json`)
		console.log(`  - ${accountDataDir}/handoffs/handoff-*.md`)
		console.log('')
		console.log('Next steps:')
		console.log('  1. Review the generated markdown file')
		console.log('  2. Share with receiving team (AE, CS, or Support)')
		console.log('  3. Optional: Mirror to Notion for team visibility')
		console.log('  4. Optional: Attach to Salesforce Opportunity')

	} catch (error) {
		console.error('❌ Handoff agent failed:', error)
		process.exit(1)
	}
}

main().catch((error) => {
	console.error('Fatal error:', error)
	process.exit(1)
})
