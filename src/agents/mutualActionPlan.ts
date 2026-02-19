/**
 * Mutual Action Plan (MAP) Seed Agent
 * 
 * Creates initial mutual action plans with clear milestones and ownership.
 * Defines the path from current stage to closed-won with specific, time-bound actions.
 */

import type {
	AgentOutput,
	OpportunityContext,
} from '../agentTypes.js'
import { makeSimpleLlmAgent, serializeContext, type Agent, cleanJsonParse } from './baseAgent.js'

// ============================================================================
// Output Types
// ============================================================================

export type MilestonePhase =
	| 'Discovery'
	| 'Technical Validation'
	| 'Business Case'
	| 'Security Review'
	| 'Procurement'
	| 'Close'

export type MilestoneOwner = 'customer' | 'sourcegraph' | 'joint'

export type MilestoneStatus = 'not_started' | 'in_progress' | 'complete' | 'blocked'

export type RiskLevel = 'low' | 'medium' | 'high'

export interface Milestone {
	phase: MilestonePhase
	milestone: string
	targetDate: string
	owner: MilestoneOwner
	ownerName?: string
	dependencies: string[]
	deliverables: string[]
	successCriteria: string
	status: MilestoneStatus
}

export interface OwnerInfo {
	sourcegraph: {
		ae?: string
		se?: string
		executive?: string
	}
	customer: {
		champion?: string
		economicBuyer?: string
		technical?: string
	}
}

export interface Risk {
	risk: string
	impact: RiskLevel
	likelihood: RiskLevel
	mitigation: string
	owner: string
}

export interface NextStep {
	action: string
	owner: string
	dueDate: string
}

export interface MutualActionPlanOutput {
	milestones: Milestone[]
	targetCloseDate: string
	dealValue: string
	owners: OwnerInfo
	risks: Risk[]
	nextSteps: NextStep[]
	notes?: string
}

// ============================================================================
// Input Types
// ============================================================================

export interface MutualActionPlanInput {
	targetCloseDate?: string
}

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * Build user message for mutual action plan generation.
 */
function buildUserMessage(context: OpportunityContext, body: MutualActionPlanInput): string {
	const contextStr = serializeContext(context)

	let message = `${contextStr}\n\n`

	message += `## Mutual Action Plan Request\n\n`

	if (body.targetCloseDate) {
		message += `### Target Close Date\n`
		message += `${body.targetCloseDate}\n\n`
	}

	message += `Based on the account context above, create a comprehensive mutual action plan that:\n`
	message += `1. Defines clear milestones with specific dates, owners, and success criteria\n`
	message += `2. Works backwards from the target close date\n`
	message += `3. Identifies key stakeholders on both sides\n`
	message += `4. Surfaces risks early with mitigation strategies\n`
	message += `5. Includes specific next steps with ownership and due dates\n\n`
	message += `Respond in JSON format matching the MutualActionPlanOutput schema.`

	return message
}

/**
 * Parse LLM output to MutualActionPlanOutput.
 */
function parseOutput(content: string): MutualActionPlanOutput {
	try {
		const parsed = cleanJsonParse<any>(content)

		return {
			milestones: extractMilestones(parsed.milestones),
			targetCloseDate: extractString(parsed.targetCloseDate, ''),
			dealValue: extractString(parsed.dealValue, ''),
			owners: extractOwners(parsed.owners),
			risks: extractRisks(parsed.risks),
			nextSteps: extractNextSteps(parsed.nextSteps),
			notes: parsed.notes ? extractString(parsed.notes, undefined) : undefined,
		}
	} catch (err) {
		console.error('Failed to parse mutual action plan output:', err)
		return {
			milestones: [],
			targetCloseDate: '',
			dealValue: '',
			owners: {
				sourcegraph: {},
				customer: {},
			},
			risks: [],
			nextSteps: [],
		}
	}
}

/**
 * Extract a string value with fallback.
 */
function extractString(input: any, fallback: string): string
function extractString(input: any, fallback: undefined): string | undefined
function extractString(input: any, fallback: string | undefined): string | undefined {
	if (typeof input === 'string') return input
	if (input === null || input === undefined) return fallback
	return String(input)
}

/**
 * Normalize milestone phase to valid MilestonePhase.
 */
function normalizePhase(phase: any): MilestonePhase {
	const phaseMap: Record<string, MilestonePhase> = {
		'discovery': 'Discovery',
		'technical validation': 'Technical Validation',
		'technical_validation': 'Technical Validation',
		'technicalvalidation': 'Technical Validation',
		'business case': 'Business Case',
		'business_case': 'Business Case',
		'businesscase': 'Business Case',
		'security review': 'Security Review',
		'security_review': 'Security Review',
		'securityreview': 'Security Review',
		'security': 'Security Review',
		'legal': 'Security Review',
		'security/legal': 'Security Review',
		'procurement': 'Procurement',
		'close': 'Close',
		'closing': 'Close',
	}

	const normalized = String(phase).toLowerCase().trim()
	return phaseMap[normalized] || 'Discovery'
}

/**
 * Normalize milestone owner to valid MilestoneOwner.
 */
