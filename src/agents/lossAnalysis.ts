/**
 * Loss Analysis Agent
 * 
 * Analyzes closed-lost deals to identify patterns, extract competitive
 * intelligence, and recommend improvements for future deals.
 */

import type {
	AgentOutput,
	OpportunityContext,
} from '../agentTypes.js'
import { makeSimpleLlmAgent, serializeContext, type Agent, cleanJsonParse } from './baseAgent.js'

// ============================================================================
// Output Types
// ============================================================================

export interface LossAnalysisSummary {
	customer: string
	potentialDealSize: string
	products: string[]
	salesCycle: string
	primaryLossReason: string
}

export interface LossFactor {
	factor: string
	type: 'product' | 'price' | 'competition' | 'timing' | 'relationship' | 'internal'
	severity: 'primary' | 'contributing' | 'minor'
	controllable: boolean
	evidence: string
}

export interface CompetitorAnalysis {
	winner: string
	theirStrengths: string[]
	ourWeaknesses: string[]
	pricingComparison: string
	featureGaps: string[]
}

export interface TimelineEvent {
	event: string
	date: string
	impact: string
}

export interface WhatWorkedItem {
	element: string
	evidence: string
}

export interface WhatFailedItem {
	element: string
	impact: string
	rootCause: string
}

export interface MissedSignal {
	signal: string
	when: string
	whatWeCouldHaveDone: string
}

export interface Recommendation {
	recommendation: string
	category: 'process' | 'product' | 'enablement' | 'pricing' | 'positioning'
	priority: 'high' | 'medium' | 'low'
	rationale: string
}

export interface PreventionStrategy {
	strategy: string
	triggerSignals: string[]
	applicability: 'broad' | 'specific'
}

export interface LossAnalysisOutput {
	summary: LossAnalysisSummary
	lossFactors: LossFactor[]
	competitorAnalysis: CompetitorAnalysis
	timeline: TimelineEvent[]
	whatWorked: WhatWorkedItem[]
	whatFailed: WhatFailedItem[]
	missedSignals: MissedSignal[]
	recommendations: Recommendation[]
	preventionStrategies: PreventionStrategy[]
	competitivePlaybookUpdates: string[]
}

// ============================================================================
// Input Types
// ============================================================================

export interface LossAnalysisInput {
	opportunityId?: string
}

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * Build user message for loss analysis.
 */
function buildUserMessage(context: OpportunityContext, body: LossAnalysisInput): string {
	const contextStr = serializeContext(context)

	let message = `${contextStr}\n\n`

	message += `## Loss Analysis Request\n\n`

	if (body.opportunityId) {
		message += `### Opportunity ID\n`
		message += body.opportunityId
		message += '\n\n'
	}

	message += `Based on the account context above, perform a comprehensive loss analysis that:\n`
	message += `1. Identifies the primary and contributing factors for the loss\n`
	message += `2. Extracts competitive intelligence about the winning vendor\n`
	message += `3. Documents what worked and what failed in our approach\n`
	message += `4. Identifies missed signals we should have caught earlier\n`
	message += `5. Provides actionable recommendations and prevention strategies\n\n`
	message += `Be objective and blame-free. Focus on patterns and actionable improvements.\n\n`
	message += `Respond in JSON format matching the LossAnalysisOutput schema.`

	return message
}

/**
 * Parse LLM output to LossAnalysisOutput.
 */
function parseOutput(content: string): LossAnalysisOutput {
	try {
		const parsed = cleanJsonParse<any>(content)

		return {
			summary: extractSummary(parsed.summary),
			lossFactors: extractLossFactors(parsed.lossFactors),
			competitorAnalysis: extractCompetitorAnalysis(parsed.competitorAnalysis),
			timeline: extractTimeline(parsed.timeline),
			whatWorked: extractWhatWorked(parsed.whatWorked),
			whatFailed: extractWhatFailed(parsed.whatFailed),
			missedSignals: extractMissedSignals(parsed.missedSignals),
			recommendations: extractRecommendations(parsed.recommendations),
			preventionStrategies: extractPreventionStrategies(parsed.preventionStrategies),
			competitivePlaybookUpdates: extractPlaybookUpdates(parsed.competitivePlaybookUpdates),
		}
	} catch (err) {
		console.error('Failed to parse loss analysis output:', err)
		return {
			summary: {
				customer: '',
				potentialDealSize: '',
				products: [],
				salesCycle: '',
				primaryLossReason: 'Unable to determine',
			},
			lossFactors: [],
			competitorAnalysis: {
				winner: 'Unknown',
				theirStrengths: [],
				ourWeaknesses: [],
				pricingComparison: '',
				featureGaps: [],
			},
			timeline: [],
			whatWorked: [],
			whatFailed: [],
			missedSignals: [],
			recommendations: [],
			preventionStrategies: [],
			competitivePlaybookUpdates: [],
		}
	}
}

/**
 * Extract summary from parsed output.
 */
function extractSummary(input: any): LossAnalysisSummary {
	if (!input) {
		return {
			customer: '',
			potentialDealSize: '',
			products: [],
			salesCycle: '',
			primaryLossReason: 'Unable to determine',
		}
	}

	return {
		customer: String(input.customer || ''),
		potentialDealSize: String(input.potentialDealSize || ''),
		products: Array.isArray(input.products) ? input.products.map(String) : [],
		salesCycle: String(input.salesCycle || ''),
		primaryLossReason: String(input.primaryLossReason || 'Unable to determine'),
	}
}

