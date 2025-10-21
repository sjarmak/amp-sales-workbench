import { createHash } from 'crypto'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import type { AccountKey } from '../../types.js'
import { callGongListCalls, callGongRetrieveTranscripts, callGongGetCall } from './mcp-wrapper.js'

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
	const toDate = new Date()
	let fromDate: Date
	
	if (options?.since) {
		// Incremental: fetch from since date with 5-minute overlap
		fromDate = new Date(options.since)
		fromDate.setMinutes(fromDate.getMinutes() - 5)
	} else {
		// Full: fetch last 14 days
		fromDate = new Date()
		fromDate.setDate(fromDate.getDate() - 14)
	}

	// List recent calls for this account
	const calls = await listCallsForAccount(accountKey, fromDate, toDate)

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
		summaries,
		transcripts: transcriptsMetadata,
		lastSyncedAt: new Date().toISOString(),
	}
}

async function listCallsForAccount(
	accountKey: AccountKey,
	fromDate: Date,
	toDate: Date
): Promise<GongCall[]> {
	try {
		const result = await callGongListCalls({
			fromDateTime: fromDate.toISOString(),
			toDateTime: toDate.toISOString(),
		})

		const calls: GongCall[] = (result.calls || []).map((call: any) => ({
			id: call.id,
			title: call.title || call.subject || 'Untitled Call',
			startTime: call.scheduled || call.started || '',
			duration: call.duration || 0,
			participants: (call.parties || []).map((p: any) => p.emailAddress || p.name).filter(Boolean),
		}))

		return calls
	} catch (error) {
		console.error('Gong list calls failed:', error)
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
		const transcript = (transcriptData.transcript || [])
			.map((t: any) => `${t.speaker}: ${t.text}`)
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
