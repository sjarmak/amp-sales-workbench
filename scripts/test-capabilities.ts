#!/usr/bin/env tsx
/**
 * Test script for capability detection
 */

import { detectCapabilities } from '../src/capabilities/index.js'

async function main() {
	console.log('Testing capability detection...\n')
	
	// Force fresh detection (no cache)
	const capabilities = await detectCapabilities(false)
	
	console.log('\n📊 Results:')
	console.log(JSON.stringify(capabilities, null, 2))
	
	if (!capabilities.gong && !capabilities.salesforce && !capabilities.notion) {
		console.log('\n⚠️  No MCPs detected. Check your Amp configuration.')
		process.exit(1)
	}
	
	console.log('\n✅ Detection complete!')
}

main().catch(console.error)
