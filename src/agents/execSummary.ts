import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { execute } from '@sourcegraph/amp-sdk'
import type { AccountKey, ExecutiveSummary, ConsolidatedSnapshot } from '../types.js'

export async function generateExecutiveSummary(
	accountKey: AccountKey,
	accountDataDir: string
): Promise<ExecutiveSummary> {
	console.log('   Generating executive summary...')

	// Load latest consolidated snapshot
	const snapshot = await loadLatestSnapshot(accountDataDir)

	// Load prompt template
	const promptPath = join(process.cwd(), 'prompts/exec-summary.md')
	const promptTemplate = await readFile(promptPath, 'utf-8')

	// Build context
	const context = buildSummaryContext(snapshot)

	// Execute with Amp SDK
	const summary = await executeSummaryGeneration(promptTemplate, context, accountKey)

	// Save outputs
	const summariesDir = join(accountDataDir, 'summaries')
	await mkdir(summariesDir, { recursive: true })

	const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '')

	// Save JSON
	const jsonPath = join(summariesDir, `exec-summary-${timestamp}.json`)
	await writeFile(jsonPath, JSON.stringify(summary, null, 2), 'utf-8')

	// Save Markdown
	const mdContent = formatSummaryAsMarkdown(summary)
	const mdPath = join(summariesDir, `exec-summary-${timestamp}.md`)
	await writeFile(mdPath, mdContent, 'utf-8')

	console.log(`   Saved executive summary: ${jsonPath}`)
	return summary
}

async function loadLatestSnapshot(accountDataDir: string): Promise<ConsolidatedSnapshot> {
	const snapshotsDir = join(accountDataDir, 'snapshots')
	const { readdir } = await import('fs/promises')
	const files = await readdir(snapshotsDir)
	const snapshotFiles = files.filter((f) => f.startsWith('snapshot-') && f.endsWith('.json'))

	if (snapshotFiles.length === 0) {
		throw new Error('No consolidated snapshot found. Run consolidation first.')
	}

	// Sort by filename (timestamp) descending
	snapshotFiles.sort().reverse()
	const latestFile = join(snapshotsDir, snapshotFiles[0])

	const content = await readFile(latestFile, 'utf-8')
	return JSON.parse(content)
}

function buildSummaryContext(snapshot: ConsolidatedSnapshot): string {
	return `# Consolidated Account Data\n\n\`\`\`json\n${JSON.stringify(snapshot, null, 2)}\n\`\`\``
}

async function executeSummaryGeneration(
	promptTemplate: string,
	context: string,
	accountKey: AccountKey
): Promise<ExecutiveSummary> {
	const fullPrompt = `${promptTemplate}\n\n---\n\n${context}\n\nGenerate an executive summary as a JSON object.`

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
			problemStatement: parsed.problemStatement || '',
			solutionFit: parsed.solutionFit || '',
			successMetrics: parsed.successMetrics || [],
			socialProof: parsed.socialProof || [],
			nextSteps: parsed.nextSteps || [],
			generatedAt: new Date().toISOString(),
		}
	} catch (error) {
		throw new Error(`Failed to parse executive summary: ${error instanceof Error ? error.message : 'Unknown error'}`)
	}
}

function formatSummaryAsMarkdown(summary: ExecutiveSummary): string {
	const sections: string[] = []

	sections.push(`# Executive Summary: ${summary.accountKey.name}`)
	sections.push(`*Generated: ${new Date(summary.generatedAt).toLocaleString()}*`)
	sections.push('')

	sections.push('## Problem Statement')
	sections.push(summary.problemStatement)
	sections.push('')

	sections.push('## Solution Fit')
	sections.push(summary.solutionFit)
	sections.push('')

	sections.push('## Success Metrics')
	summary.successMetrics.forEach((metric) => {
		sections.push(`- ${metric}`)
	})
	sections.push('')

	sections.push('## Social Proof')
	summary.socialProof.forEach((proof) => {
		sections.push(`- ${proof}`)
	})
	sections.push('')

	sections.push('## Next Steps')
	summary.nextSteps.forEach((step) => {
		sections.push(`- ${step}`)
	})

	return sections.join('\n')
}
