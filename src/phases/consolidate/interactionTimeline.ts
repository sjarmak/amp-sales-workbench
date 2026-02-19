/**
 * Unified Interaction Timeline Builder
 * 
 * RFC Phase 2: Merges all interaction data into a coherent timeline.
 * Combines: Gong calls, SF EmailMessage, SF Tasks/Events
 * 
 * Powers: pre-call briefs, risk heuristics, qualification, coaching agents
 */

import type {
	AccountInteraction,
	InteractionTimeline,
	GongSfdcLink,
	IngestedData,
} from '../../types.js'

/**
 * Build unified interaction timeline from all data sources
 */
export async function buildInteractionTimeline(
	ingestedData: IngestedData,
	gongSfdcLinks: GongSfdcLink[]
): Promise<InteractionTimeline> {
	const interactions: AccountInteraction[] = []

	// 1. Add Gong calls
	const gongInteractions = buildGongInteractions(
		ingestedData.gong?.calls || [],
		ingestedData.gong?.summaries || [],
		gongSfdcLinks
	)
	interactions.push(...gongInteractions)

	// 2. Add SF Activities (Tasks and Events that are NOT Gong-linked)
	const activityInteractions = buildActivityInteractions(
		ingestedData.salesforce?.activities || [],
		gongSfdcLinks
	)
	interactions.push(...activityInteractions)

	// 3. Add SF Emails
	const emailInteractions = buildEmailInteractions(
		ingestedData.salesforce?.emails || []
	)
	interactions.push(...emailInteractions)

	// Sort by date descending (newest first)
	interactions.sort((a, b) => {
		const dateA = new Date(a.date).getTime()
		const dateB = new Date(b.date).getTime()
		return dateB - dateA
	})

	// Calculate counts
	const interactionCounts = {
		calls: interactions.filter(i => i.type === 'call').length,
		emails: interactions.filter(i => i.type === 'email').length,
		meetings: interactions.filter(i => i.type === 'meeting').length,
		tasks: interactions.filter(i => i.type === 'task').length,
	}

	// Find last interaction date
	const lastInteractionDate = interactions.length > 0 ? interactions[0].date : undefined

	// Generate activity summary for last 30 days
	const thirtyDaysAgo = new Date()
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
	const recentInteractions = interactions.filter(
		i => new Date(i.date) >= thirtyDaysAgo
	)
	const recentActivitySummary = generateRecentActivitySummary(recentInteractions)

	return {
		interactions,
		lastInteractionDate,
		interactionCounts,
		recentActivitySummary,
	}
}

/**
 * Build interactions from Gong calls
 */
function buildGongInteractions(
	calls: any[],
	summaries: any[],
	gongSfdcLinks: GongSfdcLink[]
): AccountInteraction[] {
	// Build lookup for summaries by call ID
	const summaryByCallId = new Map<string, any>()
	for (const summary of summaries) {
		const callId = String(summary.callId || summary.call_id)
		summaryByCallId.set(callId, summary)
	}

	// Build lookup for SFDC links
	const linkByGongId = new Map<string, GongSfdcLink>()
	for (const link of gongSfdcLinks) {
		linkByGongId.set(link.gongCallId, link)
	}

	return calls.map((call): AccountInteraction => {
		const callId = String(call.id || call.call_id)
		const summary = summaryByCallId.get(callId)
		const link = linkByGongId.get(callId)

		const startTime = call.startTime || call.started || call.created_at
		const duration = call.duration || call.browser_duration_sec

		return {
			id: `gong-${callId}`,
			type: 'call',
			date: startTime || new Date().toISOString(),
			summary: call.title || 'Gong Call',
			source: ['gong'],
			linkedOpportunityId: link?.opportunityId,
			linkedContactIds: link?.contactIds,
			gongLink: link,
			durationMinutes: typeof duration === 'number' ? Math.round(duration / 60) : undefined,
			participants: call.participants || call.participantEmails || [],
			aiSummary: summary?.summary,
			topics: summary?.topics || call.topics,
			actionItems: summary?.actionItems || summary?.action_items || call.action_items,
			sentiment: undefined, // Could be derived from call analysis
		}
	})
}

/**
 * Build interactions from SF Activities (Tasks/Events)
 * Excludes Gong-linked tasks to avoid duplicates
 */
