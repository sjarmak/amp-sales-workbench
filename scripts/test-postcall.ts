#!/usr/bin/env npx tsx

import { generatePostCallUpdate } from '../src/agents/postCallUpdate.js'

async function main() {
	const args = process.argv.slice(2)

	if (args.length < 1) {
		console.error('Usage: npx tsx scripts/test-postcall.ts <account-name> [callId]')
		console.error('')
		console.error('Examples:')
		console.error('  npx tsx scripts/test-postcall.ts "Acme Corp"')
		console.error('  npx tsx scripts/test-postcall.ts "Acme Corp" gong-call-123')
		process.exit(1)
	}

	const accountName = args[0]
	const callId = args[1]

	console.log(`\n🎙️  Post-Call Update Agent\n`)
	console.log(`Account: ${accountName}`)
	if (callId) {
		console.log(`Call ID: ${callId}`)
	} else {
		console.log(`Call ID: (using most recent)`)
	}
	console.log('')

	try {
		const accountKey = {
			name: accountName,
		}

		const result = await generatePostCallUpdate(accountKey, callId)

		console.log(`\n✅ Post-call update generated\n`)
		console.log(`Call: ${result.callMetadata.title}`)
		console.log(`Date: ${new Date(result.callMetadata.date).toLocaleDateString()}`)
		console.log(`Participants: ${result.callMetadata.participants.length}`)
		console.log(`Next Steps: ${result.analysis.nextSteps.length}`)
		console.log(`Tasks: ${result.tasks.length}`)
		console.log(`Sentiment: ${result.analysis.stakeholderSentiment.overall}`)
		console.log('')
		console.log(`Files saved to: data/accounts/${accountName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/postcall/`)
		console.log('')
	} catch (error) {
		console.error('❌ Error:', error)
		process.exit(1)
	}
}

main()
