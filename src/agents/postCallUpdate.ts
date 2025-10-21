import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { execute } from '@sourcegraph/amp-sdk'
import type { AccountKey } from '../types.js'
import { callGongRetrieveTranscripts, callSalesforceGetRecord, callSalesforceSOQL } from '../phases/ingest/mcp-wrapper.js'

export interface PostCallUpdate {
	accountKey: AccountKey
	callId: string
	callMetadata: {
		title: string
		date: string
		duration?: number
		participants: string[]
	}
	crmPatch: {
		yaml: string
		proposal: any
	}
	tasks: Task[]
	followUpEmail: {
		subject: string
		body: string
		to: string[]
		cc?: string[]
	}
	analysis: CallAnalysis
	generatedAt: string
}

export interface Task {
	title: string
	description: string
	dueDate: string
	owner?: string
	type: 'follow-up' | 'internal' | 'customer-action'
	priority: 'high' | 'medium' | 'low'
}

export interface CallAnalysis {
	nextSteps: string[]
	blockers: string[]
	stageProgressionSignals?: {
		currentStage?: string
		suggestedStage?: string
		reasoning?: string
	}
	successCriteriaMentioned: string[]
	featureRequests: string[]
	stakeholderSentiment: {
		overall: 'positive' | 'neutral' | 'negative'
		byStakeholder?: Record<string, string>
	}
	suggestedCloseDate?: {
		date: string
		reasoning: string
		confidence: 'high' | 'medium' | 'low'
	}
}

export async function generatePostCallUpdate(
	accountKey: AccountKey,
	callId?: string,
	accountDataDir?: string
): Promise<PostCallUpdate> {
	if (!accountDataDir) {
		const slug = accountKey.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
		accountDataDir = join(process.cwd(), 'data', 'accounts', slug)
	}

	console.log(`   Generating post-call update...`)

	// Step 1: Get the call data
	const callData = await getCallData(accountKey, callId, accountDataDir)
	if (!callData) {
		throw new Error('Could not retrieve call data')
	}

	console.log(`   Analyzing call: ${callData.title}`)

	// Step 2: Get current Salesforce state
	const sfState = await getSalesforceState(accountKey)

	// Step 3: Use Amp SDK to analyze call + SF state
	const analysis = await analyzeCallAndGenerateUpdates(callData, sfState, accountKey)

	// Step 4: Save outputs
	const postcallDir = join(accountDataDir, 'postcall')
	await mkdir(postcallDir, { recursive: true })

	const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '-' + Date.now()
	
	// Save JSON
	const jsonPath = join(postcallDir, `postcall-${timestamp}.json`)
	await writeFile(jsonPath, JSON.stringify(analysis, null, 2), 'utf-8')
	console.log(`   Saved: ${jsonPath}`)

	// Save YAML patch
	const yamlPath = join(postcallDir, `postcall-${timestamp}.yaml`)
	await writeFile(yamlPath, analysis.crmPatch.yaml, 'utf-8')
	console.log(`   Saved: ${yamlPath}`)

	// Save markdown summary
	const mdPath = join(postcallDir, `postcall-${timestamp}.md`)
	const markdown = generateMarkdownSummary(analysis)
	await writeFile(mdPath, markdown, 'utf-8')
	console.log(`   Saved: ${mdPath}`)

	return analysis
}

async function getCallData(
	_accountKey: AccountKey,
	callId: string | undefined,
	accountDataDir: string
): Promise<any> {
	if (callId) {
		// Fetch specific call transcript
		const result = await callGongRetrieveTranscripts({ callIds: [callId] })
		if (result.callTranscripts && result.callTranscripts.length > 0) {
			return result.callTranscripts[0]
		}
		return null
	}

	// Get most recent call from raw/gong.json
	const gongDataPath = join(accountDataDir, 'raw', 'gong.json')
	try {
		const gongData = JSON.parse(await readFile(gongDataPath, 'utf-8'))
		
		if (!gongData.calls || gongData.calls.length === 0) {
			console.warn('No calls found in gong.json')
			return null
		}

		// Get most recent call
		const mostRecentCall = gongData.calls[0]
		
		// Fetch transcript for that call
		const result = await callGongRetrieveTranscripts({ callIds: [mostRecentCall.id] })
		if (result.callTranscripts && result.callTranscripts.length > 0) {
			return result.callTranscripts[0]
		}
	} catch (error) {
		console.error('Failed to read gong.json:', error)
	}

	return null
}

