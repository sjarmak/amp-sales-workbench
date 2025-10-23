import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { execute } from '@sourcegraph/amp-sdk'
import type { AccountKey, MeetingSummary } from '../types.js'

interface CallTranscript {
	callId: string
	transcript: string
	summary?: string
	actionItems?: string[]
	nextSteps?: string[]
	topics?: string[]
	title?: string
	startTime?: string
}

export async function generateMeetingSummary(
	accountKey: AccountKey,
	accountDataDir: string,
	callId: string
): Promise<MeetingSummary> {
	console.log(`   Generating meeting summary for call ${callId}...`)

	// Load call transcript from Gong cache or raw data
	const transcript = await loadCallTranscript(accountDataDir, callId)

	if (!transcript) {
		throw new Error(`No transcript found for call ${callId}`)
	}

	// Load prompt template
	const promptPath = join(process.cwd(), 'prompts/meeting-summary.md')
	const promptTemplate = await readFile(promptPath, 'utf-8')

	// Build context
	const context = buildTranscriptContext(transcript)

	// Execute with Amp SDK
	const summary = await executeSummaryGeneration(promptTemplate, context, accountKey, transcript)

	// Save outputs
	const summariesDir = join(accountDataDir, 'meeting-summaries')
	await mkdir(summariesDir, { recursive: true })

	const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '')

	// Save JSON
	const jsonPath = join(summariesDir, `meeting-summary-${callId}-${timestamp}.json`)
	await writeFile(jsonPath, JSON.stringify(summary, null, 2), 'utf-8')

	// Save Markdown
	const mdContent = formatSummaryAsMarkdown(summary)
	const mdPath = join(summariesDir, `meeting-summary-${callId}-${timestamp}.md`)
	await writeFile(mdPath, mdContent, 'utf-8')

	console.log(`   Saved meeting summary: ${jsonPath}`)
	return summary
}

async function loadCallTranscript(accountDataDir: string, callId: string): Promise<CallTranscript | undefined> {
	// Try Gong cache first
	const cacheFile = join(accountDataDir, '.gong-cache', `${callId}.json`)
	try {
		const cached = await readFile(cacheFile, 'utf-8')
		const data = JSON.parse(cached)
		return data.transcript
	} catch {
		// Not in cache, try raw data
	}

	// Try raw gong data
	const rawFile = join(accountDataDir, 'raw', 'gong.json')
	try {
		const raw = await readFile(rawFile, 'utf-8')
		const gongData = JSON.parse(raw)
		
		// Find call in summaries
		const callData = gongData.summaries?.find((s: any) => s.callId === callId)
		if (callData) {
			return callData
		}

		// Find call metadata
		const callMetadata = gongData.calls?.find((c: any) => c.id === callId)
		if (callMetadata && callData) {
			return {
				...callData,
				title: callMetadata.title,
				startTime: callMetadata.startTime,
			}
		}
	} catch {
		// Raw file doesn't exist or no matching call
	}

	return undefined
}

function buildTranscriptContext(transcript: CallTranscript): string {
	const parts: string[] = []

	if (transcript.title) {
		parts.push(`# Call: ${transcript.title}`)
		parts.push('')
	}

	if (transcript.startTime) {
		parts.push(`**Date:** ${new Date(transcript.startTime).toLocaleString()}`)
		parts.push('')
	}

	if (transcript.summary) {
		parts.push('## Gong Summary')
		parts.push(transcript.summary)
		parts.push('')
	}

	if (transcript.topics && transcript.topics.length > 0) {
		parts.push('## Topics')
		transcript.topics.forEach((topic) => parts.push(`- ${topic}`))
		parts.push('')
	}

	parts.push('## Transcript')
	parts.push('```')
	parts.push(transcript.transcript)
	parts.push('```')

	return parts.join('\n')
}

