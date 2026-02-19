/**
 * Closed-Lost Analysis Agent
 * 
 * Analyzes deals that didn't close to extract learning, identify patterns,
 * and recommend improvements. Part of the Post-Mortem lifecycle stage.
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
	potentialAcv: string
	products: string[]
	salesCycle: string
	stageReached: string
	primaryLossReason: string
}

export interface LossFactor {
	factor: string
	category: 'product' | 'price' | 'competition' | 'timing' | 'relationship' | 'process' | 'qualification'
	severity: 'primary' | 'contributing' | 'minor'
	controllable: boolean
	evidence: string
	prevention: string
}

export interface TimelineEvent {
	event: string
	date: string
	impact: string
}

export interface CompetitorAnalysis {
	winner: string
	theirStrengths: string[]
	theirWeaknesses: string[]
	pricingComparison: string
}

export interface Mistake {
	mistake: string
	impact: string
	alternative: string
}

export interface MissedSignal {
	signal: string
	when: string
	lesson: string
}

export interface WhatWorked {
	element: string
	evidence: string
}

export interface Recommendation {
	recommendation: string
	category: 'qualification' | 'discovery' | 'demo' | 'pricing' | 'process' | 'enablement'
	priority: 'high' | 'medium' | 'low'
	owner: string
}

export interface ShouldWeHavePursued {
	assessment: 'yes' | 'probably' | 'probably_not' | 'no'
	rationale: string
	disqualificationSignals: string[]
}

export interface ClosedLostOutput {
	dealSummary: DealSummary
	lossFactors: LossFactor[]
	timeline: TimelineEvent[]
	competitorAnalysis: CompetitorAnalysis
	mistakes: Mistake[]
	missedSignals: MissedSignal[]
	whatWorked: WhatWorked[]
	recommendations: Recommendation[]
	shouldWeHavePursued: ShouldWeHavePursued
	competitivePlaybookUpdates: string[]
}

// ============================================================================
// Input Types
// ============================================================================

export interface ClosedLostInput {
	opportunityId?: string
}

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * Build user message for closed-lost analysis.
 */
function buildUserMessage(context: OpportunityContext, body: ClosedLostInput): string {
	const contextStr = serializeContext(context)

	let message = `${contextStr}\n\n`

	message += `## Closed-Lost Analysis Request\n\n`

	if (body.opportunityId) {
		message += `### Opportunity ID\n${body.opportunityId}\n\n`
	}

	message += `Analyze this lost deal to understand what went wrong and extract actionable learnings.\n\n`
	message += `Focus on:\n`
	message += `1. Identifying the root causes of the loss\n`
	message += `2. Distinguishing controllable vs uncontrollable factors\n`
	message += `3. Extracting competitive intelligence\n`
	message += `4. Providing actionable recommendations\n`
	message += `5. Assessing whether we should have pursued this deal\n\n`
	message += `Respond in JSON format matching the ClosedLostOutput schema.`

	return message
}

/**
 * Parse LLM output to ClosedLostOutput.
 */
function parseOutput(content: string): ClosedLostOutput {
	try {
		const parsed = cleanJsonParse<any>(content)
		
		return {
			dealSummary: extractDealSummary(parsed.dealSummary),
			lossFactors: extractLossFactors(parsed.lossFactors),
			timeline: extractTimeline(parsed.timeline),
			competitorAnalysis: extractCompetitorAnalysis(parsed.competitorAnalysis),
			mistakes: extractMistakes(parsed.mistakes),
			missedSignals: extractMissedSignals(parsed.missedSignals),
			whatWorked: extractWhatWorked(parsed.whatWorked),
			recommendations: extractRecommendations(parsed.recommendations),
			shouldWeHavePursued: extractShouldWeHavePursued(parsed.shouldWeHavePursued),
			competitivePlaybookUpdates: extractStringArray(parsed.competitivePlaybookUpdates),
		}
	} catch (err) {
		console.error('Failed to parse closed-lost output:', err)
		return getDefaultOutput()
	}
}

/**
 * Extract deal summary with defaults.
 */
function extractDealSummary(input: any): DealSummary {
	if (!input || typeof input !== 'object') {
		return {
			customer: 'Unknown',
			potentialAcv: 'Unknown',
			products: [],
			salesCycle: 'Unknown',
			stageReached: 'Unknown',
			primaryLossReason: 'Unknown',
		}
	}

	return {
		customer: String(input.customer || 'Unknown'),
		potentialAcv: String(input.potentialAcv || 'Unknown'),
		products: Array.isArray(input.products) ? input.products.map(String) : [],
		salesCycle: String(input.salesCycle || 'Unknown'),
		stageReached: String(input.stageReached || 'Unknown'),
		primaryLossReason: String(input.primaryLossReason || 'Unknown'),
	}
}

/**
 * Extract loss factors with normalization.
 */
function extractLossFactors(input: any): LossFactor[] {
	if (!Array.isArray(input)) return []

	const validCategories = ['product', 'price', 'competition', 'timing', 'relationship', 'process', 'qualification']
	const validSeverities = ['primary', 'contributing', 'minor']

	return input.map((item: any) => ({
		factor: String(item.factor || ''),
		category: validCategories.includes(item.category) ? item.category : 'process',
		severity: validSeverities.includes(item.severity) ? item.severity : 'contributing',
		controllable: Boolean(item.controllable),
		evidence: String(item.evidence || ''),
		prevention: String(item.prevention || ''),
	})).filter((f: LossFactor) => f.factor)
}

