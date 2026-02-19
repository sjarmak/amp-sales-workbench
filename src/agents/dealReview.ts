/**
 * Deal Review Agent
 * 
 * Provides comprehensive deal health analysis with scoring across dimensions,
 * risk assessment, qualification gap analysis, and actionable recommendations.
 */

import type {
	AgentOutput,
	OpportunityContext,
} from '../agentTypes.js'
import { makeSimpleLlmAgent, serializeContext, type Agent, cleanJsonParse } from './baseAgent.js'

// ============================================================================
// Output Types
// ============================================================================

export interface DealReviewOutput {
	healthScore: {
		overall: number
		qualification: number
		relationship: number
		technical: number
		commercial: number
		process: number
	}
	strengths: Array<{
		area: string
		evidence: string
		leverage: string
	}>
	weaknesses: Array<{
		area: string
		severity: 'critical' | 'significant' | 'moderate'
		evidence: string
		remediation: string
	}>
	risks: Array<{
		risk: string
		probability: 'high' | 'medium' | 'low'
		impact: 'high' | 'medium' | 'low'
		riskScore: number
		indicators: string[]
		mitigation: string
	}>
	qualificationGaps: Array<{
		element: string
		currentState: string
		gap: string
		action: string
	}>
	recommendations: Array<{
		recommendation: string
		priority: 'high' | 'medium' | 'low'
		category: 'qualification' | 'relationship' | 'technical' | 'commercial' | 'process'
		effort: 'low' | 'medium' | 'high'
		impact: 'low' | 'medium' | 'high'
	}>
	nextActions: Array<{
		action: string
		owner: string
		dueDate: string
		successCriteria: string
	}>
	forecast: {
		recommendation: 'commit' | 'best_case' | 'pipeline' | 'at_risk'
		confidence: 'high' | 'medium' | 'low'
		rationale: string
	}
}

// ============================================================================
// Input Types
// ============================================================================

export interface DealReviewInput {
	focusAreas?: string[]
	includeCoaching?: boolean
	comparisonPeriod?: string
}

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * Build user message for deal review generation.
 */
function buildUserMessage(context: OpportunityContext, body: DealReviewInput): string {
	const contextStr = serializeContext(context)

	let message = `${contextStr}\n\n`

	message += `## Deal Review Request\n\n`

	if (body.focusAreas && body.focusAreas.length > 0) {
		message += `**Focus Areas:** ${body.focusAreas.join(', ')}\n`
	}

	if (body.includeCoaching) {
		message += `**Include Coaching:** Yes - provide rep coaching tips\n`
	}

	if (body.comparisonPeriod) {
		message += `**Comparison Period:** ${body.comparisonPeriod}\n`
	}

	message += `\nBased on the account context above, conduct a comprehensive deal review that:\n`
	message += `1. Scores deal health across qualification, relationship, technical, commercial, and process dimensions\n`
	message += `2. Identifies key strengths and how to leverage them\n`
	message += `3. Highlights weaknesses with severity and remediation plans\n`
	message += `4. Assesses risks with probability, impact, and mitigation strategies\n`
	message += `5. Documents MEDDPICC qualification gaps\n`
	message += `6. Provides prioritized recommendations\n`
	message += `7. Lists specific next actions with owners and success criteria\n`
	message += `8. Gives a forecast recommendation with rationale\n\n`
	message += `Respond in JSON format matching the DealReviewOutput schema.`

	return message
}

/**
 * Parse LLM output to DealReviewOutput.
 */
function parseOutput(content: string): DealReviewOutput {
	try {
		const parsed = cleanJsonParse<any>(content)

		return {
			healthScore: extractHealthScore(parsed.healthScore),
			strengths: extractStrengths(parsed.strengths),
			weaknesses: extractWeaknesses(parsed.weaknesses),
			risks: extractRisks(parsed.risks),
			qualificationGaps: extractQualificationGaps(parsed.qualificationGaps),
			recommendations: extractRecommendations(parsed.recommendations),
			nextActions: extractNextActions(parsed.nextActions),
			forecast: extractForecast(parsed.forecast),
		}
	} catch (err) {
		console.error('Failed to parse deal review output:', err)
		return {
			healthScore: { overall: 0, qualification: 0, relationship: 0, technical: 0, commercial: 0, process: 0 },
			strengths: [],
			weaknesses: [],
			risks: [],
			qualificationGaps: [],
			recommendations: [],
			nextActions: [],
			forecast: { recommendation: 'at_risk', confidence: 'low', rationale: 'Unable to complete analysis' },
		}
	}
}