async function getSalesforceState(accountKey: AccountKey): Promise<any> {
	if (!accountKey.salesforceId) {
		return { account: null, opportunities: [], contacts: [] }
	}

	try {
		// Get account
		const account = await callSalesforceGetRecord({
			objectType: 'Account',
			id: accountKey.salesforceId,
		})

		// Get opportunities
		const oppsResult = await callSalesforceSOQL({
			query: `SELECT Id, Name, StageName, Amount, CloseDate, 
				Next_Step__c, Feedback_Trends__c, Success_Criteria__c, 
				Feature_Requests__c, Likelihood_To_Close__c, Path_To_Close__c, Description 
				FROM Opportunity 
				WHERE AccountId = '${accountKey.salesforceId}' AND IsClosed = false`,
		})

		// Get contacts
		const contactsResult = await callSalesforceSOQL({
			query: `SELECT Id, Name, Title, Email, Phone, Department 
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

async function analyzeCallAndGenerateUpdates(
	callData: any,
	sfState: any,
	accountKey: AccountKey
): Promise<PostCallUpdate> {
	const promptPath = join(process.cwd(), 'prompts', 'post-call-update.md')
	const promptTemplate = await readFile(promptPath, 'utf-8')

	const context = `# Call Transcript\n\n\`\`\`json\n${JSON.stringify(callData, null, 2)}\n\`\`\`\n\n# Current Salesforce State\n\n\`\`\`json\n${JSON.stringify(sfState, null, 2)}\n\`\`\``

	const fullPrompt = `${promptTemplate}\n\n---\n\n${context}\n\nGenerate the post-call update analysis and CRM patch proposal.`

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

	// Parse the response (expecting JSON with specific structure)
	const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/)
	const parsedResponse = jsonMatch ? JSON.parse(jsonMatch[1]) : JSON.parse(responseText)

	// Extract YAML from response
	const yamlMatch = responseText.match(/```ya?ml\n([\s\S]*?)\n```/)
	const yaml = yamlMatch ? yamlMatch[1] : ''

	// Calculate due dates for tasks
	const now = new Date()
	const twoDaysOut = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)

	const tasks: Task[] = (parsedResponse.tasks || []).map((task: any) => ({
		...task,
		dueDate: task.dueDate || twoDaysOut.toISOString().split('T')[0],
	}))

	return {
		accountKey,
		callId: callData.callId,
		callMetadata: {
			title: callData.title || 'Unknown Call',
			date: callData.started || callData.scheduled || new Date().toISOString(),
			duration: callData.duration,
			participants: (callData.parties || []).map((p: any) => p.emailAddress || p.name).filter(Boolean),
		},
		crmPatch: {
			yaml,
			proposal: parsedResponse.crmPatch || {},
		},
		tasks,
		followUpEmail: parsedResponse.followUpEmail || {
			subject: 'Follow-up from our call',
			body: '',
			to: [],
		},
		analysis: parsedResponse.analysis || {
			nextSteps: [],
			blockers: [],
			successCriteriaMentioned: [],
			featureRequests: [],
			stakeholderSentiment: { overall: 'neutral' },
		},
		generatedAt: new Date().toISOString(),
	}
}

function generateMarkdownSummary(update: PostCallUpdate): string {
	let md = `# Post-Call Update: ${update.callMetadata.title}\n\n`
	md += `**Date**: ${new Date(update.callMetadata.date).toLocaleDateString()}\n`
	md += `**Duration**: ${update.callMetadata.duration ? Math.round(update.callMetadata.duration / 60) + ' min' : 'N/A'}\n`
	md += `**Participants**: ${update.callMetadata.participants.join(', ')}\n\n`

	md += `## Analysis\n\n`

	if (update.analysis.nextSteps.length > 0) {
		md += `### Next Steps\n\n`
		update.analysis.nextSteps.forEach((step) => {
			md += `- ${step}\n`
		})
		md += `\n`
	}

	if (update.analysis.blockers.length > 0) {
		md += `### Blockers & Risks\n\n`
		update.analysis.blockers.forEach((blocker) => {
			md += `- ${blocker}\n`
		})
		md += `\n`
	}

	if (update.analysis.stageProgressionSignals) {
		const stage = update.analysis.stageProgressionSignals
		md += `### Stage Progression\n\n`
		md += `- Current: ${stage.currentStage || 'Unknown'}\n`
		md += `- Suggested: ${stage.suggestedStage || 'No change'}\n`
		if (stage.reasoning) {
			md += `- Reasoning: ${stage.reasoning}\n`
		}
		md += `\n`
	}

	if (update.analysis.successCriteriaMentioned.length > 0) {
		md += `### Success Criteria Mentioned\n\n`
		update.analysis.successCriteriaMentioned.forEach((criteria) => {
			md += `- ${criteria}\n`
		})
		md += `\n`
	}

	if (update.analysis.featureRequests.length > 0) {
		md += `### Feature Requests\n\n`
		update.analysis.featureRequests.forEach((request) => {
			md += `- ${request}\n`
		})
		md += `\n`
	}

	md += `### Stakeholder Sentiment\n\n`
	md += `**Overall**: ${update.analysis.stakeholderSentiment.overall}\n\n`
	if (update.analysis.stakeholderSentiment.byStakeholder) {
		Object.entries(update.analysis.stakeholderSentiment.byStakeholder).forEach(([name, sentiment]) => {
			md += `- ${name}: ${sentiment}\n`
		})
		md += `\n`
	}

	if (update.analysis.suggestedCloseDate) {
		md += `### Suggested Close Date\n\n`
		md += `- **Date**: ${update.analysis.suggestedCloseDate.date}\n`
		md += `- **Confidence**: ${update.analysis.suggestedCloseDate.confidence}\n`
		md += `- **Reasoning**: ${update.analysis.suggestedCloseDate.reasoning}\n\n`
	}

	md += `## Tasks\n\n`
	update.tasks.forEach((task) => {
		md += `### ${task.title}\n\n`
		md += `- **Type**: ${task.type}\n`
		md += `- **Priority**: ${task.priority}\n`
		md += `- **Due**: ${task.dueDate}\n`
		if (task.owner) {
			md += `- **Owner**: ${task.owner}\n`
		}
		md += `- **Description**: ${task.description}\n\n`
	})

	md += `## Follow-up Email Draft\n\n`
	md += `**To**: ${update.followUpEmail.to.join(', ')}\n`
	if (update.followUpEmail.cc && update.followUpEmail.cc.length > 0) {
		md += `**CC**: ${update.followUpEmail.cc.join(', ')}\n`
	}
	md += `**Subject**: ${update.followUpEmail.subject}\n\n`
	md += `---\n\n${update.followUpEmail.body}\n\n`

	md += `## CRM Patch\n\n`
	md += `See \`postcall-${new Date(update.generatedAt).toISOString().split('T')[0]}.yaml\` for proposed CRM updates.\n`

	return md
}
