/**
 * Gong Call Cache Manager
 * 
 * Manages a local cache of all Gong call metadata with enriched company names.
 * Supports initial backfill (6 months) and incremental syncing.
 */

import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import type { GongCallMetadata, GongCacheIndex, GongCacheSyncResult } from './schema.js'
import { callGongTool } from '../mcp-client.js'
import { extractCompanyNames } from './enrichment.js'

const CACHE_DIR = './data/gong-cache'
const INDEX_FILE = join(CACHE_DIR, 'calls-index.json')
const SCHEMA_VERSION = 1

export class GongCacheManager {
	private index: GongCacheIndex | null = null

	/**
	 * Initialize cache directory and load existing index
	 */
	async initialize(): Promise<void> {
		await mkdir(CACHE_DIR, { recursive: true })
		
		if (existsSync(INDEX_FILE)) {
			const data = await readFile(INDEX_FILE, 'utf-8')
			this.index = JSON.parse(data)
			console.log(`Loaded Gong cache: ${this.index!.totalCalls} calls, last sync: ${this.index!.lastSyncAt}`)
		} else {
			this.index = {
				calls: [],
				lastSyncAt: new Date(0).toISOString(), // Unix epoch
				totalCalls: 0,
				version: SCHEMA_VERSION,
			}
			console.log('Initialized new Gong cache')
		}
	}

	/**
	 * Perform initial backfill of last N months of calls using week-by-week batching
	 * 
	 * APPROACH: Since Gong MCP doesn't expose the pagination cursor parameter,
	 * we fetch calls week-by-week to avoid hitting the 100-call page limit.
	 * Each week is unlikely to have >100 calls, so pagination is not needed.
	 * 
	 * IMPORTANT: Must be called from Amp agent context (not standalone scripts).
	 * Use this tool in an Amp thread to populate the cache initially.
	 */
	async backfill(options?: { months?: number; delayMs?: number }): Promise<GongCacheSyncResult> {
		await this.initialize()
		
		const months = options?.months || 3 // Default 3 months for initial backfill
		const delayMs = options?.delayMs || 1000 // 1 second delay between week requests
		
		console.log(`Starting backfill of last ${months} months using week-by-week batching...`)
		
		const toDate = new Date()
		const fromDate = new Date()
		fromDate.setMonth(fromDate.getMonth() - months)
		
		// Generate week ranges to avoid pagination issues
		// Each week unlikely to exceed 100 calls
		const weekRanges = this.generateWeekRanges(fromDate, toDate)
		console.log(`Fetching calls across ${weekRanges.length} weekly batches`)
		
		const rawCalls: any[] = []
		
		for (let i = 0; i < weekRanges.length; i++) {
			const { start, end } = weekRanges[i]
			
			console.log(`Fetching week ${i + 1}/${weekRanges.length}: ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`)
			
			try {
				const resultContent = await callGongTool('list_calls', {
					fromDateTime: start.toISOString(),
					toDateTime: end.toISOString(),
				})
				const result = JSON.parse(resultContent[0].text)
				
				const weekCalls = result.calls || []
				rawCalls.push(...weekCalls)
				
				console.log(`  ✓ Found ${weekCalls.length} calls (total: ${rawCalls.length})`)
				
				// Respect rate limits
				if (i < weekRanges.length - 1) {
					await new Promise(resolve => setTimeout(resolve, delayMs))
				}
			} catch (error) {
				console.error(`  ✗ Failed to fetch week ${i + 1}:`, error)
				// Continue with other weeks
			}
		}
		
		console.log(`✓ Fetched ${rawCalls.length} total calls across ${weekRanges.length} weekly batches`)
		
		// Convert to metadata format with enrichment
		// NOTE: Participant data must be enriched separately via Amp SDK (lazy enrichment)
		const newCalls: GongCallMetadata[] = []
		let processed = 0
		
		for (const call of rawCalls) {
			const metadata: GongCallMetadata = {
				id: call.id,
				title: call.title || call.subject || 'Untitled Call',
				scheduled: call.scheduled || call.started || call.startTime || new Date().toISOString(),
				started: call.started,
				duration: call.duration || 0,
				primaryUserId: call.primaryUserId,
				direction: call.direction,
				system: call.system,
				scope: call.scope,
				language: call.language,
				url: call.url,
				companyNames: extractCompanyNames(call.title || call.subject || ''),
				participantEmails: [], // Will be enriched lazily when needed
				lastEnrichedAt: new Date().toISOString(),
			}
			
			newCalls.push(metadata)
			processed++
			
			if (processed % 100 === 0) {
				console.log(`Processed ${processed}/${rawCalls.length} calls...`)
			}
		}
		
		// Merge with existing calls (dedupe by ID)
		const existingIds = new Set(this.index!.calls.map(c => c.id))
		const uniqueNewCalls = newCalls.filter(c => !existingIds.has(c.id))
		
		this.index!.calls.push(...uniqueNewCalls)
		this.index!.calls.sort((a, b) => b.scheduled.localeCompare(a.scheduled)) // Sort by date desc
		this.index!.totalCalls = this.index!.calls.length
		this.index!.lastSyncAt = toDate.toISOString()
		
		await this.save()
		
		const syncResult: GongCacheSyncResult = {
			newCalls: uniqueNewCalls.length,
			updatedCalls: 0,
			totalCalls: this.index!.totalCalls,
			syncedAt: this.index!.lastSyncAt,
		}
		
		console.log(`Backfill complete: ${syncResult.newCalls} new calls, ${syncResult.totalCalls} total`)
		
		return syncResult
	}

