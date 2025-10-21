import { readFile } from 'fs/promises'
import { join } from 'path'
import type { AccountKey } from '../../types.js'
import { callNotionGetPage, callNotionGetBlockChildren, callNotionSearch, callNotionQueryDatabase } from './mcp-wrapper.js'

interface NotionConfig {
	knowledgePages: {
		customerWins: string
		competitiveAnalysis: string
		productInfo: string
	}
	accountsDatabase: string
}

interface NotionPageData {
	id: string
	title: string
	content: any
	lastEdited: string
}

export interface NotionIngestOptions {
	since?: string // ISO timestamp for filtering by last_edited_time
}

export async function ingestFromNotion(
	accountKey: AccountKey,
	options?: NotionIngestOptions
): Promise<{
	accountPage?: any
	relatedPages?: any[]
	lastSyncedAt: string
}> {
	const config = await loadNotionConfig()

	const relatedPages: NotionPageData[] = []

	// Pull from curated knowledge pages
	const knowledgePages = await fetchKnowledgePages(config, options?.since)
	relatedPages.push(...knowledgePages)

	// Search for account-specific pages
	const accountPages = await searchAccountPages(accountKey, config, options?.since)
	relatedPages.push(...accountPages)

	// Try to find account in database
	const accountPage = await findAccountInDatabase(accountKey, config)

	return {
		accountPage,
		relatedPages,
		lastSyncedAt: new Date().toISOString(),
	}
}

async function loadNotionConfig(): Promise<NotionConfig> {
	const configPath = join(process.cwd(), 'notion-config.json')
	const content = await readFile(configPath, 'utf-8')
	return JSON.parse(content)
}

async function fetchKnowledgePages(
	config: NotionConfig,
	since?: string
): Promise<NotionPageData[]> {
	const pages: NotionPageData[] = []

	for (const [key, pageId] of Object.entries(config.knowledgePages)) {
		if (pageId === 'page-id-here') {
			console.warn(`Skipping ${key}: placeholder ID not replaced`)
			continue
		}

		try {
			const page = await fetchNotionPage(pageId)
			const lastEdited = page.last_edited_time || new Date().toISOString()
			
			// Filter by since if provided
			if (since) {
				const pageDate = new Date(lastEdited)
				const sinceDate = new Date(since)
				sinceDate.setMinutes(sinceDate.getMinutes() - 5) // 5-minute overlap
				
				if (pageDate <= sinceDate) {
					continue // Skip page if not modified since last sync
				}
			}
			
			pages.push({
				id: pageId,
				title: key,
				content: page,
				lastEdited,
			})
		} catch (error) {
			console.error(`Failed to fetch ${key} page:`, error)
		}
	}

	return pages
}

async function searchAccountPages(
	accountKey: AccountKey,
	_config: NotionConfig,
	since?: string
): Promise<NotionPageData[]> {
	const pages: NotionPageData[] = []

	// Search for pages mentioning the account name
	if (!accountKey.name) return pages

	try {
		const searchResults = await searchNotion(accountKey.name)

		for (const result of searchResults) {
			const lastEdited = result.last_edited_time || new Date().toISOString()
			
			// Filter by since if provided
			if (since) {
				const pageDate = new Date(lastEdited)
				const sinceDate = new Date(since)
				sinceDate.setMinutes(sinceDate.getMinutes() - 5)
				
				if (pageDate <= sinceDate) {
					continue
				}
			}
			
			const pageContent = await fetchNotionPage(result.id)
			pages.push({
				id: result.id,
				title: result.title || 'Untitled',
				content: pageContent,
				lastEdited,
			})
		}
	} catch (error) {
		console.error('Failed to search for account pages:', error)
	}

	return pages
}

async function findAccountInDatabase(
	accountKey: AccountKey,
	config: NotionConfig
): Promise<any | undefined> {
	if (config.accountsDatabase === 'database-id-here') {
		console.warn('Accounts database ID not configured')
		return undefined
	}

	try {
		const results = await queryNotionDatabase(config.accountsDatabase, {
			filter: {
				property: 'Name',
				title: {
					contains: accountKey.name,
				},
			},
		})

		if (results.length > 0) {
			return results[0]
		}
	} catch (error) {
		console.error('Failed to query accounts database:', error)
	}

	return undefined
}

async function fetchNotionPage(pageId: string): Promise<any> {
	try {
		const page = await callNotionGetPage({ page_id: pageId })
		const blocks = await callNotionGetBlockChildren({ 
			block_id: pageId,
			page_size: 100,
		})

		return {
			...page,
			blocks,
		}
	} catch (error) {
		console.error(`fetchNotionPage failed for ${pageId}:`, error)
		return {
			id: pageId,
			last_edited_time: new Date().toISOString(),
			blocks: { results: [] },
		}
	}
}

async function searchNotion(query: string): Promise<any[]> {
	try {
		const result = await callNotionSearch({ 
			query,
			page_size: 10,
		})

		return result.results || []
	} catch (error) {
		console.error(`searchNotion failed for "${query}":`, error)
		return []
	}
}

async function queryNotionDatabase(
	databaseId: string,
	params: any
): Promise<any[]> {
	try {
		const result = await callNotionQueryDatabase({
			database_id: databaseId,
			...params,
		})

		return result.results || []
	} catch (error) {
		console.error(`queryNotionDatabase failed for ${databaseId}:`, error)
		return []
	}
}
