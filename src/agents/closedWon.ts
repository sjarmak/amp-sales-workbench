/**
 * Closed-Won Analysis Agent
 * 
 * Analyzes successful deals to extract replicable patterns, prepare case study
 * materials, and create enablement content. Captures win factors, champion profiles,
 * and playbook elements for organizational learning.
 */

import type {
	AgentOutput,
	OpportunityContext,
} from '../agentTypes.js'
import { makeSimpleLlmAgent, serializeContext, type Agent, cleanJsonParse } from './baseAgent.js'

// ============================================================================
// Output Types
// ============================================================================

export interface DealSummary {
	customer: string
	products: string[]
	acv: string
	dealType: 'new' | 'expansion' | 'renewal'
	salesCycle: string
	competitorsDefeated: string[]
}

export interface WinFactor {
	factor: string
	category: 'product' | 'relationship' | 'timing' | 'pricing' | 'competition' | 'process'
	importance: 'critical' | 'major' | 'contributing'
	replicable: boolean
	evidence: string
}

export interface TimelineMilestone {
	milestone: string
	date: string
	significance: string
}

export interface KeyMoment {
	moment: string
	impact: string
	lesson: string
}

export interface ChampionProfile {
	title: string
	motivations: string[]
	howWeSupported: string
	internallyReplicable: string
}

export interface Playbook {
	idealCustomerProfile: string
	discoveryApproach: string
	demoStrategy: string
	competitiveStrategy: string
	closingStrategy: string
}

export interface LessonLearned {
	lesson: string
	applicability: 'broad' | 'specific'
	recommendation: string
}

export interface CaseStudyDraft {
	title: string
	challenge: string
	solution: string
	results: string
	quote: string
	metrics: string[]
}

export interface EnablementContent {
	type: 'video' | 'document' | 'training'
	topic: string
	audience: string
}

export interface ClosedWonOutput {
	dealSummary: DealSummary
	winFactors: WinFactor[]
	timeline: TimelineMilestone[]
	keyMoments: KeyMoment[]
	championProfile: ChampionProfile
	playbook: Playbook
	lessonsLearned: LessonLearned[]
	caseStudyDraft: CaseStudyDraft
	enablementContent: EnablementContent[]
}

// ============================================================================
// Input Types
// ============================================================================

export interface ClosedWonInput {
	opportunityId?: string
}

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * Build user message for closed-won analysis.
 */
function buildUserMessage(context: OpportunityContext, body: ClosedWonInput): string {
	const contextStr = serializeContext(context)

	let message = `${contextStr}\n\n`

	message += `## Closed-Won Analysis Request\n\n`

	if (body.opportunityId) {
		message += `### Opportunity ID\n`
		message += body.opportunityId
		message += '\n\n'
	}

	message += `Based on the account context above, perform a comprehensive closed-won analysis that:\n`
	message += `1. Documents the deal summary including products, ACV, and sales cycle\n`
	message += `2. Identifies win factors with their categories, importance, and evidence\n`
	message += `3. Captures the timeline of key milestones\n`
	message += `4. Extracts key moments and lessons learned\n`
	message += `5. Profiles the champion and how we supported them\n`
	message += `6. Creates replicable playbook elements\n`
	message += `7. Drafts case study materials with quotes and metrics\n`
	message += `8. Suggests enablement content to create from this win\n\n`
	message += `Respond in JSON format matching the ClosedWonOutput schema.`

	return message
}

/**
 * Parse LLM output to ClosedWonOutput.
 */
function parseOutput(content: string): ClosedWonOutput {
	try {
		const parsed = cleanJsonParse<any>(content)

		return {
			dealSummary: extractDealSummary(parsed.dealSummary),
			winFactors: extractWinFactors(parsed.winFactors),
			timeline: extractTimeline(parsed.timeline),
			keyMoments: extractKeyMoments(parsed.keyMoments),
			championProfile: extractChampionProfile(parsed.championProfile),
			playbook: extractPlaybook(parsed.playbook),
			lessonsLearned: extractLessonsLearned(parsed.lessonsLearned),
			caseStudyDraft: extractCaseStudyDraft(parsed.caseStudyDraft),
			enablementContent: extractEnablementContent(parsed.enablementContent),
		}
	} catch (err) {
		console.error('Failed to parse closed-won output:', err)
		return {
			dealSummary: getDefaultDealSummary(),
			winFactors: [],
			timeline: [],
			keyMoments: [],
			championProfile: getDefaultChampionProfile(),
			playbook: getDefaultPlaybook(),
			lessonsLearned: [],
			caseStudyDraft: getDefaultCaseStudyDraft(),
			enablementContent: [],
		}
	}
}

// ============================================================================
// Extraction Functions
// ============================================================================

function extractDealSummary(input: any): DealSummary {
	if (!input) return getDefaultDealSummary()

	return {
		customer: String(input.customer || ''),
		products: Array.isArray(input.products) ? input.products.map(String) : [],
		acv: String(input.acv || ''),
		dealType: normalizeDealType(input.dealType),
		salesCycle: String(input.salesCycle || ''),
		competitorsDefeated: Array.isArray(input.competitorsDefeated) 
			? input.competitorsDefeated.map(String) 
			: [],
	}
}

function getDefaultDealSummary(): DealSummary {
	return {
		customer: '',
		products: [],
		acv: '',
		dealType: 'new',
		salesCycle: '',
		competitorsDefeated: [],
	}
}

function normalizeDealType(input: any): 'new' | 'expansion' | 'renewal' {
	const normalized = String(input || '').toLowerCase().trim()
	if (normalized === 'expansion') return 'expansion'
	if (normalized === 'renewal') return 'renewal'
	return 'new'
}

