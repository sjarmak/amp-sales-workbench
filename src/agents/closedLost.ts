import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { execute } from '@sourcegraph/amp-sdk'
import type { AccountKey } from '../types.js'

export type ClosedLostReason =
	| 'Price'
	| 'Features'
	| 'Timing'
	| 'Competitor'
	| 'Budget'
	| 'No Decision'
	| 'Technical Fit'
	| 'Champion Lost'
	| 'Other'

export interface ClosedLostAnalysis {
	accountKey: AccountKey
	opportunityId?: string
	opportunityName?: string
	primaryReason: ClosedLostReason
	secondaryFactors: string[]
	competitorWon?: string
	objectionHistory: Array<{
		date?: string
		objection: string
		response?: string
		resolved: boolean
	}>
	whatCouldHaveBeenDifferent: string[]
	lessonsLearned: string[]
	productFeedback: Array<{
		category: 'Missing Feature' | 'Pricing' | 'Usability' | 'Integration' | 'Performance' | 'Support'
		detail: string
		priority: 'high' | 'medium' | 'low'
	}>
	competitiveIntel: Array<{
		competitor: string
		strengthsTheyLeveraged: string[]
		ourWeaknesses: string[]
	}>
	proposedSalesforceUpdates: {
		closedLostReason: ClosedLostReason
		closedLostDetails?: string
		competitor?: string
		lessonsLearned?: string
	}
	generatedAt: string
}

export async function runClosedLostAgent(
	accountKey: AccountKey,
	opportunityId: string,
	accountDataDir: string
): Promise<ClosedLostAnalysis> {
	console.log('\n❌ Running Closed-Lost Agent...')

	// Load all available data
	const rawData = await loadAccountData(accountDataDir)
	const promptTemplate = await readFile(
		join(process.cwd(), 'prompts/closed-lost.md'),
		'utf-8'
	)

	// Build context
	const context = buildClosedLostPrompt(accountKey, opportunityId, rawData)

	// Execute with Amp SDK
	const analysis = await executeClosedLostAnalysis(promptTemplate, context)

	// Save outputs
	const closedLostDir = join(accountDataDir, 'closed-lost')
	await mkdir(closedLostDir, { recursive: true })

	const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
	const baseFilename = `closed-lost-${timestamp}`

	await writeFile(
		join(closedLostDir, `${baseFilename}.json`),
		JSON.stringify(analysis, null, 2),
		'utf-8'
	)

	await writeFile(
		join(closedLostDir, `${baseFilename}.md`),
		formatClosedLostMarkdown(analysis),
		'utf-8'
	)

	console.log(`   ✓ Closed-lost analysis saved to ${closedLostDir}`)

	return analysis
}

async function loadAccountData(accountDataDir: string): Promise<any> {
	const data: any = {
		salesforce: null,
		gong: null,
		snapshots: [],
	}

	try {
		const rawSfPath = join(accountDataDir, 'raw/salesforce.json')
		data.salesforce = JSON.parse(await readFile(rawSfPath, 'utf-8'))
	} catch {}

	try {
		const rawGongPath = join(accountDataDir, 'raw/gong_calls.json')
		data.gong = JSON.parse(await readFile(rawGongPath, 'utf-8'))
	} catch {}

	return data
}

function buildClosedLostPrompt(
	accountKey: AccountKey,
	opportunityId: string,
	rawData: any
): string {
	const sections: string[] = []

	sections.push(`# Closed-Lost Analysis Request`)
	sections.push(`Account: ${accountKey.name}`)
	sections.push(`Opportunity ID: ${opportunityId}`)
	sections.push('')

	sections.push('## Available Data')
	sections.push('```json')
	sections.push(JSON.stringify(rawData, null, 2))
	sections.push('```')

	return sections.join('\n')
}

async function executeClosedLostAnalysis(
	promptTemplate: string,
	context: string
): Promise<ClosedLostAnalysis> {
	const fullPrompt = `${promptTemplate}\n\n---\n\n${context}\n\nAnalyze why this opportunity was lost and generate a comprehensive ClosedLostAnalysis as JSON.`

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

	return parseClosedLostAnalysis(accumulatedText)
}

