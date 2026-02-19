/**
 * Central Data Lake Export
 * 
 * RFC: Prepare for centralized data endpoint.
 * After each workbench run, appends normalized AccountRow + OpportunityRow
 * to data/lake/*.jsonl for future analytics API.
 * 
 * Fields: accountId, name, domain, stageSummary, lastCallAt, lastEmailAt, ownerId, segment
 */

import { appendFile, mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import type { AccountKey, ConsolidatedSnapshot } from '../types.js'

/**
 * Normalized account record for data lake
 */
export interface AccountRow {
	/** Unique identifier for this row */
	rowId: string
	/** Salesforce Account ID */
	accountId: string
	/** Account name */
	name: string
	/** Primary domain */
	domain?: string
	/** Industry classification */
	industry?: string
	/** Size/segment classification */
	segment?: string
	/** Number of open opportunities */
	openOpportunities: number
	/** Total pipeline value */
	totalPipelineValue: number
	/** Most advanced stage among open opportunities */
	stageSummary: string
	/** ISO timestamp of last Gong call */
	lastCallAt?: string
	/** ISO timestamp of last email */
	lastEmailAt?: string
	/** ISO timestamp of last any interaction */
	lastInteractionAt?: string
	/** Salesforce Owner User ID */
	ownerId?: string
	/** Owner name if available */
	ownerName?: string
	/** Risk score (0-100) */
	riskScore?: number
	/** Risk factors identified */
	riskFactors?: string[]
	/** Qualification score (0-5) */
	qualificationScore?: number
	/** Days since last activity */
	daysSinceActivity?: number
	/** Snapshot timestamp */
	snapshotAt: string
	/** When this row was exported */
	exportedAt: string
}

/**
 * Normalized opportunity record for data lake
 */
export interface OpportunityRow {
	/** Unique identifier for this row */
	rowId: string
	/** Salesforce Opportunity ID */
	opportunityId: string
	/** Salesforce Account ID */
	accountId: string
	/** Account name (denormalized for convenience) */
	accountName: string
	/** Opportunity name */
	name: string
	/** Current stage */
	stage: string
	/** Deal amount */
	amount?: number
	/** Expected close date */
	closeDate?: string
	/** Probability percentage */
	probability?: number
	/** Owner ID */
	ownerId?: string
	/** Feature requests from this opportunity */
	featureRequests?: string[]
	/** Success criteria defined */
	successCriteria?: string
	/** Feedback trends */
	feedbackTrends?: string
	/** Path to close notes */
	pathToClose?: string
	/** Likelihood assessment */
	likelihood?: string
	/** Days until close */
	daysToClose?: number
	/** Is past close date */
	isPastDue: boolean
	/** Snapshot timestamp */
	snapshotAt: string
	/** When this row was exported */
	exportedAt: string
}

/**
 * Lake metadata for tracking exports
 */
interface LakeMetadata {
	version: string
	lastExportAt: string
	totalAccountRows: number
	totalOpportunityRows: number
	accounts: Record<string, { lastExportAt: string; rowCount: number }>
}

/**
 * Export a consolidated snapshot to the data lake
 */
export async function exportToLake(
	snapshot: ConsolidatedSnapshot,
	accountKey: AccountKey
): Promise<{ accountRows: number; opportunityRows: number }> {
	const lakeDir = join(process.cwd(), 'data', 'lake')
	await mkdir(lakeDir, { recursive: true })

	const now = new Date().toISOString()
	const snapshotAt = snapshot.generatedAt

	// Generate account row
	const accountRow = buildAccountRow(snapshot, accountKey, snapshotAt, now)

	// Generate opportunity rows
	const opportunityRows = buildOpportunityRows(snapshot, accountKey, snapshotAt, now)

	// Append to JSONL files
	const accountsFile = join(lakeDir, 'accounts.jsonl')
	const opportunitiesFile = join(lakeDir, 'opportunities.jsonl')

	await appendFile(accountsFile, JSON.stringify(accountRow) + '\n', 'utf-8')

	for (const oppRow of opportunityRows) {
		await appendFile(opportunitiesFile, JSON.stringify(oppRow) + '\n', 'utf-8')
	}

	// Update metadata
	await updateLakeMetadata(lakeDir, accountKey, now, 1, opportunityRows.length)

	return {
		accountRows: 1,
		opportunityRows: opportunityRows.length,
	}
}

function buildAccountRow(
	snapshot: ConsolidatedSnapshot,
	accountKey: AccountKey,
	snapshotAt: string,
	exportedAt: string
): AccountRow {
	const profile = snapshot.accountProfile
	const opps = snapshot.opportunities || []
	const timeline = snapshot.interactionTimeline

	// Calculate stage summary (most advanced open stage)
	const stageOrder = ['Closed Won', 'Negotiation', 'Proposal', 'Evaluation', 'Discovery', 'Qualification']
	const openOpps = opps.filter((o) => !o.stage?.toLowerCase().includes('closed'))
	const stageSummary = openOpps.length > 0
		? openOpps.sort((a, b) => {
				const aIdx = stageOrder.findIndex((s) => a.stage?.includes(s)) ?? 999
				const bIdx = stageOrder.findIndex((s) => b.stage?.includes(s)) ?? 999
				return aIdx - bIdx
			})[0]?.stage || 'Unknown'
		: 'No Open Opportunities'

	// Calculate pipeline value
	const totalPipelineValue = openOpps.reduce((sum, o) => sum + (o.amount || 0), 0)

	// Get last interaction dates from timeline
	const lastCallAt = timeline?.interactions?.find((i) => i.type === 'call')?.date
	const lastEmailAt = timeline?.interactions?.find((i) => i.type === 'email')?.date
	const lastInteractionAt = timeline?.lastInteractionDate

	// Calculate days since activity
	let daysSinceActivity: number | undefined
	if (lastInteractionAt) {
		const lastDate = new Date(lastInteractionAt)
		daysSinceActivity = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
	}

	// Risk factors from RiskHeuristics structure
	const riskHeuristics = snapshot.riskHeuristics
	const riskFactors: string[] = []
	let riskScore = 0
	
	if (riskHeuristics) {
		const heuristicKeys: Array<keyof typeof riskHeuristics> = [
			'noChampion', 'staleNextMeeting', 'approachingCloseDate', 'blockersPresent',
			'lowEngagement', 'competitiveThreats', 'budgetUnclear', 'decisionProcessStalled'
		]
		for (const key of heuristicKeys) {
			const heuristic = riskHeuristics[key]
			if (heuristic?.detected) {
				riskFactors.push(heuristic.message)
				// Calculate risk score based on severity
				if (heuristic.severity === 'critical') riskScore += 25
				else if (heuristic.severity === 'high') riskScore += 15
				else if (heuristic.severity === 'medium') riskScore += 10
				else riskScore += 5
			}
		}
	}

	return {
		rowId: `acct-${accountKey.salesforceId || accountKey.name}-${Date.now()}`,
		accountId: accountKey.salesforceId || '',
		name: profile?.name || accountKey.name,
		domain: profile?.domain || accountKey.domain,
		industry: profile?.industry,
		segment: profile?.size,
		openOpportunities: openOpps.length,
		totalPipelineValue,
		stageSummary,
		lastCallAt,
		lastEmailAt,
		lastInteractionAt,
		ownerId: undefined, // Would need to pull from SF
		ownerName: undefined,
		riskScore: riskScore > 0 ? Math.min(100, riskScore) : undefined,
		riskFactors: riskFactors.length > 0 ? riskFactors : undefined,
		qualificationScore: undefined, // Would need to pull from qualification report
		daysSinceActivity,
		snapshotAt,
		exportedAt,
	}
}

function buildOpportunityRows(
	snapshot: ConsolidatedSnapshot,
	accountKey: AccountKey,
	snapshotAt: string,
	exportedAt: string
): OpportunityRow[] {
	const opps = snapshot.opportunities || []

	return opps.map((opp): OpportunityRow => {
		// Calculate days to close
		let daysToClose: number | undefined
		let isPastDue = false
		if (opp.closeDate) {
			const closeDate = new Date(opp.closeDate)
			daysToClose = Math.floor((closeDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
			isPastDue = daysToClose < 0
		}

		return {
			rowId: `opp-${opp.id || opp.name}-${Date.now()}`,
			opportunityId: opp.id || '',
			accountId: accountKey.salesforceId || '',
			accountName: snapshot.accountProfile?.name || accountKey.name,
			name: opp.name,
			stage: opp.stage,
			amount: opp.amount,
			closeDate: opp.closeDate,
			probability: undefined, // Would need from SF
			ownerId: undefined,
			featureRequests: opp.featureRequests,
			successCriteria: opp.successCriteria,
			feedbackTrends: opp.feedbackTrends,
			pathToClose: opp.pathToClose,
			likelihood: opp.likelihood,
			daysToClose,
			isPastDue,
			snapshotAt,
			exportedAt,
		}
	})
}

async function updateLakeMetadata(
	lakeDir: string,
	accountKey: AccountKey,
	exportedAt: string,
	accountRows: number,
	opportunityRows: number
): Promise<void> {
	const metaFile = join(lakeDir, '_metadata.json')

	let metadata: LakeMetadata
	try {
		const content = await readFile(metaFile, 'utf-8')
		metadata = JSON.parse(content)
	} catch {
		metadata = {
			version: '1.0',
			lastExportAt: exportedAt,
			totalAccountRows: 0,
			totalOpportunityRows: 0,
			accounts: {},
		}
	}

	const accountId = accountKey.salesforceId || accountKey.name

	metadata.lastExportAt = exportedAt
	metadata.totalAccountRows += accountRows
	metadata.totalOpportunityRows += opportunityRows
	metadata.accounts[accountId] = {
		lastExportAt: exportedAt,
		rowCount: (metadata.accounts[accountId]?.rowCount || 0) + 1,
	}

	await writeFile(metaFile, JSON.stringify(metadata, null, 2), 'utf-8')
}

/**
 * Query lake for accounts matching criteria
 * Simple in-memory query for now; could be replaced with DuckDB later
 */
export async function queryLakeAccounts(
	filter?: Partial<{
		industry: string
		minPipeline: number
		maxDaysSinceActivity: number
		hasRisk: boolean
	}>
): Promise<AccountRow[]> {
	const lakeDir = join(process.cwd(), 'data', 'lake')
	const accountsFile = join(lakeDir, 'accounts.jsonl')

	let content: string
	try {
		content = await readFile(accountsFile, 'utf-8')
	} catch {
		return []
	}

	const rows = content
		.trim()
		.split('\n')
		.filter(Boolean)
		.map((line) => JSON.parse(line) as AccountRow)

	// Deduplicate by accountId (keep latest)
	const byAccount = new Map<string, AccountRow>()
	for (const row of rows) {
		const existing = byAccount.get(row.accountId)
		if (!existing || row.exportedAt > existing.exportedAt) {
			byAccount.set(row.accountId, row)
		}
	}

	let filtered = Array.from(byAccount.values())

	if (filter) {
		if (filter.industry) {
			filtered = filtered.filter((r) =>
				r.industry?.toLowerCase().includes(filter.industry!.toLowerCase())
			)
		}
		if (filter.minPipeline !== undefined) {
			filtered = filtered.filter((r) => r.totalPipelineValue >= filter.minPipeline!)
		}
		if (filter.maxDaysSinceActivity !== undefined) {
			filtered = filtered.filter(
				(r) => r.daysSinceActivity !== undefined && r.daysSinceActivity <= filter.maxDaysSinceActivity!
			)
		}
		if (filter.hasRisk) {
			filtered = filtered.filter((r) => r.riskScore !== undefined && r.riskScore > 50)
		}
	}

	return filtered.sort((a, b) => b.totalPipelineValue - a.totalPipelineValue)
}

/**
 * Get lake statistics
 */
export async function getLakeStats(): Promise<{
	totalAccounts: number
	totalOpportunities: number
	lastExport: string | null
	topAccountsByPipeline: Array<{ name: string; pipeline: number }>
}> {
	const lakeDir = join(process.cwd(), 'data', 'lake')
	const metaFile = join(lakeDir, '_metadata.json')

	try {
		const content = await readFile(metaFile, 'utf-8')
		const metadata: LakeMetadata = JSON.parse(content)

		const accounts = await queryLakeAccounts()
		const topAccounts = accounts
			.slice(0, 10)
			.map((a) => ({ name: a.name, pipeline: a.totalPipelineValue }))

		return {
			totalAccounts: Object.keys(metadata.accounts).length,
			totalOpportunities: metadata.totalOpportunityRows,
			lastExport: metadata.lastExportAt,
			topAccountsByPipeline: topAccounts,
		}
	} catch {
		return {
			totalAccounts: 0,
			totalOpportunities: 0,
			lastExport: null,
			topAccountsByPipeline: [],
		}
	}
}
