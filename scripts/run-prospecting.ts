#!/usr/bin/env npx tsx
/**
 * Prospecting Pipeline Script
 * 
 * RFC Phase 3: Orchestrates target → workbench → preCallBrief for top accounts
 * 
 * Usage:
 *   npx tsx scripts/run-prospecting.ts [options]
 * 
 * Options:
 *   --owner <userId>      Filter by Salesforce owner ID
 *   --stage <stages>      Comma-separated stages to include
 *   --min-acv <amount>    Minimum ACV
 *   --max-acv <amount>    Maximum ACV
 *   --top <n>             Number of accounts to process (default: 5)
 *   --brief               Generate pre-call briefs for each account
 *   --dry-run             Show candidates without running workbench
 */

import { runTargetingAgent, type TargetingInput, type TargetCandidate } from '../src/phases/prospect/target.js'
import { runWorkbench } from '../src/orchestrator.js'
import { generatePreCallBrief } from '../src/agents/preCallBrief.js'

async function main() {
	const args = process.argv.slice(2)
	
	// Parse CLI arguments
	const input = parseArgs(args)
	const topN = parseInt(getArg(args, '--top') || '5')
	const generateBriefs = args.includes('--brief')
	const dryRun = args.includes('--dry-run')

	console.log('='.repeat(60))
	console.log('🎯 Prospecting Pipeline')
	console.log('='.repeat(60))
	console.log(`Filters: ${JSON.stringify(input, null, 2)}`)
	console.log(`Top N: ${topN}`)
	console.log(`Generate Briefs: ${generateBriefs}`)
	console.log(`Dry Run: ${dryRun}`)
	console.log('')

	// Step 1: Run targeting agent
	const targetResult = await runTargetingAgent({
		...input,
		limit: topN * 2, // Fetch extra in case some fail
	})

	if (targetResult.candidates.length === 0) {
		console.log('❌ No candidates found matching criteria')
		process.exit(1)
	}

	// Display candidates
	console.log('')
	console.log('📋 Top Candidates:')
	console.log('-'.repeat(60))
	
	const candidates = targetResult.candidates.slice(0, topN)
	for (let i = 0; i < candidates.length; i++) {
		const c = candidates[i]
		console.log(`${i + 1}. ${c.accountKey.name} (Score: ${c.score})`)
		console.log(`   Stage: ${c.opportunity.stage}`)
		if (c.opportunity.amount) {
			console.log(`   ACV: $${(c.opportunity.amount / 1000).toFixed(0)}K`)
		}
		console.log(`   Reasons: ${c.reasons.join(', ')}`)
		if (c.risks.length > 0) {
			console.log(`   Risks: ${c.risks.join(', ')}`)
		}
		console.log('')
	}

	if (dryRun) {
		console.log('🏁 Dry run complete - no workbench runs performed')
		process.exit(0)
	}

	// Step 2: Run workbench for each candidate
	console.log('')
	console.log('🔄 Running Workbench for top candidates...')
	console.log('='.repeat(60))

	const results: Array<{ candidate: TargetCandidate; success: boolean; error?: string }> = []

	for (const candidate of candidates) {
		console.log(`\n📊 Processing: ${candidate.accountKey.name}`)
		console.log('-'.repeat(40))

		try {
			const workbenchResult = await runWorkbench({
				accountKey: candidate.accountKey,
				forceResearch: false,
				forceSync: false,
				apply: false, // Never auto-apply in batch mode
			})

			results.push({ candidate, success: true })

			// Step 3: Optionally generate pre-call brief
			if (generateBriefs) {
				console.log('   📝 Generating pre-call brief...')
				await generatePreCallBrief(
					candidate.accountKey,
					undefined, // No specific meeting date
				)
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error)
			console.error(`   ❌ Failed: ${errorMsg}`)
			results.push({ candidate, success: false, error: errorMsg })
		}
	}

	// Summary
	console.log('')
	console.log('='.repeat(60))
	console.log('📊 Summary')
	console.log('='.repeat(60))
	
	const successful = results.filter(r => r.success).length
	const failed = results.filter(r => !r.success).length
	
	console.log(`✅ Successful: ${successful}`)
	console.log(`❌ Failed: ${failed}`)
	console.log('')

	if (failed > 0) {
		console.log('Failed accounts:')
		for (const r of results.filter(r => !r.success)) {
			console.log(`  - ${r.candidate.accountKey.name}: ${r.error}`)
		}
	}
}

function parseArgs(args: string[]): TargetingInput {
	const input: TargetingInput = {}

	const owner = getArg(args, '--owner')
	if (owner) {
		input.ownerIds = [owner]
	}

	const stages = getArg(args, '--stage')
	if (stages) {
		input.stages = stages.split(',').map(s => s.trim())
	}

	const minAcv = getArg(args, '--min-acv')
	if (minAcv) {
		input.minACV = parseInt(minAcv)
	}

	const maxAcv = getArg(args, '--max-acv')
	if (maxAcv) {
		input.maxACV = parseInt(maxAcv)
	}

	const industry = getArg(args, '--industry')
	if (industry) {
		input.industries = industry.split(',').map(s => s.trim())
	}

	return input
}

function getArg(args: string[], flag: string): string | undefined {
	const index = args.indexOf(flag)
	if (index !== -1 && index + 1 < args.length) {
		return args[index + 1]
	}
	return undefined
}

main().catch((error) => {
	console.error('Fatal error:', error)
	process.exit(1)
})
