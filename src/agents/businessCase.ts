/**
 * Business Case Agent
 * 
 * Generates ROI justification and business case documentation.
 * Translates technical benefits into financial impact and executive-ready narratives.
 */

import type {
	AgentOutput,
	OpportunityContext,
	BusinessCaseOutput,
} from '../agentTypes.js'
import { makeSimpleLlmAgent, serializeContext, type Agent, cleanJsonParse } from './baseAgent.js'

// ============================================================================
// Input Types
// ============================================================================

export interface BusinessCaseInput {
	developerCount?: number
	avgSalary?: number
	targetProducts?: string[]
	existingTools?: string[]
	securityPriority?: 'low' | 'medium' | 'high'
}

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * Build user message for business case generation.
 */
function buildUserMessage(context: OpportunityContext, body: BusinessCaseInput): string {
	const contextStr = serializeContext(context)

	let message = `${contextStr}\n\n`

	message += `## Business Case Request\n\n`

	if (body.developerCount) {
		message += `**Developer Count:** ${body.developerCount}\n`
	}

	if (body.avgSalary) {
		message += `**Average Fully-Loaded Developer Salary:** $${body.avgSalary.toLocaleString()}/year\n`
	}

	if (body.targetProducts && body.targetProducts.length > 0) {
		message += `**Target Products:** ${body.targetProducts.join(', ')}\n`
	}

	if (body.existingTools && body.existingTools.length > 0) {
		message += `**Existing Tools to Replace/Augment:** ${body.existingTools.join(', ')}\n`
	}

	if (body.securityPriority) {
		message += `**Security Priority:** ${body.securityPriority}\n`
	}

	message += `\nBased on the account context and any provided parameters, build a comprehensive business case that:\n`
	message += `1. Summarizes the current state and associated costs\n`
	message += `2. Proposes the Sourcegraph solution with key capabilities\n`
	message += `3. Calculates ROI with hard savings and soft benefits\n`
	message += `4. Identifies risks and mitigations\n`
	message += `5. Provides implementation timeline and investment summary\n\n`
	message += `Respond in JSON format matching the BusinessCaseOutput schema.`

	return message
}

/**
 * Parse LLM output to BusinessCaseOutput.
 */
function parseOutput(content: string): BusinessCaseOutput {
	try {
		const parsed = cleanJsonParse<any>(content)

		// Extract executive summary
		const executiveSummary = parsed.executiveSummary || ''

		// Extract current state - flatten complex objects to string
		const currentState = extractCurrentState(parsed.currentState)

		// Extract proposed solution
		const proposedSolution = extractProposedSolution(parsed.proposedSolution)

		// Extract ROI
		const roi = extractRoi(parsed.roi)

		// Extract risks
		const risks = extractRisks(parsed.risks)

		// Extract timeline
		const timeline = extractTimeline(parsed.timeline)

		// Extract investment
		const investment = extractInvestment(parsed.investment)

		return {
			executiveSummary,
			currentState,
			proposedSolution,
			roi,
			risks,
			timeline,
			investment,
		}
	} catch (err) {
		console.error('Failed to parse business case output:', err)
		return {
			executiveSummary: 'Failed to generate business case',
			currentState: '',
			proposedSolution: '',
			roi: { hardSavings: [], softBenefits: [] },
			risks: [],
			timeline: '',
			investment: '',
		}
	}
}

/**
 * Extract current state from various formats.
 */
function extractCurrentState(input: any): string {
	if (!input) return ''
	if (typeof input === 'string') return input

	const parts: string[] = []
	if (input.challenges?.length) {
		parts.push(`**Challenges:** ${input.challenges.join('; ')}`)
	}
	if (input.costs) {
		const costs = Object.entries(input.costs)
			.map(([k, v]) => `${k}: ${v}`)
			.join(', ')
		parts.push(`**Costs:** ${costs}`)
	}
	if (input.risks?.length) {
		parts.push(`**Risks:** ${input.risks.join('; ')}`)
	}
	return parts.join('\n')
}

/**
 * Extract proposed solution from various formats.
 */
