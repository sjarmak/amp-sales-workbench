#!/usr/bin/env tsx
import { ingestFromGong } from './src/phases/ingest/gong.js'
import { ingestFromNotion } from './src/phases/ingest/notion.js'

async function main() {
	console.log('=== Testing Gong MCP Integration ===')
	try {
		const gongResult = await ingestFromGong(
			{ name: 'Test' },
			'./data/test'
		)
		console.log(`✓ Gong calls found: ${gongResult.calls?.length || 0}`)
		console.log(`✓ Gong summaries: ${gongResult.summaries?.length || 0}`)
		if (gongResult.calls && gongResult.calls.length > 0) {
			console.log(`  Sample titles:`)
			gongResult.calls.slice(0, 3).forEach((call: any) => {
				console.log(`  - ${call.title}`)
			})
		}
	} catch (error) {
		console.error('✗ Gong error:', error)
	}

	console.log('\n=== Testing Notion MCP Integration ===')
	try {
		const notionResult = await ingestFromNotion({ name: 'customer' })
		console.log(`✓ Notion pages found: ${notionResult.relatedPages?.length || 0}`)
		if (notionResult.relatedPages && notionResult.relatedPages.length > 0) {
			console.log(`  Sample titles:`)
			notionResult.relatedPages.slice(0, 3).forEach((page: any) => {
				console.log(`  - ${page.title}`)
			})
		}
		if (notionResult.accountPage) {
			console.log(`✓ Account page found in database`)
		}
	} catch (error) {
		console.error('✗ Notion error:', error)
	}
}

main()
