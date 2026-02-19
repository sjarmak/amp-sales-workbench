/**
 * Local Context Store
 * 
 * Builds and reads consolidated account context from all sources.
 * This provides fast local access to all account data without re-parsing raw files.
 */

import { readFile, writeFile, readdir } from 'fs/promises'
import { join } from 'path'
import type { AccountContext } from './types.js'

/**
 * Build consolidated context from all raw data sources
 */
export async function buildAccountContext(accountDir: string): Promise<AccountContext> {
	const rawDir = join(accountDir, 'raw')
	const prospectingDir = join(accountDir, 'prospecting')
	const metadataPath = join(accountDir, 'metadata.json')

	// Load metadata
	const metadata = JSON.parse(await readFile(metadataPath, 'utf-8'))

	const context: AccountContext = {
		account: {
			name: metadata.name,
			domain: metadata.domain,
			salesforceId: metadata.salesforceId,
			slug: accountDir.split('/').pop() || '',
		},
		generatedAt: new Date().toISOString(),
	}

	// Load Salesforce data
	try {
		const sf = JSON.parse(await readFile(join(rawDir, 'salesforce.json'), 'utf-8'))
		context.salesforce = {
			account: sf.account,
			contacts: sf.contacts,
			opportunities: sf.opportunities,
			activities: sf.activities,
			lastSyncedAt: sf.lastSyncedAt,
		}
	} catch (error) {
		// Salesforce data not available
	}

	// Load Gong data
	try {
		const gong = JSON.parse(await readFile(join(rawDir, 'gong.json'), 'utf-8'))
		context.gong = {
			calls: gong.calls,
			summaries: gong.summaries,
			lastSyncedAt: gong.lastSyncedAt,
		}
	} catch (error) {
		// Try legacy filename
		try {
			const gong = JSON.parse(await readFile(join(rawDir, 'gong_calls.json'), 'utf-8'))
			context.gong = {
				calls: gong.calls,
				summaries: gong.summaries,
				lastSyncedAt: gong.lastSyncedAt,
			}
		} catch {
			// Gong data not available
		}
	}

	// Load Prospector data
	try {
		const files = await readdir(prospectingDir)
		const mdFiles = files.filter((f) => f.endsWith('.md'))

		if (mdFiles.length > 0) {
			const fileContents = await Promise.all(
				mdFiles.map(async (filename) => ({
					filename,
					content: await readFile(join(prospectingDir, filename), 'utf-8'),
				}))
			)

			// Try to find timestamp from filenames or use directory mtime
			const ranAt = mdFiles
				.map((f) => {
					const match = f.match(/(\d{4}-\d{2}-\d{2})/)
					return match ? new Date(match[1]).toISOString() : null
				})
				.filter(Boolean)[0]

			context.prospector = {
				ranAt: ranAt || undefined,
				files: fileContents,
			}
		}
	} catch (error) {
		// Prospector data not available
	}

	// Load Notion data
	try {
		const notion = JSON.parse(await readFile(join(rawDir, 'notion.json'), 'utf-8'))
		context.notion = {
			accountPage: notion.accountPage,
			relatedPages: notion.pages || notion.relatedPages,
			lastSyncedAt: notion.lastSyncedAt,
		}
	} catch (error) {
		// Try legacy filename
		try {
			const notion = JSON.parse(await readFile(join(rawDir, 'notion_pages.json'), 'utf-8'))
			context.notion = {
				accountPage: notion.accountPage,
				relatedPages: notion.pages || notion.relatedPages,
				lastSyncedAt: notion.lastSyncedAt,
			}
		} catch {
			// Notion data not available
		}
	}

	return context
}

/**
 * Save context to disk
 */
export async function saveAccountContext(accountDir: string, context: AccountContext): Promise<void> {
	const contextPath = join(accountDir, 'context.json')
	await writeFile(contextPath, JSON.stringify(context, null, 2), 'utf-8')
}

/**
 * Get context from disk (reads cached context.json)
 */
export async function getAccountContext(accountDir: string): Promise<AccountContext | null> {
	try {
		const contextPath = join(accountDir, 'context.json')
		const context = JSON.parse(await readFile(contextPath, 'utf-8'))
		return context
	} catch (error) {
		return null
	}
}

/**
 * Build and save context (call after any data refresh)
 */
export async function refreshAccountContext(accountDir: string): Promise<AccountContext> {
	const context = await buildAccountContext(accountDir)
	await saveAccountContext(accountDir, context)
	return context
}
