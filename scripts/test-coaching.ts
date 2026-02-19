#!/usr/bin/env tsx

import { generateCoachingFeedback } from '../src/agents/coaching.js'
import type { AccountKey } from '../src/types.js'

async function main() {
	const accountName = process.argv[2]
	const callId = process.argv[3]

	if (!accountName || !callId) {
		console.error('Usage: npx tsx scripts/test-coaching.ts "Company Name" <callId>')
		process.exit(1)
	}

	const accountKey: AccountKey = {
		name: accountName,
	}

	console.log(`🧪 Testing Coaching Agent`)
	console.log(`   Account: ${accountName}`)
	console.log(`   Call ID: ${callId}`)
	console.log('')
	console.log('⚠️  This is an internal coaching tool - NOT saved to Salesforce')
	console.log('')

	try {
		const result = await generateCoachingFeedback(accountKey, callId)
		
		console.log('')
		console.log('✅ Coaching feedback generated successfully!')
		console.log('')
		console.log('📊 Analysis Summary:')
		console.log('─'.repeat(80))
		console.log(`Talk Ratio: Rep ${result.analysis.talkRatio.rep}% / Customer ${result.analysis.talkRatio.customer}%`)
		console.log(`Technical Depth: ${result.analysis.technicalDepth.rating}`)
		console.log(`Objection Handling: ${result.analysis.objectionHandling.overallRating}`)
		console.log(`Discovery Quality: ${result.analysis.discoveryQuality.rating}`)
		console.log(`Next Step Clarity: ${result.analysis.nextStepClarity.rating}`)
		if (result.analysis.meddic) {
			console.log(`MEDDIC Score: ${result.analysis.meddic.overallScore}/10`)
		}
		console.log('')
		
		console.log('✅ What Went Well:')
		result.whatWentWell.forEach((item) => {
			console.log(`   • ${item}`)
		})
		console.log('')
		
		console.log('🎯 Areas to Improve:')
		result.areasToImprove.forEach((item) => {
			console.log(`   • ${item}`)
		})
		console.log('')
		
		console.log('🔧 Recommended Actions:')
		result.recommendedActions.forEach((action) => {
			console.log(`   [${action.priority.toUpperCase()}] ${action.action}`)
			console.log(`   → ${action.why}`)
		})
		console.log('─'.repeat(80))
		console.log('')
		
	} catch (error) {
		console.error('❌ Error:', error)
		process.exit(1)
	}
}

main()
