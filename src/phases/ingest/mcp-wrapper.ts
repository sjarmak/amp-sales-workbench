/**
 * MCP Tool Wrapper
 * 
 * OPTIMIZED: Uses direct MCP client calls instead of expensive Amp execute() calls.
 * This eliminates LLM overhead for simple data fetching (~$0.00 vs ~$0.26+ per call).
 * 
 * Falls back to globalThis functions when in Amp agent context for backward compatibility.
 */

import { callSalesforceTool, callNotionTool } from '../../mcp-client.js'

export async function callGongListCalls(params: {
	fromDateTime: string
	toDateTime: string
}): Promise<any> {
	// Use mcp__gong_extended__list_calls directly (underscore, not dash)
	// This is the exact tool that works when tested
	if (typeof (globalThis as any).mcp__gong_extended__list_calls === 'function') {
		return await (globalThis as any).mcp__gong_extended__list_calls(params)
	}
	
	// If not in Amp context, direct MCP client won't work - return empty
	console.warn('⚠️  Gong MCP not available (not in Amp context)')
	return { calls: [] }
}

export async function callGongSearchCalls(params: {
	query?: string
	fromDateTime?: string
	toDateTime?: string
	participantEmails?: string[]
}): Promise<any> {
	// WORKAROUND: Use globalThis (Amp SDK) for Gong calls
	if (typeof (globalThis as any).mcp__gong_extended__search_calls === 'function') {
		return await (globalThis as any).mcp__gong_extended__search_calls(params)
	}
	
	console.warn('⚠️  Gong search MCP not available (not in Amp context)')
	return { items: [] }
}

export async function callGongRetrieveTranscripts(params: {
	callIds: string[]
}): Promise<any> {
	// WORKAROUND: Use globalThis (Amp SDK) for Gong calls
	if (typeof (globalThis as any).mcp__gong_extended__retrieve_transcripts === 'function') {
		return await (globalThis as any).mcp__gong_extended__retrieve_transcripts(params)
	}
	
	console.warn('⚠️  Gong MCP not available (not in Amp context)')
	return { callTranscripts: [] }
}

export async function callGongGetCall(params: { callId: string }): Promise<any> {
	// WORKAROUND: Use globalThis (Amp SDK) for Gong calls
	if (typeof (globalThis as any).mcp__gong_extended__get_call === 'function') {
		return await (globalThis as any).mcp__gong_extended__get_call(params)
	}
	
	console.warn('⚠️  Gong MCP not available (not in Amp context)')
	return { metaData: {} }
}

export async function callNotionSearch(params: {
	query: string
	page_size?: number
}): Promise<any> {
	try {
		const result = await callNotionTool('mcp__notion__API-post-search', params)
		if (result && result[0]?.type === 'text') {
			return JSON.parse(result[0].text)
		}
		return result
	} catch (error) {
		if (typeof (globalThis as any).mcp__notion__API_post_search === 'function') {
			return await (globalThis as any).mcp__notion__API_post_search(params)
		}
		
		console.warn('⚠️  Notion MCP not available:', error)
		return { results: [] }
	}
}

export async function callNotionGetPage(params: { page_id: string }): Promise<any> {
	try {
		const result = await callNotionTool('mcp__notion__API-retrieve-a-page', params)
		if (result && result[0]?.type === 'text') {
			return JSON.parse(result[0].text)
		}
		return result
	} catch (error) {
		if (typeof (globalThis as any).mcp__notion__API_retrieve_a_page === 'function') {
			return await (globalThis as any).mcp__notion__API_retrieve_a_page(params)
		}
		
		console.warn('⚠️  Notion MCP not available:', error)
		return { id: params.page_id, last_edited_time: new Date().toISOString() }
	}
}

export async function callNotionGetBlockChildren(params: {
	block_id: string
	page_size?: number
}): Promise<any> {
	try {
		const result = await callNotionTool('mcp__notion__API-get-block-children', params)
		if (result && result[0]?.type === 'text') {
			return JSON.parse(result[0].text)
		}
		return result
	} catch (error) {
		if (typeof (globalThis as any).mcp__notion__API_get_block_children === 'function') {
			return await (globalThis as any).mcp__notion__API_get_block_children(params)
		}
		
		console.warn('⚠️  Notion MCP not available:', error)
		return { results: [] }
	}
}

export async function callNotionQueryDatabase(params: {
	database_id: string
	[key: string]: any
}): Promise<any> {
	try {
		const result = await callNotionTool('mcp__notion__API-post-database-query', params)
		if (result && result[0]?.type === 'text') {
			return JSON.parse(result[0].text)
		}
		return result
	} catch (error) {
		if (typeof (globalThis as any).mcp__notion__API_post_database_query === 'function') {
			return await (globalThis as any).mcp__notion__API_post_database_query(params)
		}
		
		console.warn('⚠️  Notion MCP not available:', error)
		return { results: [] }
	}
}

export async function callSalesforceSOQL(params: { query: string }): Promise<any> {
	try {
		const result = await callSalesforceTool('mcp__salesforce__soql_query', params)
		if (result && result[0]?.type === 'text') {
			return JSON.parse(result[0].text)
		}
		return result
	} catch (error) {
		if (typeof (globalThis as any).mcp__salesforce__soql_query === 'function') {
			return await (globalThis as any).mcp__salesforce__soql_query(params)
		}
		
		console.warn('⚠️  Salesforce MCP not available:', error)
		return { records: [] }
	}
}

export async function callSalesforceGetRecord(params: {
	objectType: string
	id: string
}): Promise<any> {
	try {
		const result = await callSalesforceTool('mcp__salesforce__get_record', params)
		if (result && result[0]?.type === 'text') {
			return JSON.parse(result[0].text)
		}
		return result
	} catch (error) {
		if (typeof (globalThis as any).mcp__salesforce__get_record === 'function') {
			return await (globalThis as any).mcp__salesforce__get_record(params)
		}
		
		console.warn('⚠️  Salesforce MCP not available:', error)
		return { Id: params.id, LastModifiedDate: new Date().toISOString() }
	}
}

export async function callSalesforceUpdateRecord(params: {
	objectType: string
	id: string
	data: Record<string, any>
}): Promise<void> {
	try {
		await callSalesforceTool('mcp__salesforce__update_record', params)
	} catch (error) {
		if (typeof (globalThis as any).mcp__salesforce__update_record === 'function') {
			await (globalThis as any).mcp__salesforce__update_record(params)
			return
		}
		
		console.warn('⚠️  Salesforce MCP not available:', error)
	}
}
