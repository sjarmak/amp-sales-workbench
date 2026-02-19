/**
 * Evaluation Criteria Agent
 * 
 * Defines success criteria and scoring rubrics for Sourcegraph evaluations and POCs.
 * Creates fair, measurable criteria aligned with customer priorities.
 */

import type {
	AgentOutput,
	OpportunityContext,
	ProductId,
} from '../agentTypes.js'
import { makeSimpleLlmAgent, serializeContext, type Agent, cleanJsonParse } from './baseAgent.js'

// ============================================================================
// Output Types
// ============================================================================

export interface EvaluationCriteriaOutput {
	criteria: Array<{
		category: string
		requirement: string
		weight: number
		measureMethod: string
		sourcegraphCapability: string
		notes?: string
	}>
	scoringRubric: {
		scale: string
		definitions: Record<string, string>
	}
	mustHave: string[]
	niceToHave: string[]
	dealBreakers: string[]
	evaluationProcess: {
		phases: string[]
		stakeholders: string[]
		timeline: string
	}
}

// ============================================================================
// Input Types
// ============================================================================

export interface EvaluationCriteriaInput {
	products?: ProductId[]
	focusAreas?: string[]
	mustHaveFeatures?: string[]
	competitors?: string[]
	evaluationType?: 'poc' | 'technical_review' | 'rfp'
}

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * Build user message for evaluation criteria generation.
 */
function buildUserMessage(context: OpportunityContext, body: EvaluationCriteriaInput): string {
	const contextStr = serializeContext(context)

	let message = `${contextStr}\n\n`

	message += `## Evaluation Criteria Request\n\n`

	if (body.products && body.products.length > 0) {
		message += `**Products to Evaluate:** ${body.products.join(', ')}\n`
	}

	if (body.focusAreas && body.focusAreas.length > 0) {
		message += `**Focus Areas:** ${body.focusAreas.join(', ')}\n`
	}

	if (body.mustHaveFeatures && body.mustHaveFeatures.length > 0) {
		message += `**Must-Have Features:** ${body.mustHaveFeatures.join(', ')}\n`
	}

	if (body.competitors && body.competitors.length > 0) {
		message += `**Competitors in Evaluation:** ${body.competitors.join(', ')}\n`
	}

	if (body.evaluationType) {
		message += `**Evaluation Type:** ${body.evaluationType.toUpperCase()}\n`
	}

	message += `\nBased on the account context and evaluation parameters, create a comprehensive evaluation framework that:\n`
	message += `1. Defines weighted criteria across functionality, performance, security, and usability\n`
	message += `2. Provides a clear scoring rubric with definitions\n`
	message += `3. Separates must-have vs nice-to-have requirements\n`
	message += `4. Identifies deal-breakers\n`
	message += `5. Outlines the evaluation process with phases and stakeholders\n\n`
	message += `Respond in JSON format matching the EvaluationCriteriaOutput schema.`

	return message
}

/**
 * Parse LLM output to EvaluationCriteriaOutput.
 */
function parseOutput(content: string): EvaluationCriteriaOutput {
	try {
		const parsed = cleanJsonParse<any>(content)

		// Extract criteria
		const criteria = extractCriteria(parsed.criteria)

		// Extract scoring rubric
		const scoringRubric = extractScoringRubric(parsed.scoringRubric)

		// Extract lists
		const mustHave = extractStringArray(parsed.mustHave)
		const niceToHave = extractStringArray(parsed.niceToHave)
		const dealBreakers = extractStringArray(parsed.dealBreakers)

		// Extract evaluation process
		const evaluationProcess = extractEvaluationProcess(parsed.evaluationProcess)

		return {
			criteria,
			scoringRubric,
			mustHave,
			niceToHave,
			dealBreakers,
			evaluationProcess,
		}
	} catch (err) {
		console.error('Failed to parse evaluation criteria output:', err)
		return {
			criteria: [],
			scoringRubric: { scale: '1-5', definitions: {} },
			mustHave: [],
			niceToHave: [],
			dealBreakers: [],
			evaluationProcess: { phases: [], stakeholders: [], timeline: '' },
		}
	}
}

/**
 * Extract criteria from parsed JSON.
 */
function extractCriteria(input: any): EvaluationCriteriaOutput['criteria'] {
	if (!input || !Array.isArray(input)) return []

	return input.map((c: any) => ({
		category: c.category || 'General',
		requirement: c.requirement || '',
		weight: typeof c.weight === 'number' ? c.weight : 3,
		measureMethod: c.measureMethod || '',
		sourcegraphCapability: c.sourcegraphCapability || '',
		notes: c.notes,
	}))
}

/**
 * Extract scoring rubric.
 */
function extractScoringRubric(input: any): EvaluationCriteriaOutput['scoringRubric'] {
	if (!input) {
		return {
			scale: '1-5',
			definitions: {
				'5': 'Exceeds requirements',
				'4': 'Fully meets requirements',
				'3': 'Partially meets requirements',
				'2': 'Minimally meets requirements',
				'1': 'Does not meet requirements',
			},
		}
	}

	return {
		scale: input.scale || '1-5',
		definitions: input.definitions || {},
	}
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
 * Extract evaluation process.
 */
function extractEvaluationProcess(input: any): EvaluationCriteriaOutput['evaluationProcess'] {
	if (!input) {
		return { phases: [], stakeholders: [], timeline: '' }
	}

	return {
		phases: extractStringArray(input.phases),
		stakeholders: extractStringArray(input.stakeholders),
		timeline: input.timeline || '',
	}
}

/**
 * Create the Evaluation Criteria agent.
 */
export function createEvaluationCriteriaAgent(): Agent<EvaluationCriteriaInput, EvaluationCriteriaOutput> {
	return makeSimpleLlmAgent<EvaluationCriteriaInput, EvaluationCriteriaOutput>({
		agentId: 'evaluation_criteria',
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
 * Execute evaluation criteria generation directly.
 */
export async function executeEvaluationCriteria(
	context: OpportunityContext,
	options?: EvaluationCriteriaInput
): Promise<AgentOutput<EvaluationCriteriaOutput>> {
	const agent = createEvaluationCriteriaAgent()
	return agent.execute({
		context,
		body: options || {},
	})
}

/**
 * Quick evaluation criteria for simple cases.
 */
export async function quickEvaluationCriteria(
	context: OpportunityContext,
	products?: ProductId[]
): Promise<EvaluationCriteriaOutput> {
	const result = await executeEvaluationCriteria(context, { products })
	if (!result.success) {
		throw new Error(result.error || 'Evaluation criteria generation failed')
	}
	return result.data!
}

// Export the agent factory
export default createEvaluationCriteriaAgent
