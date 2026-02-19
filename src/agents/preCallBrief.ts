/**
 * Pre-Call Brief Agent
 * 
 * Prepares sales representatives for customer calls by compiling context,
 * researching attendees, suggesting talking points, and setting objectives.
 */

import type {
	AgentOutput,
	OpportunityContext,
	ProductId,
} from '../agentTypes.js'
import { makeSimpleLlmAgent, serializeContext, type Agent, cleanJsonParse } from './baseAgent.js'

// ============================================================================
// Output Types (matching prompts/agents/precall_brief.md schema)
// ============================================================================

export type MeetingType = 
	| 'discovery'
	| 'demo'
	| 'technical_deep_dive'
	| 'exec_review'
	| 'negotiation'
	| 'kickoff'

export type AttendeeRole = 
	| 'champion'
	| 'decision_maker'
	| 'influencer'
	| 'evaluator'
	| 'blocker'

export interface PreCallAttendee {
	name: string
	title: string
	role: AttendeeRole
	linkedinUrl?: string
	recentInteractions: string[]
	keyInterests: string[]
}

export interface PreCallTalkingPoint {
	topic: string
	context: string
	suggestedQuestions: string[]
	relevantProducts: ProductId[]
}

export interface PreCallObjective {
	objective: string
	priority: 'primary' | 'secondary'
	successCriteria: string
}

export interface PreCallPreparation {
	demoEnvironment?: string
	materials: string[]
	questions: string[]
}

export interface PreCallBriefOutput {
	meetingType: MeetingType
	attendees: PreCallAttendee[]
	agenda: string[]
	talkingPoints: PreCallTalkingPoint[]
	competitiveContext?: string
	accountHistory: string
	risks: string[]
	objectives: PreCallObjective[]
	preparation: PreCallPreparation
}

// ============================================================================
// Input Types
// ============================================================================

export interface PreCallBriefInput {
	meetingDate?: string
	meetingTitle?: string
	forceMeetingType?: MeetingType
}

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * Build user message for pre-call brief generation.
 */
function buildUserMessage(
	context: OpportunityContext,
	body: PreCallBriefInput,
	portfolioContext?: string
): string {
	const contextStr = serializeContext(context)

	let message = `${contextStr}\n\n`

	// Optionally inject portfolio intelligence
	if (portfolioContext) {
		message += portfolioContext
		message += `\n\n`
	}

	message += `## Pre-Call Brief Request\n\n`

	if (body.meetingDate) {
		message += `**Meeting Date:** ${body.meetingDate}\n`
	}

	if (body.meetingTitle) {
		message += `**Meeting Title:** ${body.meetingTitle}\n`
	}

	if (body.forceMeetingType) {
		message += `**Meeting Type:** ${body.forceMeetingType}\n`
	}

	message += `\nBased on the account context above, create a comprehensive pre-call brief that:\n`
	message += `1. Identifies the meeting type and likely attendees with their roles\n`
	message += `2. Suggests a focused agenda and talking points tailored to attendee interests\n`
	message += `3. Provides competitive context and account history summary\n`
	message += `4. Lists potential risks or objections to prepare for\n`
	message += `5. Sets clear meeting objectives with success criteria\n`
	message += `6. Specifies preparation needs (demos, materials, questions)\n\n`
	message += `Respond in JSON format matching the PreCallBriefOutput schema.`

	return message
}

/**
 * Parse LLM output to PreCallBriefOutput.
 */
function parseOutput(content: string): PreCallBriefOutput {
	try {
		const parsed = cleanJsonParse<any>(content)
		
		return {
			meetingType: extractMeetingType(parsed.meetingType),
			attendees: extractAttendees(parsed.attendees),
			agenda: extractStringArray(parsed.agenda),
			talkingPoints: extractTalkingPoints(parsed.talkingPoints),
			competitiveContext: extractOptionalString(parsed.competitiveContext),
			accountHistory: extractString(parsed.accountHistory, 'No account history available'),
			risks: extractStringArray(parsed.risks),
			objectives: extractObjectives(parsed.objectives),
			preparation: extractPreparation(parsed.preparation),
		}
	} catch (err) {
		console.error('Failed to parse pre-call brief output:', err)
		return {
			meetingType: 'discovery',
			attendees: [],
			agenda: [],
			talkingPoints: [],
			accountHistory: 'Unable to retrieve account history',
			risks: [],
			objectives: [],
			preparation: { materials: [], questions: [] },
		}
	}
}

/**
 * Extract and normalize meeting type.
 */
function extractMeetingType(input: any): MeetingType {
	const validTypes: MeetingType[] = [
		'discovery', 'demo', 'technical_deep_dive', 
		'exec_review', 'negotiation', 'kickoff'
	]
	
	if (typeof input === 'string') {
		const normalized = input.toLowerCase().replace(/[^a-z_]/g, '_')
		if (validTypes.includes(normalized as MeetingType)) {
			return normalized as MeetingType
		}
	}
	
	return 'discovery'
}

/**
 * Extract attendees array with proper structure.
 */
function extractAttendees(input: any): PreCallAttendee[] {
	if (!Array.isArray(input)) return []
	
	return input.map((item: any) => ({
		name: extractString(item.name, 'Unknown'),
		title: extractString(item.title, ''),
		role: extractAttendeeRole(item.role),
		linkedinUrl: extractOptionalString(item.linkedinUrl),
		recentInteractions: extractStringArray(item.recentInteractions),
		keyInterests: extractStringArray(item.keyInterests),
	}))
}

