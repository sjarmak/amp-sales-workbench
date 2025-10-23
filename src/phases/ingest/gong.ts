import { createHash } from 'crypto'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import type { AccountKey } from '../../types.js'
import { callGongListCalls, callGongRetrieveTranscripts, callGongGetCall, callGongSearchCalls } from './mcp-wrapper.js'
import { getGongCacheManager } from '../../gong-cache/manager.js'

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
	// OVERRIDE: Search October 20-21, 2025 for Canva calls (includes timezone coverage)
	const fromDate = new Date('2025-10-20T00:00:00Z')
	const toDate = new Date('2025-10-21T23:59:59Z')

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

	// Fetch transcripts with caching
	const summaries: GongTranscript[] = []
	const transcriptsMetadata: Record<string, { hash: string; fetchedAt: string }> = {}
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
 * List calls for an account using either cache or direct API filtering
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
	useCache: boolean = true
): Promise<GongCall[]> {
	try {
		const accountName = accountKey.name?.toLowerCase()
		
		if (!accountName) {
			console.warn(`No account name found, cannot filter Gong calls`)
			return []
		}

		// Use cache for fast local filtering (zero API calls)
		if (useCache) {
			console.log(`Querying Gong cache for "${accountName}"`)
			const cacheManager = getGongCacheManager()
			
			// First ensure cache is up to date with incremental sync
			try {
				await cacheManager.sync()
			} catch (error) {
				console.warn('Cache sync failed, will use existing cache:', error)
			}
			
			// Extract domain from accountKey for participant-based filtering
			const domain = accountKey.domain?.toLowerCase()
			
			// Query cache for matching calls (filters by title containing account name)
			const cachedCalls = await cacheManager.getCallsForAccount(accountName, {
				since: fromDate,
				maxResults: 50,
				domain, // Include domain for participant email filtering
			})
			
			// Convert to GongCall format
			const calls: GongCall[] = cachedCalls.map(call => ({
				id: call.id,
				title: call.title,
				startTime: call.scheduled,
				duration: call.duration,
				participants: call.participantEmails || [],
			}))
			
			console.log(`Found ${calls.length} calls from cache for "${accountName}" (domain: ${domain || 'none'})`)
			return calls
		}

		// Fallback: Direct API filtering using list_calls + client-side filter
		// Note: search_calls endpoint returns 405, so we must use list_calls
		console.log(`Fetching all Gong calls from ${fromDate.toISOString()} to ${toDate.toISOString()}`)
		
		const result = await callGongListCalls({
			fromDateTime: fromDate.toISOString(),
			toDateTime: toDate.toISOString(),
		})

		const allCalls = result.calls || []
		console.log(`Fetched ${allCalls.length} total Gong calls`)
		
		// Filter client-side by checking if account name appears in call title
		const matchedCalls: GongCall[] = allCalls
			.filter((call: any) => {
				const title = (call.title || call.subject || '').toLowerCase()
				return title.includes(accountName)
			})
			.map((call: any) => ({
				id: call.id,
				title: call.title || call.subject || 'Untitled Call',
				startTime: call.scheduled || call.started || call.startTime || '',
				duration: call.duration || 0,
				participants: (call.participants || []).map((p: any) => p.email || p.name || '').filter(Boolean),
			}))

		console.log(`Found ${matchedCalls.length} Gong calls matching "${accountName}" in title`)
		
		return matchedCalls
	} catch (error) {
		console.error('Gong call filtering failed:', error)
		return []
	}
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
