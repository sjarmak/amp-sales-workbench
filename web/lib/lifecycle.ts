/**
 * Lifecycle Stage Configuration (Frontend)
 */

import type { LifecycleStageId, AgentId, ProductId } from '../types/agent'

export interface LifecycleStage {
	id: LifecycleStageId
	label: string
	description: string
	order: number
	color: string
	quickActions: AgentId[]
	sfStages: string[]
}

export const LIFECYCLE_STAGES: LifecycleStage[] = [
	{
		id: 'prospecting',
		label: 'Prospecting',
		description: 'Identify targets, research accounts, prepare for first meetings',
		order: 1,
		color: 'blue',
		quickActions: ['prospector_research', 'precall_brief'],
		sfStages: ['Prospecting', 'Qualification'],
	},
	{
		id: 'qualification',
		label: 'Discovery & Qualification',
		description: 'Deep discovery, demo prep, MEDDPICC scaffolding',
		order: 2,
		color: 'purple',
		quickActions: ['discovery_recap', 'custom_demo_plan', 'meddpicc_extractor'],
		sfStages: ['Discovery', 'Demo', 'Needs Analysis'],
	},
	{
		id: 'solution_mapping',
		label: 'Solution Mapping',
		description: 'Map pains to products, build business case, evaluation criteria',
		order: 3,
		color: 'indigo',
		quickActions: ['solution_map', 'business_case', 'evaluation_criteria', 'map_seed'],
		sfStages: ['Proposal/Price Quote', 'Value/ROI Analysis'],
	},
	{
		id: 'validation',
		label: 'Validation',
		description: 'POC planning, exec engagement, proposal drafting',
		order: 4,
		color: 'green',
		quickActions: ['exec_talking_points', 'evaluation_plan', 'proposal_draft', 'onboarding_plan'],
		sfStages: ['Negotiation/Review', 'POC', 'Technical Validation'],
	},
	{
		id: 'handoff_close',
		label: 'Handoff & Close',
		description: 'CSM handoff, order forms, business impact review',
		order: 5,
		color: 'orange',
		quickActions: ['handoff_package', 'order_form_draft', 'business_impact_review'],
		sfStages: ['Closed Won', 'Pending Close'],
	},
	{
		id: 'post_mortem',
		label: 'Post-Mortem',
		description: 'Win/loss analysis, playbook updates, CRM hygiene',
		order: 6,
		color: 'gray',
		quickActions: ['win_story', 'loss_analysis', 'crm_hygiene_pass'],
		sfStages: ['Closed Won', 'Closed Lost'],
	},
]

export interface Product {
	id: ProductId
	label: string
	icon: string
	description: string
}

export const PRODUCTS: Product[] = [
	{
		id: 'code_search',
		label: 'Code Search',
		icon: 'Search',
		description: 'Universal code search across all repositories',
	},
	{
		id: 'batch_changes',
		label: 'Batch Changes',
		icon: 'GitBranch',
		description: 'Automate large-scale code changes across repositories',
	},
	{
		id: 'code_insights',
		label: 'Code Insights',
		icon: 'BarChart',
		description: 'Track and visualize code metrics over time',
	},
	{
		id: 'deep_search',
		label: 'Deep Search',
		icon: 'Sparkles',
		description: 'AI-powered semantic code search and understanding',
	},
]

// Helper functions
export function getStageColorClass(id: LifecycleStageId): string {
	const stage = LIFECYCLE_STAGES.find((s) => s.id === id)
    if (!stage) return 'bg-gray-500'
    
	const colorMap: Record<string, string> = {
		blue: 'bg-blue-500',
		purple: 'bg-purple-500',
		indigo: 'bg-indigo-500',
		green: 'bg-green-500',
		orange: 'bg-orange-500',
		gray: 'bg-gray-500',
	}
	return colorMap[stage.color] || 'bg-gray-500'
}

export function getStageBorderClass(id: LifecycleStageId): string {
	const stage = LIFECYCLE_STAGES.find((s) => s.id === id)
    if (!stage) return 'border-gray-500'

	const colorMap: Record<string, string> = {
		blue: 'border-blue-500',
		purple: 'border-purple-500',
		indigo: 'border-indigo-500',
		green: 'border-green-500',
		orange: 'border-orange-500',
		gray: 'border-gray-500',
	}
	return colorMap[stage.color] || 'border-gray-500'
}
