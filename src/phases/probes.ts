import { join } from 'path'
import { readFile } from 'fs/promises'
import type { SourcesMeta } from './freshness.js'

// Probe timeout for each source
const PROBE_TIMEOUT_MS = 3000

export interface ProbeResult {
	staleOnSource: boolean
	reasons: string[]
	recommended: 'use-cache' | 'incremental' | 'full'
	error?: string
}

interface AccountMetadata {
	name: string
	salesforceId?: string
	domain?: string
}

/**
 * Probe Salesforce for latest Account and Opportunity modifications
 */
export async function probeSalesforce(
	accountDataDir: string,
	meta: SourcesMeta,
	mcpCall: (tool: string, params: any) => Promise<any>
): Promise<ProbeResult> {
	try {
		// Load account metadata for salesforceId
		const metadataPath = join(accountDataDir, 'metadata.json')
		const metadataContent = await readFile(metadataPath, 'utf-8')
		const accountMetadata: AccountMetadata = JSON.parse(metadataContent)

		if (!accountMetadata.salesforceId) {
			return {
				staleOnSource: false,
				reasons: ['No Salesforce ID available'],
				recommended: 'use-cache',
			}
		}

		const salesforceId = accountMetadata.salesforceId
		const promises: Promise<any>[] = []

		// Query Account LastModifiedDate
		promises.push(
			mcpCall('mcp__salesforce__soql_query', {
				query: `SELECT LastModifiedDate FROM Account WHERE Id = '${salesforceId}' LIMIT 1`,
			})
		)

		// Query MAX Opportunity LastModifiedDate
		promises.push(
			mcpCall('mcp__salesforce__soql_query', {
				query: `SELECT MAX(LastModifiedDate) lastModified FROM Opportunity WHERE AccountId = '${salesforceId}'`,
			})
		)

		const [accountResult, oppResult] = await Promise.race([
			Promise.all(promises),
			new Promise((_, reject) =>
				setTimeout(() => reject(new Error('Probe timeout')), PROBE_TIMEOUT_MS)
			),
		]) as any[]

		const reasons: string[] = []
		let staleOnSource = false

		// Check Account
		if (accountResult?.records?.[0]?.LastModifiedDate) {
			const remoteModified = accountResult.records[0].LastModifiedDate
			const localFetched = meta.sources.salesforce?.entityCheckpoints?.Account?.lastFetchedAt

			if (localFetched && new Date(remoteModified) > new Date(localFetched)) {
				staleOnSource = true
				reasons.push(`Account modified on source at ${remoteModified}`)
			}
		}

		// Check Opportunity
		if (oppResult?.records?.[0]?.lastModified) {
			const remoteModified = oppResult.records[0].lastModified
			const localFetched = meta.sources.salesforce?.entityCheckpoints?.Opportunity?.lastFetchedAt

			if (localFetched && new Date(remoteModified) > new Date(localFetched)) {
				staleOnSource = true
				reasons.push(`Opportunity modified on source at ${remoteModified}`)
			}
		}

		const recommended = staleOnSource ? 'incremental' : 'use-cache'

		return { staleOnSource, reasons, recommended }
	} catch (error: any) {
		return {
			staleOnSource: false,
			reasons: [],
			recommended: 'use-cache',
			error: error.message || 'Probe failed',
		}
	}
}

/**
 * Probe Gong for latest call matching account name
 */
export async function probeGong(
	accountDataDir: string,
	meta: SourcesMeta,
	mcpCall: (tool: string, params: any) => Promise<any>
): Promise<ProbeResult> {
	try {
		// Load account metadata for name
		const metadataPath = join(accountDataDir, 'metadata.json')
		const metadataContent = await readFile(metadataPath, 'utf-8')
		const accountMetadata: AccountMetadata = JSON.parse(metadataContent)

		if (!accountMetadata.name) {
			return {
				staleOnSource: false,
				reasons: ['No account name available'],
				recommended: 'use-cache',
			}
		}

		const accountName = accountMetadata.name

		// Fetch calls from last 60 days
		const toDate = new Date()
		const fromDate = new Date()
		fromDate.setDate(fromDate.getDate() - 60)

		const result = await Promise.race([
			mcpCall('mcp__gong-extended__list_calls', {
				fromDateTime: fromDate.toISOString(),
				toDateTime: toDate.toISOString(),
			}),
			new Promise((_, reject) =>
				setTimeout(() => reject(new Error('Probe timeout')), PROBE_TIMEOUT_MS)
			),
		]) as any

		// Filter calls by account name in title (case-insensitive)
		const accountCalls = (result.calls || []).filter((call: any) =>
			call.title?.toLowerCase().includes(accountName.toLowerCase())
		)

		if (accountCalls.length === 0) {
			return {
				staleOnSource: false,
				reasons: ['No matching calls found on Gong'],
				recommended: 'use-cache',
			}
		}

		// Get most recent call start time
		const latestCall = accountCalls.reduce((latest: any, call: any) => {
			const callStart = new Date(call.scheduled || call.started || 0)
			const latestStart = new Date(latest.scheduled || latest.started || 0)
			return callStart > latestStart ? call : latest
		})

		const latestCallStartTime = latestCall.scheduled || latestCall.started
		const localFetched = meta.sources.gong?.lastListSyncAt

		let staleOnSource = false
		const reasons: string[] = []

		if (localFetched && new Date(latestCallStartTime) > new Date(localFetched)) {
			staleOnSource = true
			reasons.push(`New call on source at ${latestCallStartTime}`)
		}

		const recommended = staleOnSource ? 'incremental' : 'use-cache'

		return { staleOnSource, reasons, recommended }
	} catch (error: any) {
		return {
			staleOnSource: false,
			reasons: [],
			recommended: 'use-cache',
			error: error.message || 'Probe failed',
		}
	}
}

