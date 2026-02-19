#!/usr/bin/env npx tsx
/**
 * Generic CLI Runner for Agent Testing
 * 
 * Usage:
 *   npm run run-agent <agentId> <accountSlug> [options]
 * 
 * Examples:
 *   npm run run-agent precall_brief acme-corp
 *   npm run run-agent live_qna acme-corp --question "What are their main pain points?"
 *   npm run run-agent meddpicc_extractor acme-corp --products code_search,batch_changes
 * 
 * Options:
 *   --question <text>     Question for live_qna agent
 *   --products <list>     Comma-separated product IDs
 *   --callId <id>         Gong call ID for call-dependent agents
 *   --opportunityId <id>  Salesforce opportunity ID
 *   --output <file>       Write output to file (default: stdout)
 *   --json                Output raw JSON (default: formatted)
 */

import { config } from 'dotenv'
config()

import type { AgentId, ProductId, AgentInput } from './agentTypes.js'
import { isValidAgentId, getAgentConfig } from './config/agents.js'
import { executeAgent } from './agents/registry.js'
import { buildOpportunityContext } from './context/buildOpportunityContext.js'
import { promises as fs } from 'fs'

// ============================================================================
// Argument Parsing
// ============================================================================

interface CliArgs {
	agentId: AgentId
	accountSlug: string
	question?: string
	products?: ProductId[]
	callId?: string
	opportunityId?: string
	output?: string
	json?: boolean
}

function parseArgs(): CliArgs {
	const args = process.argv.slice(2)

	if (args.length < 2) {
		console.error('Usage: npm run run-agent <agentId> <accountSlug> [options]')
		console.error('')
		console.error('Available agents:')
		const { AGENTS } = require('./config/agents.js')
		for (const agent of AGENTS) {
			console.error(`  ${agent.id.padEnd(25)} ${agent.label}`)
		}
		process.exit(1)
	}

	const agentId = args[0]
	const accountSlug = args[1]

	if (!isValidAgentId(agentId)) {
		console.error(`Unknown agent ID: ${agentId}`)
		console.error('')
		console.error('Available agents:')
		const { AGENTS } = require('./config/agents.js')
		for (const agent of AGENTS) {
			console.error(`  ${agent.id.padEnd(25)} ${agent.label}`)
		}
		process.exit(1)
	}

	const result: CliArgs = {
		agentId: agentId as AgentId,
		accountSlug,
	}

	// Parse options
	for (let i = 2; i < args.length; i++) {
		const arg = args[i]
		if (arg === '--question' && args[i + 1]) {
			result.question = args[++i]
		} else if (arg === '--products' && args[i + 1]) {
			result.products = args[++i].split(',') as ProductId[]
		} else if (arg === '--callId' && args[i + 1]) {
			result.callId = args[++i]
		} else if (arg === '--opportunityId' && args[i + 1]) {
			result.opportunityId = args[++i]
		} else if (arg === '--output' && args[i + 1]) {
			result.output = args[++i]
		} else if (arg === '--json') {
			result.json = true
		}
	}

	return result
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
	const args = parseArgs()
	const config = getAgentConfig(args.agentId)

	console.error(`\n🤖 Running agent: ${config?.label || args.agentId}`)
	console.error(`   Account: ${args.accountSlug}`)
	if (args.products) console.error(`   Products: ${args.products.join(', ')}`)
	if (args.callId) console.error(`   Call ID: ${args.callId}`)
	console.error('')

	// Build context
	console.error('📦 Building context...')
	const context = await buildOpportunityContext({
		accountSlug: args.accountSlug,
		opportunityId: args.opportunityId,
		products: args.products,
		includeTranscript: !!args.callId,
		transcriptCallId: args.callId,
	})

	console.error(`   Stage: ${context.stage}`)
	console.error(`   Activities: ${context.activities.length}`)
	console.error(`   Knowledge Docs: ${context.knowledgeDocs.length}`)
	console.error(`   Artifacts: ${context.artifacts.length}`)
	console.error('')

	// Build input body
	const body: Record<string, any> = {}
	if (args.question) body.question = args.question
	if (args.callId) body.callId = args.callId
	if (args.products) body.products = args.products

	// Execute agent
	console.error('⚡ Executing agent...')
	const startTime = Date.now()

	const input: AgentInput = { context, body }
	const result = await executeAgent(args.agentId, input)

	const duration = Date.now() - startTime
	console.error(`   Duration: ${duration}ms`)
	console.error(`   Model: ${result.metadata.model}`)
	if (result.metadata.tokensUsed) {
		console.error(`   Tokens: ${result.metadata.tokensUsed.input} in / ${result.metadata.tokensUsed.output} out`)
	}
	console.error('')

	// Output result
	if (result.success) {
		console.error('✅ Success!')
		console.error('')

		const output = args.json
			? JSON.stringify(result, null, 2)
			: formatOutput(result.data)

		if (args.output) {
			await fs.writeFile(args.output, output, 'utf-8')
			console.error(`📁 Output written to: ${args.output}`)
		} else {
			console.log(output)
		}
	} else {
		console.error('❌ Failed!')
		console.error(`   Error: ${result.error}`)
		process.exit(1)
	}
}

// ============================================================================
// Output Formatting
// ============================================================================

function formatOutput(data: any): string {
	if (typeof data === 'string') {
		return data
	}

	// Try to format as readable text
	const lines: string[] = []

	if (data.answer) {
		lines.push('## Answer')
		lines.push(data.answer)
		lines.push('')
	}

	if (data.bullets && data.bullets.length > 0) {
		lines.push('## Key Points')
		for (const bullet of data.bullets) {
			lines.push(`- ${bullet}`)
		}
		lines.push('')
	}

	if (data.suggestedFollowups && data.suggestedFollowups.length > 0) {
		lines.push('## Suggested Follow-ups')
		for (const followup of data.suggestedFollowups) {
			lines.push(`- ${followup}`)
		}
		lines.push('')
	}

	if (data.evidence && data.evidence.length > 0) {
		lines.push('## Evidence')
		for (const ev of data.evidence) {
			lines.push(`- [${ev.source}] ${ev.label}`)
		}
		lines.push('')
	}

	if (lines.length === 0) {
		// Fallback to JSON
		return JSON.stringify(data, null, 2)
	}

	return lines.join('\n')
}

// ============================================================================
// Entry Point
// ============================================================================

main().catch((err) => {
	console.error('Fatal error:', err)
	process.exit(1)
})
