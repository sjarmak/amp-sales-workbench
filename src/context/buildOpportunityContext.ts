/**
 * Opportunity Context Builder
 * 
 * Builds the OpportunityContext from cached account data,
 * Salesforce records, Gong calls, and knowledge docs.
 */

import path from 'path'
import { promises as fs } from 'fs'
import type {
	OpportunityContext,
	LifecycleStageId,
	ProductId,
	ActivitySummary,
	KnowledgeDoc,
	ArtifactSummary,
	TranscriptChunk,
} from '../agentTypes.js'
import { getStageFromSalesforce } from '../config/lifecycle.js'

const DATA_DIR = path.join(process.cwd(), 'data/accounts')
const GLOBAL_DATA_DIR = path.join(process.cwd(), 'data/global/sourcegraph')

// Product documentation URLs and their cache file names
const PRODUCT_DOC_MAP: Record<string, { file: string; url: string }> = {
	code_search: { file: 'codeSearch.md', url: 'https://sourcegraph.com/docs/code-search' },
	batch_changes: { file: 'batchChanges.md', url: 'https://sourcegraph.com/docs/batch-changes' },
	code_insights: { file: 'codeInsights.md', url: 'https://sourcegraph.com/docs/code-insights' },
	deep_search: { file: 'docs.md', url: 'https://sourcegraph.com/docs' },
	sourcegraph_mcp: { file: 'mcp.md', url: 'https://sourcegraph.com/docs/integration/editor/mcp' },
}

// ============================================================================
// Context Building
// ============================================================================

export interface BuildContextOptions {
	accountSlug: string
	opportunityId?: string
	products?: ProductId[]
	includeTranscript?: boolean
	transcriptCallId?: string
	includeProductDocs?: boolean
}

/**
 * Build OpportunityContext from account data.
 */
