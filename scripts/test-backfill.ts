#!/usr/bin/env tsx

/**
 * Test script for AI Backfill Agent
 * 
 * Analyzes historical call/email data to intelligently fill missing CRM fields
 * like Industry, Company Size, Pain Points, Use Case, Decision Criteria, etc.
 * 
 * Usage:
 *   npx tsx scripts/test-backfill.ts "Company Name" [field1,field2,...]
 * 
 * Examples:
 *   npx tsx scripts/test-backfill.ts "Acme Corp"
 *   npx tsx scripts/test-backfill.ts "TechCorp Inc" "Industry,Company_Size__c,Pain_Points__c"
 * 
 * Available fields:
 *   - Industry
 *   - Company_Size__c
 *   - Pain_Points__c
 *   - Use_Case__c
 *   - Decision_Criteria__c
 *   - Budget_Range__c
 *   - Timeline__c
 *   - Competitors_Evaluated__c
 *   - Technical_Requirements__c
 *   - Integration_Needs__c
 *   - Security_Requirements__c
 *   - Compliance_Needs__c
 */

import { join } from 'path'
import { readFile } from 'fs/promises'
import { runBackfillAgent, type BackfillableField } from '../src/agents/backfill.js'
import type { AccountKey } from '../src/types.js'

async function main() {
	const args = process.argv.slice(2)

	if (args.length < 1) {
		console.error('Usage: npx tsx scripts/test-backfill.ts "Company Name" [field1,field2,...]')
		console.error('')
		console.error('Examples:')
		console.error('  npx tsx scripts/test-backfill.ts "Acme Corp"')
		console.error('  npx tsx scripts/test-backfill.ts "TechCorp Inc" "Industry,Pain_Points__c,Use_Case__c"')
		console.error('')
		console.error('Available fields:')
		console.error('  Industry, Company_Size__c, Pain_Points__c, Use_Case__c,')
		console.error('  Decision_Criteria__c, Budget_Range__c, Timeline__c,')
		console.error('  Competitors_Evaluated__c, Technical_Requirements__c,')
		console.error('  Integration_Needs__c, Security_Requirements__c, Compliance_Needs__c')
		process.exit(1)
	}

	const accountName = args[0]
	const fieldsArg = args[1]

	let targetFields: BackfillableField[] | undefined
	if (fieldsArg) {
		targetFields = fieldsArg.split(',').map((f) => f.trim() as BackfillableField)
	}

	console.log('='.repeat(60))
	console.log('AI Backfill Agent Test')
	console.log('='.repeat(60))
	console.log(`Account: ${accountName}`)
	if (targetFields) {
		console.log(`Target Fields: ${targetFields.join(', ')}`)
	} else {
		console.log('Target Fields: [all default fields]')
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

	console.log('Starting AI backfill agent...\n')

	try {
		const result = await runBackfillAgent(
			accountKey,
			accountDataDir,
			targetFields
		)

		console.log('')
		console.log('='.repeat(60))
		console.log('🔍 Backfill Proposals Generated')
		console.log('='.repeat(60))
		console.log('')
		console.log(`Total Proposals: ${result.proposals.length}`)
		console.log('')

		// Group by confidence
		const highConfidence = result.proposals.filter((p) => p.confidence === 'high')
		const mediumConfidence = result.proposals.filter((p) => p.confidence === 'medium')
		const lowConfidence = result.proposals.filter((p) => p.confidence === 'low')

		console.log(`High Confidence: ${highConfidence.length}`)
		console.log(`Medium Confidence: ${mediumConfidence.length}`)
		console.log(`Low Confidence: ${lowConfidence.length}`)
		console.log('')

		// Show high confidence proposals
		if (highConfidence.length > 0) {
			console.log('✅ High Confidence Proposals:')
			highConfidence.forEach((proposal) => {
				console.log(`  - ${proposal.field}: "${truncate(proposal.proposedValue, 80)}"`)
				console.log(`    Evidence: ${proposal.sourceEvidence.length} sources`)
				console.log(`    Reasoning: ${truncate(proposal.reasoning, 100)}`)
				console.log('')
			})
		}

		// Show medium confidence proposals
		if (mediumConfidence.length > 0) {
			console.log('⚠️  Medium Confidence Proposals (review carefully):')
			mediumConfidence.slice(0, 3).forEach((proposal) => {
				console.log(`  - ${proposal.field}: "${truncate(proposal.proposedValue, 80)}"`)
				console.log(`    Reasoning: ${truncate(proposal.reasoning, 100)}`)
				console.log('')
			})
		}

		// Show low confidence proposals
		if (lowConfidence.length > 0) {
			console.log('❓ Low Confidence Proposals (likely need manual review):')
			lowConfidence.slice(0, 3).forEach((proposal) => {
				console.log(`  - ${proposal.field}`)
				console.log(`    Reasoning: ${truncate(proposal.reasoning, 100)}`)
			})
			console.log('')
		}

		console.log('Files generated:')
		console.log(`  - ${accountDataDir}/backfill/backfill-*.json`)
		console.log(`  - ${accountDataDir}/backfill/backfill-*.yaml`)
		console.log('')
		console.log('Next steps:')
		console.log('  1. Review the YAML file carefully')
		console.log('  2. Edit or remove any incorrect proposals')
		console.log('  3. Verify high-confidence proposals against source calls/emails')
		console.log('  4. Apply approved changes to Salesforce:')
		console.log(`     npm run manage "${accountName}" -- --apply-backfill backfill-*.yaml`)
		console.log('')
		console.log('💡 Tips:')
		console.log('  - High confidence proposals are usually safe to apply')
		console.log('  - Medium confidence proposals should be spot-checked')
		console.log('  - Low confidence proposals often need manual research')
		console.log('  - Check source evidence links to verify accuracy')

	} catch (error) {
		console.error('❌ Backfill agent failed:', error)
		process.exit(1)
	}
}

function truncate(text: string, maxLength: number): string {
	if (!text) return ''
	if (text.length <= maxLength) return text
	return text.substring(0, maxLength - 3) + '...'
}

main().catch((error) => {
	console.error('Fatal error:', error)
	process.exit(1)
})
