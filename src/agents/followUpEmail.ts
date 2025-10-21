import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { execute } from '@sourcegraph/amp-sdk'
import type { AccountKey } from '../types.js'
import { callGongRetrieveTranscripts, callSalesforceGetRecord, callSalesforceSOQL } from '../phases/ingest/mcp-wrapper.js'

export interface FollowUpEmail {
	accountKey: AccountKey
	callMetadata?: {
		title: string
		date: string
		participants: string[]
		callId: string
	}
	email: {
		to: string[]
		cc?: string[]
		subject: string
		body: string
	}
	plainText: string
	nextMeeting?: {
		suggestedDate: string
		suggestedDuration: string
		agenda: string[]
	}
	attachments?: {
		name: string
		description: string
	}[]
	generatedAt: string
}

export async function generateFollowUpEmail(
	accountKey: AccountKey,
	callId?: string,
	accountDataDir?: string
): Promise<FollowUpEmail> {
	if (!accountDataDir) {
		const slug = accountKey.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
		accountDataDir = join(process.cwd(), 'data', 'accounts', slug)
	}

	console.log(`   Generating follow-up email...`)

	// Get call data
	const callData = await getCallData(accountKey, callId, accountDataDir)

	// Get Salesforce state
	const sfState = await getSalesforceState(accountKey)

	// Check for existing postcall summary
	const postcallSummary = await getPostcallSummary(accountDataDir)

	// Use Amp SDK to generate email
	const emailData = await generateEmail(callData, sfState, postcallSummary, accountKey)

	// Save outputs
	const emailsDir = join(accountDataDir, 'emails')
	await mkdir(emailsDir, { recursive: true })

	const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

	// Save JSON
	const jsonPath = join(emailsDir, `followup-${timestamp}.json`)
	await writeFile(jsonPath, JSON.stringify(emailData, null, 2), 'utf-8')
	console.log(`   Saved: ${jsonPath}`)

	// Save Markdown
	const mdPath = join(emailsDir, `followup-${timestamp}.md`)
	const markdown = generateMarkdown(emailData)
	await writeFile(mdPath, markdown, 'utf-8')
	console.log(`   Saved: ${mdPath}`)

	// Save plain text (ready for copy-paste)
	const txtPath = join(emailsDir, `followup-${timestamp}.txt`)
	await writeFile(txtPath, emailData.plainText, 'utf-8')
	console.log(`   Saved: ${txtPath}`)

	return emailData
}

async function getCallData(
	_accountKey: AccountKey,
	callId: string | undefined,
	accountDataDir: string
): Promise<any> {
	if (callId) {
		const result = await callGongRetrieveTranscripts({ callIds: [callId] })
		if (result.callTranscripts && result.callTranscripts.length > 0) {
			return result.callTranscripts[0]
		}
	}

	// Get most recent call from raw/gong.json
	const gongDataPath = join(accountDataDir, 'raw', 'gong.json')
	try {
		const gongData = JSON.parse(await readFile(gongDataPath, 'utf-8'))
		if (gongData.calls && gongData.calls.length > 0) {
			const mostRecentCall = gongData.calls[0]
			const result = await callGongRetrieveTranscripts({ callIds: [mostRecentCall.id] })
			if (result.callTranscripts && result.callTranscripts.length > 0) {
				return result.callTranscripts[0]
			}
		}
	} catch (error) {
		console.warn('Could not read gong.json:', error)
	}

	return null
}

async function getSalesforceState(accountKey: AccountKey): Promise<any> {
	if (!accountKey.salesforceId) {
		return { account: null, opportunities: [], contacts: [] }
	}

	try {
		const account = await callSalesforceGetRecord({
			objectType: 'Account',
			id: accountKey.salesforceId,
		})

		const oppsResult = await callSalesforceSOQL({
			query: `SELECT Id, Name, StageName, Amount, CloseDate, Next_Step__c 
				FROM Opportunity 
				WHERE AccountId = '${accountKey.salesforceId}' AND IsClosed = false`,
		})

		const contactsResult = await callSalesforceSOQL({
			query: `SELECT Id, Name, Title, Email 
				FROM Contact 
				WHERE AccountId = '${accountKey.salesforceId}'`,
		})

		return {
			account,
			opportunities: oppsResult.records || [],
			contacts: contactsResult.records || [],
		}
	} catch (error) {
		console.error('Failed to fetch Salesforce state:', error)
		return { account: null, opportunities: [], contacts: [] }
	}
}

