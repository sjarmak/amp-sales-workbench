#!/usr/bin/env tsx

import { generateDemoIdea } from '../src/agents/demoIdea.js'
import type { AccountKey } from '../src/types.js'

async function main() {
	const accountName = process.argv[2]

	if (!accountName) {
		console.error('Usage: npx tsx scripts/test-demo-idea.ts "Company Name"')
		process.exit(1)
	}

	const accountKey: AccountKey = {
		name: accountName,
	}

	console.log(`🧪 Testing Demo Idea Agent`)
	console.log(`   Account: ${accountName}`)
	console.log('')

	try {
		const result = await generateDemoIdea(accountKey)
		
		console.log('')
		console.log('✅ Demo/trial plan generated successfully!')
		console.log('')
		console.log('🎯 Demo Script:')
		console.log('─'.repeat(80))
		console.log(`Title: ${result.demoScript.title}`)
		console.log(`Duration: ${result.demoScript.duration}`)
		console.log(`Target Audience: ${result.demoScript.targetAudience.join(', ')}`)
		console.log('')
		console.log('Objectives:')
		result.demoScript.objectives.forEach((obj, idx) => {
			console.log(`${idx + 1}. ${obj}`)
		})
		console.log('')
		console.log('Demo Flow:')
		result.demoScript.narrative.forEach((section) => {
			console.log(`\n${section.step}. ${section.title} (${section.duration})`)
			console.log(`   Pain Point: ${section.customerPainPoint}`)
			console.log(`   Features: ${section.features.length} features to showcase`)
		})
		console.log('─'.repeat(80))
		console.log('')
		
		if (result.trialPlan) {
			console.log('🧪 Trial Plan:')
			console.log(`   Duration: ${result.trialPlan.duration}`)
			console.log(`   Scope: ${result.trialPlan.scope.length} items`)
			console.log(`   Setup Steps: ${result.trialPlan.setupSteps.length} steps`)
			console.log(`   Success Metrics: ${result.trialPlan.successMetrics.length} metrics`)
			console.log('')
		}
		
		if (result.pocScope) {
			console.log('🔬 POC Scope:')
			console.log(`   Duration: ${result.pocScope.duration}`)
			console.log(`   Technical Requirements: ${result.pocScope.technicalRequirements.length}`)
			console.log(`   Integration Points: ${result.pocScope.integrationPoints.length}`)
			console.log(`   Timeline: ${result.pocScope.timeline.length} phases`)
			console.log('')
		}
		
	} catch (error) {
		console.error('❌ Error:', error)
		process.exit(1)
	}
}

main()
