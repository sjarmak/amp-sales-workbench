/**
 * Call Coaching Agent
 * 
 * Analyzes call recordings and provides constructive feedback on
 * discovery quality, communication, objection handling, value articulation,
 * and call control.
 */

import type {
	AgentOutput,
	OpportunityContext,
} from '../agentTypes.js'
import { makeSimpleLlmAgent, serializeContext, type Agent, cleanJsonParse } from './baseAgent.js'

// ============================================================================
// Output Types
// ============================================================================

export type CallType = 'discovery' | 'demo' | 'negotiation'
export type OverallRating = 'excellent' | 'good' | 'needs_improvement' | 'poor'
export type Priority = 'high' | 'medium' | 'low'
export type Effectiveness = 'effective' | 'partial' | 'ineffective'

export interface CallOverview {
	type: CallType
	duration: number
	participants: string[]
	overallRating: OverallRating
}

export interface Strength {
	area: string
	evidence: string
	impact: string
}

export interface Improvement {
	area: string
	observation: string
	suggestion: string
	example: string
	priority: Priority
}

export interface TalkRatio {
	rep: number
	customer: number
	recommendation: string
}

export interface QuestionsMetric {
	total: number
	open: number
	closed: number
	followUp: number
	recommendation: string
}

export interface Metrics {
	talkRatio: TalkRatio
	questionsAsked: QuestionsMetric
	silencePauses: string
	fillerWords: string
}

export interface ObjectionHandling {
	objection: string
	response: string
	effectiveness: Effectiveness
	alternative: string
}

export interface DiscoveryAnalysis {
	painsCovered: string[]
	painsMissed: string[]
	impactQuantified: boolean
	stakeholdersMapped: boolean
}

export interface Recommendation {
	focus: string
	why: string
	howToPractice: string
	resources: string[]
}

export interface PracticeScenario {
	scenario: string
	objective: string
	setup: string
}

export interface CoachingOutput {
	callOverview: CallOverview
	strengths: Strength[]
	improvements: Improvement[]
	metrics: Metrics
	objectionHandling: ObjectionHandling[]
	discoveryAnalysis: DiscoveryAnalysis
	recommendations: Recommendation[]
	practiceScenarios: PracticeScenario[]
}

// ============================================================================
// Input Types
// ============================================================================

export interface CoachingInput {
	callId: string
	focusAreas?: string[]
}

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * Build user message for coaching analysis.
 */
function buildUserMessage(context: OpportunityContext, body: CoachingInput): string {
	const contextStr = serializeContext(context)

	let message = `${contextStr}\n\n`

	message += `## Call Coaching Request\n\n`
	message += `**Call ID**: ${body.callId}\n\n`

	if (body.focusAreas && body.focusAreas.length > 0) {
		message += `### Focus Areas\n`
		message += body.focusAreas.map(a => `- ${a}`).join('\n')
		message += '\n\n'
	}

	if (context.recentTranscript && context.recentTranscript.length > 0) {
		message += `### Call Transcript\n\n`
		for (const chunk of context.recentTranscript) {
			const timestamp = chunk.startSec !== undefined ? `[${formatTime(chunk.startSec)}] ` : ''
			message += `${timestamp}**${chunk.speaker}**: ${chunk.text}\n\n`
		}
	} else {
		if (process.env.DEBUG) {
			console.warn(`[buildUserMessage] No transcript available for coaching analysis. callId=${body.callId}, hasRecentTranscript=${!!context.recentTranscript}, length=${context.recentTranscript?.length || 0}`)
		}
	}

	message += `Based on the call context above, provide comprehensive coaching feedback that:\n`
	message += `1. Identifies specific strengths with evidence from the call\n`
	message += `2. Highlights areas for improvement with actionable suggestions\n`
	message += `3. Analyzes talk ratio, questioning technique, and objection handling\n`
	message += `4. Provides practice scenarios for skill development\n\n`
	message += `Respond in JSON format matching the CoachingOutput schema.`

	return message
}

/**
 * Format seconds to MM:SS.
 */
