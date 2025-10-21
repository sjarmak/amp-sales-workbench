import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { execute } from '@sourcegraph/amp-sdk'
import type { AccountKey } from '../types.js'
import { callSalesforceGetRecord, callSalesforceSOQL } from '../phases/ingest/mcp-wrapper.js'

export interface DemoIdea {
	accountKey: AccountKey
	demoScript: {
		title: string
		objectives: string[]
		duration: string
		targetAudience: string[]
		narrative: DemoSection[]
	}
	trialPlan?: {
		duration: string
		scope: string[]
		dataRequirements: string[]
		setupSteps: SetupStep[]
		successMetrics: string[]
	}
	pocScope?: {
		duration: string
		technicalRequirements: string[]
		integrationPoints: string[]
		deliverables: string[]
		successCriteria: string[]
		timeline: TimelinePhase[]
	}
	customizationNotes: string[]
	generatedAt: string
}

export interface DemoSection {
	step: number
	title: string
	duration: string
	talkingPoints: string[]
	features: string[]
	customerPainPoint: string
}

export interface SetupStep {
	step: number
	title: string
	description: string
	owner: 'customer' | 'internal'
	estimatedTime: string
}

export interface TimelinePhase {
	phase: string
	duration: string
	activities: string[]
	milestone: string
}

export async function generateDemoIdea(
	accountKey: AccountKey,
	accountDataDir?: string
): Promise<DemoIdea> {
	if (!accountDataDir) {
		const slug = accountKey.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
		accountDataDir = join(process.cwd(), 'data', 'accounts', slug)
	}

	console.log(`   Generating demo/trial idea...`)

	// Gather all relevant data
	const researchData = await getResearchData(accountDataDir)
	const callInsights = await getCallInsights(accountDataDir)
	const sfState = await getSalesforceState(accountKey)

	// Use Amp SDK to generate demo plan
	const demoData = await generateDemoPlan(researchData, callInsights, sfState, accountKey)

	// Save outputs
	const demosDir = join(accountDataDir, 'demos')
	await mkdir(demosDir, { recursive: true })

	const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

	// Save JSON
	const jsonPath = join(demosDir, `demo-idea-${timestamp}.json`)
	await writeFile(jsonPath, JSON.stringify(demoData, null, 2), 'utf-8')
	console.log(`   Saved: ${jsonPath}`)

	// Save Markdown
	const mdPath = join(demosDir, `demo-idea-${timestamp}.md`)
	const markdown = generateMarkdown(demoData)
	await writeFile(mdPath, markdown, 'utf-8')
	console.log(`   Saved: ${mdPath}`)

	return demoData
}

async function getResearchData(accountDataDir: string): Promise<any> {
	const prospectingDir = join(accountDataDir, 'prospecting')
	try {
		const files = await readFile(prospectingDir, 'utf-8')
		const jsonFiles = files.toString().split('\n').filter((f: string) => f.endsWith('.json'))
		if (jsonFiles.length > 0) {
			const latestFile = jsonFiles.sort().reverse()[0]
			const content = await readFile(join(prospectingDir, latestFile), 'utf-8')
			return JSON.parse(content)
		}
	} catch (error) {
		// No research data
	}
	return null
}

async function getCallInsights(accountDataDir: string): Promise<any> {
	const gongDataPath = join(accountDataDir, 'raw', 'gong.json')
	try {
		const gongData = JSON.parse(await readFile(gongDataPath, 'utf-8'))
		return gongData
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
			query: `SELECT Id, Name, StageName, Amount, CloseDate, 
				Success_Criteria__c, Feature_Requests__c, Feedback_Trends__c, 
				Description 
				FROM Opportunity 
				WHERE AccountId = '${accountKey.salesforceId}' AND IsClosed = false`,
		})

		return {
			account,
			opportunities: oppsResult.records || [],
		}
	} catch (error) {
		console.error('Failed to fetch Salesforce state:', error)
		return { account: null, opportunities: [] }
	}
}

