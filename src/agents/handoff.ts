import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { execute } from '@sourcegraph/amp-sdk'
import type { AccountKey } from '../types.js'

export type HandoffType = 'SE→AE' | 'AE→CS' | 'CS→Support'

export interface HandoffContext {
	accountKey: AccountKey
	handoffType: HandoffType
	problemSummary: string
	technicalEnvironment: {
		stack?: string[]
		deployment?: string
		integrations?: string[]
		scale?: string
	}
	stakeholders: Array<{
		name: string
		role: string
		engagement: string
		concerns?: string[]
	}>
	successCriteria: string[]
	completedWork: string[]
	knownBlockers: string[]
	openQuestions: string[]
	nextActions: string[]
	artifacts: Array<{
		type: 'call' | 'demo' | 'doc' | 'poc' | 'trial'
		title: string
		url?: string
		date?: string
		summary?: string
	}>
	timeline: {
		startDate?: string
		keyDates?: Array<{ date: string; event: string }>
		targetDate?: string
	}
	trialResults?: {
		duration?: string
		metrics?: Record<string, string>
		feedback?: string
		outcome?: string
	}
	generatedAt: string
}

export async function runHandoffAgent(
	accountKey: AccountKey,
	handoffType: HandoffType,
	accountDataDir: string,
	opportunityId?: string
): Promise<HandoffContext> {
	console.log(`\n🤝 Running Handoff Agent (${handoffType})...`)

	// Load all available data
	const rawData = await loadAccountData(accountDataDir)
	const promptTemplate = await readFile(
		join(process.cwd(), 'prompts/handoff.md'),
		'utf-8'
	)

	// Build context
	const context = buildHandoffPrompt(accountKey, handoffType, rawData, opportunityId)

	// Execute with Amp SDK
	const handoffContext = await executeHandoff(promptTemplate, context)

	// Save outputs
	const handoffsDir = join(accountDataDir, 'handoffs')
	await mkdir(handoffsDir, { recursive: true })

	const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
	const baseFilename = `handoff-${handoffType.replace(/→/g, '-to-')}-${timestamp}`

	await writeFile(
		join(handoffsDir, `${baseFilename}.json`),
		JSON.stringify(handoffContext, null, 2),
		'utf-8'
	)

	await writeFile(
		join(handoffsDir, `${baseFilename}.md`),
		formatHandoffMarkdown(handoffContext),
		'utf-8'
	)

	console.log(`   ✓ Handoff context saved to ${handoffsDir}`)

	return handoffContext
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

	try {
		// Load most recent snapshot if needed
		// (simplified - would normally load and parse)
	} catch {}

	return data
}

function buildHandoffPrompt(
	accountKey: AccountKey,
	handoffType: HandoffType,
	rawData: any,
	opportunityId?: string
): string {
	const sections: string[] = []

	sections.push(`# Handoff Context Request`)
	sections.push(`Account: ${accountKey.name}`)
	sections.push(`Handoff Type: ${handoffType}`)
	if (opportunityId) {
		sections.push(`Opportunity ID: ${opportunityId}`)
	}
	sections.push('')

	sections.push('## Available Data')
	sections.push('```json')
	sections.push(JSON.stringify(rawData, null, 2))
	sections.push('```')

	return sections.join('\n')
}

async function executeHandoff(
	promptTemplate: string,
	context: string
): Promise<HandoffContext> {
	const fullPrompt = `${promptTemplate}\n\n---\n\n${context}\n\nGenerate a comprehensive handoff context as JSON.`

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

	return parseHandoffContext(accumulatedText)
}

function parseHandoffContext(text: string): HandoffContext {
	const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/)
	const jsonText = jsonMatch ? jsonMatch[1] : text

	try {
		return JSON.parse(jsonText)
	} catch (error) {
		throw new Error(`Failed to parse handoff context: ${error instanceof Error ? error.message : 'Unknown error'}`)
	}
}

