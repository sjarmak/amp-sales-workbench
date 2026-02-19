/**
 * Win Story Agent
 * 
 * Captures learnings from closed-won deals, extracts replicable patterns,
 * and creates compelling customer success stories for enablement and marketing.
 */

import type {
	AgentOutput,
	OpportunityContext,
} from '../agentTypes.js'
import { makeSimpleLlmAgent, serializeContext, type Agent, cleanJsonParse } from './baseAgent.js'

// ============================================================================
// Output Types
// ============================================================================

export interface WinStoryOutput {
	summary: {
		customer: string
		dealSize: string
		products: string[]
		salesCycle: string
		headline: string
	}
	keyDifferentiators: Array<{
		differentiator: string
		evidence: string
		customerQuote?: string
	}>
	winFactors: Array<{
		factor: string
		importance: 'critical' | 'important' | 'helpful'
		description: string
	}>
	timeline: Array<{
		milestone: string
		date: string
		significance: string
	}>
	customerQuotes: Array<{
		quote: string
		speaker: string
		context: string
		usableExternally: boolean
	}>
	championProfile: {
		title: string
		motivations: string[]
		howWeEnabled: string
	}
	competitiveInsights: {
		competitors: string[]
		ourAdvantages: string[]
		theirWeaknesses: string[]
	}
	lessonsLearned: Array<{
		lesson: string
		category: 'discovery' | 'demo' | 'negotiation' | 'technical' | 'relationship'
		applicability: string
	}>
	replicableActions: Array<{
		action: string
		when: string
		why: string
	}>
	caseStudyDraft: {
		challenge: string
		solution: string
		results: string
		quote: string
	}
}

// ============================================================================
// Input Types
// ============================================================================

export interface WinStoryInput {
	opportunityId?: string
}

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * Build user message for win story analysis.
 */
function buildUserMessage(context: OpportunityContext, body: WinStoryInput): string {
	const contextStr = serializeContext(context)

	let message = `${contextStr}\n\n`

	message += `## Win Story Request\n\n`

	if (body.opportunityId) {
		message += `### Opportunity ID\n`
		message += body.opportunityId
		message += '\n\n'
	}

	message += `Based on the account context above, analyze this closed-won deal to:\n`
	message += `1. Identify key differentiators and what set us apart\n`
	message += `2. Document the critical win factors and their importance\n`
	message += `3. Create a timeline of key milestones\n`
	message += `4. Capture customer quotes with proper attribution\n`
	message += `5. Profile the champion and their motivations\n`
	message += `6. Extract competitive insights\n`
	message += `7. Document lessons learned and replicable actions\n`
	message += `8. Draft a case study for marketing\n\n`
	message += `Respond in JSON format matching the WinStoryOutput schema.`

	return message
}

/**
 * Parse LLM output to WinStoryOutput.
 */
function parseOutput(content: string): WinStoryOutput {
	try {
		const parsed = cleanJsonParse<any>(content)

		return {
			summary: extractSummary(parsed.summary),
			keyDifferentiators: extractKeyDifferentiators(parsed.keyDifferentiators),
			winFactors: extractWinFactors(parsed.winFactors),
			timeline: extractTimeline(parsed.timeline),
			customerQuotes: extractCustomerQuotes(parsed.customerQuotes),
			championProfile: extractChampionProfile(parsed.championProfile),
			competitiveInsights: extractCompetitiveInsights(parsed.competitiveInsights),
			lessonsLearned: extractLessonsLearned(parsed.lessonsLearned),
			replicableActions: extractReplicableActions(parsed.replicableActions),
			caseStudyDraft: extractCaseStudyDraft(parsed.caseStudyDraft),
		}
	} catch (err) {
		console.error('Failed to parse win story output:', err)
		return getDefaultOutput()
	}
}

// ============================================================================
// Extraction Functions
// ============================================================================

function extractSummary(input: any): WinStoryOutput['summary'] {
	if (!input || typeof input !== 'object') {
		return {
			customer: '',
			dealSize: '',
			products: [],
			salesCycle: '',
			headline: '',
		}
	}

	return {
		customer: String(input.customer || ''),
		dealSize: String(input.dealSize || ''),
		products: Array.isArray(input.products) ? input.products.map(String) : [],
		salesCycle: String(input.salesCycle || ''),
		headline: String(input.headline || ''),
	}
}

function extractKeyDifferentiators(input: any): WinStoryOutput['keyDifferentiators'] {
	if (!Array.isArray(input)) return []

	return input.map((item: any) => ({
		differentiator: String(item.differentiator || ''),
		evidence: String(item.evidence || ''),
		customerQuote: item.customerQuote ? String(item.customerQuote) : undefined,
	}))
}

