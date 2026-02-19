/**
 * Handoff Document Agent
 * 
 * Creates comprehensive handoff documentation for account ownership transitions.
 * Supports various handoff types: AE→AE, SDR→AE, AE→SE, AE→CSM, SE→SE.
 */

import type { AgentOutput, OpportunityContext } from '../agentTypes.js'
import { makeSimpleLlmAgent, serializeContext, type Agent, cleanJsonParse } from './baseAgent.js'

// ============================================================================
// Types
// ============================================================================

export type HandoffType = 'AE_to_AE' | 'SDR_to_AE' | 'AE_to_SE' | 'AE_to_CSM' | 'SE_to_SE'

export interface HandoffInput {
	handoffType?: HandoffType
}

export interface HandoffSummary {
	accountName: string
	currentStage: string
	dealValue: string
	closeDate: string
	productsInScope: string[]
	urgency: 'high' | 'medium' | 'low'
	oneLiner: string
}

export interface HandoffContextSection {
	background: string
	currentSituation: string
	recentDevelopments: string
	upcomingEvents: string
}

export interface HandoffStakeholder {
	name: string
	title: string
	role: 'champion' | 'decision_maker' | 'influencer' | 'blocker' | 'user'
	engagement: 'high' | 'medium' | 'low'
	relationshipOwner: string
	notes: string
}

export interface HandoffOpenItem {
	item: string
	status: 'in_progress' | 'pending' | 'blocked'
	owner: string
	dueDate: string
	context: string
}

export interface HandoffTechnicalContext {
	currentStack: string[]
	integrationNeeds: string[]
	securityRequirements: string[]
	technicalConcerns: string[]
}

export interface HandoffCompetitiveLandscape {
	competitors: string[]
	ourPosition: string
	keyBattles: string
}

export interface HandoffRecommendation {
	recommendation: string
	priority: 'immediate' | 'short_term' | 'ongoing'
	rationale: string
}

export interface HandoffTimelineEvent {
	date: string
	event: string
	importance: string
}

export interface HandoffAttachment {
	name: string
	location: string
	purpose: string
}

export interface HandoffIntroductionPlan {
	warmIntro: string
	positioning: string
	keyMessages: string[]
}

export interface HandoffOutput {
	handoffType: HandoffType
	summary: HandoffSummary
	context: HandoffContextSection
	stakeholders: HandoffStakeholder[]
	openItems: HandoffOpenItem[]
	technicalContext: HandoffTechnicalContext
	competitiveLandscape: HandoffCompetitiveLandscape
	recommendations: HandoffRecommendation[]
	timeline: HandoffTimelineEvent[]
	attachments: HandoffAttachment[]
	introductionPlan: HandoffIntroductionPlan
}

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * Build user message for handoff document generation.
 */
function buildUserMessage(context: OpportunityContext, body: HandoffInput): string {
	const contextStr = serializeContext(context)

	let message = `${contextStr}\n\n`
	message += `## Handoff Document Request\n\n`

	if (body.handoffType) {
		message += `### Handoff Type\n`
		message += `${formatHandoffType(body.handoffType)}\n\n`
	}

	message += `Based on the account context above, create a comprehensive handoff document that:\n`
	message += `1. Provides a clear summary of the account and deal status\n`
	message += `2. Documents all key stakeholders and their relationships\n`
	message += `3. Lists all open items and their current status\n`
	message += `4. Captures technical context and requirements\n`
	message += `5. Outlines competitive positioning\n`
	message += `6. Provides actionable recommendations for the new owner\n`
	message += `7. Includes an introduction plan for transitioning relationships\n\n`
	message += `Respond in JSON format matching the HandoffOutput schema.`

	return message
}

/**
 * Format handoff type for display.
 */
function formatHandoffType(type: HandoffType): string {
	const labels: Record<HandoffType, string> = {
		AE_to_AE: 'AE to AE (Territory/Account Reassignment)',
		SDR_to_AE: 'SDR to AE (Qualified Lead Handoff)',
		AE_to_SE: 'AE to SE (Technical Engagement Handoff)',
		AE_to_CSM: 'AE to CSM (Post-Sale Customer Success Handoff)',
		SE_to_SE: 'SE to SE (Technical Ownership Transfer)',
	}
	return labels[type] || type
}

/**
 * Parse LLM output to HandoffOutput.
 */
