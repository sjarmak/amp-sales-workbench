#!/usr/bin/env node
import { join } from 'path'
import type { AccountKey } from '../types.js'
import { resolveAccountKey } from '../phases/intake.js'
import {
	readMeta,
	computeStaleness,
	updateSalesforceCheckpoint,
	updateGongCheckpoint,
	updateNotionCheckpoint,
} from '../phases/freshness.js'
import { mergeAndWriteRaw } from '../phases/raw-io.js'
import { ingestFromSalesforce } from '../phases/ingest/salesforce.js'
import { ingestFromGong } from '../phases/ingest/gong.js'
import { ingestFromNotion } from '../phases/ingest/notion.js'
import { detectCapabilities } from '../capabilities.js'

type RefreshMode = 'auto' | 'incremental' | 'full'
type SourceType = 'salesforce' | 'gong' | 'notion' | 'all'

interface RefreshOptions {
	mode: RefreshMode
	sources: SourceType[]
}

export async function refreshData(
	accountKey: Partial<AccountKey>,
	options: RefreshOptions = { mode: 'auto', sources: ['all'] }
): Promise<{
	success: boolean
	updated: boolean
	modeUsed: string
	stats: Record<string, any>
	error?: string
}> {
	try {
		console.log(`Starting ${options.mode} refresh for ${options.sources.join(', ')}...`)

		// Resolve account key
		const resolvedKey = await resolveAccountKey(accountKey as AccountKey)
		const accountSlug = resolvedKey.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
		const accountDataDir = join('data', 'accounts', accountSlug)

		console.log(`Account directory: ${accountDataDir}`)

		// Detect capabilities
		const capabilities = await detectCapabilities()
		console.log(`Capabilities detected:`, JSON.stringify(capabilities, null, 2))

		// Determine which sources to refresh
		const sourcesToRefresh =
			options.sources.includes('all')
				? ['salesforce', 'gong', 'notion']
				: options.sources

		// Load metadata for staleness checking
		const meta = await readMeta(accountDataDir)
		const staleness = computeStaleness(meta)

		const stats: Record<string, any> = {}
		let anyUpdated = false
		let modeUsed = 'cached'

		// Refresh each source
		console.log(`Checking staleness...`)
		for (const source of sourcesToRefresh) {
			console.log(`\nProcessing ${source}...`)
			if (source === 'salesforce' && capabilities.salesforce) {
				const result = await refreshSalesforce(
					resolvedKey,
					accountDataDir,
					meta,
					staleness.salesforce,
					options.mode
				)
				if (result.updated) {
					anyUpdated = true
					modeUsed = result.mode
					console.log(`Salesforce updated (${result.mode})`)
				} else {
					console.log(`Salesforce cached (fresh)`)
				}
				Object.assign(stats, result.stats)
			} else if (source === 'gong' && capabilities.gong) {
				const result = await refreshGong(
					resolvedKey,
					accountDataDir,
					meta,
					staleness.gong,
					options.mode
				)
				if (result.updated) {
					anyUpdated = true
					modeUsed = result.mode
					console.log(`Gong updated (${result.mode})`)
				} else {
					console.log(`Gong cached (fresh)`)
				}
				Object.assign(stats, result.stats)
			} else if (source === 'notion' && capabilities.notion) {
				const result = await refreshNotion(
					resolvedKey,
					accountDataDir,
					meta,
					staleness.notion,
					options.mode
				)
				if (result.updated) {
					anyUpdated = true
					modeUsed = result.mode
					console.log(`Notion updated (${result.mode})`)
				} else {
					console.log(`Notion cached (fresh)`)
				}
				Object.assign(stats, result.stats)
			} else {
				console.log(`${source} skipped (no capability)`)
			}
		}

		console.log('\nRefresh complete!')
		console.log(`Data stored in: ${accountDataDir}/raw/`)
		console.log(`Final stats:`, JSON.stringify(stats, null, 2))
		
		const result = {
			success: true,
			updated: anyUpdated,
			modeUsed,
			stats,
			dataPath: `${accountDataDir}/raw/`,
		}
		
		// Print final result as JSON for parsing by UI
		console.log('\n=== RESULT ===')
		console.log(JSON.stringify(result, null, 2))
		console.log('=== END RESULT ===')
		
		return result
	} catch (error) {
		console.error('Refresh failed:', error)
		return {
			success: false,
			updated: false,
			modeUsed: 'error',
			stats: {},
			error: error instanceof Error ? error.message : String(error),
		}
	}
}

