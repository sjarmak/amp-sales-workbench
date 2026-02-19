/**
 * Risk Heuristics Agent
 * 
 * Applies proven risk heuristics to detect warning signs in deals.
 * Analyzes engagement, process, competitive, qualification, and technical risks
 * to help sales teams identify potential problems early.
 */

import type {
	AgentOutput,
	OpportunityContext,
} from '../agentTypes.js'
import type { AccountKey } from '../types.js'
import { makeSimpleLlmAgent, serializeContext, type Agent, cleanJsonParse } from './baseAgent.js'
import { buildOpportunityContext } from '../context/buildOpportunityContext.js'

function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
}

// ============================================================================
// Output Types
// ============================================================================

export interface RiskScore {
	overall: number
	trend: 'increasing' | 'stable' | 'decreasing'
	category: 'low' | 'moderate' | 'elevated' | 'high' | 'critical'
}

export interface RiskEvidence {
	indicator: string
	source: string
	date?: string
}

export interface RiskMitigation {
	action: string
	urgency: 'immediate' | 'this_week' | 'this_month'
	owner?: string
}

export interface RiskItem {
	type: 'engagement' | 'process' | 'competitive' | 'qualification' | 'technical'
	risk: string
	severity: 'critical' | 'high' | 'medium' | 'low'
	confidence: 'high' | 'medium' | 'low'
	evidence: RiskEvidence[]
	heuristic: string
	mitigation: RiskMitigation
}

export interface PositiveSignal {
	signal: string
	evidence: string
	strength: 'strong' | 'moderate' | 'weak'
}

export interface WatchItem {
	item: string
	trigger: string
	checkDate?: string
}

export interface Recommendation {
	priority: number
	action: string
	rationale: string
	expectedOutcome: string
}

export interface RiskHeuristicsOutput {
	riskScore: RiskScore
	risks: RiskItem[]
	positiveSignals: PositiveSignal[]
	watchList: WatchItem[]
	recommendations: Recommendation[]
	dealHealthSummary: string
}

// ============================================================================
// Input Types
// ============================================================================

export interface RiskHeuristicsInput {
	focusAreas?: ('engagement' | 'process' | 'competitive' | 'qualification' | 'technical')[]
}

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * Build user message for risk heuristics analysis.
 */
function buildUserMessage(context: OpportunityContext, body: RiskHeuristicsInput): string {
	const contextStr = serializeContext(context)

	let message = `${contextStr}\n\n`

	message += `## Risk Analysis Request\n\n`

	if (body.focusAreas && body.focusAreas.length > 0) {
		message += `### Focus Areas\n`
		message += `Please prioritize analysis on the following risk categories:\n`
		message += body.focusAreas.map(a => `- ${a}`).join('\n')
		message += '\n\n'
	}

	message += `Based on the account context above, perform a comprehensive risk analysis that:\n`
	message += `1. Applies risk heuristics systematically across all categories\n`
	message += `2. Identifies both red flags and yellow flags with supporting evidence\n`
	message += `3. Provides specific, actionable mitigations for each risk\n`
	message += `4. Balances risk identification with positive signals\n`
	message += `5. Considers stage-appropriate expectations\n\n`
	message += `Respond in JSON format matching the RiskHeuristicsOutput schema.`

	return message
}

/**
 * Parse LLM output to RiskHeuristicsOutput.
 */
function parseOutput(content: string): RiskHeuristicsOutput {
	try {
		const parsed = cleanJsonParse<any>(content)

		return {
			riskScore: extractRiskScore(parsed.riskScore),
			risks: extractRisks(parsed.risks),
			positiveSignals: extractPositiveSignals(parsed.positiveSignals),
			watchList: extractWatchList(parsed.watchList),
			recommendations: extractRecommendations(parsed.recommendations),
			dealHealthSummary: extractDealHealthSummary(parsed.dealHealthSummary),
		}
	} catch (err) {
		console.error('Failed to parse risk heuristics output:', err)
		return {
			riskScore: { overall: 50, trend: 'stable', category: 'moderate' },
			risks: [],
			positiveSignals: [],
			watchList: [],
			recommendations: [],
			dealHealthSummary: 'Unable to parse risk analysis output.',
		}
	}
}

/**
 * Extract and normalize risk score.
 */
function extractRiskScore(input: any): RiskScore {
	if (!input || typeof input !== 'object') {
		return { overall: 50, trend: 'stable', category: 'moderate' }
	}

	const overall = typeof input.overall === 'number' ? Math.min(100, Math.max(0, input.overall)) : 50
	
	const validTrends = ['increasing', 'stable', 'decreasing']
	const trend = validTrends.includes(input.trend) ? input.trend : 'stable'
	
	const validCategories = ['low', 'moderate', 'elevated', 'high', 'critical']
	const category = validCategories.includes(input.category) ? input.category : 'moderate'

	return { overall, trend, category }
}

/**
 * Extract and normalize risks array.
 */