function parseOutput(content: string): HandoffOutput {
	try {
		const parsed = cleanJsonParse<any>(content)
		return {
			handoffType: extractHandoffType(parsed.handoffType),
			summary: extractSummary(parsed.summary),
			context: extractContext(parsed.context),
			stakeholders: extractStakeholders(parsed.stakeholders),
			openItems: extractOpenItems(parsed.openItems),
			technicalContext: extractTechnicalContext(parsed.technicalContext),
			competitiveLandscape: extractCompetitiveLandscape(parsed.competitiveLandscape),
			recommendations: extractRecommendations(parsed.recommendations),
			timeline: extractTimeline(parsed.timeline),
			attachments: extractAttachments(parsed.attachments),
			introductionPlan: extractIntroductionPlan(parsed.introductionPlan),
		}
	} catch (err) {
		console.error('Failed to parse handoff output:', err)
		return getDefaultHandoffOutput()
	}
}

// ============================================================================
// Extraction Functions
// ============================================================================

function extractHandoffType(input: any): HandoffType {
	const validTypes: HandoffType[] = ['AE_to_AE', 'SDR_to_AE', 'AE_to_SE', 'AE_to_CSM', 'SE_to_SE']
	if (validTypes.includes(input)) return input
	return 'AE_to_AE'
}

function extractSummary(input: any): HandoffSummary {
	if (!input || typeof input !== 'object') {
		return {
			accountName: '',
			currentStage: '',
			dealValue: '',
			closeDate: '',
			productsInScope: [],
			urgency: 'medium',
			oneLiner: '',
		}
	}
	return {
		accountName: String(input.accountName || ''),
		currentStage: String(input.currentStage || ''),
		dealValue: String(input.dealValue || ''),
		closeDate: String(input.closeDate || ''),
		productsInScope: Array.isArray(input.productsInScope)
			? input.productsInScope.map(String)
			: [],
		urgency: extractUrgency(input.urgency),
		oneLiner: String(input.oneLiner || ''),
	}
}

function extractUrgency(input: any): 'high' | 'medium' | 'low' {
	if (['high', 'medium', 'low'].includes(input)) return input
	return 'medium'
}

function extractContext(input: any): HandoffContextSection {
	if (!input || typeof input !== 'object') {
		return {
			background: '',
			currentSituation: '',
			recentDevelopments: '',
			upcomingEvents: '',
		}
	}
	return {
		background: String(input.background || ''),
		currentSituation: String(input.currentSituation || ''),
		recentDevelopments: String(input.recentDevelopments || ''),
		upcomingEvents: String(input.upcomingEvents || ''),
	}
}

function extractStakeholders(input: any): HandoffStakeholder[] {
	if (!Array.isArray(input)) return []
	return input.map((s: any) => ({
		name: String(s.name || ''),
		title: String(s.title || ''),
		role: extractStakeholderRole(s.role),
		engagement: extractEngagement(s.engagement),
		relationshipOwner: String(s.relationshipOwner || ''),
		notes: String(s.notes || ''),
	}))
}

function extractStakeholderRole(input: any): HandoffStakeholder['role'] {
	const validRoles = ['champion', 'decision_maker', 'influencer', 'blocker', 'user']
	if (validRoles.includes(input)) return input
	return 'user'
}

function extractEngagement(input: any): 'high' | 'medium' | 'low' {
	if (['high', 'medium', 'low'].includes(input)) return input
	return 'medium'
}

function extractOpenItems(input: any): HandoffOpenItem[] {
	if (!Array.isArray(input)) return []
	return input.map((item: any) => ({
		item: String(item.item || ''),
		status: extractOpenItemStatus(item.status),
		owner: String(item.owner || ''),
		dueDate: String(item.dueDate || ''),
		context: String(item.context || ''),
	}))
}

function extractOpenItemStatus(input: any): HandoffOpenItem['status'] {
	const validStatuses = ['in_progress', 'pending', 'blocked']
	if (validStatuses.includes(input)) return input
	return 'pending'
}

function extractTechnicalContext(input: any): HandoffTechnicalContext {
	if (!input || typeof input !== 'object') {
		return {
			currentStack: [],
			integrationNeeds: [],
			securityRequirements: [],
			technicalConcerns: [],
		}
	}
	return {
		currentStack: Array.isArray(input.currentStack) ? input.currentStack.map(String) : [],
		integrationNeeds: Array.isArray(input.integrationNeeds)
			? input.integrationNeeds.map(String)
			: [],
		securityRequirements: Array.isArray(input.securityRequirements)
			? input.securityRequirements.map(String)
			: [],
		technicalConcerns: Array.isArray(input.technicalConcerns)
			? input.technicalConcerns.map(String)
			: [],
	}
}

