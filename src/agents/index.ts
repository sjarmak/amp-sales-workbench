/**
 * Agent Index - Central export point for all agents
 * 
 * This module re-exports all agent functions for easy consumption
 * by other parts of the application.
 */

// Agent types are defined in agentTypes.ts

// ============================================================================
// V2 Agent Framework Exports
// ============================================================================

// Base agent utilities
export { makeSimpleLlmAgent, makeJsonAgent, makeTextAgent, serializeContext, loadSystemPrompt } from './baseAgent.js'

// Agent registry
export { getAgent, listAgents, listAgentsByStage, executeAgent, getQuickActions, getCallAgents } from './registry.js'

// Solution Mapping Stage
export { createSolutionMapAgent, executeSolutionMap, quickSolutionMap } from './solutionMap.js'
export type { SolutionMapInput } from './solutionMap.js'

export { createBusinessCaseAgent, executeBusinessCase, quickBusinessCase } from './businessCase.js'
export type { BusinessCaseInput } from './businessCase.js'

export { createEvaluationCriteriaAgent, executeEvaluationCriteria, quickEvaluationCriteria } from './evaluationCriteria.js'
export type { EvaluationCriteriaInput, EvaluationCriteriaOutput } from './evaluationCriteria.js'

export { createMutualActionPlanAgent, executeMutualActionPlan, quickMutualActionPlan } from './mutualActionPlan.js'
export type { MutualActionPlanInput, MutualActionPlanOutput } from './mutualActionPlan.js'

// Validation Stage
export { createExecTalkingPointsAgent, executeExecTalkingPoints, quickExecTalkingPoints } from './execTalkingPoints.js'
export type { ExecTalkingPointsInput, ExecTalkingPointsOutput } from './execTalkingPoints.js'

export { createCustomizedDemoAgent, executeCustomizedDemo, quickCustomizedDemo } from './customizedDemo.js'
export type { CustomizedDemoInput, CustomizedDemoOutput } from './customizedDemo.js'

// Global Agents
export { createLiveQnaAgent, executeLiveQna, quickQna } from './liveQna.js'

export { createExecSummaryAgent, executeExecSummary, quickExecSummary } from './execSummary.js'
export type { ExecSummaryInput, ExecSummaryOutput } from './execSummary.js'

export { createDealReviewAgent, executeDealReview, quickDealReview } from './dealReview.js'
export type { DealReviewInput, DealReviewOutput } from './dealReview.js'

export { createQualificationAgent, executeQualification, quickQualification } from './qualification.js'
export type { QualificationInput, QualificationOutput, QualMethodology } from './qualification.js'

export { createPreCallBriefAgent, executePreCallBrief, quickPreCallBrief } from './preCallBrief.js'
export type { PreCallBriefInput, PreCallBriefOutput } from './preCallBrief.js'

export { createPostCallUpdateAgent, executePostCallUpdate, quickPostCallUpdate } from './postCallUpdate.js'
export type { PostCallUpdateInput, PostCallUpdateOutput } from './postCallUpdate.js'

export { createCoachingAgent, executeCoaching, quickCoaching } from './coaching.js'
export type { CoachingInput, CoachingOutput } from './coaching.js'

export { createFollowUpEmailAgent, executeFollowUpEmail, quickFollowUpEmail } from './followUpEmail.js'
export type { FollowUpEmailInput, FollowUpEmailOutput } from './followUpEmail.js'

export { createMeetingSummaryAgent, executeMeetingSummary, quickMeetingSummary } from './meetingSummary.js'
export type { MeetingSummaryInput, MeetingSummaryOutput } from './meetingSummary.js'

export { createRiskHeuristicsAgent, executeRiskHeuristics, quickRiskHeuristics } from './riskHeuristics.js'
export type { RiskHeuristicsInput, RiskHeuristicsOutput } from './riskHeuristics.js'

export { createBackfillAgent, executeBackfill, quickBackfill } from './backfill.js'
export type { BackfillInput, BackfillOutput } from './backfill.js'

// Post-Mortem Stage
export { createClosedWonAgent, executeClosedWon, quickClosedWon } from './closedWon.js'
export type { ClosedWonInput, ClosedWonOutput } from './closedWon.js'

