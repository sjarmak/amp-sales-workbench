import { join } from 'path'
import { readFile, writeFile, access } from 'fs/promises'

// TTL configuration (in milliseconds)
const TTL = {
	salesforce: {
		opportunities: 6 * 60 * 60 * 1000, // 6 hours
		activities: 6 * 60 * 60 * 1000, // 6 hours
		contacts: 24 * 60 * 60 * 1000, // 24 hours
		account: 7 * 24 * 60 * 60 * 1000, // 7 days
	},
	gong: {
		callList: 24 * 60 * 60 * 1000, // 24 hours
		// transcripts: never stale (cached by hash)
	},
	notion: {
		knowledge: 7 * 24 * 60 * 60 * 1000, // 7 days
		accountPages: 14 * 24 * 60 * 60 * 1000, // 14 days
	},
	amp: {
		news: 6 * 60 * 60 * 1000, // 6 hours
		manual: 7 * 24 * 60 * 60 * 1000, // 7 days
	},
}

export type SourceStatus = 'fresh' | 'stale' | 'missing' | 'error'

export interface EntityCheckpoint {
	lastFetchedAt?: string // ISO timestamp
	since?: string // ISO timestamp for incremental
	count?: number
	remoteLastModifiedAt?: string // Last modified on source (Salesforce, etc.)
}

export interface SourceMetadata {
	lastFullSyncAt?: string
	lastIncrementalSyncAt?: string
	status?: SourceStatus
	error?: string
}

export interface SalesforceMetadata extends SourceMetadata {
	entityCheckpoints?: {
		Account?: EntityCheckpoint
		Contact?: EntityCheckpoint
		Opportunity?: EntityCheckpoint
		Activity?: EntityCheckpoint
	}
	lastProbedAt?: string // Last time we checked remote source for freshness
}

export interface GongMetadata extends SourceMetadata {
	lastListSyncAt?: string
	since?: string
	callCount?: number
	transcripts?: Record<string, { hash: string; fetchedAt: string }>
	latestCallAtOnSource?: string // Most recent call start time for this account on Gong
	lastProbedAt?: string // Last time we checked remote source for freshness
}

export interface NotionMetadata extends SourceMetadata {
	since?: string
	pageCount?: number
	pageUrls?: string[] // Account-specific Notion page URLs
	lastRemoteEditedAt?: string // Most recent last_edited_time across pages
	lastProbedAt?: string // Last time we checked remote source for freshness
}

export interface AmpPage {
	url: string
	etag?: string
	lastModified?: string
	hash?: string
	lastFetchedAt?: string
	lastProbedAt?: string // Last time we checked remote source for freshness
}

export interface AmpMetadata extends SourceMetadata {
	pages?: {
		news?: AmpPage
		manual?: AmpPage
	}
	featuresCount?: number
	featuresLastGeneratedAt?: string
	lastProbedAt?: string // Last time we checked remote source for freshness
}

export interface SourcesMeta {
	version: number
	sources: {
		salesforce?: SalesforceMetadata
		gong?: GongMetadata
		notion?: NotionMetadata
		amp?: AmpMetadata
	}
}

export interface StalenessResult {
	any: boolean
	reasons: string[]
	entities?: Record<string, boolean>
}

const META_FILENAME = '_sources.meta.json'

export async function readMeta(accountDataDir: string): Promise<SourcesMeta> {
	const metaPath = join(accountDataDir, 'raw', META_FILENAME)

	try {
		await access(metaPath)
		const content = await readFile(metaPath, 'utf-8')
		return JSON.parse(content)
	} catch {
		// Return default meta if not exists
		return {
			version: 1,
			sources: {},
		}
	}
}

export async function writeMeta(
	accountDataDir: string,
	meta: SourcesMeta
): Promise<void> {
	const metaPath = join(accountDataDir, 'raw', META_FILENAME)
	await writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8')
}

