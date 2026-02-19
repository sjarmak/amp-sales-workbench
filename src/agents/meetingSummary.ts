/**
 * Meeting Summary Agent
 * 
 * Extracts structured insights from meeting transcripts including objectives,
 * discussion topics, blockers, decisions, and next steps.
 */

import type {
	AgentOutput,
	OpportunityContext,
	TranscriptChunk,
} from '../agentTypes.js'
import { makeSimpleLlmAgent, serializeContext, type Agent, cleanJsonParse } from './baseAgent.js'

// ============================================================================
// Output Types
// ============================================================================

export interface MeetingSummaryOutput {
	meetingInfo: {
		date: string
		duration: string
		type: 'discovery' | 'demo' | 'technical' | 'negotiation' | 'kickoff' | 'check_in'
		participants: Array<{
			name: string
			company: 'customer' | 'sourcegraph'
			role: string
		}>
	}
	objectives: Array<{
		objective: string
		achieved: boolean
		notes: string
	}>
	discussion: Array<{
		topic: string
		summary: string
		customerPosition: string
		ourResponse: string
		outcome: string
	}>
	keyQuotes: Array<{
		quote: string
		speaker: string
		significance: string
	}>
	blockers: Array<{
		blocker: string
		owner: string
		severity: 'high' | 'medium' | 'low'
		proposedResolution: string
	}>
	decisions: Array<{
		decision: string
		rationale: string
		owner: string
	}>
	nextSteps: Array<{
		action: string
		owner: string
		dueDate: string
		dependencies: string[]
	}>
	sentimentIndicators: {
		overall: 'positive' | 'neutral' | 'negative' | 'mixed'
		engagement: 'high' | 'medium' | 'low'
		concerns: string[]
		enthusiasm: string[]
	}
	followUpRequired: {
		date: string
		type: string
		agenda: string[]
	}
}

// ============================================================================
// Input Types
// ============================================================================

export interface MeetingSummaryInput {
	callId?: string
	transcript?: TranscriptChunk[]
	meetingTitle?: string
	meetingDate?: string
}

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * Build user message for meeting summary generation.
 */
function buildUserMessage(context: OpportunityContext, body: MeetingSummaryInput): string {
	const contextStr = serializeContext(context)

	let message = `${contextStr}\n\n`

	message += `## Meeting Summary Request\n\n`

	if (body.meetingTitle) {
		message += `**Meeting Title:** ${body.meetingTitle}\n`
	}

	if (body.meetingDate) {
		message += `**Meeting Date:** ${body.meetingDate}\n`
	}

	if (body.callId) {
		message += `**Call ID:** ${body.callId}\n`
	}

	if (body.transcript && body.transcript.length > 0) {
		message += `\n## Transcript\n\n`
		for (const chunk of body.transcript) {
			message += `**${chunk.speaker}:** ${chunk.text}\n\n`
		}
	} else if (context.recentTranscript && context.recentTranscript.length > 0) {
		message += `\n## Transcript (from context)\n\n`
		for (const chunk of context.recentTranscript) {
			message += `**${chunk.speaker}:** ${chunk.text}\n\n`
		}
	}

	message += `\nBased on the transcript and account context, generate a comprehensive meeting summary that:\n`
	message += `1. Captures meeting metadata (type, participants, duration)\n`
	message += `2. Extracts objectives and whether they were achieved\n`
	message += `3. Summarizes key discussion topics with customer positions\n`
	message += `4. Highlights significant quotes\n`
	message += `5. Identifies blockers with severity and owners\n`
	message += `6. Documents decisions made\n`
	message += `7. Lists next steps with owners and dates\n`
	message += `8. Assesses overall sentiment and engagement\n`
	message += `9. Recommends follow-up meeting if needed\n\n`
	message += `Respond in JSON format matching the MeetingSummaryOutput schema.`

	return message
}

/**
 * Parse LLM output to MeetingSummaryOutput.
 */
function parseOutput(content: string): MeetingSummaryOutput {
	try {
		const parsed = cleanJsonParse<any>(content)

		return {
			meetingInfo: extractMeetingInfo(parsed.meetingInfo),
			objectives: extractObjectives(parsed.objectives),
			discussion: extractDiscussion(parsed.discussion),
			keyQuotes: extractKeyQuotes(parsed.keyQuotes),
			blockers: extractBlockers(parsed.blockers),
			decisions: extractDecisions(parsed.decisions),
			nextSteps: extractNextSteps(parsed.nextSteps),
			sentimentIndicators: extractSentiment(parsed.sentimentIndicators),
			followUpRequired: extractFollowUp(parsed.followUpRequired),
		}
	} catch (err) {
		console.error('Failed to parse meeting summary output:', err)
		return {
			meetingInfo: { date: '', duration: '', type: 'check_in', participants: [] },
			objectives: [],
			discussion: [],
			keyQuotes: [],
			blockers: [],
			decisions: [],
			nextSteps: [],
			sentimentIndicators: { overall: 'neutral', engagement: 'medium', concerns: [], enthusiasm: [] },
			followUpRequired: { date: '', type: '', agenda: [] },
		}
	}
}

