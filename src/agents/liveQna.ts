/**
 * Live Q&A Agent
 * 
 * Answers questions about the customer mid-call with context awareness.
 * Designed for quick, concise responses that help the sales rep
 * navigate the conversation effectively.
 */

import type {
	AgentOutput,
	LiveQnaInput,
	LiveQnaOutput,
	OpportunityContext,
} from '../agentTypes.js'
import { makeSimpleLlmAgent, serializeContext, type Agent, cleanJsonParse } from './baseAgent.js'

// ============================================================================
// Agent Implementation
// ============================================================================

/**
 * Build user message for live Q&A.
 */
function buildUserMessage(context: OpportunityContext, body: LiveQnaInput): string {
	const contextStr = serializeContext(context)

	let message = `${contextStr}\n\n`

	// Add recent transcript if available
	if (body.recentTranscript && body.recentTranscript.length > 0) {
		message += `## Recent Transcript (from ongoing call)\n\n`
		for (const chunk of body.recentTranscript.slice(-15)) {
			message += `**${chunk.speaker}:** ${chunk.text}\n\n`
		}
		message += '\n'
	}

	message += `## Question\n\n${body.question}\n\n`
	message += `Please provide a concise answer with key points, suggested follow-ups, and evidence where applicable. Respond in JSON format.`

	return message
}

/**
 * Parse LLM output to LiveQnaOutput.
 */
function parseOutput(content: string): LiveQnaOutput {
	try {
		const parsed = cleanJsonParse<any>(content)
		return {
			answer: parsed.answer || 'Unable to generate answer.',
			bullets: Array.isArray(parsed.bullets) ? parsed.bullets : [],
			suggestedFollowups: Array.isArray(parsed.suggestedFollowups) ? parsed.suggestedFollowups : [],
			evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [],
		}
	} catch {
		// If JSON parsing fails, return the raw content as the answer
		return {
			answer: content,
			bullets: [],
			suggestedFollowups: [],
			evidence: [],
		}
	}
}

/**
 * Create the Live Q&A agent.
 */
export function createLiveQnaAgent(): Agent<LiveQnaInput, LiveQnaOutput> {
	return makeSimpleLlmAgent<LiveQnaInput, LiveQnaOutput>({
		agentId: 'live_qna',
		buildUserMessage,
		parseOutput,
		llmOverride: {
			temperature: 0.3, // Lower temperature for more consistent answers
			maxOutputTokens: 1024, // Keep responses concise
		},
	})
}

// ============================================================================
// Direct Execution Function
// ============================================================================

/**
 * Execute live Q&A directly without going through the registry.
 * Useful for API endpoints.
 */
export async function executeLiveQna(
	context: OpportunityContext,
	question: string,
	recentTranscript?: LiveQnaInput['recentTranscript']
): Promise<AgentOutput<LiveQnaOutput>> {
	const agent = createLiveQnaAgent()
	return agent.execute({
		context,
		body: { question, recentTranscript },
	})
}

/**
 * Quick Q&A without full context building.
 * Useful for simple questions where we already have context.
 */
export async function quickQna(
	context: OpportunityContext,
	question: string
): Promise<LiveQnaOutput> {
	const result = await executeLiveQna(context, question)
	if (!result.success) {
		throw new Error(result.error || 'Q&A failed')
	}
	return result.data!
}

// Export the agent factory
export default createLiveQnaAgent
