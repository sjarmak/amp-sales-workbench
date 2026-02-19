/**
 * Agent Configuration Registry
 * 
 * Defines all agents with their configurations, system prompts,
 * and LLM settings.
 */

import type { AgentConfig, AgentId, LlmConfig, LifecycleStageId } from '../agentTypes.js'

// ============================================================================
// LLM Presets
// ============================================================================

const LLM_CHEAP: LlmConfig = {
	provider: 'openai',
	model: 'gpt-4.1-mini',
	temperature: 0.3,
	maxOutputTokens: 2048,
	costTier: 'cheap',
}

const LLM_BALANCED: LlmConfig = {
	provider: 'openai',
	model: 'gpt-4.1',
	temperature: 0.4,
	maxOutputTokens: 4096,
	costTier: 'balanced',
}

const LLM_QUALITY: LlmConfig = {
	provider: 'openai',
	model: 'gpt-4o',
	temperature: 0.5,
	maxOutputTokens: 8192,
	costTier: 'quality',
}

// ============================================================================
// Agent Configurations
// ============================================================================

export const AGENTS: AgentConfig[] = [
	// -------------------------------------------------------------------------
	// Global Agents
	// -------------------------------------------------------------------------
	{
		id: 'live_qna',
		label: 'Live Q&A',
		description: 'Answer questions about the customer mid-call with context awareness',
		stage: 'global',
		defaultLlm: LLM_CHEAP,
		systemPromptPath: 'prompts/agents/live_qna.md',
		requiredInputs: ['question'],
		optionalInputs: ['recentTranscript'],
	},

	// -------------------------------------------------------------------------
	// Prospecting Stage
	// -------------------------------------------------------------------------
	{
		id: 'prospector_target',
		label: 'Target Prioritization',
		description: 'Cross-account targeting to prioritize outreach',
		stage: 'prospecting',
		defaultLlm: LLM_BALANCED,
		systemPromptPath: 'prompts/agents/prospector_target.md',
		requiredInputs: [],
		optionalInputs: ['ownerIds', 'stages', 'minACV', 'maxACV'],
	},
	{
		id: 'prospector_research',
		label: 'Account Research',
		description: 'Deep research on account before outreach',
		stage: 'prospecting',
		defaultLlm: LLM_BALANCED,
		systemPromptPath: 'prompts/agents/prospector_research.md',
		requiredInputs: ['accountName'],
		optionalInputs: ['domain'],
	},
	{
		id: 'precall_brief',
		label: 'Pre-Call Brief',
		description: 'Generate comprehensive pre-call preparation document',
		stage: 'prospecting',
		defaultLlm: LLM_BALANCED,
		systemPromptPath: 'prompts/agents/precall_brief.md',
		requiredInputs: [],
		optionalInputs: ['briefAgenda', 'meetingType'],
	},

	// -------------------------------------------------------------------------
	// Qualification Stage
	// -------------------------------------------------------------------------
	{
		id: 'discovery_recap',
		label: 'Discovery Recap',
		description: 'Summarize discovery findings with pain points and stakeholders',
		stage: 'qualification',
		defaultLlm: LLM_BALANCED,
		systemPromptPath: 'prompts/agents/discovery_recap.md',
		requiredInputs: [],
		optionalInputs: ['callId'],
	},
	{
		id: 'custom_demo_plan',
		label: 'Custom Demo Plan',
		description: 'Generate qualification-aware demo plan with feature focus',
		stage: 'qualification',
		defaultLlm: LLM_BALANCED,
		systemPromptPath: 'prompts/agents/custom_demo_plan.md',
		requiredInputs: [],
		optionalInputs: ['products'],
	},
	{
		id: 'meddpicc_extractor',
		label: 'MEDDPICC Extractor',
		description: 'Extract and score MEDDPICC fields from conversations',
		stage: 'qualification',
		defaultLlm: LLM_QUALITY,
		systemPromptPath: 'prompts/agents/meddpicc_extractor.md',
		requiredInputs: [],
		optionalInputs: [],
	},

	// -------------------------------------------------------------------------
	// Solution Mapping Stage
	// -------------------------------------------------------------------------
	{
		id: 'solution_map',
		label: 'Solution Map',
		description: 'Map customer pains to Sourcegraph products and capabilities',
		stage: 'solution_mapping',
		defaultLlm: LLM_BALANCED,
		systemPromptPath: 'prompts/agents/solution_map.md',
		requiredInputs: [],
		optionalInputs: ['products'],
	},
	{
		id: 'business_case',
		label: 'Business Case Builder',
		description: 'Generate ROI and business case documentation',
		stage: 'solution_mapping',
		defaultLlm: LLM_QUALITY,
		systemPromptPath: 'prompts/agents/business_case.md',
		requiredInputs: [],
		optionalInputs: [],
	},
	{
		id: 'evaluation_criteria',
		label: 'Evaluation Criteria',
		description: 'Define success criteria and evaluation rubric',
		stage: 'solution_mapping',
		defaultLlm: LLM_BALANCED,
		systemPromptPath: 'prompts/agents/evaluation_criteria.md',
		requiredInputs: [],
		optionalInputs: [],
	},
	{
		id: 'map_seed',
		label: 'Mutual Action Plan Seed',
		description: 'Create initial mutual action plan with milestones',
		stage: 'solution_mapping',
		defaultLlm: LLM_BALANCED,
		systemPromptPath: 'prompts/agents/map_seed.md',
		requiredInputs: [],
		optionalInputs: ['targetCloseDate'],
	},

	// -------------------------------------------------------------------------
	// Validation Stage
	// -------------------------------------------------------------------------
	{
		id: 'exec_talking_points',
		label: 'Executive Talking Points',
		description: 'Prepare talking points for executive engagement',
		stage: 'validation',
		defaultLlm: LLM_QUALITY,
		systemPromptPath: 'prompts/agents/exec_talking_points.md',
		requiredInputs: [],
		optionalInputs: ['execName', 'execTitle'],
	},
	{
		id: 'evaluation_plan',
		label: 'POC/Evaluation Plan',
		description: 'Detailed plan for technical validation or POC',
		stage: 'validation',
		defaultLlm: LLM_BALANCED,
		systemPromptPath: 'prompts/agents/evaluation_plan.md',
		requiredInputs: [],
		optionalInputs: ['duration', 'scope'],
	},
	{
		id: 'proposal_draft',
		label: 'Proposal Draft',
		description: 'Generate proposal document draft',
		stage: 'validation',
		defaultLlm: LLM_QUALITY,
		systemPromptPath: 'prompts/agents/proposal_draft.md',
		requiredInputs: [],
		optionalInputs: ['products', 'pricing'],
	},
	{
		id: 'onboarding_plan',
		label: 'Onboarding Plan',
		description: 'Create customer onboarding and rollout plan',
		stage: 'validation',
		defaultLlm: LLM_BALANCED,
		systemPromptPath: 'prompts/agents/onboarding_plan.md',
		requiredInputs: [],
		optionalInputs: [],
	},

	// -------------------------------------------------------------------------
	// Handoff & Close Stage
	// -------------------------------------------------------------------------
	{
		id: 'handoff_package',
		label: 'Handoff Package',
		description: 'Generate comprehensive handoff documentation',
		stage: 'handoff_close',
		defaultLlm: LLM_QUALITY,
		systemPromptPath: 'prompts/agents/handoff_package.md',
		requiredInputs: [],
		optionalInputs: ['handoffType'],
	},
	{
		id: 'order_form_draft',
		label: 'Order Form Draft',
		description: 'Prepare order form with deal terms',
		stage: 'handoff_close',
		defaultLlm: LLM_BALANCED,
		systemPromptPath: 'prompts/agents/order_form_draft.md',
		requiredInputs: [],
		optionalInputs: ['products', 'pricing', 'terms'],
	},
	{
		id: 'business_impact_review',
		label: 'Business Impact Review',
		description: 'Final review of expected business impact for exec sign-off',
		stage: 'handoff_close',
		defaultLlm: LLM_QUALITY,
		systemPromptPath: 'prompts/agents/business_impact_review.md',
		requiredInputs: [],
		optionalInputs: [],
	},

	// -------------------------------------------------------------------------
	// Post-Mortem Stage
	// -------------------------------------------------------------------------
	{
		id: 'win_story',
		label: 'Win Story',
		description: 'Capture win story with key differentiators and lessons',
		stage: 'post_mortem',
		defaultLlm: LLM_QUALITY,
		systemPromptPath: 'prompts/agents/win_story.md',
		requiredInputs: [],
		optionalInputs: ['opportunityId'],
	},
	{
		id: 'loss_analysis',
		label: 'Loss Analysis',
		description: 'Analyze closed-lost deal for patterns and lessons',
		stage: 'post_mortem',
		defaultLlm: LLM_QUALITY,
		systemPromptPath: 'prompts/agents/loss_analysis.md',
		requiredInputs: [],
		optionalInputs: ['opportunityId'],
	},
	{
		id: 'crm_hygiene_pass',
		label: 'CRM Hygiene Pass',
		description: 'Identify and fix CRM data quality issues',
		stage: 'post_mortem',
		defaultLlm: LLM_CHEAP,
		systemPromptPath: 'prompts/agents/crm_hygiene_pass.md',
		requiredInputs: [],
		optionalInputs: [],
	},

	// -------------------------------------------------------------------------
	// Legacy Agents (to be migrated)
	// -------------------------------------------------------------------------
	{
		id: 'exec_summary',
		label: 'Executive Summary',
		description: 'Generate executive summary of account status',
		stage: 'global',
		defaultLlm: LLM_BALANCED,
		systemPromptPath: 'prompts/agents/exec_summary.md',
		requiredInputs: [],
		optionalInputs: [],
	},
	{
		id: 'deal_review',
		label: 'Deal Review',
		description: 'Comprehensive deal health analysis',
		stage: 'global',
		defaultLlm: LLM_BALANCED,
		systemPromptPath: 'prompts/agents/deal_review.md',
		requiredInputs: [],
		optionalInputs: [],
	},
	{
		id: 'qualification',
		label: 'Qualification',
		description: 'Run MEDDIC/BANT/SPICED qualification',
		stage: 'qualification',
		defaultLlm: LLM_BALANCED,
		systemPromptPath: 'prompts/agents/qualification.md',
		requiredInputs: [],
		optionalInputs: ['methodology'],
	},
	{
		id: 'postcall',
		label: 'Post-Call Update',
		description: 'Generate post-call summary and CRM updates',
		stage: 'global',
		defaultLlm: LLM_BALANCED,
		systemPromptPath: 'prompts/agents/postcall.md',
		requiredInputs: [],
		optionalInputs: ['callId'],
	},
	{
		id: 'coaching',
		label: 'Call Coaching',
		description: 'Analyze call for coaching insights',
		stage: 'global',
		defaultLlm: LLM_BALANCED,
		systemPromptPath: 'prompts/agents/coaching.md',
		requiredInputs: ['callId'],
		optionalInputs: [],
	},
	{
		id: 'followup_email',
		label: 'Follow-Up Email',
		description: 'Generate personalized follow-up email',
		stage: 'global',
		defaultLlm: LLM_CHEAP,
		systemPromptPath: 'prompts/agents/followup_email.md',
		requiredInputs: [],
		optionalInputs: ['callId'],
	},
	{
		id: 'meeting_summary',
		label: 'Meeting Summary',
		description: 'Extract objectives, blockers, next steps from call',
		stage: 'global',
		defaultLlm: LLM_BALANCED,
		systemPromptPath: 'prompts/agents/meeting_summary.md',
		requiredInputs: ['callId'],
		optionalInputs: [],
	},
	{
		id: 'risk_heuristics',
		label: 'Risk Heuristics',
		description: 'Analyze deal risks using heuristic detection',
		stage: 'global',
		defaultLlm: LLM_CHEAP,
		systemPromptPath: 'prompts/agents/risk_heuristics.md',
		requiredInputs: [],
		optionalInputs: [],
	},
	{
		id: 'backfill',
		label: 'Data Backfill',
		description: 'Suggest missing CRM data to capture',
		stage: 'global',
		defaultLlm: LLM_BALANCED,
		systemPromptPath: 'prompts/agents/backfill.md',
		requiredInputs: [],
		optionalInputs: [],
	},
	{
		id: 'closed_won',
		label: 'Closed-Won Analysis',
		description: 'Capture win story and playbook recommendations',
		stage: 'post_mortem',
		defaultLlm: LLM_QUALITY,
		systemPromptPath: 'prompts/agents/closed_won.md',
		requiredInputs: [],
		optionalInputs: ['opportunityId'],
	},
	{
		id: 'closed_lost',
		label: 'Closed-Lost Analysis',
		description: 'Analyze closed-lost for patterns and lessons',
		stage: 'post_mortem',
		defaultLlm: LLM_QUALITY,
		systemPromptPath: 'prompts/agents/closed_lost.md',
		requiredInputs: [],
		optionalInputs: ['opportunityId'],
	},
	{
		id: 'handoff',
		label: 'Handoff Document',
		description: 'Generate handoff document for team transitions',
		stage: 'handoff_close',
		defaultLlm: LLM_BALANCED,
		systemPromptPath: 'prompts/agents/handoff.md',
		requiredInputs: [],
		optionalInputs: ['handoffType'],
	},
]

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get agent configuration by ID.
 */
export function getAgentConfig(id: AgentId): AgentConfig | undefined {
	return AGENTS.find((a) => a.id === id)
}

/**
 * Get all agents for a specific lifecycle stage.
 */
export function getAgentsByStage(stage: LifecycleStageId): AgentConfig[] {
	return AGENTS.filter((a) => a.stage === stage)
}

/**
 * Get all available agent IDs.
 */
export function getAllAgentIds(): AgentId[] {
	return AGENTS.map((a) => a.id)
}

/**
 * Check if an agent ID is valid.
 */
export function isValidAgentId(id: string): id is AgentId {
	return AGENTS.some((a) => a.id === id)
}
