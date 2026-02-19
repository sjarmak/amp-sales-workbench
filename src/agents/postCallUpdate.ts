/**
 * Post-Call Update Agent
 * 
 * Captures and processes call outcomes to summarize key takeaways,
 * extract action items, prepare CRM updates, and plan follow-ups.
 */

import type {
	AgentOutput,
	OpportunityContext,
} from '../agentTypes.js'
import { makeSimpleLlmAgent, serializeContext, type Agent, cleanJsonParse } from './baseAgent.js'

// ============================================================================
// Output Types
// ============================================================================

export interface PostCallUpdateOutput {
	summary: CallSummary
	keyTakeaways: KeyTakeaway[]
	newInformation: NewInformation
	actionItems: ActionItem[]
	crmUpdates: CrmUpdates
	followUp?: FollowUp
	risks: string[]
	coachingNotes: string[]
}

export interface CallSummary {
	callType: 'discovery' | 'demo' | 'technical' | 'negotiation' | 'check_in'
	duration?: string
	attendees: string[]
	headline: string
}

export interface KeyTakeaway {
	takeaway: string
	importance: 'high' | 'medium' | 'low'
	category: 'pain' | 'requirement' | 'objection' | 'positive_signal' | 'next_step'
}

export interface NewInformation {
	painPoints: string[]
	requirements: string[]
	stakeholders: string[]
	timeline?: string
	budget?: string
	competition?: string
}

export interface ActionItem {
	action: string
	owner: 'us' | 'customer'
	assignee?: string
	dueDate?: string
	priority: 'high' | 'medium' | 'low'
	notes?: string
}

export interface CrmUpdates {
	opportunity?: {
		Stage?: string
		NextStep?: string
		NextStepDate?: string
		Notes?: string
	}
	contacts?: Array<{
		name: string
		updates: Record<string, string>
	}>
}

export interface FollowUp {
	date: string
	type: 'email' | 'call' | 'meeting'
	purpose: string
	preparation: string[]
}

// ============================================================================
// Input Types
// ============================================================================

export interface PostCallUpdateInput {
	callId?: string
	transcript?: string
}

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * Build user message for post-call update.
 */
function buildUserMessage(context: OpportunityContext, body: PostCallUpdateInput): string {
	const contextStr = serializeContext(context)

	let message = `${contextStr}\n\n`

	message += `## Post-Call Update Request\n\n`

	if (body.callId) {
		message += `### Call ID\n${body.callId}\n\n`
	}

	if (body.transcript) {
		message += `### Call Transcript\n${body.transcript}\n\n`
	} else if (context.recentTranscript && context.recentTranscript.length > 0) {
		message += `### Recent Transcript\n`
		for (const chunk of context.recentTranscript) {
			message += `**${chunk.speaker}**: ${chunk.text}\n`
		}
		message += '\n'
	}

	message += `Based on the account context and call information above:\n`
	message += `1. Summarize the call with type, duration, attendees, and headline\n`
	message += `2. Extract key takeaways categorized by importance and type\n`
	message += `3. Identify new information learned (pain points, requirements, stakeholders, etc.)\n`
	message += `4. List action items with owners and due dates\n`
	message += `5. Prepare specific CRM field updates\n`
	message += `6. Plan follow-up activities\n`
	message += `7. Note any risks or concerns\n`
	message += `8. Add coaching notes for self-improvement\n\n`
	message += `Respond in JSON format matching the PostCallUpdateOutput schema.`

	return message
}

/**
 * Parse LLM output to PostCallUpdateOutput.
 */
function parseOutput(content: string): PostCallUpdateOutput {
	try {
		const parsed = cleanJsonParse<any>(content)

		return {
			summary: extractSummary(parsed.summary),
			keyTakeaways: extractKeyTakeaways(parsed.keyTakeaways),
			newInformation: extractNewInformation(parsed.newInformation),
			actionItems: extractActionItems(parsed.actionItems),
			crmUpdates: extractCrmUpdates(parsed.crmUpdates),
			followUp: extractFollowUp(parsed.followUp),
			risks: extractStringArray(parsed.risks),
			coachingNotes: extractStringArray(parsed.coachingNotes),
		}
	} catch (err) {
		console.error('Failed to parse post-call update output:', err)
		return {
			summary: {
				callType: 'check_in',
				attendees: [],
				headline: 'Unable to parse call summary',
			},
			keyTakeaways: [],
			newInformation: {
				painPoints: [],
				requirements: [],
				stakeholders: [],
			},
			actionItems: [],
			crmUpdates: {},
			risks: [],
			coachingNotes: [],
		}
	}
}

/**
 * Extract call summary with defaults.
 */
function extractSummary(input: any): CallSummary {
	if (!input) {
		return {
			callType: 'check_in',
			attendees: [],
			headline: '',
		}
	}

	const callTypeMap: Record<string, CallSummary['callType']> = {
		'discovery': 'discovery',
		'demo': 'demo',
		'technical': 'technical',
		'negotiation': 'negotiation',
		'check_in': 'check_in',
		'check-in': 'check_in',
		'checkin': 'check_in',
	}

	return {
		callType: callTypeMap[String(input.callType || '').toLowerCase()] || 'check_in',
		duration: input.duration ? String(input.duration) : undefined,
		attendees: extractStringArray(input.attendees),
		headline: String(input.headline || ''),
	}
}

/**
 * Extract key takeaways array.
 */
