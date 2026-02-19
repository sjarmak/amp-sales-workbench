/**
 * Executive Summary Agent
 * 
 * Synthesizes complex deal information into a concise, actionable summary
 * for sales leadership to quickly understand account status.
 */

import type { AgentOutput, OpportunityContext } from '../agentTypes.js'
import { makeSimpleLlmAgent, serializeContext, type Agent, cleanJsonParse } from './baseAgent.js'

// ============================================================================
// Output Types
// ============================================================================

export interface ExecSummaryOverview {
	accountName: string
	opportunityName: string
	stage: string
	amount: string
	closeDate: string
	probability: number
	daysInStage: number
	lastActivity: string
}

export interface DealHealth {
	score: 'green' | 'yellow' | 'red'
	trend: 'improving' | 'stable' | 'declining'
	summary: string
}

export interface Risk {
	risk: string
	severity: 'high' | 'medium' | 'low'
	mitigation: string
}

export interface Opportunity {
	opportunity: string
	potential: 'high' | 'medium' | 'low'
	action: string
}

export interface Stakeholders {
	champion: string
	economicBuyer: string
	blockers: string[]
}

export interface CompetitivePosition {
	competitors: string[]
	ourPosition: 'winning' | 'competitive' | 'behind'
	keyBattleground: string
}

export interface Recommendation {
	action: string
	priority: 'immediate' | 'this_week' | 'this_month'
	owner: string
	rationale: string
}

export interface NextStep {
	step: string
	owner: string
	dueDate: string
}

export interface ExecSummaryOutput {
	overview: ExecSummaryOverview
	dealHealth: DealHealth
	keyHighlights: string[]
	risks: Risk[]
	opportunities: Opportunity[]
	stakeholders: Stakeholders
	competitivePosition: CompetitivePosition
	recommendations: Recommendation[]
	nextSteps: NextStep[]
	supportNeeded: string[]
}

// ============================================================================
// Input Types
// ============================================================================

export interface ExecSummaryInput {
	focusAreas?: string[]
}

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * Build user message for executive summary.
 */
function buildUserMessage(context: OpportunityContext, body: ExecSummaryInput): string {
	const contextStr = serializeContext(context)

	let message = `${contextStr}\n\n`

	message += `## Executive Summary Request\n\n`

	if (body.focusAreas && body.focusAreas.length > 0) {
		message += `### Focus Areas\n`
		message += body.focusAreas.map(a => `- ${a}`).join('\n')
		message += '\n\n'
	}

	message += `Based on the account context above, create an executive summary that:\n`
	message += `1. Provides a clear overview of the opportunity status\n`
	message += `2. Assesses deal health with a green/yellow/red score and trend\n`
	message += `3. Highlights the most important things to know\n`
	message += `4. Identifies risks with severity and mitigations\n`
	message += `5. Spots opportunities for acceleration\n`
	message += `6. Maps key stakeholders (champion, economic buyer, blockers)\n`
	message += `7. Summarizes competitive position\n`
	message += `8. Provides prioritized, actionable recommendations\n`
	message += `9. Lists concrete next steps with owners and dates\n`
	message += `10. Notes any executive or specialist support needed\n\n`
	message += `Respond in JSON format matching the ExecSummaryOutput schema.`

	return message
}

/**
 * Parse LLM output to ExecSummaryOutput.
 */
function parseOutput(content: string): ExecSummaryOutput {
	try {
		const parsed = cleanJsonParse<any>(content)

		return {
			overview: extractOverview(parsed.overview),
			dealHealth: extractDealHealth(parsed.dealHealth),
			keyHighlights: extractStringArray(parsed.keyHighlights),
			risks: extractRisks(parsed.risks),
			opportunities: extractOpportunities(parsed.opportunities),
			stakeholders: extractStakeholders(parsed.stakeholders),
			competitivePosition: extractCompetitivePosition(parsed.competitivePosition),
			recommendations: extractRecommendations(parsed.recommendations),
			nextSteps: extractNextSteps(parsed.nextSteps),
			supportNeeded: extractStringArray(parsed.supportNeeded),
		}
	} catch (err) {
		console.error('Failed to parse exec summary output:', err)
		return getDefaultOutput()
	}
}

/**
 * Extract overview with defaults.
 */
function extractOverview(input: any): ExecSummaryOverview {
	if (!input || typeof input !== 'object') {
		return getDefaultOverview()
	}

	return {
		accountName: String(input.accountName || 'Unknown'),
		opportunityName: String(input.opportunityName || 'Unknown'),
		stage: String(input.stage || 'Unknown'),
		amount: String(input.amount || '$0'),
		closeDate: String(input.closeDate || 'TBD'),
		probability: typeof input.probability === 'number' ? input.probability : 0,
		daysInStage: typeof input.daysInStage === 'number' ? input.daysInStage : 0,
		lastActivity: String(input.lastActivity || 'Unknown'),
	}
}

function getDefaultOverview(): ExecSummaryOverview {
	return {
		accountName: 'Unknown',
		opportunityName: 'Unknown',
		stage: 'Unknown',
		amount: '$0',
		closeDate: 'TBD',
		probability: 0,
		daysInStage: 0,
		lastActivity: 'Unknown',
	}
}

/**
 * Extract deal health with defaults.
 */
function extractDealHealth(input: any): DealHealth {
	if (!input || typeof input !== 'object') {
		return getDefaultDealHealth()
	}

	const validScores = ['green', 'yellow', 'red'] as const
	const validTrends = ['improving', 'stable', 'declining'] as const

	const score = validScores.includes(input.score) ? input.score : 'yellow'
	const trend = validTrends.includes(input.trend) ? input.trend : 'stable'

	return {
		score,
		trend,
		summary: String(input.summary || 'No summary available'),
	}
}