async function getPostcallSummary(accountDataDir: string): Promise<any> {
	const postcallDir = join(accountDataDir, 'postcall')
	try {
		const files = await readFile(postcallDir, 'utf-8')
		const jsonFiles = files.toString().split('\n').filter((f: string) => f.endsWith('.json'))
		if (jsonFiles.length > 0) {
			const latestFile = jsonFiles.sort().reverse()[0]
			const content = await readFile(join(postcallDir, latestFile), 'utf-8')
			return JSON.parse(content)
		}
	} catch (error) {
		// No postcall summary found
	}
	return null
}

async function generateEmail(
	callData: any,
	sfState: any,
	postcallSummary: any,
	accountKey: AccountKey
): Promise<FollowUpEmail> {
	const promptPath = join(process.cwd(), 'prompts', 'followup-email.md')
	const promptTemplate = await readFile(promptPath, 'utf-8')

	let context = ''
	
	if (callData) {
		context += `# Call Transcript\n\n\`\`\`json\n${JSON.stringify(callData, null, 2)}\n\`\`\`\n\n`
	}

	if (postcallSummary) {
		context += `# Post-Call Summary\n\n\`\`\`json\n${JSON.stringify(postcallSummary, null, 2)}\n\`\`\`\n\n`
	}

	context += `# Salesforce State\n\n\`\`\`json\n${JSON.stringify(sfState, null, 2)}\n\`\`\``

	const fullPrompt = `${promptTemplate}\n\n---\n\n${context}\n\nGenerate the follow-up email.`

	let responseText = ''

	for await (const message of execute({ prompt: fullPrompt })) {
		if (message.type === 'assistant') {
			for (const block of message.message.content) {
				if (block.type === 'text') {
					responseText += block.text
				}
			}
			process.stdout.write('.')
		}
	}

	console.log('')

	const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/)
	const parsedResponse = jsonMatch ? JSON.parse(jsonMatch[1]) : JSON.parse(responseText)

	return {
		accountKey,
		callMetadata: callData ? {
			title: callData.title || 'Recent call',
			date: callData.started || new Date().toISOString(),
			participants: (callData.parties || []).map((p: any) => p.emailAddress || p.name).filter(Boolean),
			callId: callData.callId,
		} : undefined,
		email: parsedResponse.email,
		plainText: parsedResponse.plainText,
		nextMeeting: parsedResponse.nextMeeting,
		attachments: parsedResponse.attachments,
		generatedAt: new Date().toISOString(),
	}
}

function generateMarkdown(emailData: FollowUpEmail): string {
	let md = `# Follow-Up Email\n\n`

	if (emailData.callMetadata) {
		md += `**Call**: ${emailData.callMetadata.title}\n`
		md += `**Date**: ${new Date(emailData.callMetadata.date).toLocaleDateString()}\n`
		md += `**Participants**: ${emailData.callMetadata.participants.join(', ')}\n\n`
	}

	md += `## Email Details\n\n`
	md += `**To**: ${emailData.email.to.join(', ')}\n`
	if (emailData.email.cc && emailData.email.cc.length > 0) {
		md += `**CC**: ${emailData.email.cc.join(', ')}\n`
	}
	md += `**Subject**: ${emailData.email.subject}\n\n`

	md += `---\n\n${emailData.email.body}\n\n`

	if (emailData.nextMeeting) {
		md += `## Suggested Next Meeting\n\n`
		md += `**Date**: ${emailData.nextMeeting.suggestedDate}\n`
		md += `**Duration**: ${emailData.nextMeeting.suggestedDuration}\n`
		md += `**Agenda**:\n`
		emailData.nextMeeting.agenda.forEach((item) => {
			md += `- ${item}\n`
		})
		md += `\n`
	}

	if (emailData.attachments && emailData.attachments.length > 0) {
		md += `## Suggested Attachments\n\n`
		emailData.attachments.forEach((att) => {
			md += `- **${att.name}**: ${att.description}\n`
		})
		md += `\n`
	}

	return md
}