function buildActivityInteractions(
	activities: any[],
	gongSfdcLinks: GongSfdcLink[]
): AccountInteraction[] {
	// Track which SF task IDs are already linked to Gong
	const linkedTaskIds = new Set(
		gongSfdcLinks.map(l => l.salesforceTaskId).filter(Boolean)
	)

	return activities
		.filter(activity => {
			// Skip if this is a Gong-linked task
			if (activity._isGongLinked && linkedTaskIds.has(activity.Id)) {
				return false
			}
			return true
		})
		.map((activity): AccountInteraction => {
			const isEvent = 'StartDateTime' in activity

			const date = isEvent
				? activity.StartDateTime
				: activity.ActivityDate || activity.CreatedDate

			const duration = isEvent && activity.EndDateTime
				? Math.round((new Date(activity.EndDateTime).getTime() - new Date(activity.StartDateTime).getTime()) / 60000)
				: undefined

			return {
				id: `sf-${activity.Id}`,
				type: isEvent ? 'meeting' : 'task',
				date: date || new Date().toISOString(),
				summary: activity.Subject || 'Activity',
				source: ['salesforce'],
				linkedOpportunityId: activity.WhatId?.startsWith('006') ? activity.WhatId : undefined,
				linkedContactIds: activity.WhoId?.startsWith('003') ? [activity.WhoId] : undefined,
				durationMinutes: duration,
				participants: [], // Would need to query EventRelation for attendees
			}
		})
}

/**
 * Build interactions from SF EmailMessage records
 */
function buildEmailInteractions(emails: any[]): AccountInteraction[] {
	return emails.map((email): AccountInteraction => {
		const participants: string[] = []
		if (email.FromAddress) participants.push(email.FromAddress)
		if (email.ToAddress) {
			// ToAddress may be comma-separated
			participants.push(...email.ToAddress.split(/[,;]\s*/).filter(Boolean))
		}

		return {
			id: `sf-email-${email.Id}`,
			type: 'email',
			date: email.MessageDate || email.CreatedDate || new Date().toISOString(),
			summary: email.Subject || 'Email',
			source: ['salesforce'],
			linkedOpportunityId: email.RelatedToId?.startsWith('006') ? email.RelatedToId : undefined,
			linkedContactIds: [], // Would need to query EmailMessageRelation
			participants,
			aiSummary: undefined, // Could summarize body
		}
	})
}

/**
 * Generate a natural language summary of recent activity
 */
function generateRecentActivitySummary(
	recentInteractions: AccountInteraction[]
): string {
	if (recentInteractions.length === 0) {
		return 'No interactions in the last 30 days.'
	}

	const calls = recentInteractions.filter(i => i.type === 'call').length
	const emails = recentInteractions.filter(i => i.type === 'email').length
	const meetings = recentInteractions.filter(i => i.type === 'meeting').length

	const parts: string[] = []
	if (calls > 0) parts.push(`${calls} call${calls > 1 ? 's' : ''}`)
	if (emails > 0) parts.push(`${emails} email${emails > 1 ? 's' : ''}`)
	if (meetings > 0) parts.push(`${meetings} meeting${meetings > 1 ? 's' : ''}`)

	const lastDate = recentInteractions[0]?.date
	const daysAgo = lastDate
		? Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24))
		: null

	let summary = `${parts.join(', ')} in the last 30 days.`
	if (daysAgo !== null) {
		if (daysAgo === 0) {
			summary += ' Last interaction was today.'
		} else if (daysAgo === 1) {
			summary += ' Last interaction was yesterday.'
		} else {
			summary += ` Last interaction was ${daysAgo} days ago.`
		}
	}

	return summary
}

/**
 * Get summary statistics for the timeline
 */
export function getTimelineStats(timeline: InteractionTimeline): {
	total: number
	byType: Record<string, number>
	daysSinceLastInteraction: number | null
	averageInteractionsPerWeek: number
} {
	const total = timeline.interactions.length

	const byType: Record<string, number> = {}
	for (const interaction of timeline.interactions) {
		byType[interaction.type] = (byType[interaction.type] || 0) + 1
	}

	let daysSinceLastInteraction: number | null = null
	if (timeline.lastInteractionDate) {
		daysSinceLastInteraction = Math.floor(
			(Date.now() - new Date(timeline.lastInteractionDate).getTime()) / (1000 * 60 * 60 * 24)
		)
	}

	// Calculate average interactions per week over the data period
	const dates = timeline.interactions.map(i => new Date(i.date).getTime())
	let averageInteractionsPerWeek = 0
	if (dates.length > 1) {
		const minDate = Math.min(...dates)
		const maxDate = Math.max(...dates)
		const weeks = (maxDate - minDate) / (1000 * 60 * 60 * 24 * 7)
		averageInteractionsPerWeek = weeks > 0 ? Math.round((total / weeks) * 10) / 10 : 0
	}

	return {
		total,
		byType,
		daysSinceLastInteraction,
		averageInteractionsPerWeek,
	}
}
