import { generatePreCallBrief } from '../src/agents/preCallBrief.js'
import type { AccountKey } from '../src/types.js'

async function testPreCallBrief() {
	const accountName = process.argv[2]
	const meetingDate = process.argv[3]
	
	if (!accountName) {
		console.error('Usage: npx tsx scripts/test-precall-brief.ts "Account Name" [meeting-date]')
		console.error('Example: npx tsx scripts/test-precall-brief.ts "Canva" "2025-10-22"')
		process.exit(1)
	}
	
	const accountKey: AccountKey = {
		name: accountName,
	}
	
	try {
		const brief = await generatePreCallBrief(accountKey, meetingDate)
		
		console.log('\n✅ Pre-Call Brief Generated Successfully!')
		console.log('\n📋 Summary:')
		console.log(`   - Attendees identified: ${brief.sections.whosWho?.length || 0}`)
		console.log(`   - Agenda items: ${brief.sections.predictedAgenda?.length || 0}`)
		console.log(`   - Demo focus areas: ${brief.sections.demoFocusAreas?.length || 0}`)
		console.log(`   - Competitors mentioned: ${brief.sections.competitiveLandscape?.length || 0}`)
		console.log(`   - Custom ideas: ${brief.sections.customIdeas?.length || 0}`)
		
		console.log('\n📦 Data Sources:')
		console.log(`   - Snapshot: ${brief.dataAvailability.hasSnapshot ? '✓' : '✗'} ${brief.dataAvailability.snapshotAge || ''}`)
		console.log(`   - Gong calls: ${brief.dataAvailability.hasGongCalls ? '✓' : '✗'} ${brief.dataAvailability.gongCallCount ? `(${brief.dataAvailability.gongCallCount})` : ''}`)
		console.log(`   - Notion pages: ${brief.dataAvailability.hasNotionPages ? '✓' : '✗'} ${brief.dataAvailability.notionPageCount ? `(${brief.dataAvailability.notionPageCount})` : ''}`)
		
		console.log('\n🎯 Key Questions (MEDDIC):')
		const meddic = brief.sections.keyQuestions?.meddic
		if (meddic) {
			if (meddic.metrics?.length) console.log(`   - Metrics: ${meddic.metrics.length} questions`)
			if (meddic.economicBuyer?.length) console.log(`   - Economic Buyer: ${meddic.economicBuyer.length} questions`)
			if (meddic.decisionCriteria?.length) console.log(`   - Decision Criteria: ${meddic.decisionCriteria.length} questions`)
			if (meddic.decisionProcess?.length) console.log(`   - Decision Process: ${meddic.decisionProcess.length} questions`)
			if (meddic.identifyPain?.length) console.log(`   - Identify Pain: ${meddic.identifyPain.length} questions`)
			if (meddic.champion?.length) console.log(`   - Champion: ${meddic.champion.length} questions`)
		}
		
		console.log('\n✅ Check the output files:')
		const slug = accountName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
		console.log(`   - data/accounts/${slug}/briefs/precall-*.json`)
		console.log(`   - data/accounts/${slug}/briefs/precall-*.md`)
		
	} catch (error) {
		console.error('\n❌ Error generating pre-call brief:', error)
		if (error instanceof Error) {
			console.error(error.stack)
		}
		process.exit(1)
	}
}

testPreCallBrief()