function formatTime(seconds: number): string {
	const mins = Math.floor(seconds / 60)
	const secs = Math.floor(seconds % 60)
	return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Parse LLM output to CoachingOutput.
 */
function parseOutput(content: string): CoachingOutput {
	try {
		const parsed = cleanJsonParse<any>(content)
		
		return {
			callOverview: extractCallOverview(parsed.callOverview),
			strengths: extractStrengths(parsed.strengths),
			improvements: extractImprovements(parsed.improvements),
			metrics: extractMetrics(parsed.metrics),
			objectionHandling: extractObjectionHandling(parsed.objectionHandling),
			discoveryAnalysis: extractDiscoveryAnalysis(parsed.discoveryAnalysis),
			recommendations: extractRecommendations(parsed.recommendations),
			practiceScenarios: extractPracticeScenarios(parsed.practiceScenarios),
		}
	} catch (err) {
		console.error('Failed to parse coaching output:', err)
		return getDefaultOutput()
	}
}

/**
 * Extract call overview with defaults.
 */
function extractCallOverview(input: any): CallOverview {
	if (!input) return getDefaultCallOverview()
	
	return {
		type: normalizeCallType(input.type),
		duration: typeof input.duration === 'number' ? input.duration : parseFloat(input.duration) || 0,
		participants: Array.isArray(input.participants) ? input.participants.map(String) : [],
		overallRating: normalizeOverallRating(input.overallRating),
	}
}

function normalizeCallType(type: any): CallType {
	const normalized = String(type || '').toLowerCase()
	if (['discovery', 'demo', 'negotiation'].includes(normalized)) {
		return normalized as CallType
	}
	return 'discovery'
}

function normalizeOverallRating(rating: any): OverallRating {
	const normalized = String(rating || '').toLowerCase().replace(/\s+/g, '_')
	if (['excellent', 'good', 'needs_improvement', 'poor'].includes(normalized)) {
		return normalized as OverallRating
	}
	return 'needs_improvement'
}

/**
 * Extract strengths array.
 */
function extractStrengths(input: any): Strength[] {
	if (!Array.isArray(input)) return []
	
	return input.map((item: any) => ({
		area: String(item.area || ''),
		evidence: String(item.evidence || ''),
		impact: String(item.impact || ''),
	})).filter((s: Strength) => s.area)
}

/**
 * Extract improvements array.
 */
function extractImprovements(input: any): Improvement[] {
	if (!Array.isArray(input)) return []
	
	return input.map((item: any) => ({
		area: String(item.area || ''),
		observation: String(item.observation || ''),
		suggestion: String(item.suggestion || ''),
		example: String(item.example || ''),
		priority: normalizePriority(item.priority),
	})).filter((i: Improvement) => i.area)
}

function normalizePriority(priority: any): Priority {
	const normalized = String(priority || '').toLowerCase()
	if (['high', 'medium', 'low'].includes(normalized)) {
		return normalized as Priority
	}
	return 'medium'
}

/**
 * Extract metrics.
 */
function extractMetrics(input: any): Metrics {
	if (!input) return getDefaultMetrics()
	
	return {
		talkRatio: extractTalkRatio(input.talkRatio),
		questionsAsked: extractQuestionsMetric(input.questionsAsked),
		silencePauses: String(input.silencePauses || 'Not analyzed'),
		fillerWords: String(input.fillerWords || 'Not analyzed'),
	}
}

function extractTalkRatio(input: any): TalkRatio {
	if (!input) return { rep: 50, customer: 50, recommendation: '' }
	
	return {
		rep: typeof input.rep === 'number' ? input.rep : parseFloat(input.rep) || 50,
		customer: typeof input.customer === 'number' ? input.customer : parseFloat(input.customer) || 50,
		recommendation: String(input.recommendation || ''),
	}
}

function extractQuestionsMetric(input: any): QuestionsMetric {
	if (!input) return { total: 0, open: 0, closed: 0, followUp: 0, recommendation: '' }
	
	return {
		total: parseInt(input.total) || 0,
		open: parseInt(input.open) || 0,
		closed: parseInt(input.closed) || 0,
		followUp: parseInt(input.followUp) || 0,
		recommendation: String(input.recommendation || ''),
	}
}

/**
 * Extract objection handling array.
 */
function extractObjectionHandling(input: any): ObjectionHandling[] {
	if (!Array.isArray(input)) return []
	
	return input.map((item: any) => ({
		objection: String(item.objection || ''),
		response: String(item.response || ''),
		effectiveness: normalizeEffectiveness(item.effectiveness),
		alternative: String(item.alternative || ''),
	})).filter((o: ObjectionHandling) => o.objection)
}

function normalizeEffectiveness(effectiveness: any): Effectiveness {
	const normalized = String(effectiveness || '').toLowerCase()
	if (['effective', 'partial', 'ineffective'].includes(normalized)) {
		return normalized as Effectiveness
	}
	return 'partial'
}

/**
 * Extract discovery analysis.
 */
function extractDiscoveryAnalysis(input: any): DiscoveryAnalysis {
	if (!input) return getDefaultDiscoveryAnalysis()
	
	return {
		painsCovered: Array.isArray(input.painsCovered) ? input.painsCovered.map(String) : [],
		painsMissed: Array.isArray(input.painsMissed) ? input.painsMissed.map(String) : [],
		impactQuantified: Boolean(input.impactQuantified),
		stakeholdersMapped: Boolean(input.stakeholdersMapped),
	}
}

/**
 * Extract recommendations array.
 */
function extractRecommendations(input: any): Recommendation[] {
	if (!Array.isArray(input)) return []
	
	return input.map((item: any) => ({
		focus: String(item.focus || ''),
		why: String(item.why || ''),
		howToPractice: String(item.howToPractice || ''),
		resources: Array.isArray(item.resources) ? item.resources.map(String) : [],
	})).filter((r: Recommendation) => r.focus)
}

/**
 * Extract practice scenarios array.
 */
function extractPracticeScenarios(input: any): PracticeScenario[] {
	if (!Array.isArray(input)) return []
	
	return input.map((item: any) => ({
		scenario: String(item.scenario || ''),
		objective: String(item.objective || ''),
		setup: String(item.setup || ''),
	})).filter((p: PracticeScenario) => p.scenario)
}

// ============================================================================
// Default Value Factories
// ============================================================================

function getDefaultCallOverview(): CallOverview {
	return {
		type: 'discovery',
		duration: 0,
		participants: [],
		overallRating: 'needs_improvement',
	}
}

function getDefaultMetrics(): Metrics {
	return {
		talkRatio: { rep: 50, customer: 50, recommendation: '' },
		questionsAsked: { total: 0, open: 0, closed: 0, followUp: 0, recommendation: '' },
		silencePauses: 'Not analyzed',
		fillerWords: 'Not analyzed',
	}
}

function getDefaultDiscoveryAnalysis(): DiscoveryAnalysis {
	return {
		painsCovered: [],
		painsMissed: [],
		impactQuantified: false,
		stakeholdersMapped: false,
	}
}

function getDefaultOutput(): CoachingOutput {
	return {
		callOverview: getDefaultCallOverview(),
		strengths: [],
		improvements: [],
		metrics: getDefaultMetrics(),
		objectionHandling: [],
		discoveryAnalysis: getDefaultDiscoveryAnalysis(),
		recommendations: [],
		practiceScenarios: [],
	}
}

// ============================================================================
// Agent Factory
// ============================================================================

/**
 * Create the Coaching agent.
 */
export function createCoachingAgent(): Agent<CoachingInput, CoachingOutput> {
	return makeSimpleLlmAgent<CoachingInput, CoachingOutput>({
		agentId: 'coaching',
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
 * Execute coaching analysis directly without going through the registry.
 */
export async function executeCoaching(
	context: OpportunityContext,
	options: CoachingInput
): Promise<AgentOutput<CoachingOutput>> {
	const agent = createCoachingAgent()
	return agent.execute({
		context,
		body: options,
	})
}

/**
 * Quick coaching for simple cases.
 */
export async function quickCoaching(
	context: OpportunityContext,
	callId: string,
	focusAreas?: string[]
): Promise<CoachingOutput> {
	const result = await executeCoaching(context, { callId, focusAreas })
	if (!result.success) {
		throw new Error(result.error || 'Coaching analysis failed')
	}
	return result.data!
}

/**
 * Legacy export for compatibility with agent registry.
 * Uses a snapshot-based interface for backward compatibility.
 */
export async function generateCoachingFeedback(
	snapshot: any,
	callId: string,
	_accountDataDir?: string,
	focusAreas?: string[]
): Promise<CoachingOutput> {
	const context: OpportunityContext = {
		accountId: snapshot?.account?.Id || 'unknown',
		accountName: snapshot?.account?.Name || 'Unknown Account',
		accountDomain: snapshot?.account?.Website,
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
			id: a.id || a.Id,
			type: a.type || 'gong_call',
			date: a.date || a.Date,
			title: a.title || a.Subject,
			summary: a.summary,
			participants: a.participants,
			duration: a.duration,
			source: a.source || 'gong',
		})),
		knowledgeDocs: [],
		artifacts: [],
		recentTranscript: snapshot?.transcript || [],
	}

	return quickCoaching(context, callId, focusAreas)
}

export default createCoachingAgent