function extractWinFactors(input: any): WinStoryOutput['winFactors'] {
	if (!Array.isArray(input)) return []

	const validImportance = ['critical', 'important', 'helpful'] as const

	return input.map((item: any) => {
		const importance = String(item.importance || 'helpful').toLowerCase()
		return {
			factor: String(item.factor || ''),
			importance: validImportance.includes(importance as any)
				? (importance as 'critical' | 'important' | 'helpful')
				: 'helpful',
			description: String(item.description || ''),
		}
	})
}

function extractTimeline(input: any): WinStoryOutput['timeline'] {
	if (!Array.isArray(input)) return []

	return input.map((item: any) => ({
		milestone: String(item.milestone || ''),
		date: String(item.date || ''),
		significance: String(item.significance || ''),
	}))
}

function extractCustomerQuotes(input: any): WinStoryOutput['customerQuotes'] {
	if (!Array.isArray(input)) return []

	return input.map((item: any) => ({
		quote: String(item.quote || ''),
		speaker: String(item.speaker || ''),
		context: String(item.context || ''),
		usableExternally: Boolean(item.usableExternally),
	}))
}

function extractChampionProfile(input: any): WinStoryOutput['championProfile'] {
	if (!input || typeof input !== 'object') {
		return {
			title: '',
			motivations: [],
			howWeEnabled: '',
		}
	}

	return {
		title: String(input.title || ''),
		motivations: Array.isArray(input.motivations) ? input.motivations.map(String) : [],
		howWeEnabled: String(input.howWeEnabled || ''),
	}
}

function extractCompetitiveInsights(input: any): WinStoryOutput['competitiveInsights'] {
	if (!input || typeof input !== 'object') {
		return {
			competitors: [],
			ourAdvantages: [],
			theirWeaknesses: [],
		}
	}

	return {
		competitors: Array.isArray(input.competitors) ? input.competitors.map(String) : [],
		ourAdvantages: Array.isArray(input.ourAdvantages) ? input.ourAdvantages.map(String) : [],
		theirWeaknesses: Array.isArray(input.theirWeaknesses) ? input.theirWeaknesses.map(String) : [],
	}
}

function extractLessonsLearned(input: any): WinStoryOutput['lessonsLearned'] {
	if (!Array.isArray(input)) return []

	const validCategories = ['discovery', 'demo', 'negotiation', 'technical', 'relationship'] as const

	return input.map((item: any) => {
		const category = String(item.category || 'discovery').toLowerCase()
		return {
			lesson: String(item.lesson || ''),
			category: validCategories.includes(category as any)
				? (category as 'discovery' | 'demo' | 'negotiation' | 'technical' | 'relationship')
				: 'discovery',
			applicability: String(item.applicability || ''),
		}
	})
}

function extractReplicableActions(input: any): WinStoryOutput['replicableActions'] {
	if (!Array.isArray(input)) return []

	return input.map((item: any) => ({
		action: String(item.action || ''),
		when: String(item.when || ''),
		why: String(item.why || ''),
	}))
}

function extractCaseStudyDraft(input: any): WinStoryOutput['caseStudyDraft'] {
	if (!input || typeof input !== 'object') {
		return {
			challenge: '',
			solution: '',
			results: '',
			quote: '',
		}
	}

	return {
		challenge: String(input.challenge || ''),
		solution: String(input.solution || ''),
		results: String(input.results || ''),
		quote: String(input.quote || ''),
	}
}

function getDefaultOutput(): WinStoryOutput {
	return {
		summary: {
			customer: '',
			dealSize: '',
			products: [],
			salesCycle: '',
			headline: '',
		},
		keyDifferentiators: [],
		winFactors: [],
		timeline: [],
		customerQuotes: [],
		championProfile: {
			title: '',
			motivations: [],
			howWeEnabled: '',
		},
		competitiveInsights: {
			competitors: [],
			ourAdvantages: [],
			theirWeaknesses: [],
		},
		lessonsLearned: [],
		replicableActions: [],
		caseStudyDraft: {
			challenge: '',
			solution: '',
			results: '',
			quote: '',
		},
	}
}

// ============================================================================
// Agent Factory
// ============================================================================

/**
 * Create the Win Story agent.
 */
export function createWinStoryAgent(): Agent<WinStoryInput, WinStoryOutput> {
	return makeSimpleLlmAgent<WinStoryInput, WinStoryOutput>({
		agentId: 'win_story',
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
 * Execute win story analysis directly without going through the registry.
 */
export async function executeWinStory(
	context: OpportunityContext,
	options?: WinStoryInput
): Promise<AgentOutput<WinStoryOutput>> {
	const agent = createWinStoryAgent()
	return agent.execute({
		context,
		body: options || {},
	})
}

/**
 * Quick win story for simple cases.
 */
export async function quickWinStory(
	context: OpportunityContext,
	opportunityId?: string
): Promise<WinStoryOutput> {
	const result = await executeWinStory(context, { opportunityId })
	if (!result.success) {
		throw new Error(result.error || 'Win story analysis failed')
	}
	return result.data!
}

// Export the agent factory
export default createWinStoryAgent