function extractRisks(input: any): RiskItem[] {
	if (!Array.isArray(input)) return []

	const validTypes = ['engagement', 'process', 'competitive', 'qualification', 'technical']
	const validSeverities = ['critical', 'high', 'medium', 'low']
	const validConfidences = ['high', 'medium', 'low']

	return input.map((item: any) => ({
		type: validTypes.includes(item.type) ? item.type : 'process',
		risk: String(item.risk || ''),
		severity: validSeverities.includes(item.severity) ? item.severity : 'medium',
		confidence: validConfidences.includes(item.confidence) ? item.confidence : 'medium',
		evidence: extractEvidence(item.evidence),
		heuristic: String(item.heuristic || ''),
		mitigation: extractMitigation(item.mitigation),
	})).filter((r: RiskItem) => r.risk.length > 0)
}

/**
 * Extract evidence array from various formats.
 */
function extractEvidence(input: any): RiskEvidence[] {
	if (!input) return []

	if (Array.isArray(input)) {
		return input.map((e: any) => {
			if (typeof e === 'string') {
				return { indicator: e, source: 'unknown' }
			}
			return {
				indicator: String(e.indicator || ''),
				source: String(e.source || 'unknown'),
				date: e.date ? String(e.date) : undefined,
			}
		}).filter((e: RiskEvidence) => e.indicator.length > 0)
	}

	if (typeof input === 'string') {
		return [{ indicator: input, source: 'unknown' }]
	}

	return []
}

/**
 * Extract mitigation object.
 */
function extractMitigation(input: any): RiskMitigation {
	if (!input || typeof input !== 'object') {
		return { action: 'Review and address', urgency: 'this_week' }
	}

	const validUrgencies = ['immediate', 'this_week', 'this_month']

	return {
		action: String(input.action || 'Review and address'),
		urgency: validUrgencies.includes(input.urgency) ? input.urgency : 'this_week',
		owner: input.owner ? String(input.owner) : undefined,
	}
}

/**
 * Extract positive signals array.
 */
function extractPositiveSignals(input: any): PositiveSignal[] {
	if (!Array.isArray(input)) return []

	const validStrengths = ['strong', 'moderate', 'weak']

	return input.map((item: any) => ({
		signal: String(item.signal || ''),
		evidence: String(item.evidence || ''),
		strength: validStrengths.includes(item.strength) ? item.strength : 'moderate',
	})).filter((s: PositiveSignal) => s.signal.length > 0)
}

/**
 * Extract watch list array.
 */
function extractWatchList(input: any): WatchItem[] {
	if (!Array.isArray(input)) return []

	return input.map((item: any) => ({
		item: String(item.item || ''),
		trigger: String(item.trigger || ''),
		checkDate: item.checkDate ? String(item.checkDate) : undefined,
	})).filter((w: WatchItem) => w.item.length > 0)
}

/**
 * Extract recommendations array.
 */
function extractRecommendations(input: any): Recommendation[] {
	if (!Array.isArray(input)) return []

	return input.map((item: any, index: number) => ({
		priority: typeof item.priority === 'number' ? item.priority : index + 1,
		action: String(item.action || ''),
		rationale: String(item.rationale || ''),
		expectedOutcome: String(item.expectedOutcome || ''),
	})).filter((r: Recommendation) => r.action.length > 0)
		.sort((a: Recommendation, b: Recommendation) => a.priority - b.priority)
}

/**
 * Extract deal health summary as a single string.
 */
function extractDealHealthSummary(input: any): string {
	if (!input) return ''

	if (typeof input === 'string') return input

	if (typeof input === 'object') {
		const parts: string[] = []
		if (input.summary) parts.push(String(input.summary))
		if (input.assessment) parts.push(String(input.assessment))
		if (input.outlook) parts.push(String(input.outlook))
		return parts.join(' ')
	}

	return String(input)
}

/**
 * Create the Risk Heuristics agent.
 */
export function createRiskHeuristicsAgent(): Agent<RiskHeuristicsInput, RiskHeuristicsOutput> {
	return makeSimpleLlmAgent<RiskHeuristicsInput, RiskHeuristicsOutput>({
		agentId: 'risk_heuristics',
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
 * Execute risk heuristics analysis directly without going through the registry.
 */
export async function executeRiskHeuristics(
	context: OpportunityContext,
	options?: RiskHeuristicsInput
): Promise<AgentOutput<RiskHeuristicsOutput>> {
	const agent = createRiskHeuristicsAgent()
	return agent.execute({
		context,
		body: options || {},
	})
}

/**
 * Quick risk heuristics for simple cases.
 */
export async function quickRiskHeuristics(
	context: OpportunityContext,
	focusAreas?: RiskHeuristicsInput['focusAreas']
): Promise<RiskHeuristicsOutput> {
	const result = await executeRiskHeuristics(context, { focusAreas })
	if (!result.success) {
		throw new Error(result.error || 'Risk heuristics analysis failed')
	}
	return result.data!
}

// ============================================================================
// Legacy Wrapper for agent-runner compatibility
// ============================================================================

/**
 * Legacy function signature for agent-runner compatibility.
 * Builds OpportunityContext from AccountKey and accountDataDir.
 */
export async function analyzeRiskHeuristics(
	accountKey: AccountKey,
	_accountDataDir?: string,
	options?: RiskHeuristicsInput
): Promise<AgentOutput<RiskHeuristicsOutput>> {
	const accountSlug = slugify(accountKey.name)
	const context = await buildOpportunityContext({ accountSlug })
	return executeRiskHeuristics(context, options)
}

// Export the agent factory
export default createRiskHeuristicsAgent
