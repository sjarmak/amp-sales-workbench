import { readFile } from 'fs/promises'
import { join } from 'path'
import type { AccountKey, ConsolidatedSnapshot } from '../../types.js'

export interface NotionMirrorResult {
	success: boolean
	pageUrl?: string
	pageId?: string
	error?: string
}

interface NotionConfig {
	knowledgePages: Record<string, string>
	accountsDatabase: string
}

export async function mirrorToNotion(
	accountKey: AccountKey,
	snapshot: ConsolidatedSnapshot,
	accountDataDir: string
): Promise<NotionMirrorResult> {
	try {
		// Load Notion config
		const configPath = join(process.cwd(), 'notion-config.json')
		const configData = await readFile(configPath, 'utf-8')
		const config: NotionConfig = JSON.parse(configData)

		if (!config.accountsDatabase || config.accountsDatabase === 'database-id-here') {
			console.log('   ⚠️  Notion database not configured, skipping...')
			return { success: true } // Not a failure, just skipped
		}

		// Search for existing account page
		const existingPage = await searchAccountPage(accountKey.name)

		let pageId: string
		let pageUrl: string

		if (existingPage) {
			console.log(`   Found existing page: ${existingPage.id}`)
			pageId = existingPage.id
			pageUrl = existingPage.url
			
			// Update existing page
			await updatePageContent(pageId, accountKey, snapshot, accountDataDir)
		} else {
			console.log('   Creating new account page...')
			
			// Create new page in accounts database
			const newPage = await createAccountPage(config.accountsDatabase, accountKey)
			pageId = newPage.id
			pageUrl = newPage.url
			
			// Add content to new page
			await updatePageContent(pageId, accountKey, snapshot, accountDataDir)
		}

		return {
			success: true,
			pageUrl,
			pageId,
		}
	} catch (error) {
		console.error('   ⚠️  Notion mirror error:', error)
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		}
	}
}

async function searchAccountPage(_accountName: string): Promise<{ id: string; url: string } | null> {
	// Note: MCP calls must be made via Amp SDK execute() or manual tool invocation
	// For now, return null to skip search and always create new pages
	// Future: Implement via Amp SDK execute() with proper MCP tool calls
	return null
}

async function createAccountPage(
	_databaseId: string,
	_accountKey: AccountKey
): Promise<{ id: string; url: string }> {
	// Note: MCP calls must be made via Amp SDK execute() with tool invocation
	// For now, return stub - will be implemented with proper MCP integration
	throw new Error('Notion page creation requires MCP tool integration via Amp SDK')
}

