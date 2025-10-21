#!/usr/bin/env node
import 'dotenv/config'

async function testGong() {
	console.log('\n🎯 Testing Gong MCP...')
	try {
		const { mcp__gong_extended__list_calls } = await import('@sourcegraph/amp-sdk')
		
		// List calls from last 7 days
		const toDate = new Date()
		const fromDate = new Date()
		fromDate.setDate(fromDate.getDate() - 7)
		
		console.log(`   Fetching calls from ${fromDate.toISOString()} to ${toDate.toISOString()}`)
		const result = await mcp__gong_extended__list_calls({
			fromDateTime: fromDate.toISOString(),
			toDateTime: toDate.toISOString(),
		})
		
		console.log(`   ✅ Found ${result.calls?.length || 0} calls`)
		
		if (result.calls && result.calls.length > 0) {
			const firstCall = result.calls[0]
			console.log(`   First call: ${firstCall.title || firstCall.subject || 'Untitled'}`)
			console.log(`   Call ID: ${firstCall.id}`)
			
			// Try to fetch transcript for first call
			console.log('\n   Testing transcript fetch...')
			const { mcp__gong_extended__retrieve_transcripts } = await import('@sourcegraph/amp-sdk')
			const transcriptResult = await mcp__gong_extended__retrieve_transcripts({
				callIds: [firstCall.id],
			})
			
			if (transcriptResult.callTranscripts && transcriptResult.callTranscripts.length > 0) {
				const transcript = transcriptResult.callTranscripts[0]
				console.log(`   ✅ Retrieved transcript (${transcript.transcript?.length || 0} segments)`)
				if (transcript.summary) {
					console.log(`   Summary: ${transcript.summary.substring(0, 100)}...`)
				}
			} else {
				console.log('   ⚠️  No transcript available for this call')
			}
		}
		
		return true
	} catch (error) {
		console.error('   ❌ Gong test failed:', error instanceof Error ? error.message : String(error))
		return false
	}
}

async function testNotion() {
	console.log('\n📝 Testing Notion MCP...')
	try {
		const { mcp__notion__API_post_search } = await import('@sourcegraph/amp-sdk')
		
		// Try a simple search
		console.log('   Searching for pages...')
		const result = await mcp__notion__API_post_search({
			query: 'customer',
			page_size: 5,
		})
		
		console.log(`   ✅ Found ${result.results?.length || 0} pages`)
		
		if (result.results && result.results.length > 0) {
			console.log('   Sample pages:')
			for (const page of result.results.slice(0, 3)) {
				const title = (page.properties?.title?.title?.[0]?.plain_text || 
							  page.properties?.Name?.title?.[0]?.plain_text || 
							  'Untitled')
				console.log(`     - ${title}`)
			}
			
			// Try to fetch page content
			const firstPageId = result.results[0].id
			console.log(`\n   Fetching page content for ${firstPageId}...`)
			
			const { mcp__notion__API_get_block_children } = await import('@sourcegraph/amp-sdk')
			const blocks = await mcp__notion__API_get_block_children({
				block_id: firstPageId,
				page_size: 10,
			})
			
			console.log(`   ✅ Retrieved ${blocks.results?.length || 0} blocks`)
		}
		
		return true
	} catch (error) {
		console.error('   ❌ Notion test failed:', error instanceof Error ? error.message : String(error))
		return false
	}
}

async function main() {
	console.log('🧪 Testing MCP Integrations\n')
	console.log('=' .repeat(50))
	
	const gongOk = await testGong()
	const notionOk = await testNotion()
	
	console.log('\n' + '='.repeat(50))
	console.log('\n📊 Results:')
	console.log(`   Gong:   ${gongOk ? '✅' : '❌'}`)
	console.log(`   Notion: ${notionOk ? '✅' : '❌'}`)
	
	if (!gongOk || !notionOk) {
		console.log('\n💡 Make sure MCP servers are configured in Amp settings')
		process.exit(1)
	}
	
	console.log('\n✅ All MCP integrations working!')
}

main()