function extractCompetitiveLandscape(input: any): HandoffCompetitiveLandscape {
	if (!input || typeof input !== 'object') {
		return {
			competitors: [],
			ourPosition: '',
			keyBattles: '',
		}
	}
	return {
		competitors: Array.isArray(input.competitors) ? input.competitors.map(String) : [],
		ourPosition: String(input.ourPosition || ''),
		keyBattles: String(input.keyBattles || ''),
	}
}

function extractRecommendations(input: any): HandoffRecommendation[] {
	if (!Array.isArray(input)) return []
	return input.map((r: any) => ({
		recommendation: String(r.recommendation || ''),
		priority: extractPriority(r.priority),
		rationale: String(r.rationale || ''),
	}))
}

function extractPriority(input: any): HandoffRecommendation['priority'] {
	const validPriorities = ['immediate', 'short_term', 'ongoing']
	if (validPriorities.includes(input)) return input
	return 'ongoing'
}

function extractTimeline(input: any): HandoffTimelineEvent[] {
	if (!Array.isArray(input)) return []
	return input.map((t: any) => ({
		date: String(t.date || ''),
		event: String(t.event || ''),
		importance: String(t.importance || ''),
	}))
}

function extractAttachments(input: any): HandoffAttachment[] {
	if (!Array.isArray(input)) return []
	return input.map((a: any) => ({
		name: String(a.name || ''),
		location: String(a.location || ''),
		purpose: String(a.purpose || ''),
	}))
}

function extractIntroductionPlan(input: any): HandoffIntroductionPlan {
	if (!input || typeof input !== 'object') {
		return {
			warmIntro: '',
			positioning: '',
			keyMessages: [],
		}
	}
	return {
		warmIntro: String(input.warmIntro || ''),
		positioning: String(input.positioning || ''),
		keyMessages: Array.isArray(input.keyMessages) ? input.keyMessages.map(String) : [],
	}
}

function getDefaultHandoffOutput(): HandoffOutput {
	return {
		handoffType: 'AE_to_AE',
		summary: {
			accountName: '',
			currentStage: '',
			dealValue: '',
			closeDate: '',
			productsInScope: [],
			urgency: 'medium',
			oneLiner: '',
		},
		context: {
			background: '',
			currentSituation: '',
			recentDevelopments: '',
			upcomingEvents: '',
		},
		stakeholders: [],
		openItems: [],
		technicalContext: {
			currentStack: [],
			integrationNeeds: [],
			securityRequirements: [],
			technicalConcerns: [],
		},
		competitiveLandscape: {
			competitors: [],
			ourPosition: '',
			keyBattles: '',
		},
		recommendations: [],
		timeline: [],
		attachments: [],
		introductionPlan: {
			warmIntro: '',
			positioning: '',
			keyMessages: [],
		},
	}
}

// ============================================================================
// Agent Factory
// ============================================================================

/**
 * Create the Handoff agent.
 */
export function createHandoffAgent(): Agent<HandoffInput, HandoffOutput> {
	return makeSimpleLlmAgent<HandoffInput, HandoffOutput>({
		agentId: 'handoff',
		buildUserMessage,
		parseOutput,
		llmOverride: {
			temperature: 0.4,
			maxOutputTokens: 6144,
		},
	})
}

// ============================================================================
// Direct Execution Functions
// ============================================================================

/**
 * Execute handoff document generation directly without going through the registry.
 */
export async function executeHandoff(
	context: OpportunityContext,
	options?: HandoffInput
): Promise<AgentOutput<HandoffOutput>> {
	const agent = createHandoffAgent()
	return agent.execute({
		context,
		body: options || {},
	})
}

/**
 * Quick handoff for simple cases.
 */
export async function quickHandoff(
	context: OpportunityContext,
	handoffType?: HandoffType
): Promise<HandoffOutput> {
	const result = await executeHandoff(context, { handoffType })
	if (!result.success) {
		throw new Error(result.error || 'Handoff document generation failed')
	}
	return result.data!
}

export default createHandoffAgent
