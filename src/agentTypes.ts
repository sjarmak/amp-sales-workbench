/**
 * Agent Framework Types
 * 
 * Core type definitions for the lifecycle-based agent architecture.
 * These types define the structure for agents, their configurations,
 * context passing, and output formats.
 */

// ============================================================================
// Lifecycle & Product Identifiers
// ============================================================================

export type LifecycleStageId =
	| 'prospecting'
	| 'qualification'
	| 'solution_mapping'
	| 'validation'
	| 'handoff_close'
	| 'post_mortem'
	| 'global'

export type ProductId =
	| 'code_search'
	| 'batch_changes'
	| 'code_insights'
	| 'deep_search'

// ============================================================================
// Agent Identifiers
// ============================================================================

export type AgentId =
	// Global (available in all stages)
	| 'live_qna'
	// Prospecting
	| 'prospector_target'
	| 'prospector_research'
	| 'precall_brief'
	// Qualification
	| 'discovery_recap'
	| 'custom_demo_plan'
	| 'meddpicc_extractor'
	// Solution Mapping
	| 'solution_map'
	| 'business_case'
	| 'evaluation_criteria'
	| 'map_seed'
	// Validation
	| 'exec_talking_points'
	| 'evaluation_plan'
	| 'pre_eval_survey'
	| 'proposal_draft'
	| 'onboarding_plan'
	| 'technical_win_extract'
	// Handoff & Close
	| 'handoff_package'
	| 'order_form_draft'
	| 'redlines_assistant'
	| 'business_impact_review'
	// Post-Mortem
	| 'win_story'
	| 'loss_analysis'
	| 'crm_hygiene_pass'
	// Existing agents (to migrate)
	| 'exec_summary'
	| 'deal_review'
	| 'qualification'
	| 'postcall'
	| 'coaching'
	| 'followup_email'
	| 'meeting_summary'
	| 'risk_heuristics'
	| 'backfill'
	| 'closed_won'
	| 'closed_lost'
	| 'handoff'

// ============================================================================
// LLM Configuration
// ============================================================================

export type CostTier = 'cheap' | 'balanced' | 'quality'

export interface LlmConfig {
	provider: 'openai' | 'anthropic'
	model: string
	temperature: number
	maxOutputTokens: number
	costTier: CostTier
}

// Default LLM configs for different tiers
export const LLM_PRESETS: Record<CostTier, LlmConfig> = {
	cheap: {
		provider: 'openai',
		model: 'gpt-4.1-mini',
		temperature: 0.3,
		maxOutputTokens: 2048,
		costTier: 'cheap',
	},
	balanced: {
		provider: 'openai',
		model: 'gpt-4.1',
		temperature: 0.4,
		maxOutputTokens: 4096,
		costTier: 'balanced',
	},
	quality: {
		provider: 'openai',
		model: 'gpt-4o',
		temperature: 0.5,
		maxOutputTokens: 8192,
		costTier: 'quality',
	},
}

// ============================================================================
// Agent Configuration
// ============================================================================

export interface AgentConfig {
	id: AgentId
	label: string
	description: string
	stage: LifecycleStageId
	defaultLlm: LlmConfig
	systemPromptPath: string // Path under /prompts
	requiredInputs: string[] // Required fields in body
	optionalInputs: string[] // Optional fields in body
}

// ============================================================================
// Opportunity Context
// ============================================================================

/**
 * Context passed to every agent execution.
 * Built from cached account data + Salesforce + Gong + docs.
 */
export interface OpportunityContext {
	accountId: string
	accountName: string
	accountDomain?: string
	opportunityId?: string
	opportunityName?: string
	stage: LifecycleStageId
	products: ProductId[]
	salesforceSnapshot: {
		account?: any
		opportunity?: any
		contacts?: any[]
	}
	activities: ActivitySummary[]
	knowledgeDocs: KnowledgeDoc[]
	artifacts: ArtifactSummary[]
	recentTranscript?: TranscriptChunk[]
}

export interface ActivitySummary {
	id: string
	type: 'gong_call' | 'email' | 'meeting' | 'task'
	date: string
	title: string
	summary?: string
	participants?: string[]
	duration?: number
	source: string
}

export interface KnowledgeDoc {
	id: string
	type: 'competitive' | 'product' | 'customer_win' | 'template' | 'account_doc' | 'product_doc'
	title: string
	url?: string
	excerpt?: string
}

