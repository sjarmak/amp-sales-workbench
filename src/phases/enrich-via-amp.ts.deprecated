/**
 * Enrichment via Amp SDK
 * 
 * This module uses Amp's execute() to run agents that have MCP tool access.
 * The agents call Gong, Notion, and Salesforce MCPs directly.
 */

import { execute, type AmpOptions } from '@sourcegraph/amp-sdk'
import type { AccountKey, IngestedData, Capabilities } from '../types.js'

const ampOptions: AmpOptions = {
	dangerouslyAllowAll: true, // Allow MCP tools
}

export async function enrichViaAmp(
	accountKey: AccountKey,
	capabilities: Capabilities
): Promise<IngestedData> {
	console.log('   Using Amp agents with MCP access...')
	
	// Run enrichment agents based on available capabilities
	const tasks = []
	
	if (capabilities.gong) {
		tasks.push(enrichFromGong(accountKey))
	} else {
		console.log('   ⏭️  Skipping Gong (no capability)')
		tasks.push(Promise.resolve({ calls: [], summaries: [], lastSyncedAt: new Date().toISOString(), warning: 'Gong not available' }))
	}
	
	if (capabilities.notion) {
		tasks.push(enrichFromNotion(accountKey))
	} else {
		console.log('   ⏭️  Skipping Notion (no capability)')
		tasks.push(Promise.resolve({ accountPage: null, relatedPages: [], lastSyncedAt: new Date().toISOString(), warning: 'Notion not available' }))
	}
	
	if (capabilities.salesforce) {
		tasks.push(enrichFromSalesforce(accountKey))
	} else {
		console.log('   ⏭️  Skipping Salesforce (no capability)')
		tasks.push(Promise.resolve({ account: null, contacts: [], opportunities: [], activities: [], lastSyncedAt: new Date().toISOString(), warning: 'Salesforce not available' }))
	}
	
	const [gongData, notionData, salesforceData] = await Promise.all(tasks)
	
	return {
		gong: gongData,
		notion: notionData,
		salesforce: salesforceData,
	}
}

async function enrichFromGong(accountKey: AccountKey): Promise<any> {
	console.log('   📞 Gong agent starting...')
	
	try {
		const stream = execute({
			prompt: `Use Gong MCP to pull call data for enrichment:

Account: ${accountKey.name}
Domain: ${accountKey.domain || 'N/A'}

Tasks:
1. List calls from the last 14 days using mcp__gong_extended__list_calls
2. For the most recent 10 calls, retrieve transcripts using mcp__gong_extended__retrieve_transcripts
3. Extract: call titles, participants, summaries, action items, next steps

Return a JSON object with this structure:
{
  "calls": [{ "id": "...", "title": "...", "startTime": "...", "duration": 0, "participants": [] }],
  "summaries": [{ "callId": "...", "transcript": "...", "summary": "...", "actionItems": [], "nextSteps": [] }],
  "lastSyncedAt": "ISO timestamp"
}`,
			options: ampOptions,
		})
		
		let result = ''
		for await (const message of stream) {
			if (message.type === 'result' && !message.is_error) {
				result = message.result
				break
			} else if (message.type === 'assistant') {
				for (const content of message.message.content) {
					if (content.type === 'text') {
						result += content.text
					}
				}
			}
		}
		
		// Parse JSON from response
		const jsonMatch = result.match(/\{[\s\S]*\}/)
		if (jsonMatch) {
			const parsed = JSON.parse(jsonMatch[0])
			console.log(`   ✓ Gong: ${parsed.calls?.length || 0} calls, ${parsed.summaries?.length || 0} transcripts`)
			return parsed
		}
		
		console.log('   ⚠️  Gong: No valid JSON returned')
		return { calls: [], summaries: [], lastSyncedAt: new Date().toISOString() }
		
	} catch (error) {
		console.error('   ❌ Gong enrichment failed:', error)
		return { calls: [], summaries: [], lastSyncedAt: new Date().toISOString() }
	}
}

