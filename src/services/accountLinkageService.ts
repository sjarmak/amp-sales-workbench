/**
 * Account Linkage Service
 * 
 * Links Salesforce accounts to Gong call data via account name matching.
 * Supports exact, fuzzy, and domain-based matching strategies.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { queryGongCallsFromParquet } from '../clients/gongParquetClient.js'
import type { SalesforceAccountRecord, AccountIndex } from './csvProcessor.js'
import { searchAccounts } from './csvProcessor.js'

export interface LinkedCallResult {
	call_id: string
	title: string
	created_at: string
	browser_duration_sec?: number
	transcript_text?: string | null
	match_confidence: number
	matched_field: 'name' | 'domain' | 'fuzzy'
}

export interface AccountWithLinkedCalls {
	account: SalesforceAccountRecord
	gong_calls: LinkedCallResult[]
	link_confidence: number
	match_type: 'exact' | 'fuzzy' | 'domain'
	stats: {
		total_calls: number
		calls_with_transcript: number
	}
}

export interface AccountGongLink {
	account_id: string
	account_name: string
	account_name_legal_c?: string | null
	company_domain_name_c?: string | null
	gong_call_ids: string[]
	gong_call_count: number
	link_confidence: number
	matched_by: 'exact' | 'fuzzy' | 'domain'
	last_updated: string
	matched_fields: string[]
}

/**
 * Find Gong calls for a given account using fuzzy name matching
 */
export async function findGongCallsForAccount(
	accountIndex: AccountIndex,
	accountName: string,
	options?: {
		fuzzyThreshold?: number
		limit?: number
	}
): Promise<AccountWithLinkedCalls[]> {
	const { fuzzyThreshold = 0.3, limit = 10 } = options || {}

	// Search for matching Salesforce accounts
	const matchedAccounts = searchAccounts(accountIndex, accountName, {
		limit,
		minScore: fuzzyThreshold,
	})

	if (matchedAccounts.length === 0) {
		return []
	}

	// For each matched account, query Gong
	const results: AccountWithLinkedCalls[] = []

	for (const account of matchedAccounts) {
		// Try multiple search terms
		const searchTerms = [
			account.name,
			account.account_name_legal_c,
			account.company_domain_name_c,
		].filter(Boolean) as string[]

		try {
			const gongCalls = await queryGongCallsFromParquet({
				accountNames: searchTerms,
				limit: 100,
			})

			if (gongCalls.length > 0) {
				const linkedCalls: LinkedCallResult[] = gongCalls.map((call) => ({
					call_id: String(call.call_id),
					title: call.title,
					created_at: call.created_at,
					browser_duration_sec: call.browser_duration_sec || undefined,
					transcript_text: call.transcript_text || null,
					match_confidence: 0.95, // High confidence from title match
					matched_field: 'name',
				}))

				const callsWithTranscript = linkedCalls.filter((c) => c.transcript_text?.trim().length).length

				results.push({
					account,
					gong_calls: linkedCalls,
					link_confidence: 0.95,
					match_type: 'exact',
					stats: {
						total_calls: linkedCalls.length,
						calls_with_transcript: callsWithTranscript,
					},
				})
			}
		} catch (error) {
			console.warn(`Failed to query Gong for account ${account.name}:`, error)
		}
	}

	return results
}

/**
 * Build and save account-Gong linkage file
 */
export function buildAccountGongLinkIndex(
	linkedResults: AccountWithLinkedCalls[]
): AccountGongLink[] {
	return linkedResults.map((result) => ({
		account_id: result.account.account_id,
		account_name: result.account.name,
		account_name_legal_c: result.account.account_name_legal_c,
		company_domain_name_c: result.account.company_domain_name_c,
		gong_call_ids: result.gong_calls.map((c) => c.call_id),
		gong_call_count: result.gong_calls.length,
		link_confidence: result.link_confidence,
		matched_by: result.match_type,
		last_updated: new Date().toISOString(),
		matched_fields: [
			result.account.name ? 'name' : '',
			result.account.account_name_legal_c ? 'legal_name' : '',
			result.account.company_domain_name_c ? 'domain' : '',
		].filter(Boolean),
	}))
}

/**
 * Save linkage index as JSONL
 */
export function saveLinkageIndex(links: AccountGongLink[], outputPath: string): void {
	const lines = links.map((link) => JSON.stringify(link))
	writeFileSync(outputPath, lines.join('\n'))
}

/**
 * Load linkage index from JSONL
 */
export function loadLinkageIndex(indexPath: string): AccountGongLink[] {
	if (!existsSync(indexPath)) {
		return []
	}

	const content = readFileSync(indexPath, 'utf-8')
	return content
		.split('\n')
		.filter((line) => line.trim())
		.map((line) => JSON.parse(line))
}

/**
 * Find cached Gong calls for account ID
 */
export function getLinkedGongCallsFromCache(
	linkIndex: AccountGongLink[],
	accountId: string
): AccountGongLink | null {
	return linkIndex.find((link) => link.account_id === accountId) || null
}

/**
 * Get linked calls for multiple accounts (batch operation)
 */
export async function batchLinkAccountsToGong(
	accountIndex: AccountIndex,
	accountNames: string[],
	options?: {
		outputPath?: string
		cacheExisting?: boolean
	}
): Promise<AccountGongLink[]> {
	const { outputPath, cacheExisting = true } = options || {}

	// Load existing cache if available
	let existingLinks: AccountGongLink[] = []
	if (cacheExisting && outputPath && existsSync(outputPath)) {
		existingLinks = loadLinkageIndex(outputPath)
	}

	const newLinks: AccountGongLink[] = []

	for (const accountName of accountNames) {
		const results = await findGongCallsForAccount(accountIndex, accountName)
		const links = buildAccountGongLinkIndex(results)
		newLinks.push(...links)
	}

	// Merge with existing (newer entries override)
	const mergedMap = new Map<string, AccountGongLink>()
	for (const link of existingLinks) {
		mergedMap.set(link.account_id, link)
	}
	for (const link of newLinks) {
		mergedMap.set(link.account_id, link)
	}

	const merged = Array.from(mergedMap.values())

	// Save if output path provided
	if (outputPath) {
		saveLinkageIndex(merged, outputPath)
	}

	return merged
}
