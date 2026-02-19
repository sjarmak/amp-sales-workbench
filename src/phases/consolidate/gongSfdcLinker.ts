/**
 * Gong-Salesforce Linker
 * 
 * Maps Salesforce Tasks to Gong calls to create unified interaction records.
 * Uses direct matching (via Gong_Call_Id__c) or fuzzy matching (by date+title).
 * 
 * RFC Phase 1: Gong-SFDC Linkage
 */

import type { GongSfdcLink, IngestedData } from '../../types.js'
import { loadGongSfdcConfig, type GongSfdcConfig } from '../../config/salesforceGongConfig.js'

interface GongCall {
	id: string
	title: string
	startTime: string
	duration?: number
	participants?: string[]
}

interface SalesforceTask {
	Id: string
	Subject?: string
	Description?: string
	ActivityDate?: string
	WhatId?: string // Opportunity ID if linked
	WhoId?: string // Contact ID if linked
	_isGongLinked?: boolean
	_extractedGongCallId?: string
	[key: string]: any
}

/**
 * Create Gong-SFDC links by matching SF Tasks to Gong calls
 */
export async function createGongSfdcLinks(
	ingestedData: IngestedData,
	accountId?: string
): Promise<GongSfdcLink[]> {
	const config = await loadGongSfdcConfig()
	const links: GongSfdcLink[] = []

	// Get Gong calls from ingested data
	const gongCalls: GongCall[] = (ingestedData.gong?.calls || []).map((call: any) => ({
		id: String(call.id || call.call_id),
		title: call.title || call.subject || '',
		startTime: call.startTime || call.started || call.created_at || '',
		duration: call.duration || call.browser_duration_sec,
		participants: call.participants || call.participantEmails || [],
	}))

	// Get SF tasks that are marked as Gong-linked
	const sfTasks: SalesforceTask[] = (ingestedData.salesforce?.activities || [])
		.filter((activity: any) => activity._isGongLinked === true)

	if (gongCalls.length === 0 || sfTasks.length === 0) {
		return links
	}

	// Build a lookup map for Gong calls by ID
	const gongCallsById = new Map<string, GongCall>()
	for (const call of gongCalls) {
		gongCallsById.set(call.id, call)
	}

	// Process each Gong-linked SF task
	for (const task of sfTasks) {
		const link = await matchTaskToGongCall(task, gongCalls, gongCallsById, config, accountId)
		if (link) {
			links.push(link)
		}
	}

	return links
}

/**
 * Match a single SF Task to a Gong call
 */
async function matchTaskToGongCall(
	task: SalesforceTask,
	gongCalls: GongCall[],
	gongCallsById: Map<string, GongCall>,
	config: GongSfdcConfig,
	accountId?: string
): Promise<GongSfdcLink | null> {
	// 1. Try direct match via extracted Gong call ID
	if (task._extractedGongCallId) {
		const directMatch = gongCallsById.get(task._extractedGongCallId)
		if (directMatch) {
			return createLink(task, directMatch, 'direct', 1.0, accountId)
		}
		// Even if no match in current data, still create link with ID
		return {
			gongCallId: task._extractedGongCallId,
			salesforceTaskId: task.Id,
			accountId,
			opportunityId: task.WhatId?.startsWith('006') ? task.WhatId : undefined,
			contactIds: task.WhoId?.startsWith('003') ? [task.WhoId] : undefined,
			matchType: 'direct',
			matchConfidence: 0.8, // Lower confidence since we couldn't verify against Gong data
		}
	}

	// 2. Try URL-based match
	const urlMatch = extractGongIdFromUrl(task.Description || '')
	if (urlMatch) {
		const urlMatchedCall = gongCallsById.get(urlMatch)
		if (urlMatchedCall) {
			return createLink(task, urlMatchedCall, 'url', 0.95, accountId)
		}
	}

	// 3. Try fuzzy match by date and title
	if (config.fuzzyMatching.enabled) {
		const fuzzyResult = fuzzyMatchCall(task, gongCalls, config)
		if (fuzzyResult) {
			return createLink(task, fuzzyResult.call, 'fuzzy', fuzzyResult.confidence, accountId)
		}
	}

	return null
}

