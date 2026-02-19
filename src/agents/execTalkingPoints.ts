/**
 * Executive Talking Points Agent
 * 
 * Prepares talking points for executive-level customer engagements.
 * Crafts compelling, strategic messages that resonate with C-level stakeholders.
 */

import type {
	AgentOutput,
	OpportunityContext,
} from '../agentTypes.js'
import { makeSimpleLlmAgent, serializeContext, type Agent, cleanJsonParse } from './baseAgent.js'

// ============================================================================
// Output Types
// ============================================================================

export interface ExecTalkingPointsOutput {
	keyMessages: Array<{
		message: string
		supporting: string[]
		audience: string
	}>
	valueProps: Array<{
		headline: string
		detail: string
		proof: string
		relevance: string
	}>
	objectionHandlers: Array<{
		objection: string
		response: string
		pivot: string
	}>
	callToAction: {
		primary: string
		alternatives: string[]
		urgency: string
	}
	openingHook: string
	closingStatement: string
	questions: Array<{
		question: string
		purpose: string
	}>
	avoidTopics: string[]
}

// ============================================================================
// Input Types
// ============================================================================

export interface ExecTalkingPointsInput {
	execName?: string
	execTitle?: string
	execRole?: 'cto' | 'cio' | 'cfo' | 'ciso' | 'vp_engineering' | 'other'
	meetingType?: 'intro' | 'follow_up' | 'negotiation' | 'closing'
	keyObjectives?: string[]
	knownConcerns?: string[]
}

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * Build user message for exec talking points generation.
 */
function buildUserMessage(context: OpportunityContext, body: ExecTalkingPointsInput): string {
	const contextStr = serializeContext(context)

	let message = `${contextStr}\n\n`

	message += `## Executive Talking Points Request\n\n`

	if (body.execName) {
		message += `**Executive Name:** ${body.execName}\n`
	}

	if (body.execTitle) {
		message += `**Executive Title:** ${body.execTitle}\n`
	}

	if (body.execRole) {
		const roleLabels: Record<string, string> = {
			cto: 'CTO',
			cio: 'CIO',
			cfo: 'CFO',
			ciso: 'CISO',
			vp_engineering: 'VP of Engineering',
			other: 'Executive',
		}
		message += `**Executive Role:** ${roleLabels[body.execRole]}\n`
	}

	if (body.meetingType) {
		const typeLabels: Record<string, string> = {
			intro: 'Introduction Meeting',
			follow_up: 'Follow-up Discussion',
			negotiation: 'Negotiation',
			closing: 'Closing Meeting',
		}
		message += `**Meeting Type:** ${typeLabels[body.meetingType]}\n`
	}

	if (body.keyObjectives && body.keyObjectives.length > 0) {
		message += `**Key Objectives:** ${body.keyObjectives.join(', ')}\n`
	}

	if (body.knownConcerns && body.knownConcerns.length > 0) {
		message += `**Known Concerns:** ${body.knownConcerns.join(', ')}\n`
	}

	message += `\nBased on the account context and executive profile, prepare compelling talking points that:\n`
	message += `1. Lead with business outcomes, not features\n`
	message += `2. Include key value propositions with proof points\n`
	message += `3. Prepare objection handlers with pivots to value\n`
	message += `4. Define clear call-to-action with alternatives\n`
	message += `5. Provide an attention-grabbing opening and memorable closing\n`
	message += `6. Suggest strategic questions to ask\n`
	message += `7. Identify topics to avoid\n\n`
	message += `Respond in JSON format matching the ExecTalkingPointsOutput schema.`

	return message
}

/**
 * Parse LLM output to ExecTalkingPointsOutput.
 */