async function refreshSalesforce(
	accountKey: AccountKey,
	accountDataDir: string,
	meta: any,
	staleness: { any: boolean; reasons: string[]; entities?: Record<string, boolean> },
	mode: RefreshMode
): Promise<{ updated: boolean; mode: string; stats: Record<string, any> }> {
	// Check if refresh needed for auto mode
	if (mode === 'auto' && !staleness.any) {
		console.log('Salesforce using cached data (fresh)')
		return {
			updated: false,
			mode: 'cached',
			stats: {
				contactsCount: meta.sources.salesforce?.entityCheckpoints?.Contact?.count || 0,
				opportunitiesCount:
					meta.sources.salesforce?.entityCheckpoints?.Opportunity?.count || 0,
			},
		}
	}

	// Determine refresh mode
	const isFullRefresh = mode === 'full'
	const actualMode = isFullRefresh ? 'full' : 'incremental'

	console.log(
		`Salesforce refreshing (${actualMode}): ${staleness.reasons.join(', ') || 'forced'}`
	)

	// Perform refresh
	const sfResult = await ingestFromSalesforce(accountKey, {
		sinceAccount: isFullRefresh
			? undefined
			: meta.sources.salesforce?.entityCheckpoints?.Account?.since,
		sinceContact: isFullRefresh
			? undefined
			: meta.sources.salesforce?.entityCheckpoints?.Contact?.since,
		sinceOpportunity: isFullRefresh
			? undefined
			: meta.sources.salesforce?.entityCheckpoints?.Opportunity?.since,
		sinceActivity: isFullRefresh
			? undefined
			: meta.sources.salesforce?.entityCheckpoints?.Activity?.since,
	})

	// Merge and write raw data
	await mergeAndWriteRaw(accountDataDir, 'salesforce', sfResult)

	// Update metadata checkpoints for each entity
	const now = new Date().toISOString()
	if (sfResult.account) {
		updateSalesforceCheckpoint(meta, 'Account', {
			lastFetchedAt: now,
			since: sfResult.account.LastModifiedDate || now,
			count: 1,
		})
	}
	if (sfResult.contacts && sfResult.contacts.length > 0) {
		const latestMod = sfResult.contacts.reduce(
			(latest: string, c: any) =>
				c.LastModifiedDate > latest ? c.LastModifiedDate : latest,
			meta.sources.salesforce?.entityCheckpoints?.Contact?.since || now
		)
		updateSalesforceCheckpoint(meta, 'Contact', {
			lastFetchedAt: now,
			since: latestMod,
			count: sfResult.contacts.length,
		})
	}
	if (sfResult.opportunities && sfResult.opportunities.length > 0) {
		const latestMod = sfResult.opportunities.reduce(
			(latest: string, o: any) =>
				o.LastModifiedDate > latest ? o.LastModifiedDate : latest,
			meta.sources.salesforce?.entityCheckpoints?.Opportunity?.since || now
		)
		updateSalesforceCheckpoint(meta, 'Opportunity', {
			lastFetchedAt: now,
			since: latestMod,
			count: sfResult.opportunities.length,
		})
	}
	if (sfResult.activities && sfResult.activities.length > 0) {
		const latestMod = sfResult.activities.reduce(
			(latest: string, a: any) =>
				a.LastModifiedDate > latest ? a.LastModifiedDate : latest,
			meta.sources.salesforce?.entityCheckpoints?.Activity?.since || now
		)
		updateSalesforceCheckpoint(meta, 'Activity', {
			lastFetchedAt: now,
			since: latestMod,
			count: sfResult.activities.length,
		})
	}

	// Save updated meta
	const { writeMeta } = await import('../phases/freshness.js')
	await writeMeta(accountDataDir, meta)

	// Reload meta to get final state
	const updatedMeta = await readMeta(accountDataDir)

	return {
		updated: true,
		mode: actualMode,
		stats: {
			contactsCount: updatedMeta.sources.salesforce?.entityCheckpoints?.Contact?.count || 0,
			opportunitiesCount:
				updatedMeta.sources.salesforce?.entityCheckpoints?.Opportunity?.count || 0,
			activitiesCount:
				updatedMeta.sources.salesforce?.entityCheckpoints?.Activity?.count || 0,
		},
	}
}

