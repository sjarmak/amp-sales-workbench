import type { AccountKey, ConsolidatedSnapshot } from '../types.js'
import { readFile } from 'fs/promises'
import { join } from 'path'

// Export all agents
export { generateExecutiveSummary } from './execSummary.js'
export { generateDealReview } from './dealReview.js'
export { generateQualification } from './qualification.js'
export { generatePreCallBrief } from './preCallBrief.js'
export { generatePostCallUpdate } from './postCallUpdate.js'
export { runHandoffAgent } from './handoff.js'
export { runClosedLostAgent } from './closedLost.js'
export { runBackfillAgent } from './backfill.js'
export { analyzeRiskHeuristics } from './riskHeuristics.js'

// Agent registry
export const AGENT_REGISTRY = {
	'exec-summary': {
		name: 'Executive Summary',
		description: 'Generate executive summary for customer engagement',
		handler: 'generateExecutiveSummary',
	},
	'deal-review': {
		name: 'Deal Review',
		description: 'Generate deal health and strategy review',
		handler: 'generateDealReview',
	},
	'qualification': {
		name: 'Qualification',
		description: 'Run MEDDIC/BANT/SPICED qualification',
		handler: 'generateQualification',
	},
	'precall': {
		name: 'Pre-Call Brief',
		description: 'Generate pre-call research and talking points',
		handler: 'generatePreCallBrief',
	},
	'postcall': {
		name: 'Post-Call Update',
		description: 'Process call recording and update CRM',
		handler: 'generatePostCallUpdate',
	},
	'handoff': {
		name: 'Handoff',
		description: 'Generate handoff document for account transitions',
		handler: 'runHandoffAgent',
	},
	'closed-lost': {
		name: 'Closed-Lost Analysis',
		description: 'Analyze closed-lost deals for insights',
		handler: 'runClosedLostAgent',
	},
	'backfill': {
		name: 'Backfill',
		description: 'Suggest missing CRM data to capture',
		handler: 'runBackfillAgent',
	},
	'risk-heuristics': {
		name: 'Risk Heuristics',
		description: 'Analyze deal risks using heuristic detection',
		handler: 'analyzeRiskHeuristics',
	},
} as const

// Helper to run any agent by name
export async function runAgent(
	agentName: string,
	accountKey: AccountKey,
	options: {
		snapshot?: ConsolidatedSnapshot
		accountDataDir?: string
		callId?: string
		date?: string
		methodology?: 'MEDDIC' | 'BANT' | 'SPICED'
		[key: string]: any
	}
): Promise<any> {
	const agent = AGENT_REGISTRY[agentName as keyof typeof AGENT_REGISTRY]
	
	if (!agent) {
		throw new Error(`Unknown agent: ${agentName}. Available agents: ${Object.keys(AGENT_REGISTRY).join(', ')}`)
	}
	
	// Load snapshot if not provided
	let snapshot = options.snapshot
	if (!snapshot && options.accountDataDir) {
		const snapshotPath = await findLatestSnapshot(options.accountDataDir)
		if (snapshotPath) {
			snapshot = JSON.parse(await readFile(snapshotPath, 'utf-8'))
		}
	}
	
	// Import and call the handler dynamically
	const module = await import(`./${agent.handler.replace('generate', '').toLowerCase()}.js`)
	const handlerFn = module[agent.handler]
	
	if (!handlerFn) {
		throw new Error(`Handler not found: ${agent.handler}`)
	}
	
	// Call with appropriate parameters based on agent type
	if (agentName === 'precall') {
		return handlerFn(accountKey, options.date, options.accountDataDir)
	} else if (agentName === 'postcall') {
		return handlerFn(accountKey, options.callId, options.accountDataDir)
	} else if (agentName === 'qualification') {
		return handlerFn(snapshot, options.methodology, options.accountDataDir)
	} else {
		return handlerFn(snapshot, options.accountDataDir)
	}
}

async function findLatestSnapshot(accountDataDir: string): Promise<string | null> {
	try {
		const { readdir } = await import('fs/promises')
		const snapshotsDir = join(accountDataDir, 'snapshots')
		const files = await readdir(snapshotsDir)
		const snapshots = files.filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
		
		if (snapshots.length === 0) return null
		
		snapshots.sort().reverse()
		return join(snapshotsDir, snapshots[0])
	} catch {
		return null
	}
}
