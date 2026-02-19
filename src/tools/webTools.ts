/**
 * Web Tools for Agents
 * 
 * Provides web_search and read_web_page tools that agents can use.
 * These wrap the Amp platform's tools to provide consistent interfaces.
 */

/**
 * Search the web for information.
 * Uses Amp SDK's web_search tool if available, otherwise returns graceful error.
 * 
 * @param query - The search query
 * @param maxResults - Maximum number of results to return (default: 5)
 * @returns JSON string with search results
 */
export async function web_search(query: string, maxResults: number = 5): Promise<string> {
	try {
		// Check if Amp's web_search tool is available in the global context
		const ampWebSearch = (globalThis as any).web_search
		
		if (typeof ampWebSearch === 'function') {
			// Call Amp's web search tool
			const result = await ampWebSearch({
				objective: query,
				search_queries: [query],
				max_results: maxResults,
			})
			
			return JSON.stringify({
				success: true,
				query,
				results: result,
			})
		}
		
		// Fallback: If running outside Amp context, try fetch-based approach
		// This requires network access and doesn't work in all environments
		console.warn(
			'[webTools] web_search: Amp SDK not available. ' +
			'Make sure to run this agent within Amp context for web search functionality.'
		)

		return JSON.stringify({
			error: 'Amp SDK web_search tool not available',
			query,
			message: 'web_search requires running within Amp context. ' +
				'Ensure agent is executed via Amp SDK, not standalone npm run.',
		})
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error)
		console.error('[webTools] web_search error:', errorMsg)
		return JSON.stringify({
			error: errorMsg,
			query,
			type: 'web_search_error',
		})
	}
}

/**
 * Read and extract content from a web page.
 * Uses Amp SDK's read_web_page tool if available, otherwise returns graceful error.
 * 
 * @param url - The URL to fetch
 * @param objective - Optional: what information to extract
 * @returns Page content as string
 */
export async function read_web_page(url: string, objective?: string): Promise<string> {
	try {
		// Check if Amp's read_web_page tool is available in the global context
		const ampReadWebPage = (globalThis as any).read_web_page
		
		if (typeof ampReadWebPage === 'function') {
			// Call Amp's read_web_page tool
			const result = await ampReadWebPage({
				url,
				objective,
			})
			
			return JSON.stringify({
				success: true,
				url,
				objective,
				content: result,
			})
		}
		
		// Fallback: Return helpful error message
		console.warn(
			'[webTools] read_web_page: Amp SDK not available. ' +
			'Make sure to run this agent within Amp context for web page reading functionality.'
		)

		return JSON.stringify({
			error: 'Amp SDK read_web_page tool not available',
			url,
			objective,
			message: 'read_web_page requires running within Amp context. ' +
				'Ensure agent is executed via Amp SDK, not standalone npm run.',
		})
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error)
		console.error('[webTools] read_web_page error:', errorMsg)
		return JSON.stringify({
			error: errorMsg,
			url,
			objective,
			type: 'read_web_page_error',
		})
	}
}

/**
 * Helper: fetch JSON from a web API endpoint.
 * Useful for agents that need to call REST APIs.
 */
export async function fetch_json(url: string, options?: RequestInit): Promise<string> {
	try {
		const response = await fetch(url, options || {})
		const data = await response.json()
		return JSON.stringify(data)
	} catch (error) {
		return JSON.stringify({
			error: error instanceof Error ? error.message : String(error),
			url,
		})
	}
}