function extractMeetingInfo(input: any): MeetingSummaryOutput['meetingInfo'] {
	if (!input) {
		return { date: '', duration: '', type: 'check_in', participants: [] }
	}
	const validTypes = ['discovery', 'demo', 'technical', 'negotiation', 'kickoff', 'check_in']
	return {
		date: input.date || '',
		duration: input.duration || '',
		type: validTypes.includes(input.type) ? input.type : 'check_in',
		participants: Array.isArray(input.participants) ? input.participants.map((p: any) => ({
			name: p.name || '',
			company: p.company === 'sourcegraph' ? 'sourcegraph' : 'customer',
			role: p.role || '',
		})) : [],
	}
}

function extractObjectives(input: any): MeetingSummaryOutput['objectives'] {
	if (!input || !Array.isArray(input)) return []
	return input.map((o: any) => ({
		objective: o.objective || '',
		achieved: Boolean(o.achieved),
		notes: o.notes || '',
	}))
}

function extractDiscussion(input: any): MeetingSummaryOutput['discussion'] {
	if (!input || !Array.isArray(input)) return []
	return input.map((d: any) => ({
		topic: d.topic || '',
		summary: d.summary || '',
		customerPosition: d.customerPosition || '',
		ourResponse: d.ourResponse || '',
		outcome: d.outcome || '',
	}))
}

function extractKeyQuotes(input: any): MeetingSummaryOutput['keyQuotes'] {
	if (!input || !Array.isArray(input)) return []
	return input.map((q: any) => ({
		quote: q.quote || '',
		speaker: q.speaker || '',
		significance: q.significance || '',
	}))
}

function extractBlockers(input: any): MeetingSummaryOutput['blockers'] {
	if (!input || !Array.isArray(input)) return []
	return input.map((b: any) => ({
		blocker: b.blocker || '',
		owner: b.owner || 'TBD',
		severity: validateLevel(b.severity),
		proposedResolution: b.proposedResolution || '',
	}))
}

function validateLevel(val: any): 'high' | 'medium' | 'low' {
	if (val === 'high' || val === 'medium' || val === 'low') return val
	return 'medium'
}

function extractDecisions(input: any): MeetingSummaryOutput['decisions'] {
	if (!input || !Array.isArray(input)) return []
	return input.map((d: any) => ({
		decision: d.decision || '',
		rationale: d.rationale || '',
		owner: d.owner || '',
	}))
}

function extractNextSteps(input: any): MeetingSummaryOutput['nextSteps'] {
	if (!input || !Array.isArray(input)) return []
	return input.map((s: any) => ({
		action: s.action || '',
		owner: s.owner || 'TBD',
		dueDate: s.dueDate || '',
		dependencies: Array.isArray(s.dependencies) ? s.dependencies : [],
	}))
}

function extractSentiment(input: any): MeetingSummaryOutput['sentimentIndicators'] {
	if (!input) {
		return { overall: 'neutral', engagement: 'medium', concerns: [], enthusiasm: [] }
	}
	const validSentiments = ['positive', 'neutral', 'negative', 'mixed']
	return {
		overall: validSentiments.includes(input.overall) ? input.overall : 'neutral',
		engagement: validateLevel(input.engagement),
		concerns: Array.isArray(input.concerns) ? input.concerns : [],
		enthusiasm: Array.isArray(input.enthusiasm) ? input.enthusiasm : [],
	}
}

function extractFollowUp(input: any): MeetingSummaryOutput['followUpRequired'] {
	if (!input) {
		return { date: '', type: '', agenda: [] }
	}
	return {
		date: input.date || '',
		type: input.type || '',
		agenda: Array.isArray(input.agenda) ? input.agenda : [],
	}
}

/**
 * Create the Meeting Summary agent.
 */
export function createMeetingSummaryAgent(): Agent<MeetingSummaryInput, MeetingSummaryOutput> {
	return makeSimpleLlmAgent<MeetingSummaryInput, MeetingSummaryOutput>({
		agentId: 'meeting_summary',
		buildUserMessage,
		parseOutput,
		llmOverride: {
			temperature: 0.3,
			maxOutputTokens: 4096,
		},
	})
}

// ============================================================================
// Direct Execution Functions
// ============================================================================

/**
 * Execute meeting summary generation directly.
 */
export async function executeMeetingSummary(
	context: OpportunityContext,
	options?: MeetingSummaryInput
): Promise<AgentOutput<MeetingSummaryOutput>> {
	const agent = createMeetingSummaryAgent()
	return agent.execute({
		context,
		body: options || {},
	})
}

/**
 * Quick meeting summary from transcript.
 */
export async function quickMeetingSummary(
	context: OpportunityContext,
	transcript?: TranscriptChunk[]
): Promise<MeetingSummaryOutput> {
	const result = await executeMeetingSummary(context, { transcript })
	if (!result.success) {
		throw new Error(result.error || 'Meeting summary generation failed')
	}
	return result.data!
}

export default createMeetingSummaryAgent
