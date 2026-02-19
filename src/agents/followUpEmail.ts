/**
 * Follow-Up Email Agent
 * 
 * Generates personalized follow-up emails based on opportunity context.
 * Supports post-meeting, check-in, value-add, re-engagement, and introduction emails.
 */

import type {
	AgentOutput,
	OpportunityContext,
} from '../agentTypes.js'
import { makeSimpleLlmAgent, serializeContext, type Agent, cleanJsonParse } from './baseAgent.js'

// ============================================================================
// Output Types
// ============================================================================

export interface FollowUpEmailAttachment {
	name: string
	purpose: string
}

export interface SendingRecommendations {
	timing: string
	cc: string[]
	followUpPlan: string
}

export interface AlternateVersion {
	scenario: string
	subject: string
	body: string
}

export interface FollowUpEmailOutput {
	subject: string
	body: string
	callToAction: string
	tone: 'formal' | 'professional' | 'casual' | 'urgent'
	attachments: FollowUpEmailAttachment[]
	sendingRecommendations: SendingRecommendations
	personalizationNotes: string[]
	alternateVersions: AlternateVersion[]
}

// ============================================================================
// Input Types
// ============================================================================

export type EmailType = 'post-meeting' | 'check-in' | 'value-add' | 're-engagement' | 'introduction'

export interface FollowUpEmailInput {
	emailType?: EmailType
	recipientName?: string
	callId?: string
	additionalContext?: string
}

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * Build user message for follow-up email generation.
 */
function buildUserMessage(context: OpportunityContext, body: FollowUpEmailInput): string {
	const contextStr = serializeContext(context)

	let message = `${contextStr}\n\n`

	message += `## Follow-Up Email Request\n\n`

	if (body.emailType) {
		message += `### Email Type\n${body.emailType}\n\n`
	}

	if (body.recipientName) {
		message += `### Recipient\n${body.recipientName}\n\n`
	}

	if (body.callId) {
		message += `### Related Call ID\n${body.callId}\n\n`
	}

	if (body.additionalContext) {
		message += `### Additional Context\n${body.additionalContext}\n\n`
	}

	message += `Based on the account context above, draft a compelling follow-up email that:\n`
	message += `1. References specific discussion points and context\n`
	message += `2. Has a clear, actionable call-to-action\n`
	message += `3. Matches the appropriate tone for this relationship stage\n`
	message += `4. Is concise (under 150 words when possible)\n\n`
	message += `Respond in JSON format matching the FollowUpEmailOutput schema.`

	return message
}

/**
 * Parse LLM output to FollowUpEmailOutput.
 */
function parseOutput(content: string): FollowUpEmailOutput {
	try {
		const parsed = cleanJsonParse<any>(content)

		return {
			subject: extractSubject(parsed.subject),
			body: extractBody(parsed.body),
			callToAction: extractCallToAction(parsed.callToAction),
			tone: extractTone(parsed.tone),
			attachments: extractAttachments(parsed.attachments),
			sendingRecommendations: extractSendingRecommendations(parsed.sendingRecommendations),
			personalizationNotes: extractPersonalizationNotes(parsed.personalizationNotes),
			alternateVersions: extractAlternateVersions(parsed.alternateVersions),
		}
	} catch (err) {
		console.error('Failed to parse follow-up email output:', err)
		return {
			subject: '',
			body: '',
			callToAction: '',
			tone: 'professional',
			attachments: [],
			sendingRecommendations: {
				timing: '',
				cc: [],
				followUpPlan: '',
			},
			personalizationNotes: [],
			alternateVersions: [],
		}
	}
}

/**
 * Extract subject line.
 */
function extractSubject(input: any): string {
	if (!input) return ''
	return String(input).trim()
}

/**
 * Extract email body.
 */
function extractBody(input: any): string {
	if (!input) return ''
	return String(input).trim()
}

/**
 * Extract call to action.
 */
function extractCallToAction(input: any): string {
	if (!input) return ''
	return String(input).trim()
}

/**
 * Extract and normalize tone.
 */
function extractTone(input: any): 'formal' | 'professional' | 'casual' | 'urgent' {
	const validTones = ['formal', 'professional', 'casual', 'urgent'] as const
	const normalized = String(input || '').toLowerCase().trim()
	
	if (validTones.includes(normalized as any)) {
		return normalized as typeof validTones[number]
	}
	return 'professional'
}

/**
 * Extract attachments array.
 */
function extractAttachments(input: any): FollowUpEmailAttachment[] {
	if (!input || !Array.isArray(input)) return []

	return input.map((item: any) => ({
		name: String(item.name || '').trim(),
		purpose: String(item.purpose || '').trim(),
	})).filter(a => a.name || a.purpose)
}

/**
 * Extract sending recommendations.
 */
function extractSendingRecommendations(input: any): SendingRecommendations {
	if (!input || typeof input !== 'object') {
		return {
			timing: '',
			cc: [],
			followUpPlan: '',
		}
	}

	return {
		timing: String(input.timing || '').trim(),
		cc: extractStringArray(input.cc),
		followUpPlan: String(input.followUpPlan || '').trim(),
	}
}

/**
 * Extract personalization notes.
 */
function extractPersonalizationNotes(input: any): string[] {
	return extractStringArray(input)
}

/**
 * Extract alternate versions.
 */
function extractAlternateVersions(input: any): AlternateVersion[] {
	if (!input || !Array.isArray(input)) return []

	return input.map((item: any) => ({
		scenario: String(item.scenario || '').trim(),
		subject: String(item.subject || '').trim(),
		body: String(item.body || '').trim(),
	})).filter(v => v.scenario || v.subject || v.body)
}

/**
 * Helper to extract string array from various formats.
 */
function extractStringArray(input: any): string[] {
	if (!input) return []
	if (Array.isArray(input)) {
		return input.map(item => String(item).trim()).filter(Boolean)
	}
	if (typeof input === 'string') {
		return [input.trim()].filter(Boolean)
	}
	return []
}

// ============================================================================
// Agent Factory
// ============================================================================

/**
 * Create the Follow-Up Email agent.
 */
export function createFollowUpEmailAgent(): Agent<FollowUpEmailInput, FollowUpEmailOutput> {
	return makeSimpleLlmAgent<FollowUpEmailInput, FollowUpEmailOutput>({
		agentId: 'followup_email',
		buildUserMessage,
		parseOutput,
		llmOverride: {
			temperature: 0.6,
			maxOutputTokens: 4096,
		},
	})
}

// ============================================================================
// Direct Execution Functions
// ============================================================================

/**
 * Execute follow-up email generation directly without going through the registry.
 */
export async function executeFollowUpEmail(
	context: OpportunityContext,
	options?: FollowUpEmailInput
): Promise<AgentOutput<FollowUpEmailOutput>> {
	const agent = createFollowUpEmailAgent()
	return agent.execute({
		context,
		body: options || {},
	})
}

/**
 * Quick follow-up email for simple cases.
 */
export async function quickFollowUpEmail(
	context: OpportunityContext,
	emailType?: EmailType,
	recipientName?: string
): Promise<FollowUpEmailOutput> {
	const result = await executeFollowUpEmail(context, { emailType, recipientName })
	if (!result.success) {
		throw new Error(result.error || 'Follow-up email generation failed')
	}
	return result.data!
}

export default createFollowUpEmailAgent