export function computeStaleness(
	meta: SourcesMeta,
	now: Date = new Date()
): {
	salesforce: StalenessResult
	gong: StalenessResult
	notion: StalenessResult
	amp: StalenessResult
} {
	const nowMs = now.getTime()

	// Salesforce staleness
	const sfMeta = meta.sources.salesforce
	const sfResult: StalenessResult = {
		any: false,
		reasons: [],
		entities: {},
	}

	if (!sfMeta || !sfMeta.entityCheckpoints) {
		sfResult.any = true
		sfResult.reasons.push('No Salesforce data found')
	} else {
		const checkpoints = sfMeta.entityCheckpoints
		
		// If we just probed/synced recently (within last 5 minutes), consider fresh
		const justProbed = sfMeta.lastProbedAt && (nowMs - new Date(sfMeta.lastProbedAt).getTime()) < 5 * 60 * 1000
		const justSynced = sfMeta.lastIncrementalSyncAt && (nowMs - new Date(sfMeta.lastIncrementalSyncAt).getTime()) < 5 * 60 * 1000

		// Check Account
		if (!checkpoints.Account?.lastFetchedAt) {
			sfResult.entities!.Account = true
			sfResult.reasons.push('Account data missing')
		} else {
			const age = nowMs - new Date(checkpoints.Account.lastFetchedAt).getTime()
			if (age > TTL.salesforce.account && !justProbed && !justSynced) {
				sfResult.entities!.Account = true
				sfResult.reasons.push(`Account data stale (${Math.floor(age / (24 * 60 * 60 * 1000))}d old)`)
			}
		}

		// Check Contacts
		if (!checkpoints.Contact?.lastFetchedAt) {
			sfResult.entities!.Contact = true
			sfResult.reasons.push('Contact data missing')
		} else {
			const age = nowMs - new Date(checkpoints.Contact.lastFetchedAt).getTime()
			if (age > TTL.salesforce.contacts && !justProbed && !justSynced) {
				sfResult.entities!.Contact = true
				sfResult.reasons.push(`Contact data stale (${Math.floor(age / (60 * 60 * 1000))}h old)`)
			}
		}

		// Check Opportunities
		if (!checkpoints.Opportunity?.lastFetchedAt) {
			sfResult.entities!.Opportunity = true
			sfResult.reasons.push('Opportunity data missing')
		} else {
			const age = nowMs - new Date(checkpoints.Opportunity.lastFetchedAt).getTime()
			if (age > TTL.salesforce.opportunities && !justProbed && !justSynced) {
				sfResult.entities!.Opportunity = true
				sfResult.reasons.push(`Opportunity data stale (${Math.floor(age / (60 * 60 * 1000))}h old)`)
			}
		}

		// Check Activities
		if (!checkpoints.Activity?.lastFetchedAt) {
			sfResult.entities!.Activity = true
			sfResult.reasons.push('Activity data missing')
		} else {
			const age = nowMs - new Date(checkpoints.Activity.lastFetchedAt).getTime()
			if (age > TTL.salesforce.activities && !justProbed && !justSynced) {
				sfResult.entities!.Activity = true
				// Note: 0 activities is OK if recently fetched - it just means no activities exist
				sfResult.reasons.push(`Activity data stale (${Math.floor(age / (60 * 60 * 1000))}h old)`)
			}
		}

		sfResult.any = Object.values(sfResult.entities!).some((stale) => stale)
	}

	// Gong staleness
	const gongMeta = meta.sources.gong
	const gongResult: StalenessResult = {
		any: false,
		reasons: [],
	}

	if (!gongMeta || !gongMeta.lastListSyncAt) {
		gongResult.any = true
		gongResult.reasons.push('No Gong call list data found')
	} else {
		// If we just probed/synced recently (within last 5 minutes), consider fresh
		const justProbed = gongMeta.lastProbedAt && (nowMs - new Date(gongMeta.lastProbedAt).getTime()) < 5 * 60 * 1000
		
		const age = nowMs - new Date(gongMeta.lastListSyncAt).getTime()
		if (age > TTL.gong.callList && !justProbed) {
			gongResult.any = true
			gongResult.reasons.push(`Gong call list stale (${Math.floor(age / (60 * 60 * 1000))}h old)`)
		}
	}

	// Notion staleness
	const notionMeta = meta.sources.notion
	const notionResult: StalenessResult = {
		any: false,
		reasons: [],
	}

	if (!notionMeta || !notionMeta.lastFullSyncAt) {
		notionResult.any = true
		notionResult.reasons.push('No Notion data found')
	} else {
		// If we just probed/synced recently (within last 5 minutes), consider fresh
		const justProbed = notionMeta.lastProbedAt && (nowMs - new Date(notionMeta.lastProbedAt).getTime()) < 5 * 60 * 1000
		
		const age = nowMs - new Date(notionMeta.lastFullSyncAt).getTime()
		// Use knowledge TTL as default
		if (age > TTL.notion.knowledge && !justProbed) {
			notionResult.any = true
			notionResult.reasons.push(`Notion data stale (${Math.floor(age / (24 * 60 * 60 * 1000))}d old)`)
		}
	}

	// Amp staleness
	const ampMeta = meta.sources.amp
	const ampResult: StalenessResult = {
		any: false,
		reasons: [],
	}

	if (!ampMeta || !ampMeta.pages) {
		ampResult.any = true
		ampResult.reasons.push('No Amp data found')
	} else {
		// If we just probed/synced recently (within last 5 minutes), consider fresh
		const justProbed = ampMeta.lastProbedAt && (nowMs - new Date(ampMeta.lastProbedAt).getTime()) < 5 * 60 * 1000
		
		const { news, manual } = ampMeta.pages

		// Check news page
		if (!news?.lastFetchedAt) {
			ampResult.any = true
			ampResult.reasons.push('Amp news page missing')
		} else {
			const age = nowMs - new Date(news.lastFetchedAt).getTime()
			if (age > TTL.amp.news && !justProbed) {
				ampResult.any = true
				ampResult.reasons.push(`Amp news stale (${Math.floor(age / (60 * 60 * 1000))}h old)`)
			}
		}

		// Check manual page
		if (!manual?.lastFetchedAt) {
			ampResult.any = true
			ampResult.reasons.push('Amp manual page missing')
		} else {
			const age = nowMs - new Date(manual.lastFetchedAt).getTime()
			if (age > TTL.amp.manual && !justProbed) {
				ampResult.any = true
				ampResult.reasons.push(`Amp manual stale (${Math.floor(age / (24 * 60 * 60 * 1000))}d old)`)
			}
		}
	}

	return {
		salesforce: sfResult,
		gong: gongResult,
		notion: notionResult,
		amp: ampResult,
	}
}

