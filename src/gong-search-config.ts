/**
 * Gong Search Term Configuration
 * 
 * Loads custom search terms for accounts where the formal company name
 * differs from how Gong calls are titled (e.g., "International Business Machines" → "IBM")
 */

import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import type { AccountKey } from './types.js'

interface GongSearchOverride {
	searchTerms: string[]
	reason?: string
}

interface GongSearchConfig {
	overrides: Record<string, GongSearchOverride>
}

const CONFIG_PATH = './config/gong-search-overrides.json'

let cachedConfig: GongSearchConfig | null = null

/**
 * Load Gong search overrides from config file
 */
async function loadGongSearchConfig(): Promise<GongSearchConfig> {
	if (cachedConfig) {
		return cachedConfig
	}

	if (!existsSync(CONFIG_PATH)) {
		console.log('No Gong search overrides config found, using defaults')
		return { overrides: {} }
	}

	try {
		const data = await readFile(CONFIG_PATH, 'utf-8')
		const config = JSON.parse(data)
		cachedConfig = config
		return config
	} catch (error) {
		console.warn('Failed to load Gong search config:', error)
		return { overrides: {} }
	}
}

/**
 * Get search terms for an account, using overrides if configured
 * Returns the custom search terms or falls back to account name
 */
export async function getGongSearchTerms(accountKey: AccountKey): Promise<string[]> {
	// If account already has custom search terms set, use those
	if (accountKey.gongSearchTerms && accountKey.gongSearchTerms.length > 0) {
		return accountKey.gongSearchTerms
	}

	// Check config file for overrides
	const config = await loadGongSearchConfig()
	// Normalize account name to slug format (remove special chars, lowercase, hyphens)
	const accountSlug = accountKey.name
		.toLowerCase()
		.replace(/[()]/g, '') // Remove parentheses
		.replace(/\s+/g, '-') // Replace spaces with hyphens
		.replace(/-+/g, '-')  // Collapse multiple hyphens
		.replace(/^-|-$/g, '') // Trim leading/trailing hyphens
	
	const override = config.overrides[accountSlug]
	if (override && override.searchTerms.length > 0) {
		console.log(`Using custom Gong search terms for ${accountKey.name}: ${override.searchTerms.join(', ')}`)
		if (override.reason) {
			console.log(`  Reason: ${override.reason}`)
		}
		return override.searchTerms
	}

	// Fallback to account name
	return [accountKey.name]
}

/**
 * Apply Gong search overrides to an account key (mutates the object)
 */
export async function applyGongSearchOverrides(accountKey: AccountKey): Promise<void> {
	if (!accountKey.gongSearchTerms) {
		const searchTerms = await getGongSearchTerms(accountKey)
		// Only set if we found custom terms (not just the fallback name)
		if (searchTerms.length > 1 || searchTerms[0] !== accountKey.name) {
			accountKey.gongSearchTerms = searchTerms
		}
	}
}