async function enrichFromNotion(accountKey: AccountKey): Promise<any> {
	console.log('   📝 Notion agent starting...')
	
	try {
		const stream = execute({
			prompt: `Use Notion MCP to pull knowledge pages and account data:

Account: ${accountKey.name}

Tasks:
1. Search for pages related to "${accountKey.name}" using mcp__notion__API_post_search
2. For each page found, retrieve full content using mcp__notion__API_retrieve_a_page and mcp__notion__API_get_block_children
3. Extract relevant information about this account

Return a JSON object with this structure:
{
  "accountPage": { page object or null },
  "relatedPages": [{ "id": "...", "title": "...", "content": {...}, "lastEdited": "..." }],
  "lastSyncedAt": "ISO timestamp"
}`,
			options: ampOptions,
		})
		
		let result = ''
		for await (const message of stream) {
			if (message.type === 'result' && !message.is_error) {
				result = message.result
				break
			} else if (message.type === 'assistant') {
				for (const content of message.message.content) {
					if (content.type === 'text') {
						result += content.text
					}
				}
			}
		}
		
		// Parse JSON from response
		const jsonMatch = result.match(/\{[\s\S]*\}/)
		if (jsonMatch) {
			const parsed = JSON.parse(jsonMatch[0])
			console.log(`   ✓ Notion: ${parsed.relatedPages?.length || 0} pages`)
			return parsed
		}
		
		console.log('   ⚠️  Notion: No valid JSON returned')
		return { accountPage: null, relatedPages: [], lastSyncedAt: new Date().toISOString() }
		
	} catch (error) {
		console.error('   ❌ Notion enrichment failed:', error)
		return { accountPage: null, relatedPages: [], lastSyncedAt: new Date().toISOString() }
	}
}

async function enrichFromSalesforce(accountKey: AccountKey): Promise<any> {
	console.log('   💼 Salesforce agent starting...')
	
	if (!accountKey.salesforceId) {
		console.log('   ⚠️  No Salesforce ID - skipping')
		return { 
			error: 'No Salesforce ID',
			lastSyncedAt: new Date().toISOString()
		}
	}
	
	try {
		const stream = execute({
			prompt: `Use Salesforce MCP to pull CRM data:

Account Salesforce ID: ${accountKey.salesforceId}

Tasks:
1. Query for account details using mcp__salesforce__soql_query:
   SELECT Id, Name, Website, Industry, NumberOfEmployees, AnnualRevenue, Description, BillingCity, BillingState, BillingCountry, LastModifiedDate
   FROM Account WHERE Id = '${accountKey.salesforceId}'

2. Query for contacts using mcp__salesforce__soql_query:
   SELECT Id, Name, Email, Title, Phone, Department, LastModifiedDate
   FROM Contact WHERE AccountId = '${accountKey.salesforceId}' ORDER BY LastModifiedDate DESC LIMIT 100

3. Query for opportunities using mcp__salesforce__soql_query:
   SELECT Id, Name, StageName, Amount, CloseDate, Probability, Type, LeadSource, Description, NextStep, 
          Feedback_Trends__c, Success_Criteria__c, Feature_Requests__c, Likelihood_To_Close__c, Path_To_Close__c, LastModifiedDate
   FROM Opportunity WHERE AccountId = '${accountKey.salesforceId}' ORDER BY LastModifiedDate DESC LIMIT 50

4. Query for recent activities (Tasks and Events) using mcp__salesforce__soql_query:
   SELECT Id, Subject, ActivityDate, Status, Priority, Description, WhoId, WhatId, LastModifiedDate
   FROM Task WHERE AccountId = '${accountKey.salesforceId}' ORDER BY ActivityDate DESC LIMIT 100

5. Query for emails using mcp__salesforce__soql_query:
   SELECT Id, Subject, TextBody, HtmlBody, FromAddress, ToAddress, MessageDate, Status, LastModifiedDate
   FROM EmailMessage WHERE RelatedToId = '${accountKey.salesforceId}' ORDER BY MessageDate DESC LIMIT 100

Return a JSON object with this structure:
{
  "account": { account record },
  "contacts": [ contact records ],
  "opportunities": [ opportunity records ],
  "activities": [ task/event records ],
  "emails": [ email message records ],
  "lastSyncedAt": "ISO timestamp"
}`,
			options: ampOptions,
		})
		
		let result = ''
		for await (const message of stream) {
			if (message.type === 'result' && !message.is_error) {
				result = message.result
				break
			} else if (message.type === 'assistant') {
				for (const content of message.message.content) {
					if (content.type === 'text') {
						result += content.text
					}
				}
			}
		}
		
		// Parse JSON from response
		const jsonMatch = result.match(/\{[\s\S]*\}/)
		if (jsonMatch) {
			const parsed = JSON.parse(jsonMatch[0])
			console.log(`   ✓ Salesforce: ${parsed.contacts?.length || 0} contacts, ${parsed.opportunities?.length || 0} opps`)
			return parsed
		}
		
		console.log('   ⚠️  Salesforce: No valid JSON returned')
		return {
			account: null,
			contacts: [],
			opportunities: [],
			activities: [],
			lastSyncedAt: new Date().toISOString()
		}
		
	} catch (error) {
		console.error('   ❌ Salesforce enrichment failed (AWS issues expected):', error)
		return {
			error: error instanceof Error ? error.message : 'Unknown error',
			lastSyncedAt: new Date().toISOString()
		}
	}
}
