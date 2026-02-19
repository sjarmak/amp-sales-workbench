/**
 * Direct Gong API Client
 * 
 * Provides direct access to Gong API for transcript fetching.
 * Used as fallback when:
 * - Lakehouse doesn't have transcript data
 * - MCP is not configured
 * 
 * Requires GONG_ACCESS_KEY and GONG_ACCESS_SECRET environment variables.
 */

export interface GongApiConfig {
	accessKey: string
	accessSecret: string
	baseUrl?: string
}

export interface GongTranscriptSegment {
	speakerId: string
	topic?: string
	sentences: Array<{
		start: number
		end: number
		text: string
	}>
}

export interface GongCallTranscript {
	callId: string
	transcript: GongTranscriptSegment[]
}

export interface GongTranscriptResponse {
	callTranscripts: GongCallTranscript[]
}

/**
 * Get Gong API configuration from environment.
 * Returns null if credentials are not configured.
 */
export function getGongApiConfig(): GongApiConfig | null {
	const accessKey = process.env.GONG_ACCESS_KEY
	const accessSecret = process.env.GONG_ACCESS_SECRET

	if (!accessKey || !accessSecret) {
		return null
	}

	return {
		accessKey,
		accessSecret,
		baseUrl: process.env.GONG_API_URL || 'https://api.gong.io/v2',
	}
}

/**
 * Check if Gong API is available (credentials configured).
 */
export function isGongApiAvailable(): boolean {
	return getGongApiConfig() !== null
}

/**
 * Fetch transcripts for one or more calls directly from Gong API.
 */
export async function fetchTranscriptsFromApi(
	callIds: string[],
	config?: GongApiConfig
): Promise<Map<string, string>> {
	const apiConfig = config || getGongApiConfig()
	if (!apiConfig) {
		throw new Error('Gong API credentials not configured (GONG_ACCESS_KEY, GONG_ACCESS_SECRET)')
	}

	const credentials = Buffer.from(`${apiConfig.accessKey}:${apiConfig.accessSecret}`).toString('base64')
	const results = new Map<string, string>()

	// Gong API has a limit on batch size, process in chunks
	const chunkSize = 10
	for (let i = 0; i < callIds.length; i += chunkSize) {
		const chunk = callIds.slice(i, i + chunkSize)

		try {
			const response = await fetch(`${apiConfig.baseUrl}/calls/transcript`, {
				method: 'POST',
				headers: {
					Authorization: `Basic ${credentials}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					filter: { callIds: chunk },
				}),
			})

			if (!response.ok) {
				const errorText = await response.text().catch(() => '')
				console.warn(`[gong-api] Transcript fetch failed for chunk: ${response.status} ${response.statusText}`)
				console.warn(`[gong-api] Request body: ${JSON.stringify({ filter: { callIds: chunk } })}`)
				console.warn(`[gong-api] Error response: ${errorText.slice(0, 200)}`)
				continue
			}

			const data = (await response.json()) as GongTranscriptResponse

			for (const callTranscript of data.callTranscripts || []) {
				if (callTranscript.transcript && callTranscript.transcript.length > 0) {
					const formattedTranscript = formatTranscript(callTranscript.transcript)
					results.set(callTranscript.callId, formattedTranscript)
				}
			}
		} catch (error) {
			console.warn(`[gong-api] Error fetching transcripts for chunk:`, error)
		}
	}

	return results
}

/**
 * Format raw Gong transcript segments into readable text.
 * Format: "Speaker ...XXXX: text"
 */
export function formatTranscript(segments: GongTranscriptSegment[]): string {
	return segments
		.map((segment) => {
			const speakerId = String(segment.speakerId || 'Unknown').slice(-4)
			const text = segment.sentences?.map((s) => s.text).join(' ') || ''
			return `Speaker ...${speakerId}: ${text}`
		})
		.join('\n')
}

/**
 * Fetch a single transcript from Gong API.
 * Returns null if not available.
 */
export async function fetchSingleTranscript(callId: string): Promise<string | null> {
	const results = await fetchTranscriptsFromApi([callId])
	return results.get(callId) || null
}
