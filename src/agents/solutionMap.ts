/**
 * Solution Map Agent
 * 
 * Maps customer pain points to Sourcegraph products and capabilities.
 * Designed for the Solution Mapping lifecycle stage to create comprehensive
 * value alignment between customer needs and product features.
 */

import type {
	AgentOutput,
	OpportunityContext,
	SolutionMapOutput,
	ProductId,
} from '../agentTypes.js'
import { makeSimpleLlmAgent, serializeContext, type Agent, cleanJsonParse } from './baseAgent.js'

// ============================================================================
// Input Types
// ============================================================================

export interface SolutionMapInput {
	products?: ProductId[]
	focusAreas?: string[]
	competitorContext?: string
}

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * Build user message for solution mapping.
 */
function buildUserMessage(context: OpportunityContext, body: SolutionMapInput): string {
	const contextStr = serializeContext(context)

	let message = `${contextStr}\n\n`

	message += `## Solution Mapping Request\n\n`

	if (body.products && body.products.length > 0) {
		message += `### Products to Focus On\n`
		message += body.products.map(p => `- ${p}`).join('\n')
		message += '\n\n'
	}

	if (body.focusAreas && body.focusAreas.length > 0) {
		message += `### Focus Areas\n`
		message += body.focusAreas.map(a => `- ${a}`).join('\n')
		message += '\n\n'
	}

	if (body.competitorContext) {
		message += `### Competitive Context\n`
		message += body.competitorContext
		message += '\n\n'
	}

	message += `Based on the account context above, create a comprehensive solution map that:\n`
	message += `1. Maps each identified pain point to specific Sourcegraph products and capabilities\n`
	message += `2. Identifies integration requirements with their existing toolchain\n`
	message += `3. Documents technical requirements for deployment\n`
	message += `4. Provides competitive positioning guidance\n\n`
	message += `Respond in JSON format matching the SolutionMapOutput schema.`

	return message
}

/**
 * Parse LLM output to SolutionMapOutput.
 */
function parseOutput(content: string): SolutionMapOutput {
	try {
		const parsed = cleanJsonParse<any>(content)
		
		// Normalize products array - convert string product names to ProductId
		const painToProductMap = (parsed.painToProductMap || []).map((item: any) => ({
			pain: item.pain || '',
			products: normalizeProducts(item.products || []),
			capabilities: Array.isArray(item.capabilities) ? item.capabilities : [],
			value: item.value || '',
		}))

		// Extract integration requirements as string array
		const integrationRequirements = extractIntegrationRequirements(parsed.integrationRequirements)
		
		// Extract technical requirements as string array
		const technicalRequirements = extractTechnicalRequirements(parsed.technicalRequirements)

		// Get competitive positioning as string
		const competitivePositioning = extractCompetitivePositioning(parsed.competitivePositioning)

		return {
			painToProductMap,
			integrationRequirements,
			technicalRequirements,
			competitivePositioning,
		}
	} catch (err) {
		console.error('Failed to parse solution map output:', err)
		return {
			painToProductMap: [],
			integrationRequirements: [],
			technicalRequirements: [],
		}
	}
}

/**
 * Normalize product names to ProductId values.
 */
function normalizeProducts(products: any[]): ProductId[] {
	const productMap: Record<string, ProductId> = {
		'code search': 'code_search',
		'code_search': 'code_search',
		'search': 'code_search',
		'batch changes': 'batch_changes',
		'batch_changes': 'batch_changes',
		'campaigns': 'batch_changes',
		'code insights': 'code_insights',
		'code_insights': 'code_insights',
		'insights': 'code_insights',
		'deep search': 'deep_search',
		'deep_search': 'deep_search',
		'cody': 'deep_search',
		'ai': 'deep_search',
	}

	return products
		.map((p: any) => {
			const normalized = String(p).toLowerCase().trim()
			return productMap[normalized]
		})
		.filter((p): p is ProductId => p !== undefined)
}

/**
 * Extract integration requirements from various formats.
 */
function extractIntegrationRequirements(input: any): string[] {
	if (!input) return []
	
	if (Array.isArray(input)) {
		return input.map((item: any) => {
			if (typeof item === 'string') return item
			if (item.system && item.requirement) {
				return `${item.system}: ${item.requirement}${item.complexity ? ` (${item.complexity})` : ''}`
			}
			return String(item)
		})
	}
	
	if (typeof input === 'object') {
		return Object.entries(input).map(([key, val]) => `${key}: ${val}`)
	}
	
	return [String(input)]
}

/**
 * Extract technical requirements from various formats.
 */
function extractTechnicalRequirements(input: any): string[] {
	if (!input) return []
	
	if (Array.isArray(input)) {
		return input.map(String)
	}
	
	if (typeof input === 'object') {
		const reqs: string[] = []
		if (input.deployment) reqs.push(`Deployment: ${input.deployment}`)
		if (input.scale) reqs.push(`Scale: ${input.scale}`)
		if (input.security) {
			const security = Array.isArray(input.security) ? input.security.join(', ') : input.security
			reqs.push(`Security: ${security}`)
		}
		// Add any other fields
		Object.entries(input).forEach(([key, val]) => {
			if (!['deployment', 'scale', 'security'].includes(key)) {
				reqs.push(`${key}: ${val}`)
			}
		})
		return reqs
	}
	
	return [String(input)]
}

/**
 * Extract competitive positioning as a single string.
 */
function extractCompetitivePositioning(input: any): string | undefined {
	if (!input) return undefined
	
	if (typeof input === 'string') return input
	
	if (typeof input === 'object') {
		const parts: string[] = []
		if (input.differentiators?.length) {
			parts.push(`Differentiators: ${input.differentiators.join(', ')}`)
		}
		if (input.battleCards?.length) {
			parts.push(`Key Points: ${input.battleCards.join('; ')}`)
		}
		if (input.weaknesses?.length) {
			parts.push(`Caution Areas: ${input.weaknesses.join(', ')}`)
		}
		return parts.join('\n')
	}
	
	return String(input)
}

/**
 * Create the Solution Map agent.
 */
export function createSolutionMapAgent(): Agent<SolutionMapInput, SolutionMapOutput> {
	return makeSimpleLlmAgent<SolutionMapInput, SolutionMapOutput>({
		agentId: 'solution_map',
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
 * Execute solution mapping directly without going through the registry.
 */
export async function executeSolutionMap(
	context: OpportunityContext,
	options?: SolutionMapInput
): Promise<AgentOutput<SolutionMapOutput>> {
	const agent = createSolutionMapAgent()
	return agent.execute({
		context,
		body: options || {},
	})
}

/**
 * Quick solution map for simple cases.
 */
export async function quickSolutionMap(
	context: OpportunityContext,
	products?: ProductId[]
): Promise<SolutionMapOutput> {
	const result = await executeSolutionMap(context, { products })
	if (!result.success) {
		throw new Error(result.error || 'Solution mapping failed')
	}
	return result.data!
}

// Export the agent factory
export default createSolutionMapAgent