export { createClosedLostAgent, executeClosedLost, quickClosedLost } from './closedLost.js'
export type { ClosedLostInput, ClosedLostOutput } from './closedLost.js'

export { createWinStoryAgent, executeWinStory, quickWinStory } from './winStory.js'
export type { WinStoryInput, WinStoryOutput } from './winStory.js'

export { createLossAnalysisAgent, executeLossAnalysis, quickLossAnalysis } from './lossAnalysis.js'
export type { LossAnalysisInput, LossAnalysisOutput } from './lossAnalysis.js'

// Handoff Stage
export { createHandoffAgent, executeHandoff, quickHandoff } from './handoff.js'
export type { HandoffInput, HandoffOutput } from './handoff.js'

// ============================================================================
// Agent Runner (for API usage)
// ============================================================================

export { runAgent, getAgentInfo } from './agent-runner.js'
export type { AgentName, AgentOptions, AgentResult } from './agent-runner.js'

// ============================================================================
// Agent Registry (legacy compatibility)
// ============================================================================

export const AGENT_REGISTRY = {
	'exec-summary': {
		name: 'Executive Summary',
		description: 'Generate executive summary for customer engagement',
		handler: 'executeExecSummary',
	},
	'deal-review': {
		name: 'Deal Review',
		description: 'Generate deal health and strategy review',
		handler: 'executeDealReview',
	},
	'qualification': {
		name: 'Qualification',
		description: 'Run MEDDIC/BANT/SPICED qualification',
		handler: 'executeQualification',
	},
	'precall': {
		name: 'Pre-Call Brief',
		description: 'Generate pre-call research with auto-detected meeting type',
		handler: 'executePreCallBrief',
	},
	'postcall': {
		name: 'Post-Call Update',
		description: 'Process call recording and update CRM',
		handler: 'executePostCallUpdate',
	},
	'handoff': {
		name: 'Handoff',
		description: 'Generate handoff document for account transitions',
		handler: 'executeHandoff',
	},
	'closed-lost': {
		name: 'Closed-Lost Analysis',
		description: 'Analyze closed-lost deals for insights',
		handler: 'executeClosedLost',
	},
	'closed-won': {
		name: 'Closed-Won Analysis',
		description: 'Capture win story, differentiators, repeatable plays',
		handler: 'executeClosedWon',
	},
	'backfill': {
		name: 'Backfill',
		description: 'Suggest missing CRM data to capture',
		handler: 'executeBackfill',
	},
	'risk-heuristics': {
		name: 'Risk Heuristics',
		description: 'Analyze deal risks using heuristic detection',
		handler: 'executeRiskHeuristics',
	},
	'solution-map': {
		name: 'Solution Map',
		description: 'Map customer pains to Sourcegraph products',
		handler: 'executeSolutionMap',
	},
	'business-case': {
		name: 'Business Case',
		description: 'Generate ROI and business case documentation',
		handler: 'executeBusinessCase',
	},
	'evaluation-criteria': {
		name: 'Evaluation Criteria',
		description: 'Define success criteria and evaluation rubric',
		handler: 'executeEvaluationCriteria',
	},
	'customized-demo': {
		name: 'Customized Demo',
		description: 'Generate qualification-aware demo plan with feature focus',
		handler: 'executeCustomizedDemo',
	},
	'mutual-action-plan': {
		name: 'Mutual Action Plan',
		description: 'Generate MAP with milestones, stakeholders, and success criteria',
		handler: 'executeMutualActionPlan',
	},
	'coaching': {
		name: 'Coaching Feedback',
		description: 'Analyze call for coaching insights',
		handler: 'executeCoaching',
	},
	'followup-email': {
		name: 'Follow-Up Email',
		description: 'Generate personalized follow-up email after call',
		handler: 'executeFollowUpEmail',
	},
	'meeting-summary': {
		name: 'Meeting Summary',
		description: 'Extract objectives, blockers, next steps from call',
		handler: 'executeMeetingSummary',
	},
	'live-qna': {
		name: 'Live Q&A',
		description: 'Answer questions about customer mid-call',
		handler: 'executeLiveQna',
	},
	'exec-talking-points': {
		name: 'Executive Talking Points',
		description: 'Prepare talking points for executive engagement',
		handler: 'executeExecTalkingPoints',
	},
} as const
