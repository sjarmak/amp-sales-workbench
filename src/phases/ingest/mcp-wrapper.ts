/**
 * MCP Tool Wrapper
 * 
 * These functions provide a bridge between our ingestion code and MCP tools.
 * They work when called from within an Amp agent context where MCP tools are available.
 * 
 * When MCP tools are not available (e.g., running outside Amp), they return empty results.
 */

export async function callGongListCalls(params: {
	fromDateTime: string
	toDateTime: string
}): Promise<any> {
	// Check if we're in Amp environment with MCP access
	if (typeof (globalThis as any).mcp__gong_extended__list_calls === 'function') {
		return await (globalThis as any).mcp__gong_extended__list_calls(params)
	}
	
	console.warn('⚠️  Gong MCP not available - returning empty result')
	return { calls: [] }
}

export async function callGongRetrieveTranscripts(params: {
	callIds: string[]
}): Promise<any> {
	if (typeof (globalThis as any).mcp__gong_extended__retrieve_transcripts === 'function') {
		return await (globalThis as any).mcp__gong_extended__retrieve_transcripts(params)
	}
	
	console.warn('⚠️  Gong MCP not available - returning empty result')
	return { callTranscripts: [] }
}

export async function callGongGetCall(params: { callId: string }): Promise<any> {
	if (typeof (globalThis as any).mcp__gong_extended__get_call === 'function') {
		return await (globalThis as any).mcp__gong_extended__get_call(params)
	}
	
	console.warn('⚠️  Gong MCP not available - returning empty result')
	return { metaData: {} }
}

export async function callNotionSearch(params: {
	query: string
	page_size?: number
}): Promise<any> {
	if (typeof (globalThis as any).mcp__notion__API_post_search === 'function') {
		return await (globalThis as any).mcp__notion__API_post_search(params)
	}
	
	console.warn('⚠️  Notion MCP not available - returning empty result')
	return { results: [] }
}

export async function callNotionGetPage(params: { page_id: string }): Promise<any> {
	if (typeof (globalThis as any).mcp__notion__API_retrieve_a_page === 'function') {
		return await (globalThis as any).mcp__notion__API_retrieve_a_page(params)
	}
	
	console.warn('⚠️  Notion MCP not available - returning empty result')
	return { id: params.page_id, last_edited_time: new Date().toISOString() }
}

export async function callNotionGetBlockChildren(params: {
	block_id: string
	page_size?: number
}): Promise<any> {
	if (typeof (globalThis as any).mcp__notion__API_get_block_children === 'function') {
		return await (globalThis as any).mcp__notion__API_get_block_children(params)
	}
	
	console.warn('⚠️  Notion MCP not available - returning empty result')
	return { results: [] }
}

export async function callNotionQueryDatabase(params: {
	database_id: string
	[key: string]: any
}): Promise<any> {
	if (typeof (globalThis as any).mcp__notion__API_post_database_query === 'function') {
		return await (globalThis as any).mcp__notion__API_post_database_query(params)
	}
	
	console.warn('⚠️  Notion MCP not available - returning empty result')
	return { results: [] }
}

export async function callSalesforceSOQL(params: { query: string }): Promise<any> {
	if (typeof (globalThis as any).mcp__salesforce__soql_query === 'function') {
		return await (globalThis as any).mcp__salesforce__soql_query(params)
	}
	
	console.warn('⚠️  Salesforce MCP not available - returning empty result')
	return { records: [] }
}

export async function callSalesforceGetRecord(params: {
	objectType: string
	id: string
}): Promise<any> {
	if (typeof (globalThis as any).mcp__salesforce__get_record === 'function') {
		return await (globalThis as any).mcp__salesforce__get_record(params)
	}
	
	console.warn('⚠️  Salesforce MCP not available - returning stub result')
	return { Id: params.id, LastModifiedDate: new Date().toISOString() }
}

export async function callSalesforceUpdateRecord(params: {
	objectType: string
	id: string
	data: Record<string, any>
}): Promise<void> {
	if (typeof (globalThis as any).mcp__salesforce__update_record === 'function') {
		await (globalThis as any).mcp__salesforce__update_record(params)
		return
	}
	
	console.warn('⚠️  Salesforce MCP not available - skipping update')
}
