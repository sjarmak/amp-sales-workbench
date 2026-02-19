/**
 * Gong Call Cache Schema
 * 
 * Stores metadata for all Gong calls to enable fast local filtering
 * without repeated API calls. Includes enriched company names extracted
 * from call titles for reliable account matching.
 */

export interface GongCallMetadata {
	id: string
	title: string
	scheduled: string // ISO timestamp
	started?: string // ISO timestamp
	duration: number // seconds
	primaryUserId?: string
	direction?: string
	system?: string // "Zoom", "Teams", etc.
	scope?: string // "External", "Internal"
	language?: string
	url?: string
	
	// Enriched metadata
	companyNames: string[] // Extracted company names from title (lowercase)
	participantEmails?: string[] // Participant email addresses for domain-based filtering
	lastEnrichedAt?: string // ISO timestamp
}

export interface GongCacheIndex {
	calls: GongCallMetadata[]
	lastSyncAt: string // ISO timestamp
	totalCalls: number
	version: number // Schema version for migrations
}

export interface GongCacheSyncResult {
	newCalls: number
	updatedCalls: number
	totalCalls: number
	syncedAt: string
}
