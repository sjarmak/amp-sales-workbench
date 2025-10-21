/**
 * Agent Context Helpers
 * 
 * Utilities for agents to access and prioritize account context data.
 */

import { getAccountContext } from '../../context/store.js'
import type { AccountContext } from '../../context/types.js'

/**
 * Load context for an agent
 */
export async function loadContext(accountDir: string): Promise<AccountContext | null> {
	return await getAccountContext(accountDir)
}

/**
 * Get prioritized context for pre-call brief
 * Priority: Gong transcripts > SF opportunities > Prospector > Notion
 */
export function getPrioritizedContext(context: AccountContext) {
	const sections: Array<{ source: string; priority: number; data: any; label: string }> = []

	// Priority 1: Recent Gong call transcripts (highest priority)
	if (context.gong?.summaries && context.gong.summaries.length > 0) {
		sections.push({
			source: 'gong',
			priority: 1,
			label: 'Recent Calls',
			data: context.gong.summaries.slice(0, 3), // Most recent 3 calls
		})
	}

	// Priority 2: Salesforce opportunities
	if (context.salesforce?.opportunities && context.salesforce.opportunities.length > 0) {
		const openOpps = context.salesforce.opportunities.filter(
			(opp: any) => !opp.IsClosed && opp.StageName !== 'Closed Lost'
		)
		sections.push({
			source: 'salesforce',
			priority: 2,
			label: 'Open Opportunities',
			data: openOpps,
		})
	}

	// Priority 3: Prospector research
	if (context.prospector?.files && context.prospector.files.length > 0) {
		sections.push({
			source: 'prospector',
			priority: 3,
			label: 'Research',
			data: context.prospector.files,
		})
	}

	// Priority 4: Notion pages
	if (context.notion?.relatedPages && context.notion.relatedPages.length > 0) {
		sections.push({
			source: 'notion',
			priority: 4,
			label: 'Notion Pages',
			data: context.notion.relatedPages,
		})
	}

	return sections.sort((a, b) => a.priority - b.priority)
}

/**
 * Check if prospector data is stale (>30 days old or missing)
 */
export function isProspectorStale(context: AccountContext): { stale: boolean; message?: string } {
	if (!context.prospector || !context.prospector.ranAt) {
		return { stale: true, message: 'No prospector research available. Consider running amp-prospector.' }
	}

	const ranAt = new Date(context.prospector.ranAt)
	const now = new Date()
	const daysSince = Math.floor((now.getTime() - ranAt.getTime()) / (1000 * 60 * 60 * 24))

	if (daysSince > 30) {
		return {
			stale: true,
			message: `Prospector data is ${daysSince} days old. Consider re-running for fresh insights.`,
		}
	}

	return { stale: false }
}

/**
 * Get key contacts from context
 */
export function getKeyContacts(context: AccountContext) {
	if (!context.salesforce?.contacts) return []

	// Prioritize contacts with important titles
	const priorityTitles = ['ceo', 'cto', 'cfo', 'vp', 'director', 'head', 'chief', 'president', 'founder']

	return context.salesforce.contacts
		.sort((a: any, b: any) => {
			const aTitle = (a.Title || '').toLowerCase()
			const bTitle = (b.Title || '').toLowerCase()
			const aPriority = priorityTitles.some((t) => aTitle.includes(t))
			const bPriority = priorityTitles.some((t) => bTitle.includes(t))

			if (aPriority && !bPriority) return -1
			if (!aPriority && bPriority) return 1
			return 0
		})
		.slice(0, 10)
}

/**
 * Format context for agent prompt
 */
export function formatContextForPrompt(context: AccountContext): string {
	const sections: string[] = []

	sections.push(`## Account: ${context.account.name}`)
	if (context.account.domain) sections.push(`Domain: ${context.account.domain}`)

	// Gong
	if (context.gong?.summaries && context.gong.summaries.length > 0) {
		sections.push(`\n### Recent Calls (${context.gong.summaries.length})`)
		context.gong.summaries.slice(0, 3).forEach((s) => {
			const call = context.gong?.calls?.find((c) => c.id === s.callId)
			sections.push(`\n**${call?.title || 'Call'}** (${call?.startTime || 'Unknown date'})`)
			if (s.summary) sections.push(`Summary: ${s.summary}`)
			if (s.actionItems && s.actionItems.length > 0) {
				sections.push(`Action Items: ${s.actionItems.join('; ')}`)
			}
		})
	}

	// Salesforce
	if (context.salesforce?.opportunities && context.salesforce.opportunities.length > 0) {
		const openOpps = context.salesforce.opportunities.filter(
			(opp: any) => !opp.IsClosed && opp.StageName !== 'Closed Lost'
		)
		sections.push(`\n### Open Opportunities (${openOpps.length})`)
		openOpps.slice(0, 5).forEach((opp: any) => {
			sections.push(
				`- ${opp.Name}: ${opp.StageName}, ${opp.Amount ? `$${opp.Amount}` : 'No amount'}, Close: ${opp.CloseDate || 'TBD'}`
			)
		})
	}

	if (context.salesforce?.contacts && context.salesforce.contacts.length > 0) {
		const keyContacts = getKeyContacts(context)
		sections.push(`\n### Key Contacts (${keyContacts.length})`)
		keyContacts.forEach((c: any) => {
			sections.push(`- ${c.Name}${c.Title ? ` - ${c.Title}` : ''}${c.Email ? ` (${c.Email})` : ''}`)
		})
	}

	// Prospector
	const prospectorCheck = isProspectorStale(context)
	if (prospectorCheck.stale) {
		sections.push(`\n### ⚠️ Prospector Research`)
		sections.push(prospectorCheck.message!)
	} else if (context.prospector?.files) {
		sections.push(`\n### Research (from amp-prospector)`)
		sections.push(`${context.prospector.files.length} files available`)
	}

	return sections.join('\n')
}