function extractHealthScore(input: any): DealReviewOutput['healthScore'] {
	if (!input) {
		return { overall: 0, qualification: 0, relationship: 0, technical: 0, commercial: 0, process: 0 }
	}
	return {
		overall: Number(input.overall) || 0,
		qualification: Number(input.qualification) || 0,
		relationship: Number(input.relationship) || 0,
		technical: Number(input.technical) || 0,
		commercial: Number(input.commercial) || 0,
		process: Number(input.process) || 0,
	}
}

function extractStrengths(input: any): DealReviewOutput['strengths'] {
	if (!input || !Array.isArray(input)) return []
	return input.map((s: any) => ({
		area: s.area || '',
		evidence: s.evidence || '',
		leverage: s.leverage || '',
	}))
}

function extractWeaknesses(input: any): DealReviewOutput['weaknesses'] {
	if (!input || !Array.isArray(input)) return []
	return input.map((w: any) => ({
		area: w.area || '',
		severity: validateSeverity(w.severity),
		evidence: w.evidence || '',
		remediation: w.remediation || '',
	}))
}

function validateSeverity(val: any): 'critical' | 'significant' | 'moderate' {
	if (val === 'critical' || val === 'significant' || val === 'moderate') return val
	return 'moderate'
}

function extractRisks(input: any): DealReviewOutput['risks'] {
	if (!input || !Array.isArray(input)) return []
	return input.map((r: any) => ({
		risk: r.risk || '',
		probability: validateLevel(r.probability),
		impact: validateLevel(r.impact),
		riskScore: Number(r.riskScore) || 0,
		indicators: Array.isArray(r.indicators) ? r.indicators : [],
		mitigation: r.mitigation || '',
	}))
}

function validateLevel(val: any): 'high' | 'medium' | 'low' {
	if (val === 'high' || val === 'medium' || val === 'low') return val
	return 'medium'
}

function extractQualificationGaps(input: any): DealReviewOutput['qualificationGaps'] {
	if (!input || !Array.isArray(input)) return []
	return input.map((g: any) => ({
		element: g.element || '',
		currentState: g.currentState || '',
		gap: g.gap || '',
		action: g.action || '',
	}))
}

function extractRecommendations(input: any): DealReviewOutput['recommendations'] {
	if (!input || !Array.isArray(input)) return []
	return input.map((r: any) => ({
		recommendation: r.recommendation || '',
		priority: validateLevel(r.priority),
		category: validateCategory(r.category),
		effort: validateLevel(r.effort),
		impact: validateLevel(r.impact),
	}))
}

function validateCategory(val: any): 'qualification' | 'relationship' | 'technical' | 'commercial' | 'process' {
	const valid = ['qualification', 'relationship', 'technical', 'commercial', 'process']
	if (valid.includes(val)) return val as any
	return 'qualification'
}

function extractNextActions(input: any): DealReviewOutput['nextActions'] {
	if (!input || !Array.isArray(input)) return []
	return input.map((a: any) => ({
		action: a.action || '',
		owner: a.owner || 'TBD',
		dueDate: a.dueDate || a.due_date || 'TBD',
		successCriteria: a.successCriteria || a.success_criteria || '',
	}))
}

function extractForecast(input: any): DealReviewOutput['forecast'] {
	if (!input) {
		return { recommendation: 'pipeline', confidence: 'medium', rationale: '' }
	}
	const validRecs = ['commit', 'best_case', 'pipeline', 'at_risk']
	return {
		recommendation: validRecs.includes(input.recommendation) ? input.recommendation : 'pipeline',
		confidence: validateLevel(input.confidence),
		rationale: input.rationale || '',
	}
}

/**
 * Create the Deal Review agent.
 */
export function createDealReviewAgent(): Agent<DealReviewInput, DealReviewOutput> {
	return makeSimpleLlmAgent<DealReviewInput, DealReviewOutput>({
		agentId: 'deal_review',
		buildUserMessage,
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
 * Execute deal review directly.
 */
export async function executeDealReview(
	context: OpportunityContext,
	options?: DealReviewInput
): Promise<AgentOutput<DealReviewOutput>> {
	const agent = createDealReviewAgent()
	return agent.execute({
		context,
		body: options || {},
	})
}

/**
 * Quick deal review for simple cases.
 */
export async function quickDealReview(
	context: OpportunityContext
): Promise<DealReviewOutput> {
	const result = await executeDealReview(context)
	if (!result.success) {
		throw new Error(result.error || 'Deal review failed')
	}
	return result.data!
}

export default createDealReviewAgent
