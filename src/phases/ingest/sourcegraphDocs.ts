import { mkdir, readFile, writeFile, access, copyFile } from 'fs/promises'
import { join } from 'path'
import { createHash } from 'crypto'
// @ts-ignore - turndown types are incomplete
import TurndownService from 'turndown'
import { load } from 'cheerio'
import {
	readMeta,
	writeMeta,
	updateSourcegraphDocsCheckpoint,
	type SourcegraphDocsMetadata,
	type SourcegraphPage,
} from '../freshness.js'
import { generateFeaturesTable, generateSummaryTable } from './sourcegraphFeatures.js'

const URLS = {
	docs: 'https://sourcegraph.com/docs',
	blog: 'https://sourcegraph.com/blog',
	codeSearch: 'https://sourcegraph.com/docs/code-search',
	batchChanges: 'https://sourcegraph.com/docs/batch-changes',
	codeInsights: 'https://sourcegraph.com/docs/code-insights',
	mcp: 'https://sourcegraph.com/docs/integration/editor/mcp',
}

type PageKey = keyof typeof URLS

interface GlobalCache {
	pages: Record<PageKey, SourcegraphPage>
}

type RefreshMode = 'auto' | 'incremental' | 'full'

export interface IngestSourcegraphDocsOptions {
	mode?: RefreshMode
	onProgress?: (message: string) => void
}

const GLOBAL_CACHE_DIR = join(process.cwd(), 'data', 'global', 'sourcegraph')
const GLOBAL_CACHE_FILE = join(GLOBAL_CACHE_DIR, 'sourcegraph.cache.json')

/**
 * Convert HTML to clean markdown
 */
function htmlToMarkdown(html: string): string {
	const $ = load(html)

	// Remove scripts, styles, nav, footer
	$('script, style, nav, footer, .navbar, .header, .footer').remove()

	// Try to find main content area
	let content = $('main').html() || $('article').html() || $('body').html() || html

	const turndown = new TurndownService({
		headingStyle: 'atx',
		codeBlockStyle: 'fenced',
	})

	// Clean up the markdown
	let markdown = turndown.turndown(content)
	
	// Remove excessive newlines
	markdown = markdown.replace(/\n{3,}/g, '\n\n')
	
	return markdown.trim()
}

/**
 * Compute SHA256 hash of content
 */
function computeHash(content: string): string {
	return createHash('sha256').update(content).digest('hex')
}

/**
 * Read global cache file
 */
async function readGlobalCache(): Promise<GlobalCache | null> {
	try {
		await access(GLOBAL_CACHE_FILE)
		const content = await readFile(GLOBAL_CACHE_FILE, 'utf-8')
		return JSON.parse(content)
	} catch {
		return null
	}
}

/**
 * Write global cache file
 */