function extractWinFactors(input: any): WinFactor[] {
	if (!Array.isArray(input)) return []

	return input.map((item: any) => ({
		factor: String(item.factor || ''),
		category: normalizeWinCategory(item.category),
		importance: normalizeImportance(item.importance),
		replicable: Boolean(item.replicable),
		evidence: String(item.evidence || ''),
	}))
}

function normalizeWinCategory(input: any): WinFactor['category'] {
	const normalized = String(input || '').toLowerCase().trim()
	const validCategories = ['product', 'relationship', 'timing', 'pricing', 'competition', 'process']
	return validCategories.includes(normalized) 
		? normalized as WinFactor['category']
		: 'product'
}

function normalizeImportance(input: any): WinFactor['importance'] {
	const normalized = String(input || '').toLowerCase().trim()
	if (normalized === 'critical') return 'critical'
	if (normalized === 'major') return 'major'
	return 'contributing'
}

function extractTimeline(input: any): TimelineMilestone[] {
	if (!Array.isArray(input)) return []

	return input.map((item: any) => ({
		milestone: String(item.milestone || ''),
		date: String(item.date || ''),
		significance: String(item.significance || ''),
	}))
}

function extractKeyMoments(input: any): KeyMoment[] {
	if (!Array.isArray(input)) return []

	return input.map((item: any) => ({
		moment: String(item.moment || ''),
		impact: String(item.impact || ''),
		lesson: String(item.lesson || ''),
	}))
}

function extractChampionProfile(input: any): ChampionProfile {
	if (!input) return getDefaultChampionProfile()

	return {
		title: String(input.title || ''),
		motivations: Array.isArray(input.motivations) ? input.motivations.map(String) : [],
		howWeSupported: String(input.howWeSupported || ''),
		internallyReplicable: String(input.internallyReplicable || ''),
	}
}

function getDefaultChampionProfile(): ChampionProfile {
	return {
		title: '',
		motivations: [],
		howWeSupported: '',
		internallyReplicable: '',
	}
}

function extractPlaybook(input: any): Playbook {
	if (!input) return getDefaultPlaybook()

	return {
		idealCustomerProfile: String(input.idealCustomerProfile || ''),
		discoveryApproach: String(input.discoveryApproach || ''),
		demoStrategy: String(input.demoStrategy || ''),
		competitiveStrategy: String(input.competitiveStrategy || ''),
		closingStrategy: String(input.closingStrategy || ''),
	}
}

function getDefaultPlaybook(): Playbook {
	return {
		idealCustomerProfile: '',
		discoveryApproach: '',
		demoStrategy: '',
		competitiveStrategy: '',
		closingStrategy: '',
	}
}

function extractLessonsLearned(input: any): LessonLearned[] {
	if (!Array.isArray(input)) return []

	return input.map((item: any) => ({
		lesson: String(item.lesson || ''),
		applicability: normalizeApplicability(item.applicability),
		recommendation: String(item.recommendation || ''),
	}))
}

function normalizeApplicability(input: any): 'broad' | 'specific' {
	const normalized = String(input || '').toLowerCase().trim()
	return normalized === 'broad' ? 'broad' : 'specific'
}

function extractCaseStudyDraft(input: any): CaseStudyDraft {
	if (!input) return getDefaultCaseStudyDraft()

	return {
		title: String(input.title || ''),
		challenge: String(input.challenge || ''),
		solution: String(input.solution || ''),
		results: String(input.results || ''),
		quote: String(input.quote || ''),
		metrics: Array.isArray(input.metrics) ? input.metrics.map(String) : [],
	}
}

function getDefaultCaseStudyDraft(): CaseStudyDraft {
	return {
		title: '',
		challenge: '',
		solution: '',
		results: '',
		quote: '',
		metrics: [],
	}
}

function extractEnablementContent(input: any): EnablementContent[] {
	if (!Array.isArray(input)) return []

	return input.map((item: any) => ({
		type: normalizeContentType(item.type),
		topic: String(item.topic || ''),
		audience: String(item.audience || ''),
	}))
}

function normalizeContentType(input: any): EnablementContent['type'] {
	const normalized = String(input || '').toLowerCase().trim()
	if (normalized === 'video') return 'video'
	if (normalized === 'training') return 'training'
	return 'document'
}

// ============================================================================
// Agent Factory
// ============================================================================

/**
 * Create the Closed-Won Analysis agent.
 */
export function createClosedWonAgent(): Agent<ClosedWonInput, ClosedWonOutput> {
	return makeSimpleLlmAgent<ClosedWonInput, ClosedWonOutput>({
		agentId: 'closed_won',
		buildUserMessage,
		parseOutput,
		llmOverride: {
			temperature: 0.4,
			maxOutputTokens: 8192,
		},
	})
}

// ============================================================================
// Direct Execution Functions
// ============================================================================

/**
 * Execute closed-won analysis directly without going through the registry.
 */
export async function executeClosedWon(
	context: OpportunityContext,
	options?: ClosedWonInput
): Promise<AgentOutput<ClosedWonOutput>> {
	const agent = createClosedWonAgent()
	return agent.execute({
		context,
		body: options || {},
	})
}

/**
 * Quick closed-won analysis for simple cases.
 */
export async function quickClosedWon(
	context: OpportunityContext,
	opportunityId?: string
): Promise<ClosedWonOutput> {
	const result = await executeClosedWon(context, { opportunityId })
	if (!result.success) {
		throw new Error(result.error || 'Closed-won analysis failed')
	}
	return result.data!
}

// Legacy alias for backward compatibility
export const runClosedWonAgent = executeClosedWon

// Export the agent factory
export default createClosedWonAgent
