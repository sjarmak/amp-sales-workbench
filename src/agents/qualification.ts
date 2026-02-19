/**
 * Qualification Agent
 * 
 * Assesses opportunity quality using MEDDIC, BANT, or SPICED methodologies.
 * Provides scoring, gap analysis, and discovery questions to improve qualification.
 */

import type {
	AgentOutput,
	OpportunityContext,
} from '../agentTypes.js'
import { makeSimpleLlmAgent, serializeContext, type Agent, cleanJsonParse } from './baseAgent.js'

// ============================================================================
// Output Types
// ============================================================================

export type QualMethodology = 'MEDDIC' | 'BANT' | 'SPICED'

export interface QualificationOutput {
	methodology: QualMethodology
	scores: {
		overall: number
		elements: Array<{
			element: string
			score: number
			maxScore: number
			status: 'strong' | 'partial' | 'weak' | 'unknown'
			evidence: string[]
			notes: string
		}>
	}
	gaps: Array<{
		element: string
		gap: string
		priority: 'critical' | 'high' | 'medium' | 'low'
		suggestedAction: string
		questions: string[]
	}>
	strengths: Array<{
		element: string
		strength: string
		leverage: string
	}>
	recommendations: Array<{
		action: string
		rationale: string
		priority: 'high' | 'medium' | 'low'
	}>
	overallAssessment: {
		qualified: boolean
		confidence: 'high' | 'medium' | 'low'
		stageAppropriate: boolean
		summary: string
		nextMilestone: string
	}
	disqualificationRisks: Array<{
		risk: string
		severity: 'high' | 'medium' | 'low'
		validationNeeded: string
	}>
}

// ============================================================================
// Input Types
// ============================================================================

export interface QualificationInput {
	methodology?: QualMethodology
	focusElements?: string[]
	includeDisqualificationAnalysis?: boolean
}

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * Build user message for qualification analysis.
 */
function buildUserMessage(context: OpportunityContext, body: QualificationInput): string {
	const contextStr = serializeContext(context)

	let message = `${contextStr}\n\n`

	message += `## Qualification Request\n\n`

	const methodology = body.methodology || 'MEDDIC'
	message += `**Methodology:** ${methodology}\n`

	if (body.focusElements && body.focusElements.length > 0) {
		message += `**Focus Elements:** ${body.focusElements.join(', ')}\n`
	}

	if (body.includeDisqualificationAnalysis) {
		message += `**Include Disqualification Analysis:** Yes\n`
	}

	message += `\nBased on the account context above, conduct a thorough ${methodology} qualification assessment that:\n`
	message += `1. Scores each ${methodology} element with evidence\n`
	message += `2. Identifies gaps with priority and discovery questions\n`
	message += `3. Highlights strengths and how to leverage them\n`
	message += `4. Provides actionable recommendations\n`
	message += `5. Gives an overall qualified/not-qualified assessment\n`
	message += `6. Flags disqualification risks\n\n`
	message += `Respond in JSON format matching the QualificationOutput schema.`

	return message
}

/**
 * Parse LLM output to QualificationOutput.
 */
function parseOutput(content: string): QualificationOutput {
	try {
		const parsed = cleanJsonParse<any>(content)

		return {
			methodology: validateMethodology(parsed.methodology),
			scores: extractScores(parsed.scores),
			gaps: extractGaps(parsed.gaps),
			strengths: extractStrengths(parsed.strengths),
			recommendations: extractRecommendations(parsed.recommendations),
			overallAssessment: extractOverallAssessment(parsed.overallAssessment),
			disqualificationRisks: extractDisqualificationRisks(parsed.disqualificationRisks || parsed.disqualification_risks),
		}
	} catch (err) {
		console.error('Failed to parse qualification output:', err)
		return {
			methodology: 'MEDDIC',
			scores: { overall: 0, elements: [] },
			gaps: [],
			strengths: [],
			recommendations: [],
			overallAssessment: {
				qualified: false,
				confidence: 'low',
				stageAppropriate: false,
				summary: 'Unable to complete qualification analysis',
				nextMilestone: 'Gather more information',
			},
			disqualificationRisks: [],
		}
	}
}