function extractProposedSolution(input: any): string {
	if (!input) return ''
	if (typeof input === 'string') return input

	const parts: string[] = []
	if (input.overview) {
		parts.push(input.overview)
	}
	if (input.capabilities?.length) {
		parts.push(`**Capabilities:** ${input.capabilities.join(', ')}`)
	}
	if (input.differentiators?.length) {
		parts.push(`**Differentiators:** ${input.differentiators.join(', ')}`)
	}
	return parts.join('\n')
}

/**
 * Extract ROI from various formats.
 */
function extractRoi(input: any): BusinessCaseOutput['roi'] {
	if (!input) {
		return { hardSavings: [], softBenefits: [] }
	}

	const hardSavings: string[] = []
	const softBenefits: string[] = []

	// Extract hard savings
	if (input.hardSavings) {
		if (Array.isArray(input.hardSavings)) {
			hardSavings.push(...input.hardSavings.map(String))
		} else if (typeof input.hardSavings === 'object') {
			Object.entries(input.hardSavings).forEach(([category, data]: [string, any]) => {
				if (typeof data === 'object' && data.annual) {
					hardSavings.push(`${category}: ${data.annual}${data.calculation ? ` (${data.calculation})` : ''}`)
				} else {
					hardSavings.push(`${category}: ${data}`)
				}
			})
		}
	}

	// Extract soft benefits
	if (input.softBenefits) {
		if (Array.isArray(input.softBenefits)) {
			softBenefits.push(...input.softBenefits.map(String))
		}
	}

	// Extract payback period
	const paybackPeriod = input.paybackPeriod || input.totalAnnualValue
		? `Total Annual Value: ${input.totalAnnualValue || 'TBD'}, Payback: ${input.paybackPeriod || 'TBD'}`
		: undefined

	return { hardSavings, softBenefits, paybackPeriod }
}

/**
 * Extract risks from various formats.
 */
function extractRisks(input: any): Array<{ risk: string; mitigation: string }> {
	if (!input) return []
	if (!Array.isArray(input)) return []

	return input.map((r: any) => ({
		risk: r.risk || r.description || String(r),
		mitigation: r.mitigation || r.response || '',
	}))
}

/**
 * Extract timeline from various formats.
 */
function extractTimeline(input: any): string {
	if (!input) return ''
	if (typeof input === 'string') return input

	const parts: string[] = []
	if (input.implementation) parts.push(`Implementation: ${input.implementation}`)
	if (input.timeToValue) parts.push(`Time to Value: ${input.timeToValue}`)
	if (input.fullRollout) parts.push(`Full Rollout: ${input.fullRollout}`)
	return parts.join(', ')
}

/**
 * Extract investment from various formats.
 */
function extractInvestment(input: any): string {
	if (!input) return ''
	if (typeof input === 'string') return input

	const parts: string[] = []
	if (input.software) parts.push(`Software: ${input.software}`)
	if (input.implementation) parts.push(`Implementation: ${input.implementation}`)
	if (input.totalFirstYear) parts.push(`Total First Year: ${input.totalFirstYear}`)
	return parts.join(', ')
}

/**
 * Create the Business Case agent.
 */
export function createBusinessCaseAgent(): Agent<BusinessCaseInput, BusinessCaseOutput> {
	return makeSimpleLlmAgent<BusinessCaseInput, BusinessCaseOutput>({
		agentId: 'business_case',
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
 * Execute business case generation directly.
 */
export async function executeBusinessCase(
	context: OpportunityContext,
	options?: BusinessCaseInput
): Promise<AgentOutput<BusinessCaseOutput>> {
	const agent = createBusinessCaseAgent()
	return agent.execute({
		context,
		body: options || {},
	})
}

/**
 * Quick business case for simple cases.
 */
export async function quickBusinessCase(
	context: OpportunityContext,
	developerCount?: number
): Promise<BusinessCaseOutput> {
	const result = await executeBusinessCase(context, { developerCount })
	if (!result.success) {
		throw new Error(result.error || 'Business case generation failed')
	}
	return result.data!
}

// Export the agent factory
export default createBusinessCaseAgent