function extractKeyTakeaways(input: any): KeyTakeaway[] {
	if (!Array.isArray(input)) return []

	const importanceMap: Record<string, KeyTakeaway['importance']> = {
		'high': 'high',
		'medium': 'medium',
		'low': 'low',
	}

	const categoryMap: Record<string, KeyTakeaway['category']> = {
		'pain': 'pain',
		'requirement': 'requirement',
		'objection': 'objection',
		'positive_signal': 'positive_signal',
		'positive': 'positive_signal',
		'next_step': 'next_step',
		'next': 'next_step',
	}

	return input.map((item: any) => ({
		takeaway: String(item.takeaway || ''),
		importance: importanceMap[String(item.importance || '').toLowerCase()] || 'medium',
		category: categoryMap[String(item.category || '').toLowerCase()] || 'next_step',
	}))
}

/**
 * Extract new information with defaults.
 */
function extractNewInformation(input: any): NewInformation {
	if (!input) {
		return {
			painPoints: [],
			requirements: [],
			stakeholders: [],
		}
	}

	return {
		painPoints: extractStringArray(input.painPoints),
		requirements: extractStringArray(input.requirements),
		stakeholders: extractStringArray(input.stakeholders),
		timeline: input.timeline ? String(input.timeline) : undefined,
		budget: input.budget ? String(input.budget) : undefined,
		competition: input.competition ? String(input.competition) : undefined,
	}
}

/**
 * Extract action items array.
 */
function extractActionItems(input: any): ActionItem[] {
	if (!Array.isArray(input)) return []

	const priorityMap: Record<string, ActionItem['priority']> = {
		'high': 'high',
		'medium': 'medium',
		'low': 'low',
	}

	const ownerMap: Record<string, ActionItem['owner']> = {
		'us': 'us',
		'customer': 'customer',
		'them': 'customer',
		'client': 'customer',
		'sourcegraph': 'us',
		'sg': 'us',
	}

	return input.map((item: any) => ({
		action: String(item.action || ''),
		owner: ownerMap[String(item.owner || '').toLowerCase()] || 'us',
		assignee: item.assignee ? String(item.assignee) : undefined,
		dueDate: item.dueDate ? String(item.dueDate) : undefined,
		priority: priorityMap[String(item.priority || '').toLowerCase()] || 'medium',
		notes: item.notes ? String(item.notes) : undefined,
	}))
}

/**
 * Extract CRM updates.
 */
function extractCrmUpdates(input: any): CrmUpdates {
	if (!input) return {}

	const result: CrmUpdates = {}

	if (input.opportunity) {
		result.opportunity = {}
		if (input.opportunity.Stage) result.opportunity.Stage = String(input.opportunity.Stage)
		if (input.opportunity.NextStep) result.opportunity.NextStep = String(input.opportunity.NextStep)
		if (input.opportunity.NextStepDate) result.opportunity.NextStepDate = String(input.opportunity.NextStepDate)
		if (input.opportunity.Notes) result.opportunity.Notes = String(input.opportunity.Notes)
	}

	if (Array.isArray(input.contacts)) {
		result.contacts = input.contacts.map((contact: any) => ({
			name: String(contact.name || ''),
			updates: typeof contact.updates === 'object' && contact.updates !== null
				? Object.fromEntries(
					Object.entries(contact.updates).map(([k, v]) => [k, String(v)])
				)
				: {},
		}))
	}

	return result
}

/**
 * Extract follow-up information.
 */
function extractFollowUp(input: any): FollowUp | undefined {
	if (!input) return undefined

	const typeMap: Record<string, FollowUp['type']> = {
		'email': 'email',
		'call': 'call',
		'meeting': 'meeting',
	}

	return {
		date: String(input.date || ''),
		type: typeMap[String(input.type || '').toLowerCase()] || 'email',
		purpose: String(input.purpose || ''),
		preparation: extractStringArray(input.preparation),
	}
}

/**
 * Extract string array with normalization.
 */
function extractStringArray(input: any): string[] {
	if (!input) return []
	if (Array.isArray(input)) {
		return input.map(item => String(item)).filter(s => s.length > 0)
	}
	if (typeof input === 'string') {
		return input.split('\n').map(s => s.trim()).filter(s => s.length > 0)
	}
	return []
}

/**
 * Create the Post-Call Update agent.
 */
export function createPostCallUpdateAgent(): Agent<PostCallUpdateInput, PostCallUpdateOutput> {
	return makeSimpleLlmAgent<PostCallUpdateInput, PostCallUpdateOutput>({
		agentId: 'postcall',
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
 * Execute post-call update directly without going through the registry.
 */
export async function executePostCallUpdate(
	context: OpportunityContext,
	options?: PostCallUpdateInput
): Promise<AgentOutput<PostCallUpdateOutput>> {
	const agent = createPostCallUpdateAgent()
	return agent.execute({
		context,
		body: options || {},
	})
}

/**
 * Quick post-call update for simple cases.
 */
export async function quickPostCallUpdate(
	context: OpportunityContext,
	transcript?: string
): Promise<PostCallUpdateOutput> {
	const result = await executePostCallUpdate(context, { transcript })
	if (!result.success) {
		throw new Error(result.error || 'Post-call update failed')
	}
	return result.data!
}

// Legacy alias for backwards compatibility with index.ts
export { executePostCallUpdate as generatePostCallUpdate }

// Export the agent factory
export default createPostCallUpdateAgent