	/**
	 * Incremental sync: fetch only calls since last sync
	 * Uses week-by-week batching if range > 14 days to avoid pagination issues
	 */
	async sync(): Promise<GongCacheSyncResult> {
		await this.initialize()
		
		const lastSync = new Date(this.index!.lastSyncAt)
		const now = new Date()
		
		// Add 5-minute overlap to avoid missing calls
		const fromDate = new Date(lastSync.getTime() - 5 * 60 * 1000)
		
		const daysDiff = (now.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)
		
		let rawCalls: any[] = []
		
		if (daysDiff > 14) {
			// Use week-by-week batching for large ranges
			console.log(`Syncing calls since ${fromDate.toISOString()} using week-by-week batching (${Math.ceil(daysDiff)} days)`)
			
			const weekRanges = this.generateWeekRanges(fromDate, now)
			
			for (let i = 0; i < weekRanges.length; i++) {
				const { start, end } = weekRanges[i]
				
				try {
					const resultContent = await callGongTool('list_calls', {
						fromDateTime: start.toISOString(),
						toDateTime: end.toISOString(),
					})
					const result = JSON.parse(resultContent[0].text)
					const weekCalls = result.calls || []
					rawCalls.push(...weekCalls)
					
					// Respect rate limits
					if (i < weekRanges.length - 1) {
						await new Promise(resolve => setTimeout(resolve, 500))
					}
				} catch (error) {
					console.error(`Failed to fetch week ${i + 1}:`, error)
				}
			}
		} else {
			// Single request for small ranges (<= 14 days)
			console.log(`Syncing calls since ${fromDate.toISOString()} (${Math.ceil(daysDiff)} days)`)
			
			const resultContent = await callGongTool('list_calls', {
				fromDateTime: fromDate.toISOString(),
				toDateTime: now.toISOString(),
			})
			
			const result = JSON.parse(resultContent[0].text)
			rawCalls = result.calls || []
		}
		
		console.log(`Fetched ${rawCalls.length} calls since last sync (incremental)`)
		
		if (rawCalls.length === 0) {
			console.log('No new calls to sync')
			return {
				newCalls: 0,
				updatedCalls: 0,
				totalCalls: this.index!.totalCalls,
				syncedAt: this.index!.lastSyncAt,
			}
		}
		
		// Build map of existing calls for quick lookup
		const existingCallsMap = new Map(this.index!.calls.map(c => [c.id, c]))
		
		let newCount = 0
		let updateCount = 0
		
		for (const call of rawCalls) {
			const metadata: GongCallMetadata = {
				id: call.id,
				title: call.title || call.subject || 'Untitled Call',
				scheduled: call.scheduled || call.started || call.startTime || new Date().toISOString(),
				started: call.started,
				duration: call.duration || 0,
				primaryUserId: call.primaryUserId,
				direction: call.direction,
				system: call.system,
				scope: call.scope,
				language: call.language,
				url: call.url,
				companyNames: extractCompanyNames(call.title || call.subject || ''),
				participantEmails: [], // Will be enriched lazily when needed
				lastEnrichedAt: new Date().toISOString(),
			}
			
			if (existingCallsMap.has(call.id)) {
				// Update existing
				const index = this.index!.calls.findIndex(c => c.id === call.id)
				this.index!.calls[index] = metadata
				updateCount++
			} else {
				// Add new
				this.index!.calls.push(metadata)
				newCount++
			}
		}
		
		// Re-sort by date
		this.index!.calls.sort((a, b) => b.scheduled.localeCompare(a.scheduled))
		this.index!.totalCalls = this.index!.calls.length
		this.index!.lastSyncAt = now.toISOString()
		
		await this.save()
		
		const syncResult: GongCacheSyncResult = {
			newCalls: newCount,
			updatedCalls: updateCount,
			totalCalls: this.index!.totalCalls,
			syncedAt: this.index!.lastSyncAt,
		}
		
		console.log(`Sync complete: ${newCount} new, ${updateCount} updated, ${syncResult.totalCalls} total`)
		
		return syncResult
	}

