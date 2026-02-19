import type { AccountKey } from '../../types.js'
import { callSalesforceSOQL } from './mcp-wrapper.js'

export interface SalesforceIngestOptions {
	sinceAccount?: string // ISO timestamp for Account
	sinceContact?: string // ISO timestamp for Contacts
	sinceOpportunity?: string // ISO timestamp for Opportunities
	sinceActivity?: string // ISO timestamp for Activities
	sinceEmail?: string // ISO timestamp for EmailMessage (RFC Phase 2)
}

export async function ingestFromSalesforce(
	accountKey: AccountKey,
	options?: SalesforceIngestOptions
): Promise<{
	account?: any
	contacts?: any[]
	opportunities?: any[]
	activities?: any[]
	emails?: any[] // RFC Phase 2: EmailMessage records
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

		// RFC Phase 2: Fetch email messages linked to contacts
		const contactIds = (contacts || []).map((c: any) => c.Id).filter(Boolean)
		const emails = await fetchEmailMessages(sfId, contactIds, options?.sinceEmail)

		return {
			account,
			contacts,
			opportunities,
			activities,
			emails,
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
	// Import Gong-SFDC config dynamically to avoid circular deps
	const { loadGongSfdcConfig } = await import('../../config/salesforceGongConfig.js')
	const gongConfig = await loadGongSfdcConfig()
	
	// Fetch Tasks with Gong custom fields for linkage detection
	// Fields: Gong_Call_Id__c, Gong_Recording_URL__c (or configured equivalents)
	const gongCallIdField = gongConfig.customFields.task.gongCallId
	const gongUrlField = gongConfig.customFields.task.gongRecordingUrl
	
	let taskQuery = `
		SELECT 
			Id, Subject, Status, Priority, 
			ActivityDate, Description, 
			WhoId, WhatId,
			CreatedDate, LastModifiedDate,
			${gongCallIdField},
			${gongUrlField}
		FROM Task 
		WHERE AccountId = '${escapeSoql(accountId)}'
	`

	let eventQuery = `
		SELECT 
			Id, Subject, StartDateTime, EndDateTime,
			Description, Location,
			WhoId, WhatId,
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

	let tasks: any[] = []
	try {
		tasks = (await executeSoqlQuery(taskQuery)) || []
	} catch (error) {
		// If Gong custom fields don't exist, fall back to basic query
		console.warn(`Gong custom fields may not exist, retrying without: ${error}`)
		const fallbackTaskQuery = `
			SELECT 
				Id, Subject, Status, Priority, 
				ActivityDate, Description, 
				WhoId, WhatId,
				CreatedDate, LastModifiedDate
			FROM Task 
			WHERE AccountId = '${escapeSoql(accountId)}'
			${since ? `AND LastModifiedDate > ${new Date(since).toISOString()}` : ''}
			ORDER BY ActivityDate DESC
			LIMIT 100
		`
		tasks = (await executeSoqlQuery(fallbackTaskQuery)) || []
	}
	
	const events = (await executeSoqlQuery(eventQuery)) || []

	// Mark tasks that appear to be Gong-linked based on config patterns
	const { isGongLinkedTask, extractGongCallId } = await import('../../config/salesforceGongConfig.js')
	
	for (const task of tasks) {
		task._isGongLinked = await isGongLinkedTask(task, gongConfig)
		if (task._isGongLinked) {
			task._extractedGongCallId = await extractGongCallId(task, gongConfig)
		}
	}

	return [...tasks, ...events]
}

/**
 * RFC Phase 2: Fetch EmailMessage records linked to account contacts
 * EmailMessage object requires Email-to-Salesforce or Lightning Email to be enabled
 */
async function fetchEmailMessages(
	accountId: string,
	contactIds: string[],
	since?: string
): Promise<any[]> {
	if (contactIds.length === 0) {
		return []
	}

	// EmailMessage is linked via EmailMessageRelation
	// We query EmailMessage where any relation points to our contacts
	const contactIdList = contactIds.map(id => `'${escapeSoql(id)}'`).join(',')
	
	let query = `
		SELECT 
			Id, Subject, TextBody, HtmlBody,
			FromAddress, ToAddress, CcAddress, BccAddress,
			MessageDate, Status, Incoming,
			RelatedToId, CreatedDate, LastModifiedDate
		FROM EmailMessage 
		WHERE RelatedToId = '${escapeSoql(accountId)}'
		OR Id IN (
			SELECT EmailMessageId 
			FROM EmailMessageRelation 
			WHERE RelationId IN (${contactIdList})
		)
	`

	if (since) {
		const sinceDate = new Date(since)
		sinceDate.setMinutes(sinceDate.getMinutes() - 5)
		query += ` AND MessageDate > ${sinceDate.toISOString()}`
	}

	query += `
		ORDER BY MessageDate DESC
		LIMIT 100
	`

	try {
		const emails = await executeSoqlQuery(query)
		return emails
	} catch (error) {
		// EmailMessage may not be available in all orgs
		console.warn('EmailMessage query failed (may not be enabled):', error)
		return []
	}
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