/**
 * Extract and normalize attendee role.
 */
function extractAttendeeRole(input: any): AttendeeRole {
	const validRoles: AttendeeRole[] = [
		'champion', 'decision_maker', 'influencer', 'evaluator', 'blocker'
	]
	
	if (typeof input === 'string') {
		const normalized = input.toLowerCase().replace(/[^a-z_]/g, '_')
		if (validRoles.includes(normalized as AttendeeRole)) {
			return normalized as AttendeeRole
		}
	}
	
	return 'evaluator'
}

/**
 * Extract talking points with product normalization.
 */
function extractTalkingPoints(input: any): PreCallTalkingPoint[] {
	if (!Array.isArray(input)) return []
	
	return input.map((item: any) => ({
		topic: extractString(item.topic, ''),
		context: extractString(item.context, ''),
		suggestedQuestions: extractStringArray(item.suggestedQuestions),
		relevantProducts: normalizeProducts(item.relevantProducts),
	}))
}

/**
 * Extract objectives with priority.
 */
function extractObjectives(input: any): PreCallObjective[] {
	if (!Array.isArray(input)) return []
	
	return input.map((item: any) => ({
		objective: extractString(item.objective, ''),
		priority: extractPriority(item.priority),
		successCriteria: extractString(item.successCriteria, ''),
	}))
}

/**
 * Extract priority value.
 */
function extractPriority(input: any): 'primary' | 'secondary' {
	if (typeof input === 'string') {
		const normalized = input.toLowerCase()
		if (normalized === 'primary' || normalized === 'secondary') {
			return normalized
		}
	}
	return 'secondary'
}

/**
 * Extract preparation section.
 */
function extractPreparation(input: any): PreCallPreparation {
	if (!input || typeof input !== 'object') {
		return { materials: [], questions: [] }
	}
	
	return {
		demoEnvironment: extractOptionalString(input.demoEnvironment),
		materials: extractStringArray(input.materials),
		questions: extractStringArray(input.questions),
	}
}

/**
 * Normalize product names to ProductId values.
 */
function normalizeProducts(products: any): ProductId[] {
	if (!Array.isArray(products)) return []
	
	const productMap: Record<string, ProductId> = {
		'code search': 'code_search',
		'code_search': 'code_search',
		'search': 'code_search',
		'batch changes': 'batch_changes',
		'batch_changes': 'batch_changes',
		'campaigns': 'batch_changes',
		'code insights': 'code_insights',
		'code_insights': 'code_insights',
		'insights': 'code_insights',
		'deep search': 'deep_search',
		'deep_search': 'deep_search',
		'cody': 'deep_search',
		'ai': 'deep_search',
	}

	return products
		.map((p: any) => {
			const normalized = String(p).toLowerCase().trim()
			return productMap[normalized]
		})
		.filter((p): p is ProductId => p !== undefined)
}

/**
 * Extract string with fallback.
 */
function extractString(input: any, fallback: string): string {
	if (typeof input === 'string' && input.trim()) {
		return input.trim()
	}
	return fallback
}

/**
 * Extract optional string.
 */
function extractOptionalString(input: any): string | undefined {
	if (typeof input === 'string' && input.trim()) {
		return input.trim()
	}
	return undefined
}

/**
 * Extract string array with fallback.
 */
function extractStringArray(input: any): string[] {
	if (!Array.isArray(input)) return []
	return input
		.filter((item: any) => typeof item === 'string' && item.trim())
		.map((item: string) => item.trim())
}

// ============================================================================
// Agent Factory
// ============================================================================

/**
 * Create the Pre-Call Brief agent.
 */
export function createPreCallBriefAgent(portfolioContext?: string): Agent<PreCallBriefInput, PreCallBriefOutput> {
	return makeSimpleLlmAgent<PreCallBriefInput, PreCallBriefOutput>({
		agentId: 'precall_brief',
		buildUserMessage: (context, body) => buildUserMessage(context, body, portfolioContext),
		parseOutput,
		llmOverride: {
			temperature: 0.4,
			maxOutputTokens: 4096,
		},
	})
}

// ============================================================================
// Direct Execution Functions
// ============================================================================

/**
 * Execute pre-call brief generation directly without going through the registry.
 */
export async function executePreCallBrief(
	context: OpportunityContext,
	options?: PreCallBriefInput,
	portfolioContext?: string
): Promise<AgentOutput<PreCallBriefOutput>> {
	const agent = createPreCallBriefAgent(portfolioContext)
	return agent.execute({
		context,
		body: options || {},
	})
}

/**
 * Quick pre-call brief for simple cases.
 */
export async function quickPreCallBrief(
	context: OpportunityContext,
	meetingDate?: string,
	meetingTitle?: string,
	portfolioContext?: string
): Promise<PreCallBriefOutput> {
	const result = await executePreCallBrief(context, { meetingDate, meetingTitle }, portfolioContext)
	if (!result.success) {
		throw new Error(result.error || 'Pre-call brief generation failed')
	}
	return result.data!
}

export default createPreCallBriefAgent
