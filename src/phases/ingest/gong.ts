import { createHash } from 'crypto'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import type { AccountKey } from '../../types.js'
import { callGongListCalls, callGongRetrieveTranscripts, callGongGetCall } from './mcp-wrapper.js'
import { getGongCacheManager } from '../../gong-cache/manager.js'
import { getGongSearchTerms } from '../../gong-search-config.js'
import { getGongSource } from '../../config/gongSource.js'
import { fetchGongCallsForAccount, type EventsApiGongCall } from '../../clients/salesEventsClient.js'
import { queryGongCallsFromParquet, type ParquetGongCall } from '../../clients/gongParquetClient.js'
import { fetchTranscriptsFromApi, isGongApiAvailable } from '../../clients/gongApiClient.js'

interface GongCall {
	id: string
	title: string
	startTime: string
	duration: number
	participants: string[]
}

interface GongTranscript {
	callId: string
	transcript: string
	summary?: string
	actionItems?: string[]
	nextSteps?: string[]
	topics?: string[]
}

export interface GongIngestOptions {
	since?: string // ISO timestamp for incremental call list
	maxCalls?: number // Max number of calls to fetch (default: 10)
	useCache?: boolean // Use local cache for filtering (default: true, much faster)
}

export async function ingestFromGong(
	accountKey: AccountKey,
	accountDataDir: string,
	options?: GongIngestOptions
): Promise<{
	calls?: any[]
	summaries?: any[]
	transcripts?: Record<string, { hash: string; fetchedAt: string }>
	lastSyncedAt: string
}> {
	const maxCalls = options?.maxCalls || 10
	
	// Calculate date range
	// OVERRIDE: Search August 4 to tomorrow (end of next day) to capture calls scheduled for today/tomorrow
	const fromDate = new Date('2025-08-04T00:00:00Z')
	const toDate = new Date(new Date().getTime() + 24 * 60 * 60 * 1000) // Tomorrow

	// List calls for this account using cache (fast) or direct API (slower)
	// Cache uses list_calls to fetch all calls, then filters client-side by title
	// since search_calls endpoint returns 405 errors
	const useCache = options?.useCache !== false
	const calls = await listCallsForAccount(accountKey, fromDate, toDate, useCache)

	if (calls.length === 0) {
		console.log('No recent Gong calls found')
		return {
			calls: [],
			summaries: [],
			transcripts: {},
			lastSyncedAt: new Date().toISOString(),
		}
	}

	// Limit to most recent N calls to respect rate limits
	const recentCalls = calls.slice(0, maxCalls)

	// Fetch transcripts with fallback chain:
	// 1. From Parquet (if source=parquet and transcript_text exists)
	// 2. From Gong API directly (if credentials configured)
	// 3. From MCP (legacy fallback)
	const summaries: GongTranscript[] = []
	const transcriptsMetadata: Record<string, { hash: string; fetchedAt: string }> = {}
	const source = getGongSource()
	const callsWithoutTranscripts: string[] = []
	
	if (source === 'parquet') {
		// First pass: extract transcripts from Parquet data
		for (const call of recentCalls) {
			const parquetCall = call as any // Cast to access transcript_text
			if (parquetCall.transcript_text) {
				const hash = hashTranscript(parquetCall.transcript_text)
				summaries.push({
					callId: call.id,
					transcript: parquetCall.transcript_text,
					summary: parquetCall.summary,
					actionItems: parquetCall.action_items,
					nextSteps: parquetCall.next_steps,
					topics: parquetCall.topics,
				})
				transcriptsMetadata[call.id] = {
					hash,
					fetchedAt: new Date().toISOString(),
				}
			} else {
				// Track calls that need transcript fetch
				callsWithoutTranscripts.push(call.id)
			}
		}
		
		// Second pass: fetch missing transcripts from API
		if (callsWithoutTranscripts.length > 0 && isGongApiAvailable()) {
			console.log(`[gong-ingest] Fetching ${callsWithoutTranscripts.length} missing transcripts from API...`)
			try {
				const apiTranscripts = await fetchTranscriptsFromApi(callsWithoutTranscripts)
				for (const [callId, transcript] of apiTranscripts) {
					const hash = hashTranscript(transcript)
					summaries.push({
						callId,
						transcript,
					})
					transcriptsMetadata[callId] = {
						hash,
						fetchedAt: new Date().toISOString(),
					}
				}
				console.log(`[gong-ingest] Fetched ${apiTranscripts.size} transcripts from API`)
			} catch (error) {
				console.warn(`[gong-ingest] API transcript fetch failed:`, error)
			}
		}
	} else {
		// Use MCP-based transcript fetching for other sources
		const cacheDir = join(accountDataDir, '.gong-cache')
		await mkdir(cacheDir, { recursive: true })

		for (const call of recentCalls) {
			const result = await fetchTranscriptWithCache(call.id, cacheDir)
			if (result) {
				summaries.push(result.transcript)
				transcriptsMetadata[call.id] = {
					hash: result.hash,
					fetchedAt: result.fetchedAt,
				}
			} else {
				callsWithoutTranscripts.push(call.id)
			}
		}
		
		// Fallback to API for MCP failures
		if (callsWithoutTranscripts.length > 0 && isGongApiAvailable()) {
			console.log(`[gong-ingest] MCP failed for ${callsWithoutTranscripts.length} calls, trying API...`)
			try {
				const apiTranscripts = await fetchTranscriptsFromApi(callsWithoutTranscripts)
				for (const [callId, transcript] of apiTranscripts) {
					const hash = hashTranscript(transcript)
					summaries.push({
						callId,
						transcript,
					})
					transcriptsMetadata[callId] = {
						hash,
						fetchedAt: new Date().toISOString(),
					}
				}
				console.log(`[gong-ingest] Fetched ${apiTranscripts.size} transcripts from API`)
			} catch (error) {
				console.warn(`[gong-ingest] API transcript fetch failed:`, error)
			}
		}
	}

	return {
		calls: recentCalls,
		summaries, // Array of GongTranscript objects with transcript text, summary, actionItems, nextSteps, topics
		transcripts: transcriptsMetadata, // Metadata only (hash, fetchedAt) for freshness tracking
		lastSyncedAt: new Date().toISOString(),
	}
}