export function updateSalesforceCheckpoint(
	meta: SourcesMeta,
	entity: 'Account' | 'Contact' | 'Opportunity' | 'Activity',
	checkpoint: EntityCheckpoint
): void {
	if (!meta.sources.salesforce) {
		meta.sources.salesforce = {}
	}
	if (!meta.sources.salesforce.entityCheckpoints) {
		meta.sources.salesforce.entityCheckpoints = {}
	}
	meta.sources.salesforce.entityCheckpoints[entity] = checkpoint
	meta.sources.salesforce.lastIncrementalSyncAt = new Date().toISOString()
	meta.sources.salesforce.status = 'fresh'
}

export function updateGongCheckpoint(
	meta: SourcesMeta,
	update: Partial<GongMetadata>
): void {
	if (!meta.sources.gong) {
		meta.sources.gong = {}
	}
	Object.assign(meta.sources.gong, update)
	meta.sources.gong.status = 'fresh'
}

export function updateNotionCheckpoint(
	meta: SourcesMeta,
	update: Partial<NotionMetadata>
): void {
	if (!meta.sources.notion) {
		meta.sources.notion = {}
	}
	Object.assign(meta.sources.notion, update)
	meta.sources.notion.status = 'fresh'
}

export function updateAmpCheckpoint(
	meta: SourcesMeta,
	update: Partial<AmpMetadata>
): void {
	if (!meta.sources.amp) {
		meta.sources.amp = {}
	}
	Object.assign(meta.sources.amp, update)
	meta.sources.amp.status = 'fresh'
}