export async function buildOpportunityContext(
	options: BuildContextOptions
): Promise<OpportunityContext> {
	const { accountSlug, opportunityId, products = [], includeTranscript = false, transcriptCallId, includeProductDocs = true } = options
	const accountDir = path.join(DATA_DIR, accountSlug)

	// Load metadata
	let metadata: any = {}
	try {
		metadata = JSON.parse(await fs.readFile(path.join(accountDir, 'metadata.json'), 'utf-8'))
	} catch {
		// Use defaults
	}

	// Load Salesforce data
	let sfData: any = {}
	try {
		sfData = JSON.parse(await fs.readFile(path.join(accountDir, 'raw/salesforce.json'), 'utf-8'))
	} catch {
		// Salesforce not available
	}

	// Load Gong data
	let gongData: any = {}
	try {
		gongData = JSON.parse(await fs.readFile(path.join(accountDir, 'raw/gong.json'), 'utf-8'))
	} catch {
		try {
			gongData = JSON.parse(await fs.readFile(path.join(accountDir, 'raw/gong_calls.json'), 'utf-8'))
		} catch {
			// Gong not available
		}
	}

	// Load Notion data
	let notionData: any = {}
	try {
		notionData = JSON.parse(await fs.readFile(path.join(accountDir, 'raw/notion.json'), 'utf-8'))
	} catch {
		try {
			notionData = JSON.parse(await fs.readFile(path.join(accountDir, 'raw/notion_pages.json'), 'utf-8'))
		} catch {
			// Notion not available
		}
	}

	// Determine lifecycle stage
	let stage: LifecycleStageId = 'prospecting'
	let opportunity: any = null
	if (opportunityId && sfData.opportunities) {
		opportunity = sfData.opportunities.find((o: any) => o.Id === opportunityId)
		if (opportunity?.StageName) {
			stage = getStageFromSalesforce(opportunity.StageName)
		}
	} else if (sfData.opportunities?.length > 0) {
		// Use first opportunity
		opportunity = sfData.opportunities[0]
		if (opportunity?.StageName) {
			stage = getStageFromSalesforce(opportunity.StageName)
		}
	}

	// Build activities from Gong calls and SF activities
	const activities: ActivitySummary[] = []

	// Add Gong calls
	if (gongData.calls) {
		for (const call of gongData.calls.slice(0, 20)) {
			activities.push({
				id: call.id,
				type: 'gong_call',
				date: call.started || call.scheduled || call.startTime,
				title: call.title || call.subject || 'Untitled Call',
				summary: call.summary?.brief || gongData.summaries?.find((s: any) => s.callId === call.id)?.summary,
				participants: call.participants || call.parties?.map((p: any) => p.name || p.emailAddress).filter(Boolean),
				duration: call.duration,
				source: 'gong',
			})
		}
	}

	// Add SF activities
	if (sfData.activities) {
		for (const activity of sfData.activities.slice(0, 20)) {
			activities.push({
				id: activity.Id,
				type: activity.Type === 'Call' ? 'meeting' : 'task',
				date: activity.ActivityDate || activity.CreatedDate,
				title: activity.Subject || 'Untitled Activity',
				summary: activity.Description,
				source: 'salesforce',
			})
		}
	}

	// Sort by date (newest first)
	activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

	// Build knowledge docs from Notion
	const knowledgeDocs: KnowledgeDoc[] = []
	const pages = notionData.relatedPages || notionData.pages || []
	for (const page of pages.slice(0, 10)) {
		knowledgeDocs.push({
			id: page.id,
			type: 'account_doc',
			title: page.title || 'Untitled Page',
			url: page.content?.url || page.url,
			excerpt: extractExcerpt(page),
		})
	}

	// Add product documentation for selected products
	if (includeProductDocs && products.length > 0) {
		const productDocs = await loadProductDocs(products)
		knowledgeDocs.push(...productDocs)
	}

	// Load artifacts (previous agent outputs)
	const artifacts: ArtifactSummary[] = await loadArtifacts(accountDir)

	// Load transcript if requested
	let recentTranscript: TranscriptChunk[] | undefined
	if (includeTranscript && transcriptCallId) {
		recentTranscript = await loadTranscript(accountDir, transcriptCallId)
		if (process.env.DEBUG) {
			console.log(`[buildOpportunityContext] Loaded transcript for ${transcriptCallId}: ${recentTranscript?.length || 0} chunks`)
		}
	}

	return {
		accountId: metadata.salesforceId || sfData.account?.Id || accountSlug,
		accountName: metadata.name || sfData.account?.Name || accountSlug,
		accountDomain: metadata.domain || sfData.account?.Website,
		opportunityId: opportunity?.Id,
		opportunityName: opportunity?.Name,
		stage,
		products,
		salesforceSnapshot: {
			account: sfData.account,
			opportunity,
			contacts: sfData.contacts,
		},
		activities,
		knowledgeDocs,
		artifacts,
		recentTranscript,
	}
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Load product documentation for selected products.
 * Fetches from cache or live docs if not available.
 */
async function loadProductDocs(products: ProductId[]): Promise<KnowledgeDoc[]> {
	const docs: KnowledgeDoc[] = []
	
	for (const productId of products) {
		const mapping = PRODUCT_DOC_MAP[productId]
		if (!mapping) continue
		
		try {
			// Try to load from global cache first
			const cachePath = path.join(GLOBAL_DATA_DIR, mapping.file)
			let content: string | null = null
			
			try {
				content = await fs.readFile(cachePath, 'utf-8')
			} catch {
				// Cache miss - try to fetch live
				console.log(`[loadProductDocs] Cache miss for ${productId}, fetching from ${mapping.url}`)
				try {
					const response = await fetch(mapping.url, {
						headers: { 'User-Agent': 'Sourcegraph-Sales-Workbench/1.0' }
					})
					if (response.ok) {
						const html = await response.text()
						// Simple HTML to text extraction for now
						content = html
							.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
							.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
							.replace(/<[^>]+>/g, ' ')
							.replace(/\s+/g, ' ')
							.trim()
							.substring(0, 10000) // Limit size
					}
				} catch (fetchErr) {
					console.error(`[loadProductDocs] Failed to fetch ${mapping.url}:`, fetchErr)
				}
			}
			
			if (content) {
				// Truncate to reasonable size for context
				const excerpt = content.length > 8000 ? content.substring(0, 8000) + '...' : content
				
				docs.push({
					id: `product-doc-${productId}`,
					type: 'product_doc',
					title: `Sourcegraph ${productId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} Documentation`,
					url: mapping.url,
					excerpt,
				})
			}
		} catch (err) {
			console.error(`[loadProductDocs] Error loading docs for ${productId}:`, err)
		}
	}
	
	return docs
}

/**
 * Extract a brief excerpt from a Notion page.
 */
function extractExcerpt(page: any): string | undefined {
	const blocks = page.content?.blocks?.results || []
	for (const block of blocks.slice(0, 5)) {
		const richText = block[block.type]?.rich_text
		if (richText && richText.length > 0) {
			const text = richText.map((rt: any) => rt.plain_text || '').join('')
			if (text.trim().length > 20) {
				return text.trim().substring(0, 200)
			}
		}
	}
	return undefined
}

/**
 * Load previous agent artifacts for an account.
 */
async function loadArtifacts(accountDir: string): Promise<ArtifactSummary[]> {
	const artifacts: ArtifactSummary[] = []
	const artifactDirs = ['briefs', 'summaries', 'reviews', 'qualifications', 'meeting-summaries']

	for (const dir of artifactDirs) {
		try {
			const dirPath = path.join(accountDir, dir)
			const files = await fs.readdir(dirPath)

			for (const file of files.filter((f) => f.endsWith('.json')).slice(0, 5)) {
				try {
					const content = JSON.parse(await fs.readFile(path.join(dirPath, file), 'utf-8'))
					artifacts.push({
						id: file.replace('.json', ''),
						artifactType: inferAgentType(dir, file),
						stage: 'global',
						accountId: accountDir.split('/').pop() || '',
						title: content.title || file.replace('.json', ''),
						summary: content.summary || content.executiveSummary || 'No summary',
						lastRunAt: content.generatedAt || content.timestamp || new Date().toISOString(),
						lastRunAgentId: inferAgentType(dir, file),
						version: 1,
					})
				} catch {
					// Skip invalid files
				}
			}
		} catch {
			// Directory doesn't exist
		}
	}

	// Sort by date (newest first)
	artifacts.sort((a, b) => new Date(b.lastRunAt).getTime() - new Date(a.lastRunAt).getTime())

	return artifacts.slice(0, 10)
}

/**
 * Infer agent type from directory and filename.
 */
function inferAgentType(dir: string, file: string): any {
	if (dir === 'briefs' || file.includes('precall')) return 'precall_brief'
	if (dir === 'summaries' || file.includes('exec')) return 'exec_summary'
	if (dir === 'reviews' || file.includes('deal')) return 'deal_review'
	if (dir === 'qualifications' || file.includes('meddic')) return 'qualification'
	if (dir === 'meeting-summaries') return 'meeting_summary'
	return 'exec_summary'
}

/**
 * Load transcript chunks for a specific call.
 */
async function loadTranscript(accountDir: string, callId: string): Promise<TranscriptChunk[]> {
	const chunks: TranscriptChunk[] = []

	try {
		// Try to find transcript in Gong data
		const gongPath = path.join(accountDir, 'raw/gong.json')
		let gongData: any = {}
		try {
			gongData = JSON.parse(await fs.readFile(gongPath, 'utf-8'))
		} catch {
			gongData = JSON.parse(await fs.readFile(path.join(accountDir, 'raw/gong_calls.json'), 'utf-8'))
		}

		const summary = gongData.summaries?.find((s: any) => s.callId === callId)
		if (summary?.transcript) {
			// Parse transcript format: "Speaker: text"
			const lines = summary.transcript.split('\n')
			for (const line of lines) {
				const match = line.match(/^([^:]+):\s*(.+)$/)
				if (match) {
					chunks.push({
						speaker: match[1].trim(),
						text: match[2].trim(),
					})
				}
			}
			if (process.env.DEBUG) {
				console.log(`[loadTranscript] Loaded ${chunks.length} chunks for call ${callId}`)
			}
		} else {
			if (process.env.DEBUG) {
				console.log(`[loadTranscript] No transcript found for call ${callId}. Available summaries: ${gongData.summaries?.map((s: any) => s.callId).join(', ')}`)
			}
		}
	} catch (err) {
		if (process.env.DEBUG) {
			console.error(`[loadTranscript] Error loading transcript for ${callId}:`, err)
		}
	}

	return chunks
}

/**
 * Quick context builder for simple cases.
 */
export async function getQuickContext(accountSlug: string): Promise<OpportunityContext> {
	return buildOpportunityContext({ accountSlug })
}