/**
 * List calls for an account using events-api, parquet, cache, or MCP
 * 
 * Source selection via GONG_SOURCE environment variable:
 * - events-api: Production mode, uses sales-events-api service
 * - parquet: Local lakehouse mode, queries ~/gong_data Parquet files (RECOMMENDED for dev)
 * - cache: DEPRECATED - use parquet instead
 * - mcp: Legacy fallback, uses Gong MCP server
 * 
 * APPROACH: Since Gong's search_calls endpoint returns 405 errors, we use list_calls
 * with date ranges and filter client-side by checking if the account name appears
 * in the call title. The cache system maintains a 6-month rolling window of all calls
 * and performs incremental syncs for new calls.
 */
async function listCallsForAccount(
	accountKey: AccountKey,
	fromDate: Date,
	toDate: Date,
	_useCache: boolean = true
): Promise<GongCall[]> {
	try {
		const source = getGongSource()
		console.log(`Using Gong source: ${source}`)

		// Route to appropriate source
		if (source === 'events-api') {
			return await listCallsFromEventsApi(accountKey, fromDate, toDate)
		} else if (source === 'parquet') {
			return await listCallsFromParquet(accountKey, fromDate, toDate)
		} else if (source === 'cache') {
			console.warn('DEPRECATED: cache mode - use parquet instead for better performance')
			return await listCallsFromCache(accountKey, fromDate, toDate)
		} else {
			// source === 'mcp'
			return await listCallsFromMcp(accountKey, fromDate, toDate)
		}
	} catch (error) {
		console.error('Gong call filtering failed:', error)
		return []
	}
}

/**
 * Fetch calls from Parquet lakehouse (~/gong_data)
 */
async function listCallsFromParquet(
	accountKey: AccountKey,
	fromDate: Date,
	toDate: Date
): Promise<GongCall[]> {
	try {
		// Get search terms (custom overrides or account name)
		const searchTerms = await getGongSearchTerms(accountKey)
		
		if (!searchTerms || searchTerms.length === 0) {
			console.warn(`No search terms found for account, cannot filter Gong calls`)
			return []
		}

		console.log(`Querying Parquet lakehouse with terms: ${searchTerms.join(', ')}`)

		const parquetCalls = await queryGongCallsFromParquet({
			accountNames: searchTerms,
			from: fromDate.toISOString(),
			to: toDate.toISOString(),
			limit: 50,
		})
		
		// Map ParquetGongCall to GongCall format (preserving transcript data)
		const calls: GongCall[] = parquetCalls.map((call: ParquetGongCall) => ({
			id: call.call_id.toString(),
			title: call.title || 'Untitled Call',
			startTime: call.created_at,
			duration: Math.round((call.browser_duration_sec || 0) * 60), // convert to minutes
			participants: [], // Parquet schema doesn't include participants yet
			// Preserve transcript fields for ingestFromGong to consume
			transcript_text: call.transcript_text,
			summary: call.summary,
			action_items: call.action_items,
			next_steps: call.next_steps,
			topics: call.topics,
		} as any))
		
		console.log(`Found ${calls.length} calls from Parquet lakehouse for ${searchTerms.join(', ')}`)
		return calls
	} catch (error) {
		console.error('Parquet lakehouse query failed:', error)
		throw error
	}
}

