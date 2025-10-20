#!/usr/bin/env node
import 'dotenv/config'
import { runWorkbench } from './orchestrator.js'
import type { AccountKey } from './types.js'

interface CliArgs {
	accountName: string
	domain?: string
	salesforceId?: string
	apply?: boolean
	forceResearch?: boolean
}

function parseArgs(): CliArgs {
	const args = process.argv.slice(2)
	
	if (args.length === 0) {
		console.error('Usage: npm run manage "Account Name" [options]')
		console.error('Options:')
		console.error('  --domain <domain>       Account domain')
		console.error('  --sfid <id>             Salesforce ID')
		console.error('  --apply                 Apply approved changes to Salesforce')
		console.error('  --force-research        Force fresh research even if cached')
		process.exit(1)
	}

	const accountName = args[0]
	const domain = args.find((arg, i) => args[i - 1] === '--domain')
	const salesforceId = args.find((arg, i) => args[i - 1] === '--sfid')
	const apply = args.includes('--apply')
	const forceResearch = args.includes('--force-research')

	return {
		accountName,
		domain,
		salesforceId,
		apply,
		forceResearch,
	}
}

async function main() {
	try {
		const args = parseArgs()
		
		const accountKey: AccountKey = {
			name: args.accountName,
			domain: args.domain,
			salesforceId: args.salesforceId,
		}

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
