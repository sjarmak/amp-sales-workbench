/**
 * Agent Framework Types (Frontend)
 * 
 * Core type definitions for the lifecycle-based agent architecture.
 * These types define the structure for agents, their configurations,
 * context passing, and output formats.
 * 
 * NOTE: This is a copy of src/agentTypes.ts for the frontend.
 */

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

export type CostTier = 'cheap' | 'balanced' | 'quality'

export interface LlmConfig {
	provider: 'openai' | 'anthropic'
	model: string
	temperature: number
	maxOutputTokens: number
	costTier: CostTier
}

export interface AgentConfig {
	id: AgentId
	label: string
	description: string
	stage: LifecycleStageId
	defaultLlm: LlmConfig
	systemPromptPath: string
	requiredInputs: string[]
	optionalInputs: string[]
}
