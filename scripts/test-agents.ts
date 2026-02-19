#!/usr/bin/env tsx
import { generateExecutiveSummary } from '../src/agents/execSummary.js'
import { generateDealReview } from '../src/agents/dealReview.js'
import { generateQualification } from '../src/agents/qualification.js'
import type { AccountKey } from '../src/types.js'
import { join } from 'path'

async function main() {
	const args = process.argv.slice(2)

	if (args.length === 0) {
		console.error('Usage: npx tsx scripts/test-agents.ts <account-name>')
		process.exit(1)
	}

	const accountName = args[0]
	const accountSlug = accountName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
	const accountDataDir = join(process.cwd(), 'data', 'accounts', accountSlug)

	const accountKey: AccountKey = { name: accountName }

	console.log(`Testing agents for: ${accountName}`)
	console.log(`Data directory: ${accountDataDir}`)
	console.log('')

	try {
		// Test Executive Summary
		console.log('1️⃣  Executive Summary')
		const summary = await generateExecutiveSummary(accountKey, accountDataDir)
		console.log(`✅ Generated: ${summary.generatedAt}`)
		console.log('')

		// Test Deal Review
		console.log('2️⃣  Deal Review')
		const review = await generateDealReview(accountKey, accountDataDir)
		console.log(`✅ Health Score: ${review.dealHealthScore}/100`)
		console.log('')

		// Test Qualification (MEDDIC)
		console.log('3️⃣  Qualification (MEDDIC)')
		const qual = await generateQualification(accountKey, accountDataDir, 'MEDDIC')
		console.log(`✅ Overall Score: ${qual.overallScore.toFixed(1)}/5.0`)
		console.log('')

		console.log('✅ All agents completed successfully!')
	} catch (error) {
		console.error('❌ Error:', error instanceof Error ? error.message : error)
		process.exit(1)
	}
}

main()
