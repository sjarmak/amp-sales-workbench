#!/usr/bin/env tsx

import { generateFollowUpEmail } from '../src/agents/followUpEmail.js'
import type { AccountKey } from '../src/types.js'

async function main() {
	const accountName = process.argv[2]
	const callId = process.argv[3]

	if (!accountName) {
		console.error('Usage: npx tsx scripts/test-followup-email.ts "Company Name" [callId]')
		process.exit(1)
	}

	const accountKey: AccountKey = {
		name: accountName,
	}

	console.log(`🧪 Testing Follow-Up Email Agent`)
	console.log(`   Account: ${accountName}`)
	if (callId) {
		console.log(`   Call ID: ${callId}`)
	}
	console.log('')

	try {
		const result = await generateFollowUpEmail(accountKey, callId)
		
		console.log('')
		console.log('✅ Follow-up email generated successfully!')
		console.log('')
		console.log('📧 Email Preview:')
		console.log('─'.repeat(80))
		console.log(`To: ${result.email.to.join(', ')}`)
		if (result.email.cc && result.email.cc.length > 0) {
			console.log(`Cc: ${result.email.cc.join(', ')}`)
		}
		console.log(`Subject: ${result.email.subject}`)
		console.log('')
		console.log(result.email.body)
		console.log('─'.repeat(80))
		console.log('')
		
		if (result.nextMeeting) {
			console.log('📅 Suggested Next Meeting:')
			console.log(`   Date: ${result.nextMeeting.suggestedDate}`)
			console.log(`   Duration: ${result.nextMeeting.suggestedDuration}`)
			console.log(`   Agenda:`)
			result.nextMeeting.agenda.forEach((item) => {
				console.log(`   - ${item}`)
			})
			console.log('')
		}
		
	} catch (error) {
		console.error('❌ Error:', error)
		process.exit(1)
	}
}

main()
