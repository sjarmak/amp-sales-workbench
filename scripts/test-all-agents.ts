#!/usr/bin/env npx tsx

import { generatePreCallBrief } from '../src/agents/preCallBrief.js'
import { generatePostCallUpdate } from '../src/agents/postCallUpdate.js'
import { generateExecutiveSummary } from '../src/agents/execSummary.js'
import { generateQualification } from '../src/agents/qualification.js'
import { generateDealReview } from '../src/agents/dealReview.js'
import { runHandoffAgent } from '../src/agents/handoff.js'
import { runClosedLostAgent } from '../src/agents/closedLost.js'
import { runBackfillAgent } from '../src/agents/backfill.js'

async function main() {
	const args = process.argv.slice(2)

	if (args.length < 1) {
		console.error('Usage: npx tsx scripts/test-all-agents.ts <account-name>')
		console.error('')
		console.error('Examples:')
		console.error('  npx tsx scripts/test-all-agents.ts "Acme Corp"')
		console.error('  npm run test:agents "Acme Corp"')
		process.exit(1)
	}

	const accountName = args[0]
	const accountKey = { name: accountName }
	const slug = accountName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
	const accountDataDir = `data/accounts/${slug}`

	console.log(`\n🚀 Running All Agents for: ${accountName}\n`)
	console.log(`${'='.repeat(60)}\n`)

	const results: { [key: string]: boolean } = {}

	// Pre-Call Brief
	try {
		console.log('1️⃣  Pre-Call Brief Agent...')
		await generatePreCallBrief(accountKey, new Date().toISOString().split('T')[0])
		console.log('   ✅ Success\n')
		results['Pre-Call Brief'] = true
	} catch (error) {
		console.error('   ❌ Failed:', error instanceof Error ? error.message : error)
		results['Pre-Call Brief'] = false
	}

	// Post-Call Update
	try {
		console.log('2️⃣  Post-Call Update Agent...')
		await generatePostCallUpdate(accountKey, undefined, accountDataDir)
		console.log('   ✅ Success\n')
		results['Post-Call Update'] = true
	} catch (error) {
		console.error('   ❌ Failed:', error instanceof Error ? error.message : error)
		results['Post-Call Update'] = false
	}

	// Executive Summary
	try {
		console.log('3️⃣  Executive Summary Agent...')
		await generateExecutiveSummary(accountKey, accountDataDir)
		console.log('   ✅ Success\n')
		results['Executive Summary'] = true
	} catch (error) {
		console.error('   ❌ Failed:', error instanceof Error ? error.message : error)
		results['Executive Summary'] = false
	}

	// Qualification Report
	try {
		console.log('4️⃣  Qualification Report Agent...')
		await generateQualification(accountKey, accountDataDir)
		console.log('   ✅ Success\n')
		results['Qualification Report'] = true
	} catch (error) {
		console.error('   ❌ Failed:', error instanceof Error ? error.message : error)
		results['Qualification Report'] = false
	}

	// Deal Review
	try {
		console.log('5️⃣  Deal Review Agent...')
		await generateDealReview(accountKey, accountDataDir)
		console.log('   ✅ Success\n')
		results['Deal Review'] = true
	} catch (error) {
		console.error('   ❌ Failed:', error instanceof Error ? error.message : error)
		results['Deal Review'] = false
	}

	// Handoff Document
	try {
		console.log('6️⃣  Handoff Document Agent...')
		await runHandoffAgent(accountKey, 'AE→CS', accountDataDir)
		console.log('   ✅ Success\n')
		results['Handoff Document'] = true
	} catch (error) {
		console.error('   ❌ Failed:', error instanceof Error ? error.message : error)
		results['Handoff Document'] = false
	}

	// Closed-Lost Analysis
	try {
		console.log('7️⃣  Closed-Lost Analysis Agent...')
		await runClosedLostAgent(accountKey, 'latest', accountDataDir)
		console.log('   ✅ Success\n')
		results['Closed-Lost Analysis'] = true
	} catch (error) {
		console.error('   ❌ Failed:', error instanceof Error ? error.message : error)
		results['Closed-Lost Analysis'] = false
	}

	// AI Backfill
	try {
		console.log('8️⃣  AI Backfill Proposals Agent...')
		await runBackfillAgent(accountKey, accountDataDir)
		console.log('   ✅ Success\n')
		results['AI Backfill'] = true
	} catch (error) {
		console.error('   ❌ Failed:', error instanceof Error ? error.message : error)
		results['AI Backfill'] = false
	}

	// Summary
	console.log(`\n${'='.repeat(60)}`)
	console.log('\n📊 Summary\n')

	const successful = Object.values(results).filter(Boolean).length
	const total = Object.keys(results).length

	Object.entries(results).forEach(([name, success]) => {
		const icon = success ? '✅' : '❌'
		console.log(`${icon} ${name}`)
	})

	console.log(`\nTotal: ${successful}/${total} agents successful`)
	console.log(`\nOutputs saved to: data/accounts/${accountName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/\n`)

	if (successful < total) {
		process.exit(1)
	}
}

main()
