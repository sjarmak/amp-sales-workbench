#!/usr/bin/env tsx
import { generateQualification } from '../src/agents/qualification.js'
import { resolveAccountKey } from '../src/phases/intake.js'
import { join } from 'path'
import type { QualMethodology } from '../src/types.js'

async function main() {
	const accountName = process.argv[2]
	const methodologyArg = process.argv.find(arg => arg.startsWith('--method='))
	const methodology = (methodologyArg?.split('=')[1] || 'MEDDIC') as QualMethodology

	if (!accountName) {
		console.error('Usage: npx tsx scripts/test-qualification.ts <account-name> [--method=MEDDIC|BANT|SPICED]')
		process.exit(1)
	}

	try {
		console.log(`🔍 Generating ${methodology} Qualification for: ${accountName}`)
		console.log('─'.repeat(80))

		// Resolve account key
		const accountKey = await resolveAccountKey({ name: accountName })
		const accountSlug = accountKey.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
		const accountDataDir = join(process.cwd(), 'data/accounts', accountSlug)

		// Generate qualification
		const result = await generateQualification(accountKey, accountDataDir, methodology)

		console.log('')
		console.log('✅ Qualification Report Generated!')
		console.log('─'.repeat(80))
		console.log(`📊 Overall Score: ${result.overallScore.toFixed(1)}/5.0`)
		console.log(`📋 Methodology: ${result.methodology}`)
		console.log(`📈 Criteria Assessed: ${result.criteria.length}`)
		console.log(`🚨 Gaps Identified: ${result.gaps.length}`)
		console.log(`❓ Suggested Questions: ${result.suggestedQuestions.length}`)
		console.log('')

		if (result.criteria.length > 0) {
			console.log('Criteria Breakdown:')
			result.criteria.forEach(c => {
				const stars = '⭐'.repeat(Math.round(c.score))
				console.log(`  ${c.name}: ${c.score}/5 ${stars}`)
			})
			console.log('')
		}

		if (result.gaps.length > 0) {
			const highGaps = result.gaps.filter(g => g.priority === 'high')
			const medGaps = result.gaps.filter(g => g.priority === 'medium')
			const lowGaps = result.gaps.filter(g => g.priority === 'low')

			if (highGaps.length > 0) {
				console.log('🔴 High Priority Gaps:')
				highGaps.forEach(g => console.log(`   - ${g.criterion}: ${g.missingInfo}`))
			}
			if (medGaps.length > 0) {
				console.log('🟡 Medium Priority Gaps:')
				medGaps.forEach(g => console.log(`   - ${g.criterion}: ${g.missingInfo}`))
			}
			if (lowGaps.length > 0) {
				console.log('🟢 Low Priority Gaps:')
				lowGaps.forEach(g => console.log(`   - ${g.criterion}: ${g.missingInfo}`))
			}
			console.log('')
		}

		console.log(`📁 Files saved to: ${accountDataDir}/qualification/`)
		console.log('─'.repeat(80))
	} catch (error) {
		console.error('❌ Error:', error)
		process.exit(1)
	}
}

main()
