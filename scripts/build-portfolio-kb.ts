#!/usr/bin/env npx tsx
/**
 * Build Portfolio Knowledge Base
 * 
 * Queries all Gong calls and extracts portfolio-level patterns
 * Output: data/tables/portfolio_knowledge.json
 */

import { join } from 'path'
import { extractPortfolioPatterns } from '../src/services/portfolioKbService.js'

async function main() {
	const baseDir = process.cwd()
	const kbPath = join(baseDir, 'data', 'tables', 'portfolio_knowledge.json')

	try {
		console.log('🚀 Building Portfolio Knowledge Base\n')

		const kb = await extractPortfolioPatterns(kbPath)

		console.log('\n📊 Portfolio Knowledge Base Summary')
		console.log(`   Calls analyzed: ${kb.callsAnalyzed}`)
		console.log(`   Use cases identified: ${kb.useCases.length}`)
		console.log(`   Objections extracted: ${kb.objections.length}`)
		console.log(`   Success factors: ${kb.successFactors.length}`)
		console.log(`   Competitors mentioned: ${kb.competitors.length}`)

		console.log('\n🎯 Top Use Cases:')
		kb.summary.topUseCases.slice(0, 5).forEach((uc) => console.log(`   • ${uc}`))

		console.log('\n⚠️  Top Objections:')
		kb.summary.topObjections.slice(0, 5).forEach((obj) => console.log(`   • ${obj}`))

		console.log('\n🏆 Success Factors:')
		kb.summary.commonSuccessThemes.slice(0, 5).forEach((factor) => console.log(`   • ${factor}`))

		console.log('\n🔗 Top Competitors:')
		kb.summary.mostMentionedCompetitors.slice(0, 5).forEach((comp) => console.log(`   • ${comp}`))

		console.log('\n✅ Portfolio KB built successfully!')
	} catch (error) {
		console.error('\n❌ Error building portfolio KB:')
		console.error(error)
		process.exit(1)
	}
}

main()