/**
 * Fetch calls from sales-events-api service
 */
async function listCallsFromEventsApi(
	accountKey: AccountKey,
	fromDate: Date,
	toDate: Date
): Promise<GongCall[]> {
	try {
		// Extract account slug from accountKey (use domain or name)
		const accountSlug = accountKey.domain || accountKey.name.toLowerCase().replace(/\s+/g, '-')
		
		console.log(`Fetching Gong calls from events-api for account: ${accountSlug}`)
		
		const eventsApiCalls = await fetchGongCallsForAccount({
			accountSlug,
			from: fromDate.toISOString(),
			to: toDate.toISOString(),
			limit: 50,
		})
		
		// Map EventsApiGongCall to GongCall format
		const calls: GongCall[] = eventsApiCalls.map((call: EventsApiGongCall) => ({
			id: call.gong_call_id,
			title: call.account_name || 'Untitled Call',
			startTime: call.started_at,
			duration: call.duration_seconds || 0,
			participants: call.owner_email ? [call.owner_email] : [],
		}))
		
		// Sort by date descending
		calls.sort((a, b) => b.startTime.localeCompare(a.startTime))
		
		console.log(`Found ${calls.length} calls from events-api for ${accountSlug}`)
		return calls
	} catch (error) {
		console.error('events-api call fetch failed:', error)
		throw error
	}
}

/**
 * Fetch calls from local cache
 */
async function listCallsFromCache(
	accountKey: AccountKey,
	fromDate: Date,
	_toDate: Date
): Promise<GongCall[]> {
	// Get search terms (custom overrides or account name)
	const searchTerms = await getGongSearchTerms(accountKey)
	
	if (!searchTerms || searchTerms.length === 0) {
		console.warn(`No search terms found for account, cannot filter Gong calls`)
		return []
	}

	console.log(`Searching Gong calls from cache with terms: ${searchTerms.join(', ')}`)

	const cacheManager = getGongCacheManager()
	
	// First ensure cache is up to date with incremental sync
	try {
		await cacheManager.sync()
	} catch (error) {
		console.warn('Cache sync failed, will use existing cache:', error)
	}
	
	// Extract domain from accountKey for participant-based filtering
	const domain = accountKey.domain?.toLowerCase()
	
	// Query cache for each search term and combine results
	const allMatchedCalls = new Map<string, any>() // Use map to dedupe by call ID
	
	for (const searchTerm of searchTerms) {
		const cachedCalls = await cacheManager.getCallsForAccount(searchTerm, {
			since: fromDate,
			maxResults: 50,
			domain,
		})
		
		// Add to map (deduplicates automatically)
		cachedCalls.forEach(call => {
			if (!allMatchedCalls.has(call.id)) {
				allMatchedCalls.set(call.id, call)
			}
		})
	}
	
	// Convert to GongCall format
	const calls: GongCall[] = Array.from(allMatchedCalls.values()).map(call => ({
		id: call.id,
		title: call.title,
		startTime: call.scheduled,
		duration: call.duration,
		participants: call.participantEmails || [],
	}))
	
	// Sort by date descending
	calls.sort((a, b) => b.startTime.localeCompare(a.startTime))
	
	console.log(`Found ${calls.length} calls from cache using search terms: ${searchTerms.join(', ')} (domain: ${domain || 'none'})`)
	return calls
}

/**
 * Fetch calls from Gong MCP server (legacy)
 */
