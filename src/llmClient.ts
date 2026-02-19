/**
 * LLM Client Wrapper
 * 
 * Provides a unified interface for calling LLMs with agent-specific configurations.
 * Supports OpenAI models with configurable temperature, max tokens, and cost tier.
 * Now with tool calling support for agent autonomy.
 */

import OpenAI from 'openai'
import type { ChatCompletionTool } from 'openai/resources/chat/completions'
import type { LlmConfig, CostTier } from './agentTypes.js'

let openaiClient: OpenAI | null = null

function getOpenAIClient(): OpenAI {
	if (!openaiClient) {
		const apiKey = process.env.OPENAI_API_KEY
		if (!apiKey) {
			throw new Error('OPENAI_API_KEY environment variable is required')
		}
		openaiClient = new OpenAI({ apiKey })
	}
	return openaiClient
}

export interface LlmMessage {
	role: 'system' | 'user' | 'assistant'
	content: string
}

export interface LlmCallOptions {
	config: LlmConfig
	messages: LlmMessage[]
	responseFormat?: 'text' | 'json'
	tools?: ChatCompletionTool[]
	toolChoice?: 'auto' | 'required' | 'none'
}

export interface LlmCallResult {
	content: string
	toolCalls?: Array<{
		id: string
		name: string
		arguments: Record<string, any>
	}>
	usage: {
		inputTokens: number
		outputTokens: number
		totalTokens: number
	}
	model: string
	finishReason: string
}

/**
 * Call an LLM with the given configuration and messages.
 * Supports tool calling for agent autonomy.
 */
export async function callLlm(options: LlmCallOptions): Promise<LlmCallResult> {
	const { config, messages, responseFormat = 'text', tools, toolChoice } = options

	if (config.provider !== 'openai') {
		throw new Error(`Unsupported LLM provider: ${config.provider}`)
	}

	const client = getOpenAIClient()

	const response = await client.chat.completions.create({
		model: config.model,
		messages: messages.map((m) => ({
			role: m.role,
			content: m.content,
		})),
		temperature: config.temperature,
		max_tokens: config.maxOutputTokens,
		response_format: responseFormat === 'json' ? { type: 'json_object' } : undefined,
		tools: tools ? tools : undefined,
		tool_choice: tools && toolChoice ? toolChoice : undefined,
	})

	const choice = response.choices[0]
	if (!choice?.message) {
		throw new Error('No response from LLM')
	}

	const result: LlmCallResult = {
		content: choice.message.content || '',
		usage: {
			inputTokens: response.usage?.prompt_tokens ?? 0,
			outputTokens: response.usage?.completion_tokens ?? 0,
			totalTokens: response.usage?.total_tokens ?? 0,
		},
		model: response.model,
		finishReason: choice.finish_reason ?? 'unknown',
	}

	// Handle tool calls if present
	if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
		result.toolCalls = choice.message.tool_calls
			.filter((tc): tc is OpenAI.ChatCompletionMessageToolCall => 'function' in tc)
			.map((tc) => ({
				id: tc.id,
				name: tc.function.name,
				arguments: JSON.parse(tc.function.arguments),
			}))
	}

	return result
}

/**
 * Call an LLM and parse the response as JSON.
 */
export async function callLlmJson<T = any>(options: Omit<LlmCallOptions, 'responseFormat'>): Promise<{
	data: T
	usage: LlmCallResult['usage']
	model: string
}> {
	const result = await callLlm({ ...options, responseFormat: 'json' })

	try {
		const data = JSON.parse(result.content) as T
		return {
			data,
			usage: result.usage,
			model: result.model,
		}
	} catch (err) {
		throw new Error(`Failed to parse LLM response as JSON: ${err}`)
	}
}

/**
 * Simple text completion with a system prompt and user message.
 */
export async function complete(options: {
	systemPrompt: string
	userMessage: string
	config: LlmConfig
	responseFormat?: 'text' | 'json'
}): Promise<LlmCallResult> {
	return callLlm({
		config: options.config,
		messages: [
			{ role: 'system', content: options.systemPrompt },
			{ role: 'user', content: options.userMessage },
		],
		responseFormat: options.responseFormat,
	})
}

/**
 * Estimate cost for a call based on token usage.
 * Prices as of Dec 2024 (approximate, check OpenAI pricing for current rates).
 */
export function estimateCost(usage: LlmCallResult['usage'], model: string): number {
	const pricing: Record<string, { input: number; output: number }> = {
		'gpt-4.1-mini': { input: 0.00015, output: 0.0006 },
		'gpt-4.1': { input: 0.002, output: 0.008 },
		'gpt-4o': { input: 0.0025, output: 0.01 },
		'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
	}

	const rates = pricing[model] || pricing['gpt-4o']
	const inputCost = (usage.inputTokens / 1000) * rates.input
	const outputCost = (usage.outputTokens / 1000) * rates.output
	return inputCost + outputCost
}

/**
 * Get a preset LLM config by cost tier.
 */
export function getPresetConfig(tier: CostTier): LlmConfig {
	const presets: Record<CostTier, LlmConfig> = {
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
	return presets[tier]
}

// ============================================================================
// Tool Definitions and Helpers
// ============================================================================

/**
 * Common tool definitions for agents.
 */
export const commonTools = {
	web_search: {
		type: 'function',
		function: {
			name: 'web_search',
			description: 'Search the web for information using a search query',
			parameters: {
				type: 'object',
				properties: {
					query: {
						type: 'string',
						description: 'The search query to execute',
					},
					maxResults: {
						type: 'number',
						description: 'Maximum number of search results to return (default: 5)',
					},
				},
				required: ['query'],
			},
		},
	} as ChatCompletionTool,
	read_web_page: {
		type: 'function',
		function: {
			name: 'read_web_page',
			description: 'Fetch and read the content of a web page',
			parameters: {
				type: 'object',
				properties: {
					url: {
						type: 'string',
						description: 'The URL of the page to read',
					},
					objective: {
						type: 'string',
						description: 'Optional: what information you are looking for on the page',
					},
				},
				required: ['url'],
			},
		},
	} as ChatCompletionTool,
}

/**
 * Execute a tool call result and format it for the LLM.
 * Note: Actual implementation depends on your tool infrastructure.
 */
export interface ToolExecutionResult {
	toolId: string
	toolName: string
	content: string
	success: boolean
}

/**
 * Format tool results as an LLM message for continuing the conversation.
 */
export function formatToolResults(results: ToolExecutionResult[]): LlmMessage {
	const content = results
		.map((r) => `Tool: ${r.toolName}\nResult: ${r.content}`)
		.join('\n\n')
	return {
		role: 'user',
		content,
	}
}