async function refreshGong(
	accountKey: AccountKey,
	accountDataDir: string,
	meta: any,
	staleness: { any: boolean; reasons: string[] },
	mode: RefreshMode
): Promise<{ updated: boolean; mode: string; stats: Record<string, any> }> {
	// Check if refresh needed for auto mode
	if (mode === 'auto' && !staleness.any) {
		console.log('Gong using cached data (fresh)')
		return {
			updated: false,
			mode: 'cached',
			stats: {
				callsCount: meta.sources.gong?.callCount || 0,
			},
		}
	}

	const isFullRefresh = mode === 'full'
	const actualMode = isFullRefresh ? 'full' : 'incremental'

	console.log(`Gong refreshing (${actualMode}): ${staleness.reasons.join(', ') || 'forced'}`)

	// Perform refresh
	const gongResult = await ingestFromGong(accountKey, accountDataDir, {
		since: isFullRefresh ? undefined : meta.sources.gong?.lastListSyncAt,
	})

	// Merge and write raw data
	await mergeAndWriteRaw(accountDataDir, 'gong', gongResult)

	// Update metadata checkpoint
	updateGongCheckpoint(meta, {
		lastListSyncAt: gongResult.lastSyncedAt,
		callCount: gongResult.calls?.length || 0,
		transcripts: gongResult.transcripts || {},
	})

	// Save updated meta
	const { writeMeta } = await import('../phases/freshness.js')
	await writeMeta(accountDataDir, meta)

	// Reload meta to get final state
	const updatedMeta = await readMeta(accountDataDir)

	return {
		updated: true,
		mode: actualMode,
		stats: {
			callsCount: updatedMeta.sources.gong?.callCount || 0,
			transcriptsCount: Object.keys(updatedMeta.sources.gong?.transcripts || {}).length,
		},
	}
}

async function refreshNotion(
	accountKey: AccountKey,
	accountDataDir: string,
	meta: any,
	staleness: { any: boolean; reasons: string[] },
	mode: RefreshMode
): Promise<{ updated: boolean; mode: string; stats: Record<string, any> }> {
	// Check if refresh needed for auto mode
	if (mode === 'auto' && !staleness.any) {
		console.log('Notion using cached data (fresh)')
		return {
			updated: false,
			mode: 'cached',
			stats: {
				pagesCount: meta.sources.notion?.pageCount || 0,
			},
		}
	}

	const actualMode = mode === 'full' ? 'full' : 'incremental'

	console.log(`Notion refreshing (${actualMode}): ${staleness.reasons.join(', ') || 'forced'}`)

	// Perform refresh (Notion doesn't support incremental, always full)
	const notionResult = await ingestFromNotion(accountKey)

	// Write raw data
	await mergeAndWriteRaw(accountDataDir, 'notion', notionResult)

	// Update metadata checkpoint
	updateNotionCheckpoint(meta, {
		lastFullSyncAt: notionResult.lastSyncedAt,
		pageCount: notionResult.relatedPages?.length || 0,
	})

	// Save updated meta
	const { writeMeta } = await import('../phases/freshness.js')
	await writeMeta(accountDataDir, meta)

	// Reload meta to get final state
	const updatedMeta = await readMeta(accountDataDir)

	return {
		updated: true,
		mode: 'full', // Notion always does full refresh
		stats: {
			pagesCount: updatedMeta.sources.notion?.pageCount || 0,
		},
	}
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
	const args = process.argv.slice(2)

	if (args.length === 0) {
		console.error('Usage: refreshData.ts <account-name> [--mode auto|incremental|full] [--sources salesforce|gong|notion|all]')
		process.exit(1)
	}

	const accountName = args[0]
	const modeIdx = args.indexOf('--mode')
	const sourcesIdx = args.indexOf('--sources')

	const mode = (modeIdx >= 0 ? args[modeIdx + 1] : 'auto') as RefreshMode
	const sourcesArg = sourcesIdx >= 0 ? args[sourcesIdx + 1] : 'all'
	const sources = sourcesArg.split(',') as SourceType[]

	refreshData({ name: accountName }, { mode, sources })
		.then((result) => {
			console.log(JSON.stringify(result, null, 2))
			process.exit(result.success ? 0 : 1)
		})
		.catch((error) => {
			console.error('Fatal error:', error)
			process.exit(1)
		})
}
