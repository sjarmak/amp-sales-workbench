#!/usr/bin/env tsx
import { analyzeRiskHeuristics } from '../src/agents/riskHeuristics.js'
import { join } from 'path'
import type { AccountKey } from '../src/types.js'

const accountName = process.argv[2]

if (!accountName) {
	console.error('Usage: npm run risks "Account Name"')
	process.exit(1)
}

const slug = accountName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const accountDataDir = join(process.cwd(), 'data/accounts', slug)

const accountKey: AccountKey = { name: accountName }

console.log(`\n🔍 Analyzing risk heuristics for: ${accountName}`)
console.log(`   Data directory: ${accountDataDir}\n`)

try {
	const risks = await analyzeRiskHeuristics(accountKey, accountDataDir)

	console.log('\n✅ Risk Analysis Complete\n')

	const detectedRisks = Object.entries(risks).filter(([_, r]) => r.detected)

	if (detectedRisks.length === 0) {
		console.log('✅ No risks detected - deal appears healthy!')
	} else {
		console.log(`🚨 ${detectedRisks.length} risk(s) detected:\n`)

		const sortedRisks = detectedRisks.sort((a, b) => {
			const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
			return severityOrder[a[1].severity] - severityOrder[b[1].severity]
		})

		for (const [name, risk] of sortedRisks) {
			const emoji = {
				critical: '🔴',
				high: '🟠',
				medium: '🟡',
				low: '🟢',
			}[risk.severity]

			console.log(`${emoji} ${name.replace(/([A-Z])/g, ' $1').toUpperCase()} - ${risk.severity}`)
			console.log(`   ${risk.message}`)
			if (risk.evidence.length > 0) {
				console.log(`   Evidence: ${risk.evidence[0]}`)
			}
			console.log('')
		}
	}

	console.log(`\n📄 Full report saved to: data/accounts/${slug}/reviews/`)
} catch (error) {
	console.error('❌ Error analyzing risks:', error)
	process.exit(1)
}