async function updatePageContent(
	_pageId: string,
	_accountKey: AccountKey,
	snapshot: ConsolidatedSnapshot,
	accountDataDir: string
): Promise<void> {
	// Note: MCP calls must be made via Amp SDK execute() with tool invocation
	
	const timestamp = new Date().toISOString().split('T')[0]
	const summaryFile = `summary-${timestamp.replace(/-/g, '')}.md`
	
	// Read the summary markdown if it exists
	let summaryContent = ''
	try {
		const summaryPath = join(accountDataDir, 'drafts', summaryFile)
		summaryContent = await readFile(summaryPath, 'utf-8')
	} catch (error) {
		console.log('   No summary file found, using snapshot data')
	}

	// Build content blocks
	const blocks: any[] = []

	// Header
	blocks.push({
		type: 'paragraph',
		paragraph: {
			rich_text: [
				{
					type: 'text',
					text: {
						content: `Last Updated: ${new Date().toLocaleDateString()} | Source: ${summaryFile}`,
						link: null,
					},
				},
			],
		},
	})

	// Executive Summary
	blocks.push({
		type: 'paragraph',
		paragraph: {
			rich_text: [
				{
					type: 'text',
					text: {
						content: '🎯 Executive Summary',
						link: null,
					},
				},
			],
		},
	})

	const execSummary = extractSection(summaryContent, '## 🎯 Executive Summary') 
		|| snapshot.accountProfile.summary 
		|| 'No summary available.'

	blocks.push({
		type: 'paragraph',
		paragraph: {
			rich_text: [
				{
					type: 'text',
					text: {
						content: execSummary.substring(0, 2000), // Notion text limit
						link: null,
					},
				},
			],
		},
	})

	// Latest Deal Review
	blocks.push({
		type: 'paragraph',
		paragraph: {
			rich_text: [
				{
					type: 'text',
					text: {
						content: '💼 Latest Deal Review',
						link: null,
					},
				},
			],
		},
	})

	const dealReview = extractSection(summaryContent, '## 💼 Active Opportunities') 
		|| 'No active opportunities.'

	blocks.push({
		type: 'paragraph',
		paragraph: {
			rich_text: [
				{
					type: 'text',
					text: {
						content: dealReview.substring(0, 2000),
						link: null,
					},
				},
			],
		},
	})

	// Recent Call Insights
	if (snapshot.signals.recentCallInsights && snapshot.signals.recentCallInsights.length > 0) {
		blocks.push({
			type: 'paragraph',
			paragraph: {
				rich_text: [
					{
						type: 'text',
						text: {
							content: '🗣️ Recent Call Insights (Last 3)',
							link: null,
						},
					},
				],
			},
		})

		const recentCalls = snapshot.signals.recentCallInsights.slice(0, 3)
		for (const call of recentCalls) {
			blocks.push({
				type: 'bulleted_list_item',
				bulleted_list_item: {
					rich_text: [
						{
							type: 'text',
							text: {
								content: `${call.date}: ${call.summary.substring(0, 500)}`,
								link: null,
							},
						},
					],
				},
			})
		}
	}

	// Next Actions
	blocks.push({
		type: 'paragraph',
		paragraph: {
			rich_text: [
				{
					type: 'text',
					text: {
						content: '🎯 Recommended Next Actions',
						link: null,
					},
				},
			],
		},
	})

	const nextActions = extractSection(summaryContent, '## 🎯 Recommended Next Actions') 
		|| (snapshot.signals.nextActions || []).join('\n')
		|| 'No specific actions recommended.'

	blocks.push({
		type: 'paragraph',
		paragraph: {
			rich_text: [
				{
					type: 'text',
					text: {
						content: nextActions.substring(0, 2000),
						link: null,
					},
				},
			],
		},
	})

	// Risks & Objections
	if (snapshot.signals.risks && snapshot.signals.risks.length > 0) {
		blocks.push({
			type: 'paragraph',
			paragraph: {
				rich_text: [
					{
						type: 'text',
						text: {
							content: '🚨 Risks & Objections',
							link: null,
						},
					},
				],
			},
		})

		for (const risk of snapshot.signals.risks) {
			blocks.push({
				type: 'bulleted_list_item',
				bulleted_list_item: {
					rich_text: [
						{
							type: 'text',
							text: {
								content: risk.substring(0, 500),
								link: null,
							},
						},
					],
				},
			})
		}
	}

	// Key Insights
	blocks.push({
		type: 'paragraph',
		paragraph: {
			rich_text: [
				{
					type: 'text',
					text: {
						content: '💡 Key Insights',
						link: null,
					},
				},
			],
		},
	})

	const keyInsights = extractSection(summaryContent, '## 💡 Key Insights') 
		|| 'See full summary for detailed insights.'

	blocks.push({
		type: 'paragraph',
		paragraph: {
			rich_text: [
				{
					type: 'text',
					text: {
						content: keyInsights.substring(0, 2000),
						link: null,
					},
				},
			],
		},
	})

	// Append all content blocks to page
	// Note: Actual MCP tool invocation would happen here via Amp SDK execute()
	// For now, log what we would send
	console.log(`   ✓ Prepared ${blocks.length} content blocks for Notion`)
	console.log(`   ⚠️  Notion MCP integration pending - requires Amp SDK execute() wrapper`)
}

function extractSection(markdown: string, heading: string): string {
	if (!markdown) return ''
	
	const lines = markdown.split('\n')
	const startIdx = lines.findIndex((line) => line.trim().startsWith(heading))
	
	if (startIdx === -1) return ''
	
	// Find next heading or end of content
	let endIdx = startIdx + 1
	while (endIdx < lines.length && !lines[endIdx].trim().startsWith('##')) {
		endIdx++
	}
	
	return lines.slice(startIdx + 1, endIdx).join('\n').trim()
}