function validateMethodology(val: any): QualMethodology {
	if (val === 'MEDDIC' || val === 'BANT' || val === 'SPICED') return val
	return 'MEDDIC'
}

function extractScores(input: any): QualificationOutput['scores'] {
	if (!input) {
		return { overall: 0, elements: [] }
	}
	return {
		overall: Number(input.overall) || 0,
		elements: Array.isArray(input.elements) ? input.elements.map((e: any) => ({
			element: e.element || '',
			score: Number(e.score) || 0,
			maxScore: Number(e.maxScore) || 4,
			status: validateStatus(e.status),
			evidence: Array.isArray(e.evidence) ? e.evidence : [],
			notes: e.notes || '',
		})) : [],
	}
}

function validateStatus(val: any): 'strong' | 'partial' | 'weak' | 'unknown' {
	const valid = ['strong', 'partial', 'weak', 'unknown']
	if (valid.includes(val)) return val as any
	return 'unknown'
}

function extractGaps(input: any): QualificationOutput['gaps'] {
	if (!input || !Array.isArray(input)) return []
	return input.map((g: any) => ({
		element: g.element || '',
		gap: g.gap || '',
		priority: validatePriority(g.priority),
		suggestedAction: g.suggestedAction || '',
		questions: Array.isArray(g.questions) ? g.questions : [],
	}))
}

function validatePriority(val: any): 'critical' | 'high' | 'medium' | 'low' {
	const valid = ['critical', 'high', 'medium', 'low']
	if (valid.includes(val)) return val as any
	return 'medium'
}

function extractStrengths(input: any): QualificationOutput['strengths'] {
	if (!input || !Array.isArray(input)) return []
	return input.map((s: any) => ({
		element: s.element || '',
		strength: s.strength || '',
		leverage: s.leverage || '',
	}))
}

function extractRecommendations(input: any): QualificationOutput['recommendations'] {
	if (!input || !Array.isArray(input)) return []
	return input.map((r: any) => ({
		action: r.action || '',
		rationale: r.rationale || '',
		priority: validateLevel(r.priority),
	}))
}

function validateLevel(val: any): 'high' | 'medium' | 'low' {
	if (val === 'high' || val === 'medium' || val === 'low') return val
	return 'medium'
}

function extractOverallAssessment(input: any): QualificationOutput['overallAssessment'] {
	if (!input) {
		return {
			qualified: false,
			confidence: 'low',
			stageAppropriate: false,
			summary: '',
			nextMilestone: '',
		}
	}
	return {
		qualified: Boolean(input.qualified),
		confidence: validateLevel(input.confidence),
		stageAppropriate: Boolean(input.stageAppropriate || input.stage_appropriate),
		summary: input.summary || '',
		nextMilestone: input.nextMilestone || input.next_milestone || '',
	}
}

function extractDisqualificationRisks(input: any): QualificationOutput['disqualificationRisks'] {
	if (!input || !Array.isArray(input)) return []
	return input.map((r: any) => ({
		risk: r.risk || '',
		severity: validateLevel(r.severity),
		validationNeeded: r.validationNeeded || r.validation_needed || '',
	}))
}

/**
 * Create the Qualification agent.
 */
export function createQualificationAgent(): Agent<QualificationInput, QualificationOutput> {
	return makeSimpleLlmAgent<QualificationInput, QualificationOutput>({
		agentId: 'qualification',
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
 * Execute qualification analysis directly.
 */
export async function executeQualification(
	context: OpportunityContext,
	options?: QualificationInput
): Promise<AgentOutput<QualificationOutput>> {
	const agent = createQualificationAgent()
	return agent.execute({
		context,
		body: options || {},
	})
}

/**
 * Quick qualification with default methodology.
 */
export async function quickQualification(
	context: OpportunityContext,
	methodology?: QualMethodology
): Promise<QualificationOutput> {
	const result = await executeQualification(context, { methodology })
	if (!result.success) {
		throw new Error(result.error || 'Qualification analysis failed')
	}
	return result.data!
}

export default createQualificationAgent
