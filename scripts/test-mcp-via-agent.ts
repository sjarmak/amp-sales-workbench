#!/usr/bin/env node
import 'dotenv/config'
import { execute } from '@sourcegraph/amp-sdk'

async function testGongMCP() {
	console.log('\n🎯 Testing Gong MCP via Amp agent...')
	
	try {
		const stream = execute({
			userMessage: `Use the Gong MCP server to list calls from the last 7 days. 
			Return a JSON object with: { success: boolean, callCount: number, sampleCallTitle: string }`,
			tools: ['mcp__gong_extended__list_calls'],
		})
		
		let finalResult = ''
		let toolCalled = false
		
		for await (const event of stream) {
			if (event.type === 'tool_use') {
				console.log(`   Tool called: ${event.name}`)
				toolCalled = true
			} else if (event.type === 'text') {
				finalResult += event.text
			}
		}
		
		console.log('   Result:', finalResult)
		return toolCalled
	} catch (error) {
		console.error('   ❌ Failed:', error)
		return false
	}
}

async function testNotionMCP() {
	console.log('\n📝 Testing Notion MCP via Amp agent...')
	
	try {
		const stream = execute({
			userMessage: `Use the Notion MCP server to search for pages containing "customer".
			Return a JSON object with: { success: boolean, pageCount: number, samplePageTitle: string }`,
			tools: ['mcp__notion__API_post_search'],
		})
		
		let finalResult = ''
		let toolCalled = false
		
		for await (const event of stream) {
			if (event.type === 'tool_use') {
				console.log(`   Tool called: ${event.name}`)
				toolCalled = true
			} else if (event.type === 'text') {
				finalResult += event.text
			}
		}
		
		console.log('   Result:', finalResult)
		return toolCalled
	} catch (error) {
		console.error('   ❌ Failed:', error)
		return false
	}
}

async function testSalesforceMCP() {
	console.log('\n💼 Testing Salesforce MCP via Amp agent...')
	
	try {
		const stream = execute({
			userMessage: `Use the Salesforce MCP server to query for recent accounts.
			Execute this SOQL query: SELECT Id, Name FROM Account LIMIT 5
			Return a JSON object with: { success: boolean, accountCount: number, sampleAccountName: string }`,
			tools: ['mcp__salesforce__soql_query'],
		})
		
		let finalResult = ''
		let toolCalled = false
		
		for await (const event of stream) {
			if (event.type === 'tool_use') {
				console.log(`   Tool called: ${event.name}`)
				toolCalled = true
			} else if (event.type === 'text') {
				finalResult += event.text
			}
		}
		
		console.log('   Result:', finalResult)
		return toolCalled
	} catch (error) {
		console.error('   ❌ Failed (expected due to AWS issues):', error)
		return false
	}
}

async function main() {
	console.log('🧪 Testing MCP Integrations via Amp Agents')
	console.log('=' .repeat(50))
	
	const gongOk = await testGongMCP()
	const notionOk = await testNotionMCP()
	const salesforceOk = await testSalesforceMCP()
	
	console.log('\n' + '='.repeat(50))
	console.log('\n📊 Results:')
	console.log(`   Gong:       ${gongOk ? '✅' : '❌'}`)
	console.log(`   Notion:     ${notionOk ? '✅' : '❌'}`)
	console.log(`   Salesforce: ${salesforceOk ? '✅' : '❌'} (AWS issues expected)`)
	
	if (gongOk && notionOk) {
		console.log('\n✅ Core MCP integrations working!')
	}
}

main()