function getDefaultDealHealth(): DealHealth {
	return {
		score: 'yellow',
		trend: 'stable',
		summary: 'No summary available',
	}
}

/**
 * Extract string array with defaults.
 */
function extractStringArray(input: any): string[] {
	if (!Array.isArray(input)) return []
	return input.filter((item): item is string => typeof item === 'string')
}

/**
 * Extract risks with defaults.
 */
function extractRisks(input: any): Risk[] {
	if (!Array.isArray(input)) return []

	const validSeverities = ['high', 'medium', 'low'] as const

	return input.map((item: any) => {
		if (!item || typeof item !== 'object') {
			return { risk: 'Unknown', severity: 'medium' as const, mitigation: 'TBD' }
		}

		const severity = validSeverities.includes(item.severity) ? item.severity : 'medium'

		return {
			risk: String(item.risk || 'Unknown'),
			severity,
			mitigation: String(item.mitigation || 'TBD'),
		}
	})
}

/**
 * Extract opportunities with defaults.
 */
function extractOpportunities(input: any): Opportunity[] {
	if (!Array.isArray(input)) return []

	const validPotentials = ['high', 'medium', 'low'] as const

	return input.map((item: any) => {
		if (!item || typeof item !== 'object') {
			return { opportunity: 'Unknown', potential: 'medium' as const, action: 'TBD' }
		}

		const potential = validPotentials.includes(item.potential) ? item.potential : 'medium'

		return {
			opportunity: String(item.opportunity || 'Unknown'),
			potential,
			action: String(item.action || 'TBD'),
		}
	})
}

/**
 * Extract stakeholders with defaults.
 */
function extractStakeholders(input: any): Stakeholders {
	if (!input || typeof input !== 'object') {
		return getDefaultStakeholders()
	}

	return {
		champion: String(input.champion || 'Not identified'),
		economicBuyer: String(input.economicBuyer || 'Not identified'),
		blockers: extractStringArray(input.blockers),
	}
}

function getDefaultStakeholders(): Stakeholders {
	return {
		champion: 'Not identified',
		economicBuyer: 'Not identified',
		blockers: [],
	}
}

/**
 * Extract competitive position with defaults.
 */
function extractCompetitivePosition(input: any): CompetitivePosition {
	if (!input || typeof input !== 'object') {
		return getDefaultCompetitivePosition()
	}

	const validPositions = ['winning', 'competitive', 'behind'] as const
	const ourPosition = validPositions.includes(input.ourPosition) ? input.ourPosition : 'competitive'

	return {
		competitors: extractStringArray(input.competitors),
		ourPosition,
		keyBattleground: String(input.keyBattleground || 'Unknown'),
	}
}

function getDefaultCompetitivePosition(): CompetitivePosition {
	return {
		competitors: [],
		ourPosition: 'competitive',
		keyBattleground: 'Unknown',
	}
}

/**
 * Extract recommendations with defaults.
 */
function extractRecommendations(input: any): Recommendation[] {
	if (!Array.isArray(input)) return []

	const validPriorities = ['immediate', 'this_week', 'this_month'] as const

	return input.map((item: any) => {
		if (!item || typeof item !== 'object') {
			return {
				action: 'Unknown',
				priority: 'this_week' as const,
				owner: 'TBD',
				rationale: 'TBD',
			}
		}

		const priority = validPriorities.includes(item.priority) ? item.priority : 'this_week'

		return {
			action: String(item.action || 'Unknown'),
			priority,
			owner: String(item.owner || 'TBD'),
			rationale: String(item.rationale || 'TBD'),
		}
	})
}

/**
 * Extract next steps with defaults.
 */
function extractNextSteps(input: any): NextStep[] {
	if (!Array.isArray(input)) return []

	return input.map((item: any) => {
		if (!item || typeof item !== 'object') {
			return { step: 'Unknown', owner: 'TBD', dueDate: 'TBD' }
		}

		return {
			step: String(item.step || 'Unknown'),
			owner: String(item.owner || 'TBD'),
			dueDate: String(item.dueDate || 'TBD'),
		}
	})
}

/**
 * Get default output for error cases.
 */
function getDefaultOutput(): ExecSummaryOutput {
	return {
		overview: getDefaultOverview(),
		dealHealth: getDefaultDealHealth(),
		keyHighlights: [],
		risks: [],
		opportunities: [],
		stakeholders: getDefaultStakeholders(),
		competitivePosition: getDefaultCompetitivePosition(),
		recommendations: [],
		nextSteps: [],
		supportNeeded: [],
	}
}

/**
 * Create the Executive Summary agent.
 */
export function createExecSummaryAgent(): Agent<ExecSummaryInput, ExecSummaryOutput> {
	return makeSimpleLlmAgent<ExecSummaryInput, ExecSummaryOutput>({
		agentId: 'exec_summary',
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
 * Execute executive summary directly without going through the registry.
 */
export async function executeExecSummary(
	context: OpportunityContext,
	options?: ExecSummaryInput
): Promise<AgentOutput<ExecSummaryOutput>> {
	const agent = createExecSummaryAgent()
	return agent.execute({
		context,
		body: options || {},
	})
}

/**
 * Quick executive summary for simple cases.
 */
export async function quickExecSummary(
	context: OpportunityContext,
	focusAreas?: string[]
): Promise<ExecSummaryOutput> {
	const result = await executeExecSummary(context, { focusAreas })
	if (!result.success) {
		throw new Error(result.error || 'Executive summary failed')
	}
	return result.data!
}

// Export the agent factory
export default createExecSummaryAgent
