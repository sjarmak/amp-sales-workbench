import { join } from 'path'
import { mkdir } from 'fs/promises'
import type { WorkbenchInput, WorkbenchResult, IngestedData } from './types.js'
import { resolveAccountKey } from './phases/intake.js'
import { runResearch } from './phases/research.js'
import { consolidateData } from './phases/consolidate.js'
import { generateDrafts } from './phases/draft.js'
import { applySalesforceChanges } from './phases/sync/syncSalesforce.js'
import { mirrorToNotion } from './phases/mirror/notionMirror.js'
import { detectCapabilities } from './capabilities.js'
import {
	readMeta,
	writeMeta,
	computeStaleness,
	updateSalesforceCheckpoint,
	updateGongCheckpoint,
	updateNotionCheckpoint,
} from './phases/freshness.js'
import { loadRawIfExists, mergeAndWriteRaw } from './phases/raw-io.js'
import { ingestFromSalesforce } from './phases/ingest/salesforce.js'
import { ingestFromGong } from './phases/ingest/gong.js'
import { ingestFromNotion } from './phases/ingest/notion.js'

export async function runWorkbench(input: WorkbenchInput): Promise<WorkbenchResult> {
	console.log('\n🚀 Amp Sales Workbench')
	console.log(`   Account: ${input.accountKey.name}`)
	console.log(`   Domain: ${input.accountKey.domain || 'N/A'}`)
	console.log(`   Salesforce ID: ${input.accountKey.salesforceId || 'TBD'}`)
	
	// Detect capabilities
	const capabilities = await detectCapabilities()

	// Phase 1: Intake - Resolve account key
	console.log('\n📥 Phase 1: Intake')
	const resolvedKey = await resolveAccountKey(input.accountKey)
	console.log(`   ✓ Resolved: ${resolvedKey.salesforceId}`)

	// Setup account data directory
	const accountSlug = resolvedKey.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
	const accountDataDir = join('data', 'accounts', accountSlug)
	await setupDataDirectories(accountDataDir)

	// Phase 2: Research - Run amp-prospector if needed
	console.log('\n🔍 Phase 2: Research')
	
	const researchResult = await runResearch(
		resolvedKey,
		accountDataDir,
		input.forceResearch
	)
	
	if (researchResult.completed) {
		console.log('   ✓ Research complete')
	} else {
		console.log('   ✓ Using cached research')
	}

	// Phase 3: Enrichment - Smart refresh with staleness checking
	console.log('\n📊 Phase 3: Enrichment')
	
	const meta = await readMeta(accountDataDir)
	const staleness = computeStaleness(meta)
	
	const ingestedData: IngestedData = {
		salesforce: { lastSyncedAt: new Date().toISOString() },
		gong: { lastSyncedAt: new Date().toISOString() },
		notion: { lastSyncedAt: new Date().toISOString() },
	}

	// Salesforce: Check staleness and use cached or incremental refresh
	if (!capabilities.salesforce) {
		console.log('   ⏭️  Salesforce skipped (no capability)')
	} else if (!staleness.salesforce.any) {
		console.log('   ↻ Salesforce using cached data')
		ingestedData.salesforce = await loadRawIfExists(accountDataDir, 'salesforce')
	} else {
		console.log(`   🔄 Salesforce refreshing: ${staleness.salesforce.reasons.join(', ')}`)
		const sfResult = await ingestFromSalesforce(resolvedKey, {
			sinceAccount: meta.sources.salesforce?.entityCheckpoints?.Account?.since,
			sinceContact: meta.sources.salesforce?.entityCheckpoints?.Contact?.since,
			sinceOpportunity: meta.sources.salesforce?.entityCheckpoints?.Opportunity?.since,
			sinceActivity: meta.sources.salesforce?.entityCheckpoints?.Activity?.since,
		})

		ingestedData.salesforce = await mergeAndWriteRaw(accountDataDir, 'salesforce', sfResult)

		// Update checkpoints with latest LastModifiedDate from results
		const now = new Date().toISOString()
		if (sfResult.account) {
			updateSalesforceCheckpoint(meta, 'Account', {
				lastFetchedAt: now,
				since: sfResult.account.LastModifiedDate || now,
				count: 1,
			})
		}
		if (sfResult.contacts && sfResult.contacts.length > 0) {
			const latestMod = sfResult.contacts.reduce((latest, c) =>
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
			const latestMod = sfResult.opportunities.reduce((latest, o) =>
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
			const latestMod = sfResult.activities.reduce((latest, a) =>
				a.LastModifiedDate > latest ? a.LastModifiedDate : latest,
				meta.sources.salesforce?.entityCheckpoints?.Activity?.since || now
			)
			updateSalesforceCheckpoint(meta, 'Activity', {
				lastFetchedAt: now,
				since: latestMod,
				count: sfResult.activities.length,
			})
		}
	}

	// Gong: Check staleness and use cached or incremental refresh
	if (!capabilities.gong) {
		console.log('   ⏭️  Gong skipped (no capability)')
	} else if (!staleness.gong.any) {
		console.log('   ↻ Gong using cached data')
		ingestedData.gong = await loadRawIfExists(accountDataDir, 'gong')
	} else {
		console.log(`   🔄 Gong refreshing: ${staleness.gong.reasons.join(', ')}`)
		const gongResult = await ingestFromGong(resolvedKey, accountDataDir, {
			since: meta.sources.gong?.since,
			maxCalls: 20,
		})

		ingestedData.gong = await mergeAndWriteRaw(accountDataDir, 'gong', gongResult)

		// Update checkpoint
		const now = new Date().toISOString()
		updateGongCheckpoint(meta, {
			lastListSyncAt: now,
			since: now,
			callCount: gongResult.calls?.length || 0,
			transcripts: gongResult.transcripts || {},
		})
	}

	// Notion: Check staleness and use cached or incremental refresh
	if (!capabilities.notion) {
		console.log('   ⏭️  Notion skipped (no capability)')
	} else if (!staleness.notion.any) {
		console.log('   ↻ Notion using cached data')
		ingestedData.notion = await loadRawIfExists(accountDataDir, 'notion')
	} else {
		console.log(`   🔄 Notion refreshing: ${staleness.notion.reasons.join(', ')}`)
		const notionResult = await ingestFromNotion(resolvedKey, {
			since: meta.sources.notion?.since,
		})

		ingestedData.notion = await mergeAndWriteRaw(accountDataDir, 'notion', notionResult)

		// Update checkpoint
		const now = new Date().toISOString()
		updateNotionCheckpoint(meta, {
			lastFullSyncAt: now,
			since: now,
			pageCount: notionResult.relatedPages?.length || 0,
		})
	}

	// Write updated metadata
	await writeMeta(accountDataDir, meta)
	
	console.log('   ✓ Enrichment complete')

	// Phase 4: Consolidation
	console.log('\n🔄 Phase 4: Consolidation')
	const snapshot = await consolidateData(resolvedKey, ingestedData, accountDataDir)
	console.log('   ✓ Snapshot generated')

	// Phase 5: Draft Generation
	console.log('\n📝 Phase 5: Draft Generation')
	const draft = await generateDrafts(resolvedKey, snapshot, accountDataDir, capabilities)
	console.log('   ✓ Draft saved')

	// Phase 6: Apply (if requested)
	let applyReceipt
	if (input.apply) {
		if (!capabilities.salesforce) {
			console.log('\n⚠️  Phase 6: Apply Changes - SKIPPED (no Salesforce capability)')
		} else {
			console.log('\n✅ Phase 6: Apply Changes')
			const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '')
			const draftYamlPath = join(accountDataDir, 'drafts', `crm-draft-${timestamp}.yaml`)
			
			applyReceipt = await applySalesforceChanges(resolvedKey, draftYamlPath, accountDataDir)
			
			const successCount = [
				applyReceipt.patches.account?.success ? 1 : 0,
				...(applyReceipt.patches.contacts?.filter(c => c.success) || []),
				...(applyReceipt.patches.opportunities?.filter(o => o.success) || []),
			].length
			
			console.log(`   ✓ Applied ${successCount} changes`)
			if (applyReceipt.errors && applyReceipt.errors.length > 0) {
				console.log(`   ⚠️  ${applyReceipt.errors.length} errors`)
			}

			// Auto-refresh Salesforce data after applying changes
			console.log('\n🔄 Auto-refreshing Salesforce data after apply')
			const metaAfterApply = await readMeta(accountDataDir)
			const sfRefresh = await ingestFromSalesforce(resolvedKey)
			await mergeAndWriteRaw(accountDataDir, 'salesforce', sfRefresh)

			// Update checkpoints
			const now = new Date().toISOString()
			if (sfRefresh.account) {
				updateSalesforceCheckpoint(metaAfterApply, 'Account', {
					lastFetchedAt: now,
					since: sfRefresh.account.LastModifiedDate || now,
					count: 1,
				})
			}
			if (sfRefresh.opportunities && sfRefresh.opportunities.length > 0) {
				const latestMod = sfRefresh.opportunities.reduce((latest, o) =>
					o.LastModifiedDate > latest ? o.LastModifiedDate : latest, now
				)
				updateSalesforceCheckpoint(metaAfterApply, 'Opportunity', {
					lastFetchedAt: now,
					since: latestMod,
					count: sfRefresh.opportunities.length,
				})
			}
			await writeMeta(accountDataDir, metaAfterApply)
			console.log('   ✓ Salesforce data refreshed')
		}
	} else {
		console.log('\n⏸️  Changes drafted. Review and run with --apply to sync.')
	}

	// Phase 7: Mirror to Notion (optional)
	console.log('\n🔄 Phase 7: Notion Mirror')
	
	let notionResult
	if (!capabilities.notion) {
		console.log('   ⏭️  Skipped (no Notion capability)')
		notionResult = { success: true }
	} else {
		notionResult = await mirrorToNotion(resolvedKey, snapshot, accountDataDir)
		
		if (notionResult.success && notionResult.pageUrl) {
			console.log(`   ✓ Notion updated: ${notionResult.pageUrl}`)
		} else if (notionResult.success) {
			console.log('   ⏭️  Skipped (not configured)')
		} else {
			console.log(`   ⚠️  Error: ${notionResult.error}`)
		}
	}

	console.log('\n✨ Workbench Complete!')
	console.log(`   Output: ${accountDataDir}`)

	return {
		accountKey: resolvedKey,
		snapshot,
		draft,
		applied: applyReceipt,
		notionMirror: notionResult,
		outputDir: accountDataDir,
	}
}

async function setupDataDirectories(accountDataDir: string): Promise<void> {
	// Create all required subdirectories
	await mkdir(join(accountDataDir, 'raw'), { recursive: true })
	await mkdir(join(accountDataDir, 'snapshots'), { recursive: true })
	await mkdir(join(accountDataDir, 'drafts'), { recursive: true })
	await mkdir(join(accountDataDir, 'applied'), { recursive: true })
	await mkdir(join(accountDataDir, 'prospecting'), { recursive: true })
}


