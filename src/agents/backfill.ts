/**
 * Backfill Agent
 * 
 * Analyzes account data to identify missing CRM information and suggest
 * where to find it. Helps sales teams maintain complete and accurate records.
 */

import type {
	AgentOutput,
	OpportunityContext,
} from '../agentTypes.js'
import { makeSimpleLlmAgent, serializeContext, type Agent, cleanJsonParse } from './baseAgent.js'

// ============================================================================
// Input Types
// ============================================================================

export interface BackfillInput {
	focusObjects?: ('account' | 'opportunity' | 'contact' | 'activity')[]
}

// ============================================================================
// Output Types
// ============================================================================

export interface BackfillSummary {
	completenessScore: number
	criticalGaps: number
	recommendedActions: number
}

export interface MissingField {
	field: string
	object: string
	importance: 'critical' | 'high' | 'medium' | 'low'
	impact: string
	suggestedSource: string
	discoveryQuestion: string
}

export interface IncompleteData {
	field: string
	currentValue: string
	issue: string
	suggestedAction: string
}

export interface EnrichmentOpportunity {
	dataPoint: string
	source: 'gong' | 'salesforce' | 'linkedin' | 'web'
	value: string
	confidence: 'high' | 'medium' | 'low'
}

export interface SuggestedSource {
	source: string
	dataAvailable: string[]
	extractionNotes: string
}

export interface PrioritizedAction {
	priority: number
	action: string
	effort: 'low' | 'medium' | 'high'
	value: 'low' | 'medium' | 'high'
	owner: string
}

export interface BackfillOutput {
	summary: BackfillSummary
	missingFields: MissingField[]
	incompleteData: IncompleteData[]
	enrichmentOpportunities: EnrichmentOpportunity[]
	suggestedSources: SuggestedSource[]
	prioritizedActions: PrioritizedAction[]
}

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * Build user message for backfill analysis.
 */
function buildUserMessage(context: OpportunityContext, body: BackfillInput): string {
	const contextStr = serializeContext(context)

	let message = `${contextStr}\n\n`

	message += `## Data Backfill Request\n\n`

	if (body.focusObjects && body.focusObjects.length > 0) {
		message += `### Focus Objects\n`
		message += body.focusObjects.map(o => `- ${o}`).join('\n')
		message += '\n\n'
	}

	message += `Analyze the account data above and identify:\n`
	message += `1. Missing fields that should be populated\n`
	message += `2. Incomplete or outdated data that needs attention\n`
	message += `3. Enrichment opportunities from existing artifacts\n`
	message += `4. Suggested sources for missing information\n`
	message += `5. Prioritized actions to improve data completeness\n\n`
	message += `Respond in JSON format matching the BackfillOutput schema.`

	return message
}

/**
 * Parse LLM output to BackfillOutput.
 */
function parseOutput(content: string): BackfillOutput {
	try {
		const parsed = cleanJsonParse<any>(content)

		return {
			summary: extractSummary(parsed.summary),
			missingFields: extractMissingFields(parsed.missingFields),
			incompleteData: extractIncompleteData(parsed.incompleteData),
			enrichmentOpportunities: extractEnrichmentOpportunities(parsed.enrichmentOpportunities),
			suggestedSources: extractSuggestedSources(parsed.suggestedSources),
			prioritizedActions: extractPrioritizedActions(parsed.prioritizedActions),
		}
	} catch (err) {
		console.error('Failed to parse backfill output:', err)
		return {
			summary: { completenessScore: 0, criticalGaps: 0, recommendedActions: 0 },
			missingFields: [],
			incompleteData: [],
			enrichmentOpportunities: [],
			suggestedSources: [],
			prioritizedActions: [],
		}
	}
}

/**
 * Extract summary from parsed data.
 */
function extractSummary(input: any): BackfillSummary {
	if (!input || typeof input !== 'object') {
		return { completenessScore: 0, criticalGaps: 0, recommendedActions: 0 }
	}

	return {
		completenessScore: typeof input.completenessScore === 'number' 
			? Math.max(0, Math.min(100, input.completenessScore)) 
			: 0,
		criticalGaps: typeof input.criticalGaps === 'number' ? input.criticalGaps : 0,
		recommendedActions: typeof input.recommendedActions === 'number' ? input.recommendedActions : 0,
	}
}

/**
 * Extract missing fields array.
 */
function extractMissingFields(input: any): MissingField[] {
	if (!Array.isArray(input)) return []

	return input.map((item: any) => ({
		field: String(item.field || ''),
		object: String(item.object || ''),
		importance: normalizeImportance(item.importance),
		impact: String(item.impact || ''),
		suggestedSource: String(item.suggestedSource || ''),
		discoveryQuestion: String(item.discoveryQuestion || ''),
	})).filter(item => item.field && item.object)
}

/**
 * Normalize importance level.
 */
function normalizeImportance(input: any): 'critical' | 'high' | 'medium' | 'low' {
	const normalized = String(input).toLowerCase().trim()
	if (['critical', 'high', 'medium', 'low'].includes(normalized)) {
		return normalized as 'critical' | 'high' | 'medium' | 'low'
	}
	return 'medium'
}

/**
 * Extract incomplete data array.
 */
