/**
 * Prospector-Target Agent
 * 
 * RFC Phase 3: Cross-account prospecting agent
 * Queries Salesforce for accounts matching filters, ranks them by engagement signals,
 * and outputs a prioritized list of TargetCandidates for outreach.
 * 
 * This is SEPARATE from the research agent (phases/research.ts) which does
 * deep prospect research on a single account. This agent identifies WHICH
 * accounts to prioritize for research and outreach.
 */

import type { AccountKey } from '../../types.js'
import { callSalesforceSOQL } from '../ingest/mcp-wrapper.js'

/**
 * Input parameters for targeting
 */
export interface TargetingInput {
	/** Filter by opportunity owner Salesforce User IDs */
	ownerIds?: string[]
	/** Filter by opportunity stages */
	stages?: string[]
	/** Minimum ACV (annual contract value) */
	minACV?: number
	/** Maximum ACV */
	maxACV?: number
	/** Account segments (e.g., "Enterprise", "Mid-Market") */
	segments?: string[]
	/** Industries to include */
	industries?: string[]
	/** Minimum days since last activity (for stale account detection) */
	minDaysSinceActivity?: number
	/** Maximum days since last activity (for recently active accounts) */
	maxDaysSinceActivity?: number
	/** Limit results */
	limit?: number
}

/**
 * A scored target candidate for prioritization
 */
export interface TargetCandidate {
	accountKey: AccountKey
	/** Overall priority score (0-100) */
	score: number
	/** Reasons why this account is a good target */
	reasons: string[]
	/** Opportunity details */
	opportunity: {
		id: string
		name: string
		stage: string
		amount?: number
		closeDate?: string
		probability?: number
	}
	/** Activity signals */
	signals: {
		daysSinceLastActivity: number | null
		gongCallCount?: number
		emailCount?: number
		lastActivityType?: string
	}
	/** Risk factors */
	risks: string[]
}

/**
 * Result from targeting query
 */
export interface TargetingResult {
	candidates: TargetCandidate[]
	query: TargetingInput
	generatedAt: string
	totalMatched: number
}

/**
 * Run the targeting agent to find accounts to prioritize
 */
export async function runTargetingAgent(
	input: TargetingInput
): Promise<TargetingResult> {
	console.log('\n🎯 Running Prospector-Target Agent...')

	// Build and execute SOQL query
	const query = buildTargetingQuery(input)
	console.log(`   Querying Salesforce for opportunities...`)

	let records: any[] = []
	try {
		const result = await executeSoqlQuery(query)
		records = result || []
	} catch (error) {
		console.error('   ❌ Salesforce query failed:', error)
		return {
			candidates: [],
			query: input,
			generatedAt: new Date().toISOString(),
			totalMatched: 0,
		}
	}

	console.log(`   Found ${records.length} matching opportunities`)

	// Score and rank candidates
	const candidates = await scoreAndRankCandidates(records, input)

	// Apply limit
	const limit = input.limit || 20
	const limitedCandidates = candidates.slice(0, limit)

	console.log(`   ✓ Returning top ${limitedCandidates.length} candidates`)

	return {
		candidates: limitedCandidates,
		query: input,
		generatedAt: new Date().toISOString(),
		totalMatched: records.length,
	}
}

/**
 * Build SOQL query for targeting
 */
function buildTargetingQuery(input: TargetingInput): string {
	const conditions: string[] = []

	// Owner filter
	if (input.ownerIds && input.ownerIds.length > 0) {
		const ownerList = input.ownerIds.map(id => `'${escapeSoql(id)}'`).join(',')
		conditions.push(`OwnerId IN (${ownerList})`)
	}

	// Stage filter
	if (input.stages && input.stages.length > 0) {
		const stageList = input.stages.map(s => `'${escapeSoql(s)}'`).join(',')
		conditions.push(`StageName IN (${stageList})`)
	} else {
		// Default: exclude Closed Won/Lost
		conditions.push(`NOT StageName IN ('Closed Won', 'Closed Lost')`)
	}

	// ACV filter
	if (input.minACV !== undefined) {
		conditions.push(`Amount >= ${input.minACV}`)
	}
	if (input.maxACV !== undefined) {
		conditions.push(`Amount <= ${input.maxACV}`)
	}

	// Activity date filter (on related account)
	// Note: This is a simplified approach; full implementation would use subquery
	if (input.minDaysSinceActivity !== undefined) {
		const cutoffDate = new Date()
		cutoffDate.setDate(cutoffDate.getDate() - input.minDaysSinceActivity)
		// This filters for stale accounts - no activity since cutoff
		// Actual implementation would need to check Task/Event dates
	}

	// Build WHERE clause
	const whereClause = conditions.length > 0
		? `WHERE ${conditions.join(' AND ')}`
		: ''

	// Query opportunities with account details
	const query = `
		SELECT 
			Id, Name, StageName, Amount, CloseDate, Probability,
			OwnerId, Owner.Name,
			AccountId, Account.Name, Account.Website, Account.Industry,
			LastActivityDate, LastModifiedDate,
			(SELECT Id, Subject, ActivityDate FROM Tasks ORDER BY ActivityDate DESC LIMIT 1),
			(SELECT Id, Subject, StartDateTime FROM Events ORDER BY StartDateTime DESC LIMIT 1)
		FROM Opportunity
		${whereClause}
		ORDER BY Amount DESC NULLS LAST, LastActivityDate ASC NULLS FIRST
		LIMIT 100
	`

	return query
}