function parseOutput(content: string): ExecTalkingPointsOutput {
	try {
		const parsed = cleanJsonParse<any>(content)

		return {
			keyMessages: extractKeyMessages(parsed.keyMessages),
			valueProps: extractValueProps(parsed.valueProps),
			objectionHandlers: extractObjectionHandlers(parsed.objectionHandlers),
			callToAction: extractCallToAction(parsed.callToAction),
			openingHook: parsed.openingHook || '',
			closingStatement: parsed.closingStatement || '',
			questions: extractQuestions(parsed.questions),
			avoidTopics: extractStringArray(parsed.avoidTopics),
		}
	} catch (err) {
		console.error('Failed to parse exec talking points output:', err)
		return {
			keyMessages: [],
			valueProps: [],
			objectionHandlers: [],
			callToAction: { primary: '', alternatives: [], urgency: '' },
			openingHook: '',
			closingStatement: '',
			questions: [],
			avoidTopics: [],
		}
	}
}

/**
 * Extract key messages.
 */
function extractKeyMessages(input: any): ExecTalkingPointsOutput['keyMessages'] {
	if (!input || !Array.isArray(input)) return []

	return input.map((m: any) => ({
		message: m.message || '',
		supporting: Array.isArray(m.supporting) ? m.supporting : [],
		audience: m.audience || 'Executive',
	}))
}

/**
 * Extract value props.
 */
function extractValueProps(input: any): ExecTalkingPointsOutput['valueProps'] {
	if (!input || !Array.isArray(input)) return []

	return input.map((v: any) => ({
		headline: v.headline || '',
		detail: v.detail || '',
		proof: v.proof || '',
		relevance: v.relevance || '',
	}))
}

/**
 * Extract objection handlers.
 */
function extractObjectionHandlers(input: any): ExecTalkingPointsOutput['objectionHandlers'] {
	if (!input || !Array.isArray(input)) return []

	return input.map((o: any) => ({
		objection: o.objection || '',
		response: o.response || '',
		pivot: o.pivot || '',
	}))
}

/**
 * Extract call to action.
 */
function extractCallToAction(input: any): ExecTalkingPointsOutput['callToAction'] {
	if (!input) {
		return { primary: '', alternatives: [], urgency: '' }
	}

	return {
		primary: input.primary || '',
		alternatives: Array.isArray(input.alternatives) ? input.alternatives : [],
		urgency: input.urgency || '',
	}
}

/**
 * Extract questions.
 */
function extractQuestions(input: any): ExecTalkingPointsOutput['questions'] {
	if (!input || !Array.isArray(input)) return []

	return input.map((q: any) => ({
		question: q.question || '',
		purpose: q.purpose || '',
	}))
}

/**
 * Extract string array.
 */
function extractStringArray(input: any): string[] {
	if (!input) return []
	if (Array.isArray(input)) return input.map(String)
	return [String(input)]
}

/**
 * Create the Executive Talking Points agent.
 */
export function createExecTalkingPointsAgent(): Agent<ExecTalkingPointsInput, ExecTalkingPointsOutput> {
	return makeSimpleLlmAgent<ExecTalkingPointsInput, ExecTalkingPointsOutput>({
		agentId: 'exec_talking_points',
		buildUserMessage,
		parseOutput,
		llmOverride: {
			temperature: 0.5,
			maxOutputTokens: 4096,
		},
	})
}

// ============================================================================
// Direct Execution Functions
// ============================================================================

/**
 * Execute exec talking points generation directly.
 */
export async function executeExecTalkingPoints(
	context: OpportunityContext,
	options?: ExecTalkingPointsInput
): Promise<AgentOutput<ExecTalkingPointsOutput>> {
	const agent = createExecTalkingPointsAgent()
	return agent.execute({
		context,
		body: options || {},
	})
}

/**
 * Quick exec talking points for simple cases.
 */
export async function quickExecTalkingPoints(
	context: OpportunityContext,
	execTitle?: string
): Promise<ExecTalkingPointsOutput> {
	const result = await executeExecTalkingPoints(context, { execTitle })
	if (!result.success) {
		throw new Error(result.error || 'Executive talking points generation failed')
	}
	return result.data!
}

// Export the agent factory
export default createExecTalkingPointsAgent