function extractIncompleteData(input: any): IncompleteData[] {
	if (!Array.isArray(input)) return []

	return input.map((item: any) => ({
		field: String(item.field || ''),
		currentValue: String(item.currentValue || ''),
		issue: String(item.issue || ''),
		suggestedAction: String(item.suggestedAction || ''),
	})).filter(item => item.field)
}

/**
 * Extract enrichment opportunities array.
 */
function extractEnrichmentOpportunities(input: any): EnrichmentOpportunity[] {
	if (!Array.isArray(input)) return []

	return input.map((item: any) => ({
		dataPoint: String(item.dataPoint || ''),
		source: normalizeSource(item.source),
		value: String(item.value || ''),
		confidence: normalizeConfidence(item.confidence),
	})).filter(item => item.dataPoint)
}

/**
 * Normalize source type.
 */
function normalizeSource(input: any): 'gong' | 'salesforce' | 'linkedin' | 'web' {
	const normalized = String(input).toLowerCase().trim()
	if (['gong', 'salesforce', 'linkedin', 'web'].includes(normalized)) {
		return normalized as 'gong' | 'salesforce' | 'linkedin' | 'web'
	}
	return 'salesforce'
}

/**
 * Normalize confidence level.
 */
function normalizeConfidence(input: any): 'high' | 'medium' | 'low' {
	const normalized = String(input).toLowerCase().trim()
	if (['high', 'medium', 'low'].includes(normalized)) {
		return normalized as 'high' | 'medium' | 'low'
	}
	return 'medium'
}

/**
 * Extract suggested sources array.
 */
function extractSuggestedSources(input: any): SuggestedSource[] {
	if (!Array.isArray(input)) return []

	return input.map((item: any) => ({
		source: String(item.source || ''),
		dataAvailable: Array.isArray(item.dataAvailable) 
			? item.dataAvailable.map(String) 
			: [],
		extractionNotes: String(item.extractionNotes || ''),
	})).filter(item => item.source)
}

/**
 * Extract prioritized actions array.
 */
function extractPrioritizedActions(input: any): PrioritizedAction[] {
	if (!Array.isArray(input)) return []

	return input.map((item: any) => ({
		priority: typeof item.priority === 'number' ? item.priority : 99,
		action: String(item.action || ''),
		effort: normalizeEffortValue(item.effort),
		value: normalizeEffortValue(item.value),
		owner: String(item.owner || ''),
	})).filter(item => item.action)
		.sort((a, b) => a.priority - b.priority)
}

/**
 * Normalize effort/value level.
 */
function normalizeEffortValue(input: any): 'low' | 'medium' | 'high' {
	const normalized = String(input).toLowerCase().trim()
	if (['low', 'medium', 'high'].includes(normalized)) {
		return normalized as 'low' | 'medium' | 'high'
	}
	return 'medium'
}

/**
 * Create the Backfill agent.
 */
export function createBackfillAgent(): Agent<BackfillInput, BackfillOutput> {
	return makeSimpleLlmAgent<BackfillInput, BackfillOutput>({
		agentId: 'backfill',
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
 * Execute backfill analysis directly without going through the registry.
 */
export async function executeBackfill(
	context: OpportunityContext,
	options?: BackfillInput
): Promise<AgentOutput<BackfillOutput>> {
	const agent = createBackfillAgent()
	return agent.execute({
		context,
		body: options || {},
	})
}

/**
 * Quick backfill for simple cases.
 */
export async function quickBackfill(
	context: OpportunityContext,
	focusObjects?: BackfillInput['focusObjects']
): Promise<BackfillOutput> {
	const result = await executeBackfill(context, { focusObjects })
	if (!result.success) {
		throw new Error(result.error || 'Backfill analysis failed')
	}
	return result.data!
}

// ============================================================================
// Legacy Compatibility
// ============================================================================

/**
 * Legacy wrapper for backwards compatibility with index.ts.
 * Converts ConsolidatedSnapshot to OpportunityContext and runs backfill.
 */
export async function runBackfillAgent(
	snapshot: any,
	_accountDataDir?: string
): Promise<BackfillOutput> {
	// Convert snapshot to OpportunityContext
	const context: OpportunityContext = {
		accountId: snapshot?.accountKey?.salesforceId || snapshot?.accountId || '',
		accountName: snapshot?.accountKey?.name || snapshot?.accountName || 'Unknown Account',
		accountDomain: snapshot?.accountKey?.domain,
		opportunityId: snapshot?.opportunity?.Id,
		opportunityName: snapshot?.opportunity?.Name,
		stage: 'global',
		products: [],
		salesforceSnapshot: {
			account: snapshot?.account,
			opportunity: snapshot?.opportunity,
			contacts: snapshot?.contacts || [],
		},
		activities: (snapshot?.activities || []).map((a: any) => ({
			id: a.id || '',
			type: a.type || 'meeting',
			date: a.date || '',
			title: a.title || a.subject || '',
			summary: a.summary,
			participants: a.participants,
			source: 'salesforce',
		})),
		knowledgeDocs: [],
		artifacts: [],
	}

	return quickBackfill(context)
}

// Export the agent factory
export default createBackfillAgent
