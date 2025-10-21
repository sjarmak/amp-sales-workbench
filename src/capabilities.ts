import { execute } from '@sourcegraph/amp-sdk'
import type { Capabilities } from './types.js'

export async function detectCapabilities(): Promise<Capabilities> {
	console.log('Detecting MCP capabilities...')
	
	const capabilities: Capabilities = {
		gong: false,
		salesforce: false,
		notion: false,
		detectedAt: new Date().toISOString(),
	}
	
	try {
		const stream = execute({
			prompt: `List all available MCP tools. For each tool found, return its full name including the mcp__ prefix and server name.
			
Just list the tool names, one per line, nothing else.`,
			options: { dangerouslyAllowAll: true },
		})
		
		let toolsList = ''
		for await (const message of stream) {
			if (message.type === 'assistant') {
				for (const block of message.message.content) {
					if (block.type === 'text') {
						toolsList += block.text
					}
				}
			}
		}
		
		// Check for each capability
		if (toolsList.includes('mcp__gong')) {
			capabilities.gong = true
			console.log('Gong MCP detected')
		} else {
			console.log('Gong MCP not available')
		}
		
		if (toolsList.includes('mcp__salesforce')) {
			capabilities.salesforce = true
			console.log('Salesforce MCP detected')
		} else {
			console.log('Salesforce MCP not available')
		}
		
		if (toolsList.includes('mcp__notion')) {
			capabilities.notion = true
			console.log('Notion MCP detected')
		} else {
			console.log('Notion MCP not available')
		}
		
	} catch (error) {
		console.error('Failed to detect capabilities:', error)
	}
	
	return capabilities
}
