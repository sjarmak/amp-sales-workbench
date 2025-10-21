import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { execute } from '@sourcegraph/amp-sdk'
import type { AccountKey, DealReview, ConsolidatedSnapshot } from '../types.js'

export async function generateDealReview(
	accountKey: AccountKey,
	accountDataDir: string
): Promise<DealReview> {
	console.log('   Generating deal review...')

	// Load latest consolidated snapshot
	const snapshot = await loadLatestSnapshot(accountDataDir)

	// Load prompt template
	const promptPath = join(process.cwd(), 'prompts/deal-review.md')
	const promptTemplate = await readFile(promptPath, 'utf-8')

	// Build context
	const context = buildReviewContext(snapshot)

	// Execute with Amp SDK
	const review = await executeReviewGeneration(promptTemplate, context, accountKey)

	// Save outputs
	const reviewsDir = join(accountDataDir, 'reviews')
	await mkdir(reviewsDir, { recursive: true })

	const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '')

	// Save JSON
	const jsonPath = join(reviewsDir, `deal-review-${timestamp}.json`)
	await writeFile(jsonPath, JSON.stringify(review, null, 2), 'utf-8')

	// Save Markdown
	const mdContent = formatReviewAsMarkdown(review)
	const mdPath = join(reviewsDir, `deal-review-${timestamp}.md`)
	await writeFile(mdPath, mdContent, 'utf-8')

	console.log(`   Saved deal review: ${jsonPath}`)
	return review
}

async function loadLatestSnapshot(accountDataDir: string): Promise<ConsolidatedSnapshot> {
	const snapshotsDir = join(accountDataDir, 'snapshots')
	const { readdir } = await import('fs/promises')
	const files = await readdir(snapshotsDir)
	const snapshotFiles = files.filter((f) => f.startsWith('snapshot-') && f.endsWith('.json'))

	if (snapshotFiles.length === 0) {
		throw new Error('No consolidated snapshot found. Run consolidation first.')
	}

	snapshotFiles.sort().reverse()
	const latestFile = join(snapshotsDir, snapshotFiles[0])

	const content = await readFile(latestFile, 'utf-8')
	return JSON.parse(content)
}

function buildReviewContext(snapshot: ConsolidatedSnapshot): string {
	return `# Consolidated Account Data\n\n\`\`\`json\n${JSON.stringify(snapshot, null, 2)}\n\`\`\``
}

async function executeReviewGeneration(
	promptTemplate: string,
	context: string,
	accountKey: AccountKey
): Promise<DealReview> {
	const fullPrompt = `${promptTemplate}\n\n---\n\n${context}\n\nGenerate a deal review as a JSON object.`

	let accumulatedText = ''

	for await (const message of execute({ prompt: fullPrompt })) {
		if (message.type === 'assistant') {
			for (const block of message.message.content) {
				if (block.type === 'text') {
					accumulatedText += block.text
				}
			}
			process.stdout.write('.')
		}
	}

	console.log('')

	// Parse JSON response
	const jsonMatch = accumulatedText.match(/```json\n([\s\S]*?)\n```/)
	const jsonText = jsonMatch ? jsonMatch[1] : accumulatedText

	try {
		const parsed = JSON.parse(jsonText)
		return {
			accountKey,
			dealHealthScore: parsed.dealHealthScore || 0,
			status: parsed.status || '',
			strategy: parsed.strategy || '',
			riskFactors: parsed.riskFactors || [],
			pathToClose: parsed.pathToClose || '',
			coachingTips: parsed.coachingTips || [],
			blockers: parsed.blockers || [],
			champions: parsed.champions || [],
			objections: parsed.objections || [],
			generatedAt: new Date().toISOString(),
		}
	} catch (error) {
		throw new Error(`Failed to parse deal review: ${error instanceof Error ? error.message : 'Unknown error'}`)
	}
}

function formatReviewAsMarkdown(review: DealReview): string {
	const sections: string[] = []

	sections.push(`# Deal Review: ${review.accountKey.name}`)
	sections.push(`*Generated: ${new Date(review.generatedAt).toLocaleString()}*`)
	sections.push('')

	sections.push(`## Deal Health Score: ${review.dealHealthScore}/100`)
	sections.push(`**Status:** ${review.status}`)
	sections.push('')

	sections.push('## Strategy')
	sections.push(review.strategy)
	sections.push('')

	sections.push('## Path to Close')
	sections.push(review.pathToClose)
	sections.push('')

	if (review.champions.length > 0) {
		sections.push('## Champions')
		review.champions.forEach((champion) => {
			sections.push(`- ${champion}`)
		})
		sections.push('')
	}

	if (review.blockers.length > 0) {
		sections.push('## Blockers')
		review.blockers.forEach((blocker) => {
			sections.push(`- ${blocker}`)
		})
		sections.push('')
	}

	if (review.objections.length > 0) {
		sections.push('## Objections')
		review.objections.forEach((objection) => {
			sections.push(`- ${objection}`)
		})
		sections.push('')
	}

	if (review.riskFactors.length > 0) {
		sections.push('## Risk Factors')
		review.riskFactors.forEach((risk) => {
			const emoji = risk.severity === 'high' ? '🔴' : risk.severity === 'medium' ? '🟡' : '🟢'
			sections.push(`- ${emoji} **${risk.risk}**`)
			if (risk.mitigation) {
				sections.push(`  - Mitigation: ${risk.mitigation}`)
			}
		})
		sections.push('')
	}

	if (review.coachingTips.length > 0) {
		sections.push('## Coaching Tips')
		review.coachingTips.forEach((tip) => {
			sections.push(`- ${tip}`)
		})
	}

	return sections.join('\n')
}