function formatHandoffMarkdown(context: HandoffContext): string {
	const lines: string[] = []

	lines.push(`# ${context.handoffType} Handoff: ${context.accountKey.name}`)
	lines.push(`*Generated: ${new Date(context.generatedAt).toLocaleString()}*`)
	lines.push('')

	lines.push('## Problem Summary')
	lines.push(context.problemSummary)
	lines.push('')

	lines.push('## Technical Environment')
	if (context.technicalEnvironment.stack?.length) {
		lines.push(`- **Stack**: ${context.technicalEnvironment.stack.join(', ')}`)
	}
	if (context.technicalEnvironment.deployment) {
		lines.push(`- **Deployment**: ${context.technicalEnvironment.deployment}`)
	}
	if (context.technicalEnvironment.integrations?.length) {
		lines.push(`- **Integrations**: ${context.technicalEnvironment.integrations.join(', ')}`)
	}
	if (context.technicalEnvironment.scale) {
		lines.push(`- **Scale**: ${context.technicalEnvironment.scale}`)
	}
	lines.push('')

	lines.push('## Stakeholders')
	for (const stakeholder of context.stakeholders) {
		lines.push(`### ${stakeholder.name} - ${stakeholder.role}`)
		lines.push(`*Engagement*: ${stakeholder.engagement}`)
		if (stakeholder.concerns?.length) {
			lines.push(`*Concerns*: ${stakeholder.concerns.join('; ')}`)
		}
		lines.push('')
	}

	lines.push('## Success Criteria')
	context.successCriteria.forEach((c) => lines.push(`- ${c}`))
	lines.push('')

	lines.push('## Completed Work')
	context.completedWork.forEach((w) => lines.push(`- ✓ ${w}`))
	lines.push('')

	lines.push('## Known Blockers')
	context.knownBlockers.forEach((b) => lines.push(`- ⚠️ ${b}`))
	lines.push('')

	lines.push('## Open Questions')
	context.openQuestions.forEach((q) => lines.push(`- ❓ ${q}`))
	lines.push('')

	lines.push('## Recommended Next Actions')
	context.nextActions.forEach((a, i) => lines.push(`${i + 1}. ${a}`))
	lines.push('')

	if (context.artifacts.length) {
		lines.push('## Key Artifacts')
		for (const artifact of context.artifacts) {
			const title = artifact.url ? `[${artifact.title}](${artifact.url})` : artifact.title
			lines.push(`- **${artifact.type.toUpperCase()}**: ${title}`)
			if (artifact.date) lines.push(`  - Date: ${artifact.date}`)
			if (artifact.summary) lines.push(`  - ${artifact.summary}`)
		}
		lines.push('')
	}

	if (context.timeline.keyDates?.length) {
		lines.push('## Timeline')
		if (context.timeline.startDate) {
			lines.push(`- **Start**: ${context.timeline.startDate}`)
		}
		context.timeline.keyDates.forEach((kd) => {
			lines.push(`- **${kd.date}**: ${kd.event}`)
		})
		if (context.timeline.targetDate) {
			lines.push(`- **Target Close**: ${context.timeline.targetDate}`)
		}
		lines.push('')
	}

	if (context.trialResults) {
		lines.push('## Trial/POC Results')
		if (context.trialResults.duration) {
			lines.push(`- **Duration**: ${context.trialResults.duration}`)
		}
		if (context.trialResults.metrics) {
			lines.push(`- **Metrics**:`)
			for (const [key, value] of Object.entries(context.trialResults.metrics)) {
				lines.push(`  - ${key}: ${value}`)
			}
		}
		if (context.trialResults.feedback) {
			lines.push(`- **Feedback**: ${context.trialResults.feedback}`)
		}
		if (context.trialResults.outcome) {
			lines.push(`- **Outcome**: ${context.trialResults.outcome}`)
		}
		lines.push('')
	}

	return lines.join('\n')
}
