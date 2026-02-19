import type { AccountKey } from '../types.js'
import { lookupAccountBySalesforce } from './ingest/salesforce.js'
import { createDataLayerService } from '../services/dataLayerService.js'

export async function resolveAccountKey(
	partial: AccountKey
): Promise<AccountKey> {
	// If we already have a Salesforce ID, validate and return
	if (partial.salesforceId) {
		return {
			name: partial.name,
			domain: partial.domain,
			salesforceId: partial.salesforceId,
		}
	}

	// Look up by name or domain
	const salesforceId = await lookupSalesforceAccount(partial)

	if (!salesforceId) {
		console.warn(
			`⚠️  Could not find Salesforce account for ${partial.name}${partial.domain ? ` (${partial.domain})` : ''} - continuing without Salesforce data`
		)
	}

	return {
		name: partial.name,
		domain: partial.domain,
		salesforceId,
	}
}

async function lookupSalesforceAccount(
	key: AccountKey
): Promise<string | undefined> {
	if (!key.name && !key.domain) {
		return undefined
	}

	// Phase 1: Fast local lookup via DataLayerService
	try {
		const dataLayer = await createDataLayerService(process.cwd())
		const searchTerm = key.name || key.domain || ''
		const results = dataLayer.searchAccounts(searchTerm, { limit: 5 })

		// Check for exact or near-exact match
		if (results.length > 0) {
			// Prefer exact name match
			const exactMatch = results.find((r) => r.account.name.toLowerCase() === searchTerm.toLowerCase())
			if (exactMatch) {
				console.log(`   ✓ Found account in local index: ${exactMatch.account.name}`)
				return exactMatch.account.account_id
			}

			// Prefer domain match if provided
			if (key.domain) {
				const domainMatch = results.find((r) => r.account.company_domain_name_c?.toLowerCase() === key.domain?.toLowerCase())
				if (domainMatch) {
					console.log(`   ✓ Found account by domain in local index: ${domainMatch.account.name}`)
					return domainMatch.account.account_id
				}
			}

			// Return best fuzzy match
			const topMatch = results[0]
			console.log(`   ✓ Found account via fuzzy match: ${topMatch.account.name}`)
			return topMatch.account.account_id
		}
	} catch (error) {
		// Data layer initialization may fail if index not built yet - fall back to Salesforce MCP
		if (error instanceof Error && error.message.includes('not found')) {
			console.log('   ℹ️  Local account index not available, querying Salesforce...')
		} else {
			console.warn(`   ⚠️  Data layer lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
		}
	}

	// Phase 2: Fall back to Salesforce MCP for real-time lookup
	try {
		console.log('   🔍 Querying Salesforce MCP...')
		const salesforceId = await lookupAccountBySalesforce(key.name, key.domain)
		if (salesforceId) {
			console.log(`   ✓ Found account in Salesforce: ${key.name}`)
		}
		return salesforceId
	} catch (error) {
		console.error(`   ❌ Salesforce lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
		return undefined
	}
}