function parseClosedLostAnalysis(text: string): ClosedLostAnalysis {
	const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/)
	const jsonText = jsonMatch ? jsonMatch[1] : text

	try {
		return JSON.parse(jsonText)
	} catch (error) {
		throw new Error(
			`Failed to parse closed-lost analysis: ${error instanceof Error ? error.message : 'Unknown error'}`
		)
	}
}

function formatClosedLostMarkdown(analysis: ClosedLostAnalysis): string {
	const lines: string[] = []

	lines.push(`# Closed-Lost Analysis: ${analysis.accountKey.name}`)
	if (analysis.opportunityName) {
		lines.push(`## ${analysis.opportunityName}`)
	}
	lines.push(`*Generated: ${new Date(analysis.generatedAt).toLocaleString()}*`)
	lines.push('')

	lines.push(`## Primary Reason: ${analysis.primaryReason}`)
	lines.push('')

	if (analysis.secondaryFactors.length) {
		lines.push('## Secondary Factors')
		analysis.secondaryFactors.forEach((f) => lines.push(`- ${f}`))
		lines.push('')
	}

	if (analysis.competitorWon) {
		lines.push(`## Competitor Won: ${analysis.competitorWon}`)
		lines.push('')
	}

	if (analysis.objectionHistory.length) {
		lines.push('## Objection History')
		for (const obj of analysis.objectionHistory) {
			const status = obj.resolved ? '✓' : '✗'
			const date = obj.date ? `*${obj.date}*: ` : ''
			lines.push(`- ${status} ${date}**${obj.objection}**`)
			if (obj.response) {
				lines.push(`  - Response: ${obj.response}`)
			}
		}
		lines.push('')
	}

	lines.push('## What Could Have Been Different')
	analysis.whatCouldHaveBeenDifferent.forEach((w) => lines.push(`- ${w}`))
	lines.push('')

	lines.push('## Lessons Learned')
	analysis.lessonsLearned.forEach((l) => lines.push(`- 💡 ${l}`))
	lines.push('')

	if (analysis.productFeedback.length) {
		lines.push('## Product Feedback')
		for (const feedback of analysis.productFeedback) {
			const priority = feedback.priority === 'high' ? '🔴' : feedback.priority === 'medium' ? '🟡' : '🟢'
			lines.push(`- ${priority} **[${feedback.category}]** ${feedback.detail}`)
		}
		lines.push('')
	}

	if (analysis.competitiveIntel.length) {
		lines.push('## Competitive Intelligence')
		for (const intel of analysis.competitiveIntel) {
			lines.push(`### ${intel.competitor}`)
			if (intel.strengthsTheyLeveraged.length) {
				lines.push('**Their Strengths:**')
				intel.strengthsTheyLeveraged.forEach((s) => lines.push(`- ${s}`))
			}
			if (intel.ourWeaknesses.length) {
				lines.push('**Our Weaknesses:**')
				intel.ourWeaknesses.forEach((w) => lines.push(`- ${w}`))
			}
			lines.push('')
		}
	}

	lines.push('## Proposed Salesforce Updates')
	lines.push('```yaml')
	lines.push(`closedLostReason: "${analysis.proposedSalesforceUpdates.closedLostReason}"`)
	if (analysis.proposedSalesforceUpdates.closedLostDetails) {
		lines.push(`closedLostDetails: "${analysis.proposedSalesforceUpdates.closedLostDetails}"`)
	}
	if (analysis.proposedSalesforceUpdates.competitor) {
		lines.push(`competitor: "${analysis.proposedSalesforceUpdates.competitor}"`)
	}
	if (analysis.proposedSalesforceUpdates.lessonsLearned) {
		lines.push(`lessonsLearned: "${analysis.proposedSalesforceUpdates.lessonsLearned}"`)
	}
	lines.push('```')

	return lines.join('\n')
}