export interface ArtifactSummary {
	id: string
	artifactType: AgentId
	stage: LifecycleStageId
	accountId: string
	opportunityId?: string
	title: string
	summary: string
	lastRunAt: string
	lastRunAgentId: AgentId
	version: number
}

export interface TranscriptChunk {
	speaker: string
	text: string
	startSec?: number
	endSec?: number
}

// ============================================================================
// Agent Execution
// ============================================================================

export interface AgentInput<T = Record<string, any>> {
	context: OpportunityContext
	body: T
}

export interface AgentOutput<T = any> {
	success: boolean
	data?: T
	error?: string
	metadata: {
		agentId: AgentId
		stage: LifecycleStageId
		executionTimeMs: number
		model: string
		tokensUsed?: {
			input: number
			output: number
		}
		timestamp: string
	}
}

// ============================================================================
// Live Q&A Agent Types
// ============================================================================

export interface LiveQnaInput {
	question: string
	recentTranscript?: TranscriptChunk[]
}

export interface LiveQnaOutput {
	answer: string
	bullets: string[]
	suggestedFollowups: string[]
	evidence: EvidenceReference[]
}

export interface EvidenceReference {
	source: 'gong' | 'salesforce' | 'docs' | 'artifact'
	label: string
	url?: string
	excerpt?: string
}

// ============================================================================
// Agent Result Types (for specific agents)
// ============================================================================

export interface PrecallBriefOutput {
	meetingType: string
	attendees: AttendeeInfo[]
	agenda: string[]
	talkingPoints: TalkingPoint[]
	competitiveContext?: string
	accountHistory: string
	risks: string[]
	objectives: string[]
}

export interface AttendeeInfo {
	name: string
	title?: string
	role?: string
	linkedinUrl?: string
	recentInteractions?: string[]
}

export interface TalkingPoint {
	topic: string
	context: string
	suggestedQuestions: string[]
	relevantProducts: ProductId[]
}

export interface DiscoveryRecapOutput {
	painPoints: PainPoint[]
	decisionProcess: DecisionInfo
	timeline: string
	budget?: BudgetInfo
	nextSteps: string[]
	stakeholderMap: StakeholderInfo[]
}

export interface PainPoint {
	description: string
	severity: 'high' | 'medium' | 'low'
	relevantProducts: ProductId[]
	quotes?: string[]
}

export interface DecisionInfo {
	makers: string[]
	influencers: string[]
	champions: string[]
	blockers?: string[]
	process: string
}

export interface BudgetInfo {
	range?: string
	approvalProcess?: string
	fiscalYearEnd?: string
}

export interface StakeholderInfo {
	name: string
	title: string
	role: 'champion' | 'decision_maker' | 'influencer' | 'blocker' | 'user'
	engagement: 'high' | 'medium' | 'low'
	notes?: string
}

export interface SolutionMapOutput {
	painToProductMap: Array<{
		pain: string
		products: ProductId[]
		capabilities: string[]
		value: string
	}>
	integrationRequirements: string[]
	technicalRequirements: string[]
	competitivePositioning?: string
}

export interface BusinessCaseOutput {
	executiveSummary: string
	currentState: string
	proposedSolution: string
	roi: {
		hardSavings: string[]
		softBenefits: string[]
		paybackPeriod?: string
	}
	risks: Array<{
		risk: string
		mitigation: string
	}>
	timeline: string
	investment: string
}

export interface MEDDPICCOutput {
	metrics: {
		score: number
		evidence: string[]
		gaps: string[]
	}
	economicBuyer: {
		identified: boolean
		name?: string
		evidence: string[]
		gaps: string[]
	}
	decisionCriteria: {
		score: number
		criteria: string[]
		gaps: string[]
	}
	decisionProcess: {
		score: number
		steps: string[]
		gaps: string[]
	}
	paperProcess: {
		score: number
		steps: string[]
		gaps: string[]
	}
	impliedPain: {
		score: number
		pains: string[]
		gaps: string[]
	}
	champion: {
		identified: boolean
		name?: string
		evidence: string[]
		gaps: string[]
	}
	competition: {
		identified: string[]
		positioning: string
		gaps: string[]
	}
	overallScore: number
	recommendations: string[]
}

// ============================================================================
// Agent Registry Types
// ============================================================================

export interface AgentDefinition {
	config: AgentConfig
	execute: (input: AgentInput) => Promise<AgentOutput>
}

export interface AgentRegistry {
	get(id: AgentId): AgentDefinition | undefined
	list(): AgentConfig[]
	listByStage(stage: LifecycleStageId): AgentConfig[]
}