/**
 * Score and rank candidates based on multiple signals
 */
async function scoreAndRankCandidates(
	records: any[],
	input: TargetingInput
): Promise<TargetCandidate[]> {
	const candidates: TargetCandidate[] = []

	for (const opp of records) {
		const candidate = createCandidate(opp, input)
		candidates.push(candidate)
	}

	// Sort by score descending
	candidates.sort((a, b) => b.score - a.score)

	return candidates
}

/**
 * Create a scored TargetCandidate from an opportunity record
 */
function createCandidate(opp: any, _input: TargetingInput): TargetCandidate {
	const reasons: string[] = []
	const risks: string[] = []
	let score = 50 // Base score

	// Account details
	const account = opp.Account || {}
	const accountKey: AccountKey = {
		name: account.Name || opp.Name || 'Unknown',
		domain: extractDomain(account.Website),
		salesforceId: opp.AccountId,
	}

	// Calculate days since last activity
	let daysSinceLastActivity: number | null = null
	if (opp.LastActivityDate) {
		const lastActivity = new Date(opp.LastActivityDate)
		daysSinceLastActivity = Math.floor(
			(Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
		)
	}

	// Scoring: Deal size
	if (opp.Amount) {
		if (opp.Amount >= 100000) {
			score += 20
			reasons.push(`High-value deal ($${(opp.Amount / 1000).toFixed(0)}K)`)
		} else if (opp.Amount >= 50000) {
			score += 10
			reasons.push(`Mid-value deal ($${(opp.Amount / 1000).toFixed(0)}K)`)
		}
	}

	// Scoring: Stage
	const stage = opp.StageName?.toLowerCase() || ''
	if (stage.includes('negotiation') || stage.includes('proposal')) {
		score += 15
		reasons.push('Late-stage opportunity')
	} else if (stage.includes('discovery') || stage.includes('qualification')) {
		score += 5
		reasons.push('Early-stage - room to influence')
	}

	// Scoring: Activity recency
	if (daysSinceLastActivity !== null) {
		if (daysSinceLastActivity > 14) {
			// Stale - needs attention
			score += 15
			reasons.push(`Stale account (${daysSinceLastActivity} days since activity)`)
			risks.push('Low recent engagement')
		} else if (daysSinceLastActivity <= 7) {
			// Recently active - good momentum
			score += 5
			reasons.push('Active engagement')
		}
	} else {
		// No activity recorded
		score += 10
		risks.push('No activity recorded')
	}

	// Scoring: Probability
	if (opp.Probability) {
		if (opp.Probability >= 70) {
			score += 10
			reasons.push('High probability')
		} else if (opp.Probability <= 30) {
			risks.push('Low probability - may need attention')
		}
	}

	// Scoring: Close date proximity
	if (opp.CloseDate) {
		const closeDate = new Date(opp.CloseDate)
		const daysToClose = Math.floor(
			(closeDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
		)
		if (daysToClose <= 30 && daysToClose > 0) {
			score += 15
			reasons.push(`Close date in ${daysToClose} days`)
		} else if (daysToClose < 0) {
			risks.push('Past close date')
		}
	}

	// Determine last activity type
	let lastActivityType: string | undefined
	const tasks = opp.Tasks?.records || []
	const events = opp.Events?.records || []
	if (tasks.length > 0 || events.length > 0) {
		const lastTask = tasks[0]
		const lastEvent = events[0]
		if (lastTask && lastEvent) {
			const taskDate = new Date(lastTask.ActivityDate || 0)
			const eventDate = new Date(lastEvent.StartDateTime || 0)
			lastActivityType = taskDate > eventDate ? 'Task' : 'Meeting'
		} else if (lastTask) {
			lastActivityType = 'Task'
		} else if (lastEvent) {
			lastActivityType = 'Meeting'
		}
	}

	// Clamp score to 0-100
	score = Math.max(0, Math.min(100, score))

	return {
		accountKey,
		score,
		reasons,
		opportunity: {
			id: opp.Id,
			name: opp.Name,
			stage: opp.StageName,
			amount: opp.Amount,
			closeDate: opp.CloseDate,
			probability: opp.Probability,
		},
		signals: {
			daysSinceLastActivity,
			lastActivityType,
		},
		risks,
	}
}

/**
 * Extract domain from website URL
 */
function extractDomain(website: string | null | undefined): string | undefined {
	if (!website) return undefined
	try {
		const url = website.startsWith('http') ? website : `https://${website}`
		return new URL(url).hostname.replace(/^www\./, '')
	} catch {
		return website
	}
}

function escapeSoql(value: string): string {
	return value.replace(/'/g, "\\'")
}

async function executeSoqlQuery(soql: string): Promise<any[]> {
	try {
		const result = await callSalesforceSOQL({ query: soql })
		return result.records || []
	} catch (error) {
		console.error('Salesforce SOQL query failed:', error)
		return []
	}
}