async function listCallsFromMcp(
	accountKey: AccountKey,
	fromDate: Date,
	toDate: Date
): Promise<GongCall[]> {
	// Get search terms (custom overrides or account name)
	const searchTerms = await getGongSearchTerms(accountKey)
	
	if (!searchTerms || searchTerms.length === 0) {
		console.warn(`No search terms found for account, cannot filter Gong calls`)
		return []
	}

	console.log(`Searching Gong calls from MCP with terms: ${searchTerms.join(', ')}`)

	// Direct API filtering using list_calls + client-side filter
	// Note: search_calls endpoint returns 405, so we must use list_calls
	console.log(`Fetching all Gong calls from ${fromDate.toISOString()} to ${toDate.toISOString()}`)
	
	const result = await callGongListCalls({
		fromDateTime: fromDate.toISOString(),
		toDateTime: toDate.toISOString(),
	})

	const allCalls = result.calls || []
	console.log(`Fetched ${allCalls.length} total Gong calls from MCP`)
	
	// Filter client-side by checking if any search term appears in call title
	const matchedCalls: GongCall[] = allCalls
		.filter((call: any) => {
			const title = (call.title || call.subject || '').toLowerCase()
			return searchTerms.some(term => title.includes(term.toLowerCase()))
		})
		.map((call: any) => ({
			id: call.id,
			title: call.title || call.subject || 'Untitled Call',
			startTime: call.scheduled || call.started || call.startTime || '',
			duration: call.duration || 0,
			participants: (call.participants || []).map((p: any) => p.email || p.name || '').filter(Boolean),
		}))

	console.log(`Found ${matchedCalls.length} Gong calls from MCP matching search terms: ${searchTerms.join(', ')}`)
	
	return matchedCalls
}

async function fetchTranscriptWithCache(
	callId: string,
	cacheDir: string
): Promise<{ transcript: GongTranscript; hash: string; fetchedAt: string } | undefined> {
	const cacheFile = join(cacheDir, `${callId}.json`)

	// Check cache first
	try {
		const cached = await readFile(cacheFile, 'utf-8')
		const data = JSON.parse(cached)

		// Verify hash to ensure transcript hasn't changed
		const currentHash = await getTranscriptHash(callId)
		if (currentHash && currentHash === data.hash) {
			console.log(`Using cached transcript for call ${callId}`)
			return {
				transcript: data.transcript,
				hash: data.hash,
				fetchedAt: data.fetchedAt || new Date().toISOString(),
			}
		}
	} catch (error) {
		// Cache miss or read error - continue to fetch
	}

	// Fetch fresh transcript
	const transcript = await fetchTranscript(callId)

	if (transcript) {
		// Cache the transcript with hash
		const hash = hashTranscript(transcript.transcript)
		const fetchedAt = new Date().toISOString()
		await writeFile(
			cacheFile,
			JSON.stringify({ hash, transcript, fetchedAt }, null, 2),
			'utf-8'
		)
		return { transcript, hash, fetchedAt }
	}

	return undefined
}

async function fetchTranscript(
	callId: string
): Promise<GongTranscript | undefined> {
	try {
		const result = await callGongRetrieveTranscripts({
			callIds: [callId],
		})

		if (!result.callTranscripts || result.callTranscripts.length === 0) {
			return undefined
		}

		const transcriptData = result.callTranscripts[0]
		
		// Gong API doesn't provide speaker name mappings
		// Use shortened speaker IDs for readability
		const transcript = (transcriptData.transcript || [])
			.map((segment: any) => {
				const speakerId = segment.speakerId || 'Unknown'
				// Use last 4 digits for readability: "Speaker ...1234"
				const shortId = speakerId.toString().slice(-4)
				const sentences = (segment.sentences || []).map((s: any) => s.text).join(' ')
				return `Speaker ...${shortId}: ${sentences}`
			})
			.join('\n')

		return {
			callId,
			transcript,
			summary: transcriptData.summary,
			actionItems: transcriptData.actionItems,
			nextSteps: transcriptData.nextSteps,
			topics: transcriptData.topics?.map((t: any) => t.name || t),
		}
	} catch (error) {
		console.error(`Gong transcript fetch failed for call ${callId}:`, error)
		return undefined
	}
}

async function getTranscriptHash(callId: string): Promise<string | undefined> {
	try {
		const result = await callGongGetCall({ callId })

		if (result.metaData?.recorded) {
			return hashTranscript(result.metaData.recorded)
		}
	} catch (error) {
		console.error(`Gong hash check failed for call ${callId}:`, error)
	}
	return undefined
}

function hashTranscript(transcript: string): string {
	return createHash('sha256').update(transcript).digest('hex')
}