async function writeGlobalCache(cache: GlobalCache): Promise<void> {
	await mkdir(GLOBAL_CACHE_DIR, { recursive: true })
	await writeFile(GLOBAL_CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8')
}

/**
 * Fetch a page with conditional requests
 */
async function fetchPage(
	url: string,
	cachedPage?: SourcegraphPage
): Promise<{ content: string; etag?: string; lastModified?: string } | null> {
	const headers: Record<string, string> = {
		'User-Agent': 'Sourcegraph-Sales-Workbench/1.0',
	}

	// Add conditional headers if we have cached data
	if (cachedPage?.etag) {
		headers['If-None-Match'] = cachedPage.etag
	}
	if (cachedPage?.lastModified) {
		headers['If-Modified-Since'] = cachedPage.lastModified
	}

	const response = await fetch(url, { headers })

	// 304 Not Modified - content hasn't changed
	if (response.status === 304) {
		return null
	}

	if (!response.ok) {
		throw new Error(`HTTP ${response.status} for ${url}`)
	}

	const content = await response.text()
	const etag = response.headers.get('etag') || undefined
	const lastModified = response.headers.get('last-modified') || undefined

	return { content, etag, lastModified }
}

/**
 * Check if a page needs updating
 */
async function checkPageFreshness(
	url: string,
	cachedPage?: SourcegraphPage
): Promise<boolean> {
	try {
		const headers: Record<string, string> = {
			'User-Agent': 'Sourcegraph-Sales-Workbench/1.0',
		}

		const response = await fetch(url, { method: 'HEAD', headers })

		if (!response.ok) {
			// If HEAD fails, assume we need to fetch
			return true
		}

		const etag = response.headers.get('etag')
		const lastModified = response.headers.get('last-modified')

		// Compare with cached values
		if (cachedPage) {
			if (etag && cachedPage.etag && etag !== cachedPage.etag) {
				return true
			}
			if (lastModified && cachedPage.lastModified && lastModified !== cachedPage.lastModified) {
				return true
			}
		}

		return false
	} catch {
		// If HEAD request fails, assume we need to fetch
		return true
	}
}

/**
 * Ingest Sourcegraph Docs and Blog pages
 */
export async function ingestSourcegraphDocs(
	_accountSlug: string,
	accountDataDir: string,
	options: IngestSourcegraphDocsOptions = {}
): Promise<{ updated: boolean; stats: any }> {
	const { mode = 'auto', onProgress } = options

	const progress = (msg: string) => {
		console.log(`[ingestSourcegraphDocs] ${msg}`)
		onProgress?.(msg)
	}

	progress('Starting Sourcegraph Docs ingest...')

	// Read account metadata
	const meta = await readMeta(accountDataDir)
	
	// Read global cache
	let globalCache = await readGlobalCache()
	if (!globalCache) {
		globalCache = {
			pages: Object.entries(URLS).reduce((acc, [key, url]) => {
				acc[key as PageKey] = { url }
				return acc
			}, {} as Record<PageKey, SourcegraphPage>),
		}
	}

	// Ensure all pages exist in cache structure
	for (const [key, url] of Object.entries(URLS)) {
		const pageKey = key as PageKey
		if (!globalCache.pages[pageKey]) {
			globalCache.pages[pageKey] = { url }
		}
	}

	const sgDir = join(accountDataDir, 'raw', 'sourcegraph')
	await mkdir(sgDir, { recursive: true })

	let updated = false
	const stats: any = {
		pagesChecked: 0,
		pagesUpdated: 0,
	}

	// Process each page
	for (const [pageKey, url] of Object.entries(URLS)) {
		const key = pageKey as PageKey
		stats.pagesChecked++

		progress(`Checking ${key} page...`)

		const cachedPage = globalCache.pages[key]
		let shouldFetch = mode === 'full'

		if (mode === 'auto' || mode === 'incremental') {
			// Check if we need to fetch
			if (!cachedPage.lastFetchedAt) {
				progress(`${key} never fetched, fetching now...`)
				shouldFetch = true
			} else {
				const needsUpdate = await checkPageFreshness(url, cachedPage)
				if (needsUpdate) {
					progress(`${key} has changes, fetching...`)
					shouldFetch = true
				} else {
					progress(`${key} unchanged`)
				}
			}
		}

		if (shouldFetch) {
			try {
				const result = await fetchPage(url, mode === 'incremental' ? cachedPage : undefined)

				if (result) {
					const { content, etag, lastModified } = result
					const markdown = htmlToMarkdown(content)
					const hash = computeHash(markdown)

					// Check if content actually changed
					if (cachedPage.hash && cachedPage.hash === hash) {
						progress(`${key} content unchanged (same hash)`)
						// Update metadata only
						globalCache.pages[key].lastFetchedAt = new Date().toISOString()
						if (etag) globalCache.pages[key].etag = etag
						if (lastModified) globalCache.pages[key].lastModified = lastModified
					} else {
						progress(`${key} content updated`)
						
						// Write to global cache
						const mdPath = join(GLOBAL_CACHE_DIR, `${key}.md`)
						await writeFile(mdPath, markdown, 'utf-8')

						// Update cache metadata
						globalCache.pages[key] = {
							url,
							etag,
							lastModified,
							hash,
							lastFetchedAt: new Date().toISOString(),
						}

						updated = true
						stats.pagesUpdated++
					}
				} else {
					progress(`${key} returned 304 Not Modified`)
					// Update last fetched time
					globalCache.pages[key].lastFetchedAt = new Date().toISOString()
				}
			} catch (err) {
				progress(`Error fetching ${key}: ${err}`)
				// Continue with other pages even if one fails
			}
		}
	}

	// Write global cache
	await writeGlobalCache(globalCache)

	// Regenerate features and summary table if any page was updated
	let featuresCount = 0
	let sectionsCount = 0
	if (updated || mode === 'full') {
		progress('Regenerating features table...')
		try {
			const featuresTable = await generateFeaturesTable(GLOBAL_CACHE_DIR, URLS)
			featuresCount = featuresTable.features.length
			
			const featuresPath = join(GLOBAL_CACHE_DIR, 'features.json')
			await writeFile(featuresPath, JSON.stringify(featuresTable, null, 2), 'utf-8')
			
			progress(`Generated ${featuresCount} features`)
			stats.featuresCount = featuresCount
		} catch (err) {
			progress(`Error generating features: ${err}`)
		}

		progress('Regenerating summary table...')
		try {
			const summaryTable = await generateSummaryTable(GLOBAL_CACHE_DIR, URLS)
			sectionsCount = summaryTable.stats.totalHeadings
			
			const summaryPath = join(GLOBAL_CACHE_DIR, 'summary.json')
			await writeFile(summaryPath, JSON.stringify(summaryTable, null, 2), 'utf-8')
			
			progress(`Generated summary table with ${sectionsCount} sections`)
			stats.sectionsCount = sectionsCount
		} catch (err) {
			progress(`Error generating summary: ${err}`)
		}
	}

	// Copy files to account directory
	progress('Copying to account directory...')
	
	// Copy page markdowns
	for (const key of Object.keys(URLS)) {
		const srcPath = join(GLOBAL_CACHE_DIR, `${key}.md`)
		const dstPath = join(sgDir, `${key}.md`)
		
		try {
			await access(srcPath)
			await copyFile(srcPath, dstPath)
		} catch (err) {
			// File doesn't exist yet - this is OK
		}
	}
	
	// Copy metadata files
	for (const file of ['features.json', 'summary.json']) {
		const srcPath = join(GLOBAL_CACHE_DIR, file)
		const dstPath = join(sgDir, file)
		
		try {
			await access(srcPath)
			await copyFile(srcPath, dstPath)
		} catch (err) {
			// File doesn't exist yet - this is OK
		}
	}

	// Update account metadata
	// We need to map the global cache pages to the expected partial type
	// Since PageKey is a subset of string, this cast is safe enough for our internal use
	const sgMeta: Partial<SourcegraphDocsMetadata> = {
		pages: globalCache.pages as any,
		lastFullSyncAt: mode === 'full' ? new Date().toISOString() : meta.sources.sourcegraph?.lastFullSyncAt,
		lastIncrementalSyncAt: new Date().toISOString(),
		featuresCount,
		featuresLastGeneratedAt: updated || mode === 'full' 
			? new Date().toISOString() 
			: meta.sources.sourcegraph?.featuresLastGeneratedAt,
	}

	updateSourcegraphDocsCheckpoint(meta, sgMeta)
	await writeMeta(accountDataDir, meta)

	progress('Sourcegraph Docs ingest complete')

	return {
		updated,
		stats,
	}
}