/**
 * Probe Notion for page last edited times
 */
export async function probeNotion(
	_accountDataDir: string,
	meta: SourcesMeta,
	mcpCall: (tool: string, params: any) => Promise<any>
): Promise<ProbeResult> {
	try {
		const pageUrls = meta.sources.notion?.pageUrls || []

		if (pageUrls.length === 0) {
			return {
				staleOnSource: false,
				reasons: ['No Notion pages configured'],
				recommended: 'use-cache',
			}
		}

		// Extract page IDs from URLs (format: https://notion.so/Page-Title-<pageId>)
		const pageIds = pageUrls
			.map((url) => {
				const match = url.match(/([a-f0-9]{32})/i)
				return match ? match[1] : null
			})
			.filter(Boolean) as string[]

		if (pageIds.length === 0) {
			return {
				staleOnSource: false,
				reasons: ['Could not extract Notion page IDs'],
				recommended: 'use-cache',
			}
		}

		// Fetch page metadata (limit to first 3 pages)
		const promises = pageIds.slice(0, 3).map((pageId) =>
			Promise.race([
				mcpCall('mcp__notion__API-retrieve-a-page', { page_id: pageId }),
				new Promise((_, reject) =>
					setTimeout(() => reject(new Error('Probe timeout')), PROBE_TIMEOUT_MS)
				),
			])
		)

		const results = await Promise.allSettled(promises)

		let latestEditTime: Date | null = null

		for (const result of results) {
			if (result.status === 'fulfilled' && result.value?.last_edited_time) {
				const editTime = new Date(result.value.last_edited_time)
				if (!latestEditTime || editTime > latestEditTime) {
					latestEditTime = editTime
				}
			}
		}

		if (!latestEditTime) {
			return {
				staleOnSource: false,
				reasons: ['Could not retrieve page edit times'],
				recommended: 'use-cache',
			}
		}

		const localFetched = meta.sources.notion?.lastFullSyncAt
		let staleOnSource = false
		const reasons: string[] = []

		if (localFetched && latestEditTime > new Date(localFetched)) {
			staleOnSource = true
			reasons.push(`Page edited on source at ${latestEditTime.toISOString()}`)
		}

		const recommended = staleOnSource ? 'full' : 'use-cache'

		return { staleOnSource, reasons, recommended }
	} catch (error: any) {
		return {
			staleOnSource: false,
			reasons: [],
			recommended: 'use-cache',
			error: error.message || 'Probe failed',
		}
	}
}

/**
 * Probe Amp pages (news and manual) for Last-Modified headers
 */
export async function probeAmp(
	_accountDataDir: string,
	meta: SourcesMeta
): Promise<ProbeResult> {
	try {
		const newsUrl = 'https://ampcode.com/news'
		const manualUrl = 'https://ampcode.com/manual'

		const promises = [
			fetchLastModified(newsUrl),
			fetchLastModified(manualUrl),
		]

		const [newsModified, manualModified] = await Promise.race([
			Promise.all(promises),
			new Promise((_, reject) =>
				setTimeout(() => reject(new Error('Probe timeout')), PROBE_TIMEOUT_MS)
			),
		]) as (string | null)[]

		const reasons: string[] = []
		let staleOnSource = false

		// Check news page
		if (newsModified) {
			const localFetched = meta.sources.amp?.pages?.news?.lastFetchedAt
			if (localFetched && new Date(newsModified) > new Date(localFetched)) {
				staleOnSource = true
				reasons.push(`Amp news modified at ${newsModified}`)
			}
		}

		// Check manual page
		if (manualModified) {
			const localFetched = meta.sources.amp?.pages?.manual?.lastFetchedAt
			if (localFetched && new Date(manualModified) > new Date(localFetched)) {
				staleOnSource = true
				reasons.push(`Amp manual modified at ${manualModified}`)
			}
		}

		const recommended = staleOnSource ? 'full' : 'use-cache'

		return { staleOnSource, reasons, recommended }
	} catch (error: any) {
		return {
			staleOnSource: false,
			reasons: [],
			recommended: 'use-cache',
			error: error.message || 'Probe failed',
		}
	}
}

/**
 * Fetch Last-Modified header from URL via HEAD request (fallback to GET)
 */
async function fetchLastModified(url: string): Promise<string | null> {
	try {
		// Try HEAD first
		const headResponse = await fetch(url, { method: 'HEAD' })
		const lastModified = headResponse.headers.get('last-modified')
		if (lastModified) return lastModified

		// Fallback to GET and check meta tags
		const getResponse = await fetch(url)
		const html = await getResponse.text()

		// Check meta tags
		const metaMatch = html.match(/<meta[^>]+property=["']article:modified_time["'][^>]+content=["']([^"']+)["']/i)
		if (metaMatch) return metaMatch[1]

		const metaMatch2 = html.match(/<meta[^>]+name=["']last-modified["'][^>]+content=["']([^"']+)["']/i)
		if (metaMatch2) return metaMatch2[1]

		return null
	} catch (error) {
		return null
	}
}
