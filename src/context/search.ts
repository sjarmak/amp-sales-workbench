/**
 * Context Search Utilities
 * 
 * Fast text search across consolidated context data.
 */

import type { AccountContext } from './types.js'

export interface SearchResult {
	type: 'transcript' | 'contact' | 'opportunity' | 'prospector' | 'notion'
	id: string
	title: string
	snippet: string
	score: number
	data: any
}

/**
 * Search transcripts for keywords
 */
export function searchTranscripts(context: AccountContext, query: string): SearchResult[] {
	if (!context.gong?.summaries) return []

	const q = query.toLowerCase()
	const results: SearchResult[] = []

	for (const summary of context.gong.summaries) {
		const text = `${summary.transcript} ${summary.summary || ''} ${(summary.actionItems || []).join(' ')}`
		const lowerText = text.toLowerCase()

		if (lowerText.includes(q)) {
			const idx = lowerText.indexOf(q)
			const start = Math.max(0, idx - 50)
			const end = Math.min(text.length, idx + query.length + 50)
			const snippet = text.slice(start, end)

			results.push({
				type: 'transcript',
				id: summary.callId,
				title: context.gong.calls?.find((c) => c.id === summary.callId)?.title || 'Untitled Call',
				snippet: `...${snippet}...`,
				score: 1,
				data: summary,
			})
		}
	}

	return results
}

/**
 * Search contacts for keywords
 */
export function searchContacts(context: AccountContext, query: string): SearchResult[] {
	if (!context.salesforce?.contacts) return []

	const q = query.toLowerCase()
	const results: SearchResult[] = []

	for (const contact of context.salesforce.contacts) {
		const text = `${contact.Name} ${contact.Email} ${contact.Title || ''} ${contact.Department || ''}`
		const lowerText = text.toLowerCase()

		if (lowerText.includes(q)) {
			results.push({
				type: 'contact',
				id: contact.Id,
				title: contact.Name,
				snippet: `${contact.Title || ''} - ${contact.Email}`,
				score: 1,
				data: contact,
			})
		}
	}

	return results
}

/**
 * Search opportunities for keywords
 */
export function searchOpportunities(context: AccountContext, query: string): SearchResult[] {
	if (!context.salesforce?.opportunities) return []

	const q = query.toLowerCase()
	const results: SearchResult[] = []

	for (const opp of context.salesforce.opportunities) {
		const text = `${opp.Name} ${opp.StageName} ${opp.NextStep || ''} ${opp.Type || ''}`
		const lowerText = text.toLowerCase()

		if (lowerText.includes(q)) {
			results.push({
				type: 'opportunity',
				id: opp.Id,
				title: opp.Name,
				snippet: `${opp.StageName} - ${opp.Amount ? `$${opp.Amount}` : 'No amount'}`,
				score: 1,
				data: opp,
			})
		}
	}

	return results
}

/**
 * Search all context for keywords
 */
export function searchAll(context: AccountContext, query: string): SearchResult[] {
	return [
		...searchTranscripts(context, query),
		...searchContacts(context, query),
		...searchOpportunities(context, query),
	].sort((a, b) => b.score - a.score)
}

/**
 * Get recent transcripts (for quick access)
 */
export function getRecentTranscripts(context: AccountContext, limit: number = 5) {
	if (!context.gong?.summaries) return []
	return context.gong.summaries.slice(0, limit)
}

/**
 * Get open opportunities (for quick access)
 */
export function getOpenOpportunities(context: AccountContext) {
	if (!context.salesforce?.opportunities) return []
	return context.salesforce.opportunities.filter((opp) => !opp.IsClosed && opp.StageName !== 'Closed Lost')
}

/**
 * Get key contacts (for quick access)
 */
export function getKeyContacts(context: AccountContext, limit: number = 10) {
	if (!context.salesforce?.contacts) return []
	// Prioritize contacts with important titles
	const priorityTitles = ['ceo', 'cto', 'vp', 'director', 'head', 'chief', 'president']

	return context.salesforce.contacts
		.sort((a, b) => {
			const aTitle = (a.Title || '').toLowerCase()
			const bTitle = (b.Title || '').toLowerCase()
			const aPriority = priorityTitles.some((t) => aTitle.includes(t))
			const bPriority = priorityTitles.some((t) => bTitle.includes(t))

			if (aPriority && !bPriority) return -1
			if (!aPriority && bPriority) return 1
			return 0
		})
		.slice(0, limit)
}
