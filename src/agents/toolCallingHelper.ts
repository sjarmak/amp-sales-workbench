/**
 * Tool Calling Helper
 * 
 * Provides utilities for agents to use tool calling for web search,
 * documentation fetching, and other autonomous actions.
 * 
 * Usage example:
 * 
 * const agenticLoop = new AgenticLoopRunner({
 *   maxIterations: 5,
 *   tools: [commonTools.web_search, commonTools.read_web_page],
 * })
 * 
 * const result = await agenticLoop.run({
 *   config: llmConfig,
 *   systemPrompt: "You are a research agent...",
 *   initialQuery: "Find the latest Sourcegraph features",
 * })
 */

import { callLlm, commonTools, formatToolResults, type LlmMessage } from '../llmClient.js'
import { web_search, read_web_page } from '../tools/webTools.js'
import type { ChatCompletionTool } from 'openai/resources/chat/completions'
import type { LlmConfig } from '../agentTypes.js'

export interface AgenticLoopConfig {
	maxIterations: number
	tools: ChatCompletionTool[]
	verbose?: boolean
}

export interface AgenticLoopInput {
	config: LlmConfig
	systemPrompt: string
	initialQuery: string
}

export interface AgenticLoopResult {
	finalContent: string
	iterationsUsed: number
	totalTokens: number
	toolCallsMade: Array<{
		name: string
		arguments: Record<string, any>
	}>
}

/**
 * Runner for agentic loops with tool calling.
 * 
 * Implements the standard agentic loop:
 * 1. LLM decides to call a tool or return final answer
 * 2. If tool call, execute it and add result to messages
 * 3. LLM continues with new context
 * 4. Repeat until final answer or max iterations
 */
export class AgenticLoopRunner {
	private config: AgenticLoopConfig

	constructor(config: AgenticLoopConfig) {
		this.config = config
	}

	async run(input: AgenticLoopInput): Promise<AgenticLoopResult> {
		const messages: LlmMessage[] = [
			{ role: 'user', content: input.initialQuery },
		]

		const toolCallsMade: Array<{ name: string; arguments: Record<string, any> }> = []
		let totalTokens = 0
		let iteration = 0

		while (iteration < this.config.maxIterations) {
			iteration++

			if (this.config.verbose) {
				console.log(`[Agentic Loop] Iteration ${iteration}/${this.config.maxIterations}`)
			}

			// Call LLM with tools available
			const response = await callLlm({
				config: input.config,
				messages: [
					{ role: 'system', content: input.systemPrompt },
					...messages,
				],
				tools: this.config.tools,
				toolChoice: 'auto',
			})

			totalTokens += response.usage.totalTokens

			// If no tool calls, we're done
			if (!response.toolCalls || response.toolCalls.length === 0) {
				return {
					finalContent: response.content,
					iterationsUsed: iteration,
					totalTokens,
					toolCallsMade,
				}
			}

			// Add assistant response to messages
			messages.push({
				role: 'assistant',
				content: response.content,
			})

			// Execute each tool call
			const toolResults: Array<{
				toolId: string
				toolName: string
				content: string
				success: boolean
			}> = []

			for (const toolCall of response.toolCalls) {
				if (this.config.verbose) {
					console.log(`[Agentic Loop] Calling tool: ${toolCall.name}`)
				}

				toolCallsMade.push({ name: toolCall.name, arguments: toolCall.arguments })

				try {
					const result = await this.executeTool(toolCall.name, toolCall.arguments)
					toolResults.push({
						toolId: toolCall.id,
						toolName: toolCall.name,
						content: result,
						success: true,
					})
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : String(error)
					toolResults.push({
						toolId: toolCall.id,
						toolName: toolCall.name,
						content: `Error: ${errorMsg}`,
						success: false,
					})
				}
			}

			// Add tool results to messages
			const resultsMessage = formatToolResults(toolResults)
			messages.push(resultsMessage)
		}

		// Max iterations reached
		return {
			finalContent: 'Max iterations reached without final answer',
			iterationsUsed: iteration,
			totalTokens,
			toolCallsMade,
		}
	}

	private async executeTool(name: string, args: Record<string, any>): Promise<string> {
		switch (name) {
			case 'web_search':
				return await web_search(args.query, args.maxResults || 5)

			case 'read_web_page':
				return await read_web_page(args.url, args.objective)

			default:
				throw new Error(`Unknown tool: ${name}`)
		}
	}
}

/**
 * Quick helper for agents that need web search capability.
 * 
 * Example:
 * 
 * const agent = makeSimpleLlmAgent({
 *   agentId: 'custom_demo_plan',
 *   buildUserMessage: (context, body) => {
 *     return buildDemoPrompt(context, body, true) // enable web search
 *   },
 *   parseOutput,
 * })
 */
export async function runWithWebSearch(
	config: LlmConfig,
	systemPrompt: string,
	initialQuery: string,
	maxIterations: number = 3
): Promise<AgenticLoopResult> {
	const runner = new AgenticLoopRunner({
		maxIterations,
		tools: [commonTools.web_search, commonTools.read_web_page],
	})

	return runner.run({
		config,
		systemPrompt,
		initialQuery,
	})
}
