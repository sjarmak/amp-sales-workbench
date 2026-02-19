/**
 * Unified Data Layer Service
 * 
 * Provides a single interface for querying Salesforce account data,
 * Gong calls, and linked interactions.
 */

import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import type { SalesforceAccountRecord, AccountIndex } from './csvProcessor.js'
import { loadSalesforceAccountsCSV, buildAccountIndex, searchAccounts, saveAccountIndex, loadAccountIndex } from './csvProcessor.js'
import type { AccountGongLink, AccountWithLinkedCalls } from './accountLinkageService.js'
import { findGongCallsForAccount, loadLinkageIndex, buildAccountGongLinkIndex, saveLinkageIndex } from './accountLinkageService.js'
import type { PortfolioKnowledgeBase } from './portfolioKbService.js'
import { loadPortfolioKb } from './portfolioKbService.js'

export interface AccountSearchResult {
	account: SalesforceAccountRecord
	searchScore?: number
	match_type: 'exact' | 'fuzzy'
}

export interface EnrichedAccount extends SalesforceAccountRecord {
	gong_calls?: AccountGongLink
	match_score?: number
}

export interface DataLayerConfig {
	tablesDir: string
	csvPath: string
	indexPath: string
	linkagePath: string
}

/**
 * Data Layer Service - main API
 */
export class DataLayerService {
	private accountIndex: AccountIndex | null = null
	private linkageIndex: AccountGongLink[] = []
	private portfolioKb: PortfolioKnowledgeBase | null = null
	private config: DataLayerConfig

	constructor(config: DataLayerConfig) {
		this.config = config
	}

	/**
	 * Initialize service - load all indexes
	 */
	async initialize(): Promise<void> {
		// Ensure directories exist
		mkdirSync(this.config.tablesDir, { recursive: true })

		// Load or create account index
		if (existsSync(this.config.indexPath)) {
			this.accountIndex = loadAccountIndex(this.config.indexPath)
		} else if (existsSync(this.config.csvPath)) {
			const records = loadSalesforceAccountsCSV(this.config.csvPath)
			this.accountIndex = buildAccountIndex(records)
			saveAccountIndex(this.accountIndex, this.config.indexPath)
		} else {
			throw new Error(`Salesforce account CSV not found at ${this.config.csvPath}`)
		}

		// Load linkage index
		if (existsSync(this.config.linkagePath)) {
			this.linkageIndex = loadLinkageIndex(this.config.linkagePath)
		}

		// Load portfolio knowledge base
		const kbPath = join(this.config.tablesDir, 'portfolio_knowledge.json')
		this.portfolioKb = loadPortfolioKb(kbPath)
	}

	/**
	 * Verify initialization
	 */
	private ensureInitialized(): void {
		if (!this.accountIndex) {
			throw new Error('DataLayerService not initialized - call initialize() first')
		}
	}

	/**
	 * Search for accounts by name/domain with fuzzy matching
	 */
	searchAccounts(
		term: string,
		options?: { limit?: number; minScore?: number }
	): AccountSearchResult[] {
		this.ensureInitialized()
		const accounts = searchAccounts(this.accountIndex!, term, options)
		return accounts.map((account) => ({
			account,
			match_type: 'fuzzy',
		}))
	}

	/**
	 * Get account by Salesforce ID
	 */
	getAccountById(accountId: string): SalesforceAccountRecord | null {
		this.ensureInitialized()
		return this.accountIndex!.accountsById.get(accountId) || null
	}

	/**
	 * Find linked Gong calls for an account
	 */
	getLinkedGongCalls(accountId: string): AccountGongLink | null {
		this.ensureInitialized()
		return this.linkageIndex.find((link) => link.account_id === accountId) || null
	}

	/**
	 * Link an account to Gong calls (with caching)
	 */
	async linkAccountToGong(accountName: string): Promise<AccountWithLinkedCalls[]> {
		this.ensureInitialized()
		return findGongCallsForAccount(this.accountIndex!, accountName)
	}

	/**
	 * Get enriched account with Gong links
	 */
	async getEnrichedAccount(accountId: string): Promise<EnrichedAccount | null> {
		this.ensureInitialized()
		const account = this.getAccountById(accountId)
		if (!account) return null

		const gongCalls = this.getLinkedGongCalls(accountId)
		return {
			...account,
			gong_calls: gongCalls || undefined,
		}
	}

	/**
	 * Refresh linkage for an account
	 */
	async refreshAccountLinkage(accountName: string): Promise<AccountGongLink | null> {
		const results = await this.linkAccountToGong(accountName)
		if (results.length === 0) return null

		const links = buildAccountGongLinkIndex(results)
		if (links.length === 0) return null

		// Update cache
		const link = links[0]
		const existingIndex = this.linkageIndex.findIndex((l) => l.account_id === link.account_id)
		if (existingIndex >= 0) {
			this.linkageIndex[existingIndex] = link
		} else {
			this.linkageIndex.push(link)
		}

		// Save updated index
		saveLinkageIndex(this.linkageIndex, this.config.linkagePath)

		return link
	}

	/**
	 * Enrich account with linked Gong calls
	 */
	enrichAccountWithGongCalls(accountId: string): EnrichedAccount | null {
		this.ensureInitialized()
		const account = this.getAccountById(accountId)
		if (!account) return null

		const gongLinks = this.getLinkedGongCalls(accountId)
		return {
			...account,
			gong_calls: gongLinks || undefined,
		}
	}

	/**
	 * Get portfolio knowledge base
	 */
	getPortfolioKb(): PortfolioKnowledgeBase | null {
		this.ensureInitialized()
		return this.portfolioKb
	}

	/**
	 * Get statistics about data layer
	 */
	getStats(): {
		totalAccounts: number
		accountsWithGongLinks: number
		totalLinkedCalls: number
		portfolioKbAvailable: boolean
		lastIndexUpdate: string | null
	} {
		this.ensureInitialized()
		const totalAccounts = this.accountIndex!.accountsById.size
		const accountsWithGongLinks = this.linkageIndex.length
		const totalLinkedCalls = this.linkageIndex.reduce((sum, link) => sum + link.gong_call_count, 0)

		return {
			totalAccounts,
			accountsWithGongLinks,
			totalLinkedCalls,
			portfolioKbAvailable: this.portfolioKb !== null,
			lastIndexUpdate: null, // TODO: Read from meta file
		}
	}
}

/**
 * Create default config for project
 */
export function getDefaultDataLayerConfig(baseDir: string): DataLayerConfig {
	return {
		tablesDir: join(baseDir, 'data', 'tables'),
		csvPath: join(baseDir, 'data', 'tables', 'salesforce_accounts.csv'),
		indexPath: join(baseDir, 'data', 'tables', 'salesforce_accounts_index.json'),
		linkagePath: join(baseDir, 'data', 'tables', 'account_gong_links.jsonl'),
	}
}

/**
 * Create and initialize service with default config
 */
export async function createDataLayerService(baseDir: string): Promise<DataLayerService> {
	const config = getDefaultDataLayerConfig(baseDir)
	const service = new DataLayerService(config)
	await service.initialize()
	return service
}
