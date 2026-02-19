/**
 * Base Agent Interface and Factory
 * 
 * Provides a unified interface for creating agents that:
 * - Load system prompts from file
 * - Build context from account data
 * - Call LLM with proper configuration
 * - Return structured outputs
 */

import { promises as fs } from 'fs'
import * as path from 'path'
import type {
	AgentConfig,
	AgentInput,
	AgentOutput,
	AgentId,
	OpportunityContext,
	LlmConfig,
} from '../agentTypes.js'
import { callLlm, type LlmMessage } from '../llmClient.js'
import { getAgentConfig } from '../config/agents.js'

// ============================================================================
// Agent Interface
// ============================================================================

export interface Agent<TInput = Record<string, any>, TOutput = any> {
	config: AgentConfig
	execute(input: AgentInput<TInput>): Promise<AgentOutput<TOutput>>
}

// ============================================================================
// Prompt Loading
// ============================================================================

const promptCache = new Map<string, string>()

/**
 * Load a system prompt from file with caching.
 */
export async function loadSystemPrompt(promptPath: string): Promise<string> {
	if (promptCache.has(promptPath)) {
		return promptCache.get(promptPath)!
	}

	const fullPath = path.join(process.cwd(), promptPath)
	try {
		const content = await fs.readFile(fullPath, 'utf-8')
		promptCache.set(promptPath, content)
		return content
	} catch (err) {
		throw new Error(`Failed to load system prompt from ${fullPath}: ${err}`)
	}
}

/**
 * Clear the prompt cache (useful for development).
 */
export function clearPromptCache(): void {
	promptCache.clear()
}

// ============================================================================
// Context Serialization
// ============================================================================

/**
 * Serialize OpportunityContext to a string for inclusion in prompts.
 */
export function serializeContext(context: OpportunityContext): string {
	const sections: string[] = []

	sections.push(`## Account Information
- **Account Name:** ${context.accountName}
- **Account ID:** ${context.accountId}
${context.accountDomain ? `- **Domain:** ${context.accountDomain}` : ''}
${context.opportunityId ? `- **Opportunity ID:** ${context.opportunityId}` : ''}
${context.opportunityName ? `- **Opportunity Name:** ${context.opportunityName}` : ''}
- **Lifecycle Stage:** ${context.stage}
- **Products of Interest:** ${context.products.length > 0 ? context.products.join(', ') : 'Not specified'}`)

	if (context.salesforceSnapshot.account) {
		const acc = context.salesforceSnapshot.account
		sections.push(`## Salesforce Account
- **Industry:** ${acc.Industry || 'Unknown'}
- **Annual Revenue:** ${acc.AnnualRevenue ? `$${acc.AnnualRevenue.toLocaleString()}` : 'Unknown'}
- **Employees:** ${acc.NumberOfEmployees || 'Unknown'}
- **Website:** ${acc.Website || 'Unknown'}`)
	}

	if (context.salesforceSnapshot.opportunity) {
		const opp = context.salesforceSnapshot.opportunity
		sections.push(`## Salesforce Opportunity
- **Stage:** ${opp.StageName || 'Unknown'}
- **Amount:** ${opp.Amount ? `$${opp.Amount.toLocaleString()}` : 'Unknown'}
- **Close Date:** ${opp.CloseDate || 'Unknown'}
- **Probability:** ${opp.Probability ? `${opp.Probability}%` : 'Unknown'}`)
	}

	if (context.salesforceSnapshot.contacts && context.salesforceSnapshot.contacts.length > 0) {
		const contacts = context.salesforceSnapshot.contacts.slice(0, 10)
		sections.push(`## Key Contacts (${contacts.length} shown)
${contacts.map((c) => `- **${c.Name}** - ${c.Title || 'No title'} (${c.Email || 'No email'})`).join('\n')}`)
	}

	if (context.activities.length > 0) {
		const activities = context.activities.slice(0, 10)
		sections.push(`## Recent Activities (${activities.length} shown)
${activities.map((a) => `- **${a.date}** [${a.type}] ${a.title}${a.summary ? `: ${a.summary}` : ''}`).join('\n')}`)
	}

	if (context.knowledgeDocs.length > 0) {
		sections.push(`## Relevant Knowledge Docs
${context.knowledgeDocs.map((d) => `- **${d.type}:** ${d.title}${d.excerpt ? ` - ${d.excerpt}` : ''}`).join('\n')}`)
	}

	if (context.artifacts.length > 0) {
		const artifacts = context.artifacts.slice(0, 5)
		const artifactSections = artifacts.map((a: any) => {
			if (a._fullOutput) {
				return `### ${a.title} (${a.artifactType}, ${a.lastRunAt})
\`\`\`json
${JSON.stringify(a._fullOutput, null, 2)}
\`\`\``
			}
			return `- **${a.title}** (${a.artifactType}, ${a.lastRunAt}): ${a.summary}`
		})
		sections.push(`## Previous Agent Outputs\n${artifactSections.join('\n\n')}`)
	}

	if (context.recentTranscript && context.recentTranscript.length > 0) {
		const transcript = context.recentTranscript.slice(-20) // Last 20 chunks
		sections.push(`## Recent Transcript
${transcript.map((t) => `**${t.speaker}:** ${t.text}`).join('\n\n')}`)
	}

	return sections.join('\n\n')
}