/**
 * Create a GongSfdcLink from matched task and call
 */
function createLink(
	task: SalesforceTask,
	call: GongCall,
	matchType: 'direct' | 'url' | 'fuzzy',
	confidence: number,
	accountId?: string
): GongSfdcLink {
	return {
		gongCallId: call.id,
		salesforceTaskId: task.Id,
		accountId,
		opportunityId: task.WhatId?.startsWith('006') ? task.WhatId : undefined,
		contactIds: task.WhoId?.startsWith('003') ? [task.WhoId] : undefined,
		matchType,
		matchConfidence: confidence,
		callDate: call.startTime,
		callTitle: call.title,
	}
}

/**
 * Extract Gong call ID from URL in description
 */
function extractGongIdFromUrl(description: string): string | null {
	const urlMatch = description.match(/gong\.io\/call\/(\d+)/i) ||
		description.match(/app\.gong\.io\/call[s]?\/(\d+)/i)
	return urlMatch ? urlMatch[1] : null
}

/**
 * Fuzzy match a task to a Gong call by date and title similarity
 */
function fuzzyMatchCall(
	task: SalesforceTask,
	gongCalls: GongCall[],
	config: GongSfdcConfig
): { call: GongCall; confidence: number } | null {
	if (!task.ActivityDate) {
		return null
	}

	const taskDate = new Date(task.ActivityDate)
	const timeWindowMs = config.fuzzyMatching.timeWindowMinutes * 60 * 1000
	const threshold = config.fuzzyMatching.titleSimilarityThreshold

	let bestMatch: { call: GongCall; confidence: number } | null = null

	for (const call of gongCalls) {
		if (!call.startTime) continue

		const callDate = new Date(call.startTime)
		const timeDiff = Math.abs(taskDate.getTime() - callDate.getTime())

		// Check time window
		if (timeDiff > timeWindowMs) continue

		// Calculate title similarity
		const taskSubject = (task.Subject || '').toLowerCase()
		const callTitle = call.title.toLowerCase()
		const similarity = calculateSimilarity(taskSubject, callTitle)

		if (similarity >= threshold) {
			// Weight by time proximity and title similarity
			const timeScore = 1 - (timeDiff / timeWindowMs)
			const confidence = (similarity * 0.7) + (timeScore * 0.3)

			if (!bestMatch || confidence > bestMatch.confidence) {
				bestMatch = { call, confidence }
			}
		}
	}

	return bestMatch
}

/**
 * Simple string similarity using Jaccard index on word sets
 */
function calculateSimilarity(str1: string, str2: string): number {
	const words1 = new Set(str1.split(/\s+/).filter(w => w.length > 2))
	const words2 = new Set(str2.split(/\s+/).filter(w => w.length > 2))

	if (words1.size === 0 && words2.size === 0) return 0
	if (words1.size === 0 || words2.size === 0) return 0

	const intersection = new Set([...words1].filter(w => words2.has(w)))
	const union = new Set([...words1, ...words2])

	return intersection.size / union.size
}

/**
 * Get summary statistics about Gong-SFDC linkage
 */
export function getLinkageStats(links: GongSfdcLink[]): {
	total: number
	byMatchType: Record<string, number>
	averageConfidence: number
	linkedToOpportunity: number
} {
	const byMatchType: Record<string, number> = { direct: 0, url: 0, fuzzy: 0 }
	let totalConfidence = 0
	let linkedToOpportunity = 0

	for (const link of links) {
		byMatchType[link.matchType]++
		totalConfidence += link.matchConfidence || 0
		if (link.opportunityId) linkedToOpportunity++
	}

	return {
		total: links.length,
		byMatchType,
		averageConfidence: links.length > 0 ? totalConfidence / links.length : 0,
		linkedToOpportunity,
	}
}