/**
 * Extract timeline events.
 */
function extractTimeline(input: any): TimelineEvent[] {
	if (!Array.isArray(input)) return []

	return input.map((item: any) => ({
		event: String(item.event || ''),
		date: String(item.date || ''),
		impact: String(item.impact || ''),
	})).filter((t: TimelineEvent) => t.event)
}

/**
 * Extract competitor analysis.
 */
function extractCompetitorAnalysis(input: any): CompetitorAnalysis {
	if (!input || typeof input !== 'object') {
		return {
			winner: 'Unknown',
			theirStrengths: [],
			theirWeaknesses: [],
			pricingComparison: 'Unknown',
		}
	}

	return {
		winner: String(input.winner || 'Unknown'),
		theirStrengths: extractStringArray(input.theirStrengths),
		theirWeaknesses: extractStringArray(input.theirWeaknesses),
		pricingComparison: String(input.pricingComparison || 'Unknown'),
	}
}

/**
 * Extract mistakes.
 */
function extractMistakes(input: any): Mistake[] {
	if (!Array.isArray(input)) return []

	return input.map((item: any) => ({
		mistake: String(item.mistake || ''),
		impact: String(item.impact || ''),
		alternative: String(item.alternative || ''),
	})).filter((m: Mistake) => m.mistake)
}

/**
 * Extract missed signals.
 */
function extractMissedSignals(input: any): MissedSignal[] {
	if (!Array.isArray(input)) return []

	return input.map((item: any) => ({
		signal: String(item.signal || ''),
		when: String(item.when || ''),
		lesson: String(item.lesson || ''),
	})).filter((s: MissedSignal) => s.signal)
}

/**
 * Extract what worked.
 */
function extractWhatWorked(input: any): WhatWorked[] {
	if (!Array.isArray(input)) return []

	return input.map((item: any) => ({
		element: String(item.element || ''),
		evidence: String(item.evidence || ''),
	})).filter((w: WhatWorked) => w.element)
}

/**
 * Extract recommendations with normalization.
 */
function extractRecommendations(input: any): Recommendation[] {
	if (!Array.isArray(input)) return []

	const validCategories = ['qualification', 'discovery', 'demo', 'pricing', 'process', 'enablement']
	const validPriorities = ['high', 'medium', 'low']

	return input.map((item: any) => ({
		recommendation: String(item.recommendation || ''),
		category: validCategories.includes(item.category) ? item.category : 'process',
		priority: validPriorities.includes(item.priority) ? item.priority : 'medium',
		owner: String(item.owner || 'Unassigned'),
	})).filter((r: Recommendation) => r.recommendation)
}

/**
 * Extract should we have pursued assessment.
 */
function extractShouldWeHavePursued(input: any): ShouldWeHavePursued {
	if (!input || typeof input !== 'object') {
		return {
			assessment: 'probably',
			rationale: 'Insufficient data to assess',
			disqualificationSignals: [],
		}
	}

	const validAssessments = ['yes', 'probably', 'probably_not', 'no']
	
	return {
		assessment: validAssessments.includes(input.assessment) ? input.assessment : 'probably',
		rationale: String(input.rationale || 'No rationale provided'),
		disqualificationSignals: extractStringArray(input.disqualificationSignals),
	}
}

/**
 * Extract string array with fallback.
 */
function extractStringArray(input: any): string[] {
	if (!Array.isArray(input)) return []
	return input.map(String).filter(Boolean)
}

/**
 * Get default output for error cases.
 */
function getDefaultOutput(): ClosedLostOutput {
	return {
		dealSummary: {
			customer: 'Unknown',
			potentialAcv: 'Unknown',
			products: [],
			salesCycle: 'Unknown',
			stageReached: 'Unknown',
			primaryLossReason: 'Analysis failed',
		},
		lossFactors: [],
		timeline: [],
		competitorAnalysis: {
			winner: 'Unknown',
			theirStrengths: [],
			theirWeaknesses: [],
			pricingComparison: 'Unknown',
		},
		mistakes: [],
		missedSignals: [],
		whatWorked: [],
		recommendations: [],
		shouldWeHavePursued: {
			assessment: 'probably',
			rationale: 'Could not analyze deal',
			disqualificationSignals: [],
		},
		competitivePlaybookUpdates: [],
	}
}

/**
 * Create the Closed-Lost Analysis agent.
 */
export function createClosedLostAgent(): Agent<ClosedLostInput, ClosedLostOutput> {
	return makeSimpleLlmAgent<ClosedLostInput, ClosedLostOutput>({
		agentId: 'closed_lost',
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
 * Execute closed-lost analysis directly without going through the registry.
 */
export async function executeClosedLost(
	context: OpportunityContext,
	options?: ClosedLostInput
): Promise<AgentOutput<ClosedLostOutput>> {
	const agent = createClosedLostAgent()
	return agent.execute({
		context,
		body: options || {},
	})
}

/**
 * Quick closed-lost analysis for simple cases.
 */
export async function quickClosedLost(
	context: OpportunityContext,
	opportunityId?: string
): Promise<ClosedLostOutput> {
	const result = await executeClosedLost(context, { opportunityId })
	if (!result.success) {
		throw new Error(result.error || 'Closed-lost analysis failed')
	}
	return result.data!
}

// Export the agent factory
export default createClosedLostAgent
