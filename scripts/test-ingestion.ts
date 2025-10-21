#!/usr/bin/env node
import 'dotenv/config'
import { ingestFromGong } from '../src/phases/ingest/gong.js'
import { ingestFromNotion } from '../src/phases/ingest/notion.js'
import { mkdir } from 'fs/promises'

async function main() {
	console.log('🧪 Testing Gong & Notion MCP Integration\n')

	// Create test directory
	await mkdir('./data/test', { recursive: true })

	// Test Gong
	console.log('1️⃣ Testing Gong ingestion...')
	try {
		const gongData = await ingestFromGong(
			{ name: 'Test Account' },
			'./data/test'
		)
		console.log('   ✅ Gong calls found:', gongData.calls?.length || 0)
		console.log('   ✅ Summaries:', gongData.summaries?.length || 0)
		if (gongData.calls && gongData.calls.length > 0) {
			console.log('   Sample call:', gongData.calls[0].title)
		}
	} catch (error) {
		console.error('   ❌ Gong failed:', error instanceof Error ? error.message : error)
	}

	// Test Notion
	console.log('\n2️⃣ Testing Notion ingestion...')
	try {
		const notionData = await ingestFromNotion({ name: 'customer' })
		console.log('   ✅ Related pages:', notionData.relatedPages?.length || 0)
		console.log('   ✅ Account page:', notionData.accountPage ? 'Found' : 'Not found')
		if (notionData.relatedPages && notionData.relatedPages.length > 0) {
			console.log('   Sample page:', notionData.relatedPages[0].title)
		}
	} catch (error) {
		console.error('   ❌ Notion failed:', error instanceof Error ? error.message : error)
	}

	console.log('\n✅ Test complete!')
}

main()
