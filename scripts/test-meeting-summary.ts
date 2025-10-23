#!/usr/bin/env tsx
import { generateMeetingSummary } from '../src/agents/meetingSummary.js'
import { join } from 'path'
import type { AccountKey } from '../src/types.js'

async function main() {
	const args = process.argv.slice(2)
	
	if (args.length < 2) {
		console.error('Usage: npm run meeting-summary "Account Name" [callId]')
		console.error('Example: npm run meeting-summary "Acme Corp" "call-12345"')
		process.exit(1)
	}

	const accountName = args[0]
	const callId = args[1]

	// Create account key
	const accountKey: AccountKey = {
		name: accountName,
	}

	// Construct account data directory
	const slug = accountName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
	const accountDataDir = join(process.cwd(), 'data/accounts', slug)

	console.log(`\n📊 Generating meeting summary for ${accountName}`)
	console.log(`   Call ID: ${callId}`)
	console.log(`   Account directory: ${accountDataDir}`)
	console.log('')

	try {
		const summary = await generateMeetingSummary(accountKey, accountDataDir, callId)

		console.log('\n✅ Meeting summary generated successfully!')
		console.log('')
		console.log('📋 Summary:')
		console.log(`   Objectives: ${summary.objectives.length}`)
		console.log(`   Blockers: ${summary.blockers.length}`)
		console.log(`   Next Steps: ${summary.nextSteps.length}`)
		console.log(`   Stakeholders: ${summary.stakeholders.length}`)
		console.log('')
		console.log('🔍 MEDDIC Hints:')
		console.log(`   Metrics: ${summary.meddicHints.metrics.length}`)
		console.log(`   Economic Buyer: ${summary.meddicHints.economicBuyer.length}`)
		console.log(`   Decision Criteria: ${summary.meddicHints.decisionCriteria.length}`)
		console.log(`   Decision Process: ${summary.meddicHints.decisionProcess.length}`)
		console.log(`   Pain Points: ${summary.meddicHints.identifyPain.length}`)
		console.log(`   Champion: ${summary.meddicHints.champion.length}`)
	} catch (error) {
		console.error('\n❌ Failed to generate meeting summary:')
		console.error(error instanceof Error ? error.message : error)
		process.exit(1)
	}
}

main()
