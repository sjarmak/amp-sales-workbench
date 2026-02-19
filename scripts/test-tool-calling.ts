/**
 * Test Tool Calling
 * 
 * Quick test of the tool calling capability.
 * 
 * Usage:
 *   npx tsx scripts/test-tool-calling.ts
 */

import { callLlm, commonTools, formatToolResults } from '../src/llmClient.js'
import type { LlmMessage } from '../src/llmClient.js'

async function testBasicToolCalling() {
	console.log('Testing basic tool calling...\n')

	const config = {
		provider: 'openai' as const,
		model: 'gpt-4o',
		temperature: 0.5,
		maxOutputTokens: 1024,
		costTier: 'quality' as const,
	}

	const messages: LlmMessage[] = [
		{
			role: 'user',
			content:
				'Search for information about Sourcegraph Batch Changes ' +
				'and tell me what it does in one sentence.',
		},
	]

	// First call with tools
	console.log('>>> Calling LLM with tool_choice=auto')
	const response1 = await callLlm({
		config,
		messages,
		tools: [commonTools.web_search, commonTools.read_web_page],
		toolChoice: 'auto',
	})

	console.log(`Finish reason: ${response1.finishReason}`)

	if (response1.toolCalls && response1.toolCalls.length > 0) {
		console.log(`\nLLM decided to call ${response1.toolCalls.length} tool(s):`)
		for (const tc of response1.toolCalls) {
			console.log(`  - ${tc.name}(${JSON.stringify(tc.arguments)})`)
		}

		// Simulate tool results
		const toolResults = response1.toolCalls.map((tc) => ({
			toolId: tc.id,
			toolName: tc.name,
			content:
				'Batch Changes is a tool for automating code changes ' +
				'across multiple repositories simultaneously.',
			success: true,
		}))

		// Add tool results and continue conversation
		messages.push({ role: 'assistant', content: response1.content })
		messages.push(formatToolResults(toolResults))

		console.log('\n>>> Calling LLM again with tool results')
		const response2 = await callLlm({
			config,
			messages,
		})

		console.log(`\nFinal answer: ${response2.content}`)
	} else {
		console.log(`\nNo tool calls. Direct answer: ${response1.content}`)
	}
}

async function testWithoutTools() {
	console.log('\n\nTesting without tools (direct answer)...\n')

	const config = {
		provider: 'openai' as const,
		model: 'gpt-4o',
		temperature: 0.5,
		maxOutputTokens: 1024,
		costTier: 'quality' as const,
	}

	const messages: LlmMessage[] = [
		{
			role: 'user',
			content: 'What is Sourcegraph Batch Changes?',
		},
	]

	// Call without tools
	const response = await callLlm({
		config,
		messages,
	})

	console.log(`Answer: ${response.content}`)
}

async function main() {
	try {
		await testBasicToolCalling()
		await testWithoutTools()

		console.log('\n✅ Tool calling tests completed successfully!')
	} catch (error) {
		console.error('❌ Error:', error)
		process.exit(1)
	}
}

main()