/**
 * Extract loss factors from parsed output.
 */
function extractLossFactors(input: any): LossFactor[] {
	if (!Array.isArray(input)) return []

	const validTypes = ['product', 'price', 'competition', 'timing', 'relationship', 'internal']
	const validSeverities = ['primary', 'contributing', 'minor']

	return input.map((item: any) => ({
		factor: String(item.factor || ''),
		type: validTypes.includes(item.type) ? item.type : 'internal',
		severity: validSeverities.includes(item.severity) ? item.severity : 'contributing',
		controllable: Boolean(item.controllable),
		evidence: String(item.evidence || ''),
	}))
}

/**
 * Extract competitor analysis from parsed output.
 */
function extractCompetitorAnalysis(input: any): CompetitorAnalysis {
	if (!input) {
		return {
			winner: 'Unknown',
			theirStrengths: [],
			ourWeaknesses: [],
			pricingComparison: '',
			featureGaps: [],
		}
	}

	return {
		winner: String(input.winner || 'Unknown'),
		theirStrengths: Array.isArray(input.theirStrengths)
			? input.theirStrengths.map(String)
			: [],
		ourWeaknesses: Array.isArray(input.ourWeaknesses)
			? input.ourWeaknesses.map(String)
			: [],
		pricingComparison: String(input.pricingComparison || ''),
		featureGaps: Array.isArray(input.featureGaps)
			? input.featureGaps.map(String)
			: [],
	}
}

/**
 * Extract timeline events from parsed output.
 */
function extractTimeline(input: any): TimelineEvent[] {
	if (!Array.isArray(input)) return []

	return input.map((item: any) => ({
		event: String(item.event || ''),
		date: String(item.date || ''),
		impact: String(item.impact || ''),
	}))
}

/**
 * Extract what worked items from parsed output.
 */
function extractWhatWorked(input: any): WhatWorkedItem[] {
	if (!Array.isArray(input)) return []

	return input.map((item: any) => ({
		element: String(item.element || ''),
		evidence: String(item.evidence || ''),
	}))
}

/**
 * Extract what failed items from parsed output.
 */
function extractWhatFailed(input: any): WhatFailedItem[] {
	if (!Array.isArray(input)) return []

	return input.map((item: any) => ({
		element: String(item.element || ''),
		impact: String(item.impact || ''),
		rootCause: String(item.rootCause || ''),
	}))
}

/**
 * Extract missed signals from parsed output.
 */
function extractMissedSignals(input: any): MissedSignal[] {
	if (!Array.isArray(input)) return []

	return input.map((item: any) => ({
		signal: String(item.signal || ''),
		when: String(item.when || ''),
		whatWeCouldHaveDone: String(item.whatWeCouldHaveDone || ''),
	}))
}

/**
 * Extract recommendations from parsed output.
 */
function extractRecommendations(input: any): Recommendation[] {
	if (!Array.isArray(input)) return []

	const validCategories = ['process', 'product', 'enablement', 'pricing', 'positioning']
	const validPriorities = ['high', 'medium', 'low']

	return input.map((item: any) => ({
		recommendation: String(item.recommendation || ''),
		category: validCategories.includes(item.category) ? item.category : 'process',
		priority: validPriorities.includes(item.priority) ? item.priority : 'medium',
		rationale: String(item.rationale || ''),
	}))
}

/**
 * Extract prevention strategies from parsed output.
 */
function extractPreventionStrategies(input: any): PreventionStrategy[] {
	if (!Array.isArray(input)) return []

	const validApplicability = ['broad', 'specific']

	return input.map((item: any) => ({
		strategy: String(item.strategy || ''),
		triggerSignals: Array.isArray(item.triggerSignals)
			? item.triggerSignals.map(String)
			: [],
		applicability: validApplicability.includes(item.applicability)
			? item.applicability
			: 'specific',
	}))
}

/**
 * Extract competitive playbook updates from parsed output.
 */
function extractPlaybookUpdates(input: any): string[] {
	if (!Array.isArray(input)) return []
	return input.map(String)
}

/**
 * Create the Loss Analysis agent.
 */
export function createLossAnalysisAgent(): Agent<LossAnalysisInput, LossAnalysisOutput> {
	return makeSimpleLlmAgent<LossAnalysisInput, LossAnalysisOutput>({
		agentId: 'loss_analysis',
		buildUserMessage,
		parseOutput,
		llmOverride: {
			temperature: 0.3,
			maxOutputTokens: 6144,
		},
	})
}

// ============================================================================
// Direct Execution Functions
// ============================================================================

/**
 * Execute loss analysis directly without going through the registry.
 */
export async function executeLossAnalysis(
	context: OpportunityContext,
	options?: LossAnalysisInput
): Promise<AgentOutput<LossAnalysisOutput>> {
	const agent = createLossAnalysisAgent()
	return agent.execute({
		context,
		body: options || {},
	})
}

/**
 * Quick loss analysis for simple cases.
 */
export async function quickLossAnalysis(
	context: OpportunityContext,
	opportunityId?: string
): Promise<LossAnalysisOutput> {
	const result = await executeLossAnalysis(context, { opportunityId })
	if (!result.success) {
		throw new Error(result.error || 'Loss analysis failed')
	}
	return result.data!
}

// Export the agent factory
export default createLossAnalysisAgent