function normalizeOwner(owner: any): MilestoneOwner {
	const ownerMap: Record<string, MilestoneOwner> = {
		'customer': 'customer',
		'sourcegraph': 'sourcegraph',
		'sg': 'sourcegraph',
		'joint': 'joint',
		'both': 'joint',
		'mutual': 'joint',
	}

	const normalized = String(owner).toLowerCase().trim()
	return ownerMap[normalized] || 'joint'
}

/**
 * Normalize milestone status to valid MilestoneStatus.
 */
function normalizeStatus(status: any): MilestoneStatus {
	const statusMap: Record<string, MilestoneStatus> = {
		'not_started': 'not_started',
		'notstarted': 'not_started',
		'not started': 'not_started',
		'pending': 'not_started',
		'in_progress': 'in_progress',
		'inprogress': 'in_progress',
		'in progress': 'in_progress',
		'active': 'in_progress',
		'complete': 'complete',
		'completed': 'complete',
		'done': 'complete',
		'blocked': 'blocked',
		'stuck': 'blocked',
	}

	const normalized = String(status).toLowerCase().trim()
	return statusMap[normalized] || 'not_started'
}

/**
 * Normalize risk level to valid RiskLevel.
 */
function normalizeRiskLevel(level: any): RiskLevel {
	const levelMap: Record<string, RiskLevel> = {
		'low': 'low',
		'l': 'low',
		'medium': 'medium',
		'med': 'medium',
		'm': 'medium',
		'high': 'high',
		'h': 'high',
		'critical': 'high',
	}

	const normalized = String(level).toLowerCase().trim()
	return levelMap[normalized] || 'medium'
}

/**
 * Extract milestones from various formats.
 */
function extractMilestones(input: any): Milestone[] {
	if (!input || !Array.isArray(input)) return []

	return input.map((item: any) => ({
		phase: normalizePhase(item.phase),
		milestone: extractString(item.milestone, ''),
		targetDate: extractString(item.targetDate, ''),
		owner: normalizeOwner(item.owner),
		ownerName: item.ownerName ? extractString(item.ownerName, undefined) : undefined,
		dependencies: extractStringArray(item.dependencies),
		deliverables: extractStringArray(item.deliverables),
		successCriteria: extractString(item.successCriteria, ''),
		status: normalizeStatus(item.status),
	}))
}

/**
 * Extract string array with fallback.
 */
function extractStringArray(input: any): string[] {
	if (!input) return []
	if (Array.isArray(input)) return input.map(String)
	if (typeof input === 'string') return [input]
	return []
}

/**
 * Extract owners from various formats.
 */
function extractOwners(input: any): OwnerInfo {
	const defaultOwners: OwnerInfo = {
		sourcegraph: {},
		customer: {},
	}

	if (!input || typeof input !== 'object') return defaultOwners

	return {
		sourcegraph: {
			ae: input.sourcegraph?.ae ? extractString(input.sourcegraph.ae, undefined) : undefined,
			se: input.sourcegraph?.se ? extractString(input.sourcegraph.se, undefined) : undefined,
			executive: input.sourcegraph?.executive ? extractString(input.sourcegraph.executive, undefined) : undefined,
		},
		customer: {
			champion: input.customer?.champion ? extractString(input.customer.champion, undefined) : undefined,
			economicBuyer: input.customer?.economicBuyer ? extractString(input.customer.economicBuyer, undefined) : undefined,
			technical: input.customer?.technical ? extractString(input.customer.technical, undefined) : undefined,
		},
	}
}

/**
 * Extract risks from various formats.
 */
function extractRisks(input: any): Risk[] {
	if (!input || !Array.isArray(input)) return []

	return input.map((item: any) => ({
		risk: extractString(item.risk, ''),
		impact: normalizeRiskLevel(item.impact),
		likelihood: normalizeRiskLevel(item.likelihood),
		mitigation: extractString(item.mitigation, ''),
		owner: extractString(item.owner, ''),
	}))
}

/**
 * Extract next steps from various formats.
 */
function extractNextSteps(input: any): NextStep[] {
	if (!input || !Array.isArray(input)) return []

	return input.map((item: any) => ({
		action: extractString(item.action, ''),
		owner: extractString(item.owner, ''),
		dueDate: extractString(item.dueDate, ''),
	}))
}

/**
 * Create the Mutual Action Plan agent.
 */
export function createMutualActionPlanAgent(): Agent<MutualActionPlanInput, MutualActionPlanOutput> {
	return makeSimpleLlmAgent<MutualActionPlanInput, MutualActionPlanOutput>({
		agentId: 'map_seed',
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
 * Execute mutual action plan generation directly without going through the registry.
 */
export async function executeMutualActionPlan(
	context: OpportunityContext,
	options?: MutualActionPlanInput
): Promise<AgentOutput<MutualActionPlanOutput>> {
	const agent = createMutualActionPlanAgent()
	return agent.execute({
		context,
		body: options || {},
	})
}

/**
 * Quick mutual action plan for simple cases.
 */
export async function quickMutualActionPlan(
	context: OpportunityContext,
	targetCloseDate?: string
): Promise<MutualActionPlanOutput> {
	const result = await executeMutualActionPlan(context, { targetCloseDate })
	if (!result.success) {
		throw new Error(result.error || 'Mutual action plan generation failed')
	}
	return result.data!
}

// Export the agent factory
export default createMutualActionPlanAgent