async function generateDemoPlan(
	researchData: any,
	callInsights: any,
	sfState: any,
	accountKey: AccountKey
): Promise<DemoIdea> {
	const promptPath = join(process.cwd(), 'prompts', 'demo-idea.md')
	const promptTemplate = await readFile(promptPath, 'utf-8')

	let context = ''

	if (researchData) {
		context += `# Research Data\n\n\`\`\`json\n${JSON.stringify(researchData, null, 2)}\n\`\`\`\n\n`
	}

	if (callInsights) {
		context += `# Call Insights\n\n\`\`\`json\n${JSON.stringify(callInsights, null, 2)}\n\`\`\`\n\n`
	}

	context += `# Salesforce State\n\n\`\`\`json\n${JSON.stringify(sfState, null, 2)}\n\`\`\``

	const fullPrompt = `${promptTemplate}\n\n---\n\n${context}\n\nGenerate the custom demo/trial plan.`

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
		demoScript: parsedResponse.demoScript,
		trialPlan: parsedResponse.trialPlan,
		pocScope: parsedResponse.pocScope,
		customizationNotes: parsedResponse.customizationNotes || [],
		generatedAt: new Date().toISOString(),
	}
}

function generateMarkdown(demoData: DemoIdea): string {
	let md = `# Demo/Trial Plan: ${demoData.accountKey.name}\n\n`
	md += `**Generated**: ${new Date(demoData.generatedAt).toLocaleDateString()}\n\n`

	md += `## Demo Script\n\n`
	md += `**Title**: ${demoData.demoScript.title}\n`
	md += `**Duration**: ${demoData.demoScript.duration}\n`
	md += `**Target Audience**: ${demoData.demoScript.targetAudience.join(', ')}\n\n`

	md += `### Objectives\n\n`
	demoData.demoScript.objectives.forEach((obj) => {
		md += `- ${obj}\n`
	})
	md += `\n`

	md += `### Demo Flow\n\n`
	demoData.demoScript.narrative.forEach((section) => {
		md += `#### ${section.step}. ${section.title} (${section.duration})\n\n`
		md += `**Customer Pain Point**: ${section.customerPainPoint}\n\n`
		md += `**Features to Showcase**:\n`
		section.features.forEach((feature) => {
			md += `- ${feature}\n`
		})
		md += `\n**Talking Points**:\n`
		section.talkingPoints.forEach((point) => {
			md += `- ${point}\n`
		})
		md += `\n`
	})

	if (demoData.trialPlan) {
		md += `## Trial Plan\n\n`
		md += `**Duration**: ${demoData.trialPlan.duration}\n\n`

		md += `### Scope\n\n`
		demoData.trialPlan.scope.forEach((item) => {
			md += `- ${item}\n`
		})
		md += `\n`

		md += `### Data Requirements\n\n`
		demoData.trialPlan.dataRequirements.forEach((req) => {
			md += `- ${req}\n`
		})
		md += `\n`

		md += `### Setup Steps\n\n`
		demoData.trialPlan.setupSteps.forEach((step) => {
			md += `${step.step}. **${step.title}** (${step.owner}, ~${step.estimatedTime})\n`
			md += `   ${step.description}\n\n`
		})

		md += `### Success Metrics\n\n`
		demoData.trialPlan.successMetrics.forEach((metric) => {
			md += `- ${metric}\n`
		})
		md += `\n`
	}

	if (demoData.pocScope) {
		md += `## POC Scope\n\n`
		md += `**Duration**: ${demoData.pocScope.duration}\n\n`

		md += `### Technical Requirements\n\n`
		demoData.pocScope.technicalRequirements.forEach((req) => {
			md += `- ${req}\n`
		})
		md += `\n`

		md += `### Integration Points\n\n`
		demoData.pocScope.integrationPoints.forEach((point) => {
			md += `- ${point}\n`
		})
		md += `\n`

		md += `### Deliverables\n\n`
		demoData.pocScope.deliverables.forEach((deliverable) => {
			md += `- ${deliverable}\n`
		})
		md += `\n`

		md += `### Success Criteria\n\n`
		demoData.pocScope.successCriteria.forEach((criteria) => {
			md += `- ${criteria}\n`
		})
		md += `\n`

		md += `### Timeline\n\n`
		demoData.pocScope.timeline.forEach((phase) => {
			md += `**${phase.phase}** (${phase.duration})\n`
			phase.activities.forEach((activity) => {
				md += `- ${activity}\n`
			})
			md += `_Milestone: ${phase.milestone}_\n\n`
		})
	}

	if (demoData.customizationNotes.length > 0) {
		md += `## Customization Notes\n\n`
		demoData.customizationNotes.forEach((note) => {
			md += `- ${note}\n`
		})
		md += `\n`
	}

	return md
}