async function executeSummaryGeneration(
	promptTemplate: string,
	context: string,
	accountKey: AccountKey,
	transcript: CallTranscript
): Promise<MeetingSummary> {
	const fullPrompt = `${promptTemplate}\n\n---\n\n${context}\n\nGenerate a meeting summary as a JSON object.`

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
			callId: transcript.callId,
			callTitle: transcript.title,
			callDate: transcript.startTime,
			objectives: parsed.objectives || [],
			blockers: parsed.blockers || [],
			nextSteps: parsed.nextSteps || transcript.nextSteps || [],
			stakeholders: parsed.stakeholders || [],
			meddicHints: {
				metrics: parsed.meddicHints?.metrics || [],
				economicBuyer: parsed.meddicHints?.economicBuyer || [],
				decisionCriteria: parsed.meddicHints?.decisionCriteria || [],
				decisionProcess: parsed.meddicHints?.decisionProcess || [],
				identifyPain: parsed.meddicHints?.identifyPain || [],
				champion: parsed.meddicHints?.champion || [],
			},
			generatedAt: new Date().toISOString(),
		}
	} catch (error) {
		throw new Error(`Failed to parse meeting summary: ${error instanceof Error ? error.message : 'Unknown error'}`)
	}
}

function formatSummaryAsMarkdown(summary: MeetingSummary): string {
	const sections: string[] = []

	sections.push(`# Meeting Summary: ${summary.callTitle || summary.callId}`)
	sections.push(`**Account:** ${summary.accountKey.name}`)
	if (summary.callDate) {
		sections.push(`**Date:** ${new Date(summary.callDate).toLocaleString()}`)
	}
	sections.push(`*Generated: ${new Date(summary.generatedAt).toLocaleString()}*`)
	sections.push('')

	if (summary.objectives.length > 0) {
		sections.push('## Objectives')
		summary.objectives.forEach((obj) => {
			sections.push(`- ${obj}`)
		})
		sections.push('')
	}

	if (summary.blockers.length > 0) {
		sections.push('## Blockers')
		summary.blockers.forEach((blocker) => {
			sections.push(`- ${blocker}`)
		})
		sections.push('')
	}

	if (summary.nextSteps.length > 0) {
		sections.push('## Next Steps')
		summary.nextSteps.forEach((step) => {
			sections.push(`- ${step}`)
		})
		sections.push('')
	}

	if (summary.stakeholders.length > 0) {
		sections.push('## Stakeholders')
		summary.stakeholders.forEach((stakeholder) => {
			const name = stakeholder.name || 'Unknown'
			const role = stakeholder.role ? ` (${stakeholder.role})` : ''
			const engagement = stakeholder.engagementLevel === 'high' ? ' 🔥' : stakeholder.engagementLevel === 'medium' ? ' ⚡' : ' 🔵'
			sections.push(`- **${name}**${role}${engagement}`)
			if (stakeholder.keyComments && stakeholder.keyComments.length > 0) {
				stakeholder.keyComments.forEach((comment) => {
					sections.push(`  - "${comment}"`)
				})
			}
		})
		sections.push('')
	}

	sections.push('## MEDDIC Hints')
	sections.push('')

	const meddicSections = [
		{ key: 'metrics', title: 'Metrics', icon: '📊' },
		{ key: 'economicBuyer', title: 'Economic Buyer', icon: '💰' },
		{ key: 'decisionCriteria', title: 'Decision Criteria', icon: '✅' },
		{ key: 'decisionProcess', title: 'Decision Process', icon: '⚙️' },
		{ key: 'identifyPain', title: 'Pain Points', icon: '⚠️' },
		{ key: 'champion', title: 'Champion', icon: '🏆' },
	]

	meddicSections.forEach(({ key, title, icon }) => {
		const hints = summary.meddicHints[key as keyof typeof summary.meddicHints]
		if (hints && hints.length > 0) {
			sections.push(`### ${icon} ${title}`)
			hints.forEach((hint) => {
				sections.push(`- ${hint}`)
			})
			sections.push('')
		}
	})

	return sections.join('\n')
}
