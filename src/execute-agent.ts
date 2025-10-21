#!/usr/bin/env node
import 'dotenv/config'
import { runWorkbench } from './orchestrator.js'
import { runAgent, AGENT_REGISTRY } from './agents/index.js'
import type { AccountKey } from './types.js'

interface CliArgs {
	accountName: string
	domain?: string
	salesforceId?: string
	apply?: boolean
	forceResearch?: boolean
	agent?: string
	listAgents?: boolean
	callId?: string
	date?: string
	methodology?: 'MEDDIC' | 'BANT' | 'SPICED'
}

function parseArgs(): CliArgs {
	const args = process.argv.slice(2)
	
	// Check for --list-agents flag
	if (args.includes('--list-agents')) {
		return { accountName: '', listAgents: true }
	}
	
	if (args.length === 0 || args[0].startsWith('--')) {
		console.error('Usage: npm run manage "Account Name" [options]')
		console.error('')
		console.error('Options:')
		console.error('  --domain <domain>       Account domain')
		console.error('  --sfid <id>             Salesforce ID')
		console.error('  --apply                 Apply approved changes to Salesforce')
		console.error('  --force-research        Force fresh research even if cached')
		console.error('')
		console.error('Agent Options:')
		console.error('  --agent <name>          Run specific agent (exec-summary, deal-review, qualification, etc.)')
		console.error('  --list-agents           List all available agents')
		console.error('  --call-id <id>          Call ID for postcall agent')
		console.error('  --date <date>           Date for precall agent (YYYY-MM-DD)')
		console.error('  --methodology <type>    Qualification methodology (MEDDIC, BANT, SPICED)')
		console.error('')
		console.error('Examples:')
		console.error('  npm run manage "Acme Corp"')
		console.error('  npm run manage "Acme Corp" -- --agent precall --date 2025-01-15')
		console.error('  npm run manage "Acme Corp" -- --agent postcall --call-id abc123')
		console.error('  npm run manage "Acme Corp" -- --agent qualification --methodology MEDDIC')
		process.exit(1)
	}

	const accountName = args[0]
	const domain = args.find((arg, i) => args[i - 1] === '--domain')
	const salesforceId = args.find((arg, i) => args[i - 1] === '--sfid')
	const apply = args.includes('--apply')
	const forceResearch = args.includes('--force-research')
	const agent = args.find((arg, i) => args[i - 1] === '--agent')
	const callId = args.find((arg, i) => args[i - 1] === '--call-id')
	const date = args.find((arg, i) => args[i - 1] === '--date')
	const methodology = args.find((arg, i) => args[i - 1] === '--methodology') as 'MEDDIC' | 'BANT' | 'SPICED' | undefined

	return {
		accountName,
		domain,
		salesforceId,
		apply,
		forceResearch,
		agent,
		callId,
		date,
		methodology,
	}
}

async function main() {
	try {
		const args = parseArgs()
		
		// List agents
		if (args.listAgents) {
			console.log('\n📋 Available Agents:\n')
			for (const [key, agent] of Object.entries(AGENT_REGISTRY)) {
				console.log(`  ${key.padEnd(20)} ${agent.name}`)
				console.log(`  ${' '.repeat(20)} ${agent.description}`)
				console.log('')
			}
			return
		}
		
		const accountKey: AccountKey = {
			name: args.accountName,
			domain: args.domain,
			salesforceId: args.salesforceId,
		}

		// Run specific agent
		if (args.agent) {
			console.log(`\n🤖 Running ${args.agent} agent for ${args.accountName}`)
			
			const accountSlug = args.accountName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
			const accountDataDir = `data/accounts/${accountSlug}`
			
			const result = await runAgent(args.agent, accountKey, {
				accountDataDir,
				callId: args.callId,
				date: args.date,
				methodology: args.methodology,
			})
			
			console.log('\n✅ Agent completed successfully!')
			console.log(JSON.stringify(result, null, 2))
			return
		}

		// Run full workbench
		const result = await runWorkbench({
			accountKey,
			apply: args.apply,
			forceResearch: args.forceResearch,
		})

		console.log('\n✅ Workbench completed successfully!')
		console.log(`   Output: ${result.outputDir}`)
		
	} catch (error) {
		console.error('\n❌ Error:', error instanceof Error ? error.message : String(error))
		if (process.env.DEBUG) {
			console.error(error)
		}
		process.exit(1)
	}
}

main()
