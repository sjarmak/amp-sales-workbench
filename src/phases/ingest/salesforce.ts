import type { AccountKey } from '../../types.js'
import { callSalesforceSOQL } from './mcp-wrapper.js'

export interface SalesforceIngestOptions {
	sinceAccount?: string // ISO timestamp for Account
	sinceContact?: string // ISO timestamp for Contacts
	sinceOpportunity?: string // ISO timestamp for Opportunities
	sinceActivity?: string // ISO timestamp for Activities
}

export async function ingestFromSalesforce(
	accountKey: AccountKey,
	options?: SalesforceIngestOptions
): Promise<{
	account?: any
	contacts?: any[]
	opportunities?: any[]
	activities?: any[]
	lastSyncedAt: string
	error?: string
}> {
	if (!accountKey.salesforceId) {
		console.warn('⚠️  Salesforce ID not provided, skipping Salesforce ingestion')
		return {
			lastSyncedAt: new Date().toISOString(),
			error: 'No Salesforce ID provided',
		}
	}

	try {
		const sfId = accountKey.salesforceId

		// Fetch account details (if stale or not incremental)
		const account = options?.sinceAccount
			? await fetchAccountIfModified(sfId, options.sinceAccount)
			: await fetchAccount(sfId)

		// Fetch related contacts (incremental if since provided)
		const contacts = await fetchContacts(sfId, options?.sinceContact)

		// Fetch opportunities with enriched fields (incremental if since provided)
		const opportunities = await fetchOpportunities(sfId, options?.sinceOpportunity)

		// Fetch recent activities (incremental if since provided)
		const activities = await fetchActivities(sfId, options?.sinceActivity)

		return {
			account,
			contacts,
			opportunities,
			activities,
			lastSyncedAt: new Date().toISOString(),
		}
	} catch (error) {
		console.error('❌ Salesforce ingestion failed:', error instanceof Error ? error.message : String(error))
		return {
			lastSyncedAt: new Date().toISOString(),
			error: error instanceof Error ? error.message : 'Unknown error',
		}
	}
}

export async function lookupAccountBySalesforce(
	name?: string,
	domain?: string
): Promise<string | undefined> {
	if (!name && !domain) {
		throw new Error('Must provide name or domain for lookup')
	}

	const conditions: string[] = []

	if (name) {
		conditions.push(`Name = '${escapeSoql(name)}'`)
	}

	if (domain) {
		// Match domain in Website field
		conditions.push(`Website LIKE '%${escapeSoql(domain)}%'`)
	}

	const query = `SELECT Id, Name, Website FROM Account WHERE ${conditions.join(' OR ')} LIMIT 1`

	try {
		const results = await executeSoqlQuery(query)

		if (results && results.length > 0) {
			return results[0].Id
		}
	} catch (error) {
		console.error('Salesforce lookup failed:', error)
	}

	return undefined
}

async function fetchAccount(accountId: string): Promise<any> {
	const query = `
		SELECT 
			Id, Name, Website, Industry, 
			NumberOfEmployees, AnnualRevenue,
			Description, BillingCity, BillingState, BillingCountry,
			LastModifiedDate
		FROM Account 
		WHERE Id = '${escapeSoql(accountId)}'
	`

	const results = await executeSoqlQuery(query)
	return results && results.length > 0 ? results[0] : undefined
}

async function fetchAccountIfModified(
	accountId: string,
	since: string
): Promise<any | null> {
	const query = `
		SELECT 
			Id, Name, Website, Industry, 
			NumberOfEmployees, AnnualRevenue,
			Description, BillingCity, BillingState, BillingCountry,
			LastModifiedDate
		FROM Account 
		WHERE Id = '${escapeSoql(accountId)}'
		AND LastModifiedDate > ${since}
	`

	const results = await executeSoqlQuery(query)
	return results && results.length > 0 ? results[0] : null
}

async function fetchContacts(accountId: string, since?: string): Promise<any[]> {
	let query = `
		SELECT 
			Id, Name, Email, Title, Phone, 
			Department, LastModifiedDate
		FROM Contact 
		WHERE AccountId = '${escapeSoql(accountId)}'
	`

	if (since) {
		// Add small overlap window (5 minutes) to avoid missing updates due to clock skew
		const sinceDate = new Date(since)
		sinceDate.setMinutes(sinceDate.getMinutes() - 5)
		query += ` AND LastModifiedDate > ${sinceDate.toISOString()}`
	}

	query += `
		ORDER BY LastModifiedDate DESC
		LIMIT 100
	`

	return (await executeSoqlQuery(query)) || []
}

async function fetchOpportunities(accountId: string, since?: string): Promise<any[]> {
	let query = `
		SELECT 
			Id, Name, StageName, Amount, CloseDate,
			Probability, Type, LeadSource,
			Description, NextStep,
			Feedback_Trends__c,
			Success_Criteria__c,
			Feature_Requests__c,
			Likelihood_To_Close__c,
			Path_To_Close__c,
			LastModifiedDate
		FROM Opportunity 
		WHERE AccountId = '${escapeSoql(accountId)}'
	`

	if (since) {
		const sinceDate = new Date(since)
		sinceDate.setMinutes(sinceDate.getMinutes() - 5)
		query += ` AND LastModifiedDate > ${sinceDate.toISOString()}`
	}

	query += `
		ORDER BY LastModifiedDate DESC
		LIMIT 50
	`

	return (await executeSoqlQuery(query)) || []
}

async function fetchActivities(accountId: string, since?: string): Promise<any[]> {
	// Fetch Tasks and Events related to the account
	let taskQuery = `
		SELECT 
			Id, Subject, Status, Priority, 
			ActivityDate, Description, 
			CreatedDate, LastModifiedDate
		FROM Task 
		WHERE AccountId = '${escapeSoql(accountId)}'
	`

	let eventQuery = `
		SELECT 
			Id, Subject, StartDateTime, EndDateTime,
			Description, Location,
			CreatedDate, LastModifiedDate
		FROM Event 
		WHERE AccountId = '${escapeSoql(accountId)}'
	`

	if (since) {
		const sinceDate = new Date(since)
		sinceDate.setMinutes(sinceDate.getMinutes() - 5)
		const sinceFilter = ` AND LastModifiedDate > ${sinceDate.toISOString()}`
		taskQuery += sinceFilter
		eventQuery += sinceFilter
	}

	taskQuery += `
		ORDER BY ActivityDate DESC
		LIMIT 100
	`

	eventQuery += `
		ORDER BY StartDateTime DESC
		LIMIT 100
	`

	const tasks = (await executeSoqlQuery(taskQuery)) || []
	const events = (await executeSoqlQuery(eventQuery)) || []

	return [...tasks, ...events]
}

function escapeSoql(value: string): string {
	return value.replace(/'/g, "\\'")
}

async function executeSoqlQuery(soql: string): Promise<any[]> {
	try {
		const result = await callSalesforceSOQL({ query: soql })
		return result.records || []
	} catch (error) {
		console.error('Salesforce SOQL query failed:', error)
		return []
	}
}
