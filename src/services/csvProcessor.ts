/**
 * CSV Processing Service
 * 
 * Handles loading, parsing, and converting Salesforce account data
 * from CSV to Parquet and indexed JSON formats.
 */

import { readFileSync, writeFileSync } from 'fs'
import { parse } from 'csv-parse/sync'
import Fuse from 'fuse.js'

export interface SalesforceAccountRecord {
	account_id: string                    // Salesforce ID (18-char)
	name: string                          // Account Name
	account_name_legal_c?: string | null  // Legal name (custom field)
	company_domain_name_c?: string | null // Domain
	industry?: string | null
	number_of_employees?: number | null
	annual_revenue?: string | null
	website?: string | null
	billing_city?: string | null
	billing_state?: string | null
	billing_country?: string | null
	type?: string | null
	created_date?: string | null
	last_modified_date?: string | null
	// Keep minimal set for indexing
	[key: string]: any
}

export interface AccountIndex {
	accountsById: Map<string, SalesforceAccountRecord>
	accountsByLegalName: Map<string, SalesforceAccountRecord[]>
	accountsByDomain: Map<string, SalesforceAccountRecord[]>
	searchIndex: Fuse<SalesforceAccountRecord>
}

/**
 * Load Salesforce accounts from CSV file
 */
export function loadSalesforceAccountsCSV(
	csvPath: string
): SalesforceAccountRecord[] {
	const csvContent = readFileSync(csvPath, 'utf-8')
	const records = parse(csvContent, {
		columns: true,
		skip_empty_lines: true,
		trim: true,
	}) as Record<string, any>[]

	// Normalize and extract key fields
	return records.map((row) => ({
		account_id: row.id || '',
		name: row.name || '',
		account_name_legal_c: row.account_name_legal_c || null,
		company_domain_name_c: row.company_domain_name_c || null,
		industry: row.industry || null,
		number_of_employees: row.number_of_employees ? parseInt(row.number_of_employees) : null,
		annual_revenue: row.annual_revenue || null,
		website: row.website || null,
		billing_city: row.billing_city || null,
		billing_state: row.billing_state || null,
		billing_country: row.billing_country || null,
		type: row.type || null,
		created_date: row.created_date || null,
		last_modified_date: row.last_modified_date || null,
	}))
}

/**
 * Build in-memory indexes for fast account lookups
 */
export function buildAccountIndex(records: SalesforceAccountRecord[]): AccountIndex {
	const accountsById = new Map<string, SalesforceAccountRecord>()
	const accountsByLegalName = new Map<string, SalesforceAccountRecord[]>()
	const accountsByDomain = new Map<string, SalesforceAccountRecord[]>()

	for (const record of records) {
		if (record.account_id) {
			accountsById.set(record.account_id, record)
		}

		// Index by legal name
		if (record.account_name_legal_c) {
			const legalName = record.account_name_legal_c.toUpperCase()
			const existing = accountsByLegalName.get(legalName) || []
			accountsByLegalName.set(legalName, [...existing, record])
		}

		// Index by domain
		if (record.company_domain_name_c) {
			const domain = record.company_domain_name_c.toLowerCase()
			const existing = accountsByDomain.get(domain) || []
			accountsByDomain.set(domain, [...existing, record])
		}
	}

	// Build Fuse search index
	const searchIndex = new Fuse(records, {
		keys: ['name', 'account_name_legal_c', 'company_domain_name_c'],
		threshold: 0.4, // Fuzzy matching threshold
		ignoreLocation: true,
	})

	return {
		accountsById,
		accountsByLegalName,
		accountsByDomain,
		searchIndex,
	}
}

/**
 * Search accounts with fuzzy matching
 */
export function searchAccounts(
	index: AccountIndex,
	term: string,
	options?: { limit?: number; minScore?: number }
): SalesforceAccountRecord[] {
	const { limit = 10 } = options || {}

	// Direct lookups first
	const results: Map<string, SalesforceAccountRecord> = new Map()

	// By legal name
	const legalNameKey = term.toUpperCase()
	if (index.accountsByLegalName.has(legalNameKey)) {
		for (const record of index.accountsByLegalName.get(legalNameKey) || []) {
			results.set(record.account_id, record)
		}
	}

	// By domain
	const domainKey = term.toLowerCase()
	if (index.accountsByDomain.has(domainKey)) {
		for (const record of index.accountsByDomain.get(domainKey) || []) {
			results.set(record.account_id, record)
		}
	}

	// Fuzzy search if we need more results
	if (results.size < limit) {
		const fuzzyResults = index.searchIndex.search(term)
		for (const { item } of fuzzyResults.slice(0, limit - results.size)) {
			results.set(item.account_id, item)
		}
	}

	return Array.from(results.values()).slice(0, limit)
}

/**
 * Save index as JSON for fast loading
 */
export function saveAccountIndex(
	index: AccountIndex,
	outputPath: string
): void {
	const indexData = {
		version: 1,
		timestamp: new Date().toISOString(),
		accountsById: Object.fromEntries(index.accountsById),
		accountsByLegalName: Object.fromEntries(index.accountsByLegalName),
		accountsByDomain: Object.fromEntries(index.accountsByDomain),
	}

	writeFileSync(outputPath, JSON.stringify(indexData, null, 2))
}

/**
 * Load previously saved index
 */
export function loadAccountIndex(indexPath: string): AccountIndex {
	const indexData = JSON.parse(readFileSync(indexPath, 'utf-8'))

	const accountsById = new Map(Object.entries(indexData.accountsById)) as Map<string, SalesforceAccountRecord>
	const accountsByLegalName = new Map(Object.entries(indexData.accountsByLegalName)) as Map<string, SalesforceAccountRecord[]>
	const accountsByDomain = new Map(Object.entries(indexData.accountsByDomain)) as Map<string, SalesforceAccountRecord[]>

	// Rebuild Fuse index from accounts
	const allRecords = Array.from(accountsById.values()) as SalesforceAccountRecord[]
	const searchIndex = new Fuse(allRecords, {
		keys: ['name', 'account_name_legal_c', 'company_domain_name_c'],
		threshold: 0.4,
		ignoreLocation: true,
	})

	return {
		accountsById,
		accountsByLegalName,
		accountsByDomain,
		searchIndex,
	}
}

/**
 * Process CSV → Parquet (future: currently just index)
 */
export async function processCSVToParquet(
	csvPath: string,
	outputPath: string
): Promise<{ recordCount: number; indexPath: string }> {
	const records = loadSalesforceAccountsCSV(csvPath)
	const index = buildAccountIndex(records)

	// For now, save as JSON index (Parquet conversion can be added later)
	const indexPath = outputPath.replace('.parquet', '_index.json')
	saveAccountIndex(index, indexPath)

	return {
		recordCount: records.length,
		indexPath,
	}
}