// ============================================================================
// Agent Factory
// ============================================================================

export interface SimpleAgentOptions<TInput, TOutput> {
	agentId: AgentId
	parseOutput?: (content: string) => TOutput
	buildUserMessage?: (context: OpportunityContext, body: TInput) => string
	llmOverride?: Partial<LlmConfig>
}

/**
 * Create a simple LLM-based agent that:
 * 1. Loads the system prompt from config
 * 2. Serializes the context
 * 3. Calls the LLM
 * 4. Parses the response
 */
export function makeSimpleLlmAgent<TInput = Record<string, any>, TOutput = any>(
	options: SimpleAgentOptions<TInput, TOutput>
): Agent<TInput, TOutput> {
	const config = getAgentConfig(options.agentId)
	if (!config) {
		throw new Error(`Unknown agent ID: ${options.agentId}`)
	}

	return {
		config,
		async execute(input: AgentInput<TInput>): Promise<AgentOutput<TOutput>> {
			const startTime = Date.now()

			try {
				// Load system prompt
				const systemPrompt = await loadSystemPrompt(config.systemPromptPath)

				// Build user message
				const contextStr = serializeContext(input.context)
				const userMessage = options.buildUserMessage
					? options.buildUserMessage(input.context, input.body)
					: `${contextStr}\n\n## Request\n${JSON.stringify(input.body, null, 2)}`

				// Prepare LLM config
				const llmConfig: LlmConfig = {
					...config.defaultLlm,
					...options.llmOverride,
				}

				// Call LLM
				const messages: LlmMessage[] = [
					{ role: 'system', content: systemPrompt },
					{ role: 'user', content: userMessage },
				]

				const result = await callLlm({
					config: llmConfig,
					messages,
					responseFormat: options.parseOutput ? 'text' : 'json',
				})

				// Parse output
				let data: TOutput
				if (options.parseOutput) {
					data = options.parseOutput(result.content)
				} else {
					data = JSON.parse(result.content) as TOutput
				}

				return {
					success: true,
					data,
					metadata: {
						agentId: config.id,
						stage: config.stage,
						executionTimeMs: Date.now() - startTime,
						model: result.model,
						tokensUsed: {
							input: result.usage.inputTokens,
							output: result.usage.outputTokens,
						},
						timestamp: new Date().toISOString(),
					},
				}
			} catch (err) {
				return {
					success: false,
					error: err instanceof Error ? err.message : String(err),
					metadata: {
						agentId: config.id,
						stage: config.stage,
						executionTimeMs: Date.now() - startTime,
						model: config.defaultLlm.model,
						timestamp: new Date().toISOString(),
					},
				}
			}
		},
	}
}

/**
 * Create a JSON-output agent that returns structured data.
 */
export function makeJsonAgent<TInput = Record<string, any>, TOutput = any>(
	options: Omit<SimpleAgentOptions<TInput, TOutput>, 'parseOutput'>
): Agent<TInput, TOutput> {
	return makeSimpleLlmAgent<TInput, TOutput>({
		...options,
		parseOutput: undefined, // Will use JSON response format
	})
}

/**
 * Create an agent that returns markdown text.
 */
export function makeTextAgent<TInput = Record<string, any>>(
	options: Omit<SimpleAgentOptions<TInput, string>, 'parseOutput'>
): Agent<TInput, string> {
	return makeSimpleLlmAgent<TInput, string>({
		...options,
		parseOutput: (content) => content, // Return raw text
	})
}

// ============================================================================
// JSON Parsing Utilities
// ============================================================================

/**
 * Clean and parse JSON from LLM response, removing markdown code fences if present.
 * Useful for handling cases where LLM wraps JSON in ```json ... ``` blocks.
 */
export function cleanJsonParse<T>(content: string): T {
	let jsonStr = content.trim()
	
	// Remove markdown code fences if present
	if (jsonStr.startsWith('```json')) {
		jsonStr = jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '')
	} else if (jsonStr.startsWith('```')) {
		jsonStr = jsonStr.replace(/^```\n?/, '').replace(/\n?```$/, '')
	}
	
	return JSON.parse(jsonStr)
}
