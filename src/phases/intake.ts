import type { AccountKey } from '../types.js'
import { lookupAccountBySalesforce } from './ingest/salesforce.js'

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
	return lookupAccountBySalesforce(key.name, key.domain)
}