	/**
	 * Query calls for a specific account by company name or domain
	 * Auto-backfills cache if empty (first use)
	 */
	async getCallsForAccount(accountName: string, options?: {
		maxResults?: number
		since?: Date
		domain?: string // Optional: filter by participant email domain (e.g., "canva.com")
	}): Promise<GongCallMetadata[]> {
		await this.initialize()
		
		// Auto-backfill if cache is empty (first use)
		if (this.index!.totalCalls === 0) {
			console.log('Cache is empty, performing initial backfill...')
			try {
				await this.backfill({ months: 6 })
			} catch (error) {
				console.warn('Auto-backfill failed, returning empty results:', error)
				return []
			}
		}
		
		const searchName = accountName.toLowerCase()
		const domain = options?.domain?.toLowerCase()
		const since = options?.since
		const maxResults = options?.maxResults || 50
		
		let filtered = this.index!.calls.filter(call => {
			// Match if company name is in extracted names or in title
			const titleMatch = call.title.toLowerCase().includes(searchName)
			const companyMatch = call.companyNames.some(name => name.includes(searchName))
			
			// Match if any participant email contains the domain
			const domainMatch = domain && call.participantEmails?.some(email => 
				email.includes(domain)
			)
			
			return titleMatch || companyMatch || domainMatch
		})
		
		// Apply date filter if provided
		if (since) {
			const sinceISO = since.toISOString()
			filtered = filtered.filter(call => call.scheduled >= sinceISO)
		}
		
		// Limit results
		filtered = filtered.slice(0, maxResults)
		
		console.log(`Found ${filtered.length} calls for "${accountName}"`)
		
		return filtered
	}

	/**
	 * Get cache stats
	 */
	async getStats(): Promise<{
		totalCalls: number
		lastSyncAt: string
		oldestCall: string
		newestCall: string
		uniqueCompanies: number
	}> {
		await this.initialize()
		
		const calls = this.index!.calls
		const allCompanies = new Set<string>()
		calls.forEach(c => c.companyNames.forEach(name => allCompanies.add(name)))
		
		return {
			totalCalls: this.index!.totalCalls,
			lastSyncAt: this.index!.lastSyncAt,
			oldestCall: calls[calls.length - 1]?.scheduled || 'N/A',
			newestCall: calls[0]?.scheduled || 'N/A',
			uniqueCompanies: allCompanies.size,
		}
	}

	/**
	 * Generate week ranges from start to end date
	 * Used to avoid pagination issues with 100-call limit per request
	 */
	private generateWeekRanges(fromDate: Date, toDate: Date): Array<{ start: Date; end: Date }> {
		const ranges: Array<{ start: Date; end: Date }> = []
		const current = new Date(fromDate)
		
		while (current < toDate) {
			const weekStart = new Date(current)
			const weekEnd = new Date(current)
			weekEnd.setDate(weekEnd.getDate() + 7)
			
			// Don't exceed toDate
			if (weekEnd > toDate) {
				ranges.push({ start: weekStart, end: new Date(toDate) })
				break
			}
			
			ranges.push({ start: weekStart, end: weekEnd })
			current.setDate(current.getDate() + 7)
		}
		
		return ranges
	}

	/**
	 * Save index to disk
	 */
	private async save(): Promise<void> {
		await writeFile(INDEX_FILE, JSON.stringify(this.index, null, 2), 'utf-8')
	}
}

// Singleton instance
let cacheManager: GongCacheManager | null = null

export function getGongCacheManager(): GongCacheManager {
	if (!cacheManager) {
		cacheManager = new GongCacheManager()
	}
	return cacheManager
}
