#!/usr/bin/env node
import 'dotenv/config'

async function main() {
	try {
		const { mcp__codemode__list_available_servers } = await import('@sourcegraph/amp-sdk')
		const servers = await mcp__codemode__list_available_servers()
		console.log('Available MCP servers:')
		console.log(JSON.stringify(servers, null, 2))
	} catch (error) {
		console.error('Error:', error)
	}
}

main()
