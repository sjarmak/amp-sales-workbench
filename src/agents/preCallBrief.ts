import { readFile, writeFile, mkdir, readdir } from 'fs/promises'
import { join } from 'path'
import { execute } from '@sourcegraph/amp-sdk'
import type { AccountKey, ConsolidatedSnapshot } from '../types.js'

export interface PreCallBrief {
	accountKey: AccountKey
	meetingDate?: string
	generatedAt: string
	sections: {
		whosWho: WhosWho[]
		recentActivity: RecentActivity
		predictedAgenda: string[]
		keyQuestions: KeyQuestions
		demoFocusAreas: DemoFocus[]
		competitiveLandscape: CompetitiveIntel[]
		customIdeas: CustomIdea[]
	}
	dataAvailability: DataAvailability
}

export interface WhosWho {
	name: string
	role?: string
	title?: string
	decisionPower?: 'high' | 'medium' | 'low' | 'unknown'
	orgChartHints?: string
	recentInteractions?: string
}

export interface RecentActivity {
	lastCallsSummary?: string
	emailTopics?: string[]
	tasksCompleted?: string[]
	lastInteractionDate?: string
}

export interface KeyQuestions {
	meddic: {
		metrics?: string[]
		economicBuyer?: string[]
		decisionCriteria?: string[]
		decisionProcess?: string[]
		identifyPain?: string[]
		champion?: string[]
	}
	blockers?: string[]
	successCriteria?: string[]
}

export interface DemoFocus {
	feature: string
	reason: string
	painPoints?: string[]
}

export interface CompetitiveIntel {
	competitor: string
	mentions: string[]
	sentiment?: string
	context?: string
}

export interface CustomIdea {
	idea: string
	reasoning: string
	evidence: string[]
}

export interface DataAvailability {
	hasSnapshot: boolean
	hasGongCalls: boolean
	hasNotionPages: boolean
	gongCallCount?: number
	notionPageCount?: number
	snapshotAge?: string
}

export async function generatePreCallBrief(
accountKey: AccountKey,
meetingDate?: string,
	callId?: string
): Promise<PreCallBrief> {
	console.log(`\n📋 Generating pre-call brief for ${accountKey.name}...`)
	
	const accountSlug = slugify(accountKey.name)
	const accountDataDir = join(process.cwd(), 'data/accounts', accountSlug)
	
	const [snapshot, gongData, notionData] = await loadDataSources(accountDataDir, callId)
	
	const dataAvailability = assessDataAvailability(snapshot, gongData, notionData)
	logDataAvailability(dataAvailability)
	
	const briefSections = await generateBriefWithAI(
	accountKey,
	meetingDate,
	snapshot,
	gongData,
	notionData,
	 callId
	)
	
	const brief: PreCallBrief = {
		accountKey,
		meetingDate,
		generatedAt: new Date().toISOString(),
		sections: briefSections,
		dataAvailability,
	}
	
	await saveBrief(accountDataDir, brief)
	
	return brief
}

async function loadDataSources(
accountDataDir: string,
	callId?: string
): Promise<[ConsolidatedSnapshot | null, any | null, any | null]> {
const snapshot = await loadLatestSnapshot(accountDataDir)
const gongData = await loadRecentGongCalls(accountDataDir, callId)
	const notionData = await loadNotionPages(accountDataDir)
	
	return [snapshot, gongData, notionData]
}

async function loadLatestSnapshot(
	accountDataDir: string
): Promise<ConsolidatedSnapshot | null> {
	try {
		const snapshotsDir = join(accountDataDir, 'snapshots')
		const files = await readdir(snapshotsDir)
		const snapshotFiles = files
			.filter((f) => f.startsWith('snapshot-') && f.endsWith('.json'))
			.sort()
			.reverse()
		
		if (snapshotFiles.length === 0) return null
		
		const latestFile = join(snapshotsDir, snapshotFiles[0])
		const content = await readFile(latestFile, 'utf-8')
		return JSON.parse(content)
	} catch (error) {
		return null
	}
}

async function loadRecentGongCalls(accountDataDir: string, callId?: string): Promise<any | null> {
	try {
		const rawDir = join(accountDataDir, 'raw')
		const gongFile = join(rawDir, 'gong_calls.json')
		const content = await readFile(gongFile, 'utf-8')
		const data = JSON.parse(content)
		
		const sevenDaysAgo = new Date()
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
		
		if (data.calls && Array.isArray(data.calls)) {
		data.calls = data.calls.filter((call: any) => {
		// If specific callId requested, only include that call
		if (callId) {
		  return call.id === callId
		  }
				// Otherwise, filter to recent calls (last 7 days)
				const callDate = new Date(call.started || call.created)
				return callDate >= sevenDaysAgo
			})
		}
		
		return data
	} catch (error) {
		return null
	}
}

async function loadNotionPages(accountDataDir: string): Promise<any | null> {
	try {
		const rawDir = join(accountDataDir, 'raw')
		const notionFile = join(rawDir, 'notion_pages.json')
		const content = await readFile(notionFile, 'utf-8')
		return JSON.parse(content)
	} catch (error) {
		return null
	}
}

function assessDataAvailability(
	snapshot: ConsolidatedSnapshot | null,
	gongData: any | null,
	notionData: any | null
): DataAvailability {
	const availability: DataAvailability = {
		hasSnapshot: !!snapshot,
		hasGongCalls: !!(gongData && gongData.calls && gongData.calls.length > 0),
		hasNotionPages: !!(notionData && notionData.relatedPages && notionData.relatedPages.length > 0),
	}
	
	if (gongData?.calls) {
		availability.gongCallCount = gongData.calls.length
	}
	
	if (notionData?.relatedPages) {
		availability.notionPageCount = notionData.relatedPages.length
	}
	
	if (snapshot?.generatedAt) {
		const snapshotDate = new Date(snapshot.generatedAt)
		const ageMs = Date.now() - snapshotDate.getTime()
		const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24))
		availability.snapshotAge = `${ageDays} days old`
	}
	
	return availability
}

function logDataAvailability(availability: DataAvailability): void {
	console.log('   Data sources:')
	console.log(`   ✓ Snapshot: ${availability.hasSnapshot ? '✓' : '✗'} ${availability.snapshotAge || ''}`)
	console.log(`   ✓ Gong calls (7d): ${availability.hasGongCalls ? '✓' : '✗'} ${availability.gongCallCount ? `(${availability.gongCallCount})` : ''}`)
	console.log(`   ✓ Notion pages: ${availability.hasNotionPages ? '✓' : '✗'} ${availability.notionPageCount ? `(${availability.notionPageCount})` : ''}`)
}

async function generateBriefWithAI(
accountKey: AccountKey,
meetingDate: string | undefined,
snapshot: ConsolidatedSnapshot | null,
gongData: any | null,
notionData: any | null,
	callId?: string
): Promise<PreCallBrief['sections']> {
	console.log('   Generating brief with AI...')
	
	const promptPath = join(process.cwd(), 'prompts/precall-brief.md')
	let promptTemplate: string
	
	try {
		promptTemplate = await readFile(promptPath, 'utf-8')
	} catch (error) {
		promptTemplate = getDefaultPrompt()
	}
	
	const context = buildBriefContext(accountKey, meetingDate, snapshot, gongData, notionData, callId)
	const fullPrompt = `${promptTemplate}\n\n---\n\n${context}\n\nPlease generate a structured PreCallBrief JSON object with the sections defined above.`
	
	let accumulatedText = ''
	
	for await (const message of execute({ prompt: fullPrompt })) {
		if (message.type === 'assistant') {
			for (const block of message.message.content) {
				if (block.type === 'text') {
					accumulatedText += block.text
				}
			}
			process.stdout.write('.')
		}
	}
	
	console.log('')
	
	const sections = parseBriefSections(accumulatedText)
	
	return sections
}

function determineCallContext(gongData: any | null): { isFirstCall: boolean; previousCalls: any[] } {
const calls = gongData?.calls || [];
const hasPreviousCalls = calls.length > 0;

return {
 isFirstCall: !hasPreviousCalls,
		previousCalls: calls
	};
}

function buildBriefContext(
accountKey: AccountKey,
meetingDate: string | undefined,
snapshot: ConsolidatedSnapshot | null,
gongData: any | null,
notionData: any | null,
callId?: string // Used indirectly through gongData filtering to determine call context
): string {
const sections: string[] = []

const callContext = determineCallContext(gongData)

sections.push(`# Pre-Call Brief for ${accountKey.name}`)
if (meetingDate) {
 sections.push(`Meeting Date: ${meetingDate}`)
	}
	sections.push('')

	// Add call context information
	sections.push('## Call Context')
	if (callContext.isFirstCall) {
		sections.push('**This is the FIRST CALL** with this customer.')
		sections.push('Focus: Discovery, relationship building, initial qualification.')
	} else {
		sections.push('**This is a FOLLOW-UP CALL**.')
		sections.push(`Previous calls: ${callContext.previousCalls.length}`)
		sections.push('Focus: Action on previous commitments, momentum building, addressing next steps.')
	}
	sections.push('')
	
	if (snapshot) {
		sections.push('## Consolidated Account Snapshot')
		sections.push('```json')
		sections.push(JSON.stringify(snapshot, null, 2))
		sections.push('```')
		sections.push('')
	} else {
		sections.push('## No consolidated snapshot available')
		sections.push('')
	}
	
	if (gongData && gongData.calls) {
		sections.push('## Recent Gong Calls (Last 7 Days)')
		sections.push('```json')
		sections.push(JSON.stringify(gongData, null, 2))
		sections.push('```')
		sections.push('')
	} else {
		sections.push('## No recent Gong calls available')
		sections.push('')
	}
	
	if (notionData && notionData.relatedPages) {
		sections.push('## Notion Knowledge Base')
		sections.push('```json')
		sections.push(JSON.stringify(notionData, null, 2))
		sections.push('```')
		sections.push('')
	} else {
		sections.push('## No Notion pages available')
		sections.push('')
	}
	
	return sections.join('\n')
}

function parseBriefSections(text: string): PreCallBrief['sections'] {
	const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/)
	let parsed: any
	
	if (jsonMatch) {
		parsed = JSON.parse(jsonMatch[1])
	} else {
		const jsonStart = text.indexOf('{')
		const jsonEnd = text.lastIndexOf('}')
		if (jsonStart !== -1 && jsonEnd !== -1) {
			parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1))
		} else {
			throw new Error('Could not parse AI response as JSON')
		}
	}
	
	return parsed.sections || parsed
}

async function saveBrief(accountDataDir: string, brief: PreCallBrief): Promise<void> {
	const briefsDir = join(accountDataDir, 'briefs')
	await mkdir(briefsDir, { recursive: true })
	
	const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0]
	
	const jsonFile = join(briefsDir, `precall-${timestamp}.json`)
	await writeFile(jsonFile, JSON.stringify(brief, null, 2), 'utf-8')
	console.log(`   ✓ Saved JSON: ${jsonFile}`)
	
	const markdown = formatBriefAsMarkdown(brief)
	const mdFile = join(briefsDir, `precall-${timestamp}.md`)
	await writeFile(mdFile, markdown, 'utf-8')
	console.log(`   ✓ Saved Markdown: ${mdFile}`)
}

function formatBriefAsMarkdown(brief: PreCallBrief): string {
	const lines: string[] = []
	
	lines.push(`# Pre-Call Brief: ${brief.accountKey.name}`)
	lines.push('')
	if (brief.meetingDate) {
		lines.push(`**Meeting Date:** ${brief.meetingDate}`)
	}
	lines.push(`**Generated:** ${new Date(brief.generatedAt).toLocaleString()}`)
	lines.push('')
	
	lines.push('## 👥 Who\'s Who')
	lines.push('')
	if (brief.sections.whosWho && brief.sections.whosWho.length > 0) {
		for (const person of brief.sections.whosWho) {
			lines.push(`### ${person.name}`)
			if (person.title) lines.push(`- **Title:** ${person.title}`)
			if (person.role) lines.push(`- **Role:** ${person.role}`)
			if (person.decisionPower) lines.push(`- **Decision Power:** ${person.decisionPower}`)
			if (person.orgChartHints) lines.push(`- **Org Hints:** ${person.orgChartHints}`)
			if (person.recentInteractions) lines.push(`- **Recent:** ${person.recentInteractions}`)
			lines.push('')
		}
	} else {
		lines.push('_No attendee information available_')
		lines.push('')
	}
	
	lines.push('## 📊 Recent Activity')
	lines.push('')
	const activity = brief.sections.recentActivity
	if (activity.lastCallsSummary) {
		lines.push(`**Last Calls:** ${activity.lastCallsSummary}`)
		lines.push('')
	}
	if (activity.emailTopics && activity.emailTopics.length > 0) {
		lines.push('**Email Topics:**')
		activity.emailTopics.forEach((topic) => lines.push(`- ${topic}`))
		lines.push('')
	}
	if (activity.tasksCompleted && activity.tasksCompleted.length > 0) {
		lines.push('**Tasks Completed:**')
		activity.tasksCompleted.forEach((task) => lines.push(`- ${task}`))
		lines.push('')
	}
	if (activity.lastInteractionDate) {
		lines.push(`**Last Interaction:** ${activity.lastInteractionDate}`)
		lines.push('')
	}
	
	lines.push('## 📝 Predicted Agenda')
	lines.push('')
	if (brief.sections.predictedAgenda && brief.sections.predictedAgenda.length > 0) {
		brief.sections.predictedAgenda.forEach((item) => lines.push(`- ${item}`))
	} else {
		lines.push('_Unable to predict agenda_')
	}
	lines.push('')
	
	lines.push('## ❓ Key Questions to Ask')
	lines.push('')
	const questions = brief.sections.keyQuestions
	if (questions.meddic) {
		if (questions.meddic.metrics && questions.meddic.metrics.length > 0) {
			lines.push('**Metrics:**')
			questions.meddic.metrics.forEach((q) => lines.push(`- ${q}`))
			lines.push('')
		}
		if (questions.meddic.economicBuyer && questions.meddic.economicBuyer.length > 0) {
			lines.push('**Economic Buyer:**')
			questions.meddic.economicBuyer.forEach((q) => lines.push(`- ${q}`))
			lines.push('')
		}
		if (questions.meddic.decisionCriteria && questions.meddic.decisionCriteria.length > 0) {
			lines.push('**Decision Criteria:**')
			questions.meddic.decisionCriteria.forEach((q) => lines.push(`- ${q}`))
			lines.push('')
		}
		if (questions.meddic.decisionProcess && questions.meddic.decisionProcess.length > 0) {
			lines.push('**Decision Process:**')
			questions.meddic.decisionProcess.forEach((q) => lines.push(`- ${q}`))
			lines.push('')
		}
		if (questions.meddic.identifyPain && questions.meddic.identifyPain.length > 0) {
			lines.push('**Identify Pain:**')
			questions.meddic.identifyPain.forEach((q) => lines.push(`- ${q}`))
			lines.push('')
		}
		if (questions.meddic.champion && questions.meddic.champion.length > 0) {
			lines.push('**Champion:**')
			questions.meddic.champion.forEach((q) => lines.push(`- ${q}`))
			lines.push('')
		}
	}
	if (questions.blockers && questions.blockers.length > 0) {
		lines.push('**Blockers:**')
		questions.blockers.forEach((q) => lines.push(`- ${q}`))
		lines.push('')
	}
	if (questions.successCriteria && questions.successCriteria.length > 0) {
		lines.push('**Success Criteria:**')
		questions.successCriteria.forEach((q) => lines.push(`- ${q}`))
		lines.push('')
	}
	
	lines.push('## 🎯 Demo Focus Areas')
	lines.push('')
	if (brief.sections.demoFocusAreas && brief.sections.demoFocusAreas.length > 0) {
		brief.sections.demoFocusAreas.forEach((demo) => {
			lines.push(`### ${demo.feature}`)
			lines.push(`**Reason:** ${demo.reason}`)
			if (demo.painPoints && demo.painPoints.length > 0) {
				lines.push('**Pain Points:**')
				demo.painPoints.forEach((pain) => lines.push(`- ${pain}`))
			}
			lines.push('')
		})
	} else {
		lines.push('_No demo focus areas identified_')
		lines.push('')
	}
	
	lines.push('## ⚔️ Competitive Landscape')
	lines.push('')
	if (brief.sections.competitiveLandscape && brief.sections.competitiveLandscape.length > 0) {
		brief.sections.competitiveLandscape.forEach((comp) => {
			lines.push(`### ${comp.competitor}`)
			if (comp.sentiment) lines.push(`**Sentiment:** ${comp.sentiment}`)
			if (comp.context) lines.push(`**Context:** ${comp.context}`)
			if (comp.mentions && comp.mentions.length > 0) {
				lines.push('**Mentions:**')
				comp.mentions.forEach((mention) => lines.push(`- ${mention}`))
			}
			lines.push('')
		})
	} else {
		lines.push('_No competitive mentions found_')
		lines.push('')
	}
	
	lines.push('## 💡 Custom Demo/Trial Ideas')
	lines.push('')
	if (brief.sections.customIdeas && brief.sections.customIdeas.length > 0) {
		brief.sections.customIdeas.forEach((idea, idx) => {
			lines.push(`${idx + 1}. **${idea.idea}**`)
			lines.push(`   - **Reasoning:** ${idea.reasoning}`)
			if (idea.evidence && idea.evidence.length > 0) {
				lines.push('   - **Evidence:**')
				idea.evidence.forEach((ev) => lines.push(`     - ${ev}`))
			}
			lines.push('')
		})
	} else {
		lines.push('_No custom ideas generated_')
		lines.push('')
	}
	
	lines.push('---')
	lines.push('')
	lines.push('## 📦 Data Availability')
	lines.push(`- Snapshot: ${brief.dataAvailability.hasSnapshot ? '✓' : '✗'} ${brief.dataAvailability.snapshotAge || ''}`)
	lines.push(`- Gong Calls: ${brief.dataAvailability.hasGongCalls ? '✓' : '✗'} ${brief.dataAvailability.gongCallCount ? `(${brief.dataAvailability.gongCallCount})` : ''}`)
	lines.push(`- Notion Pages: ${brief.dataAvailability.hasNotionPages ? '✓' : '✗'} ${brief.dataAvailability.notionPageCount ? `(${brief.dataAvailability.notionPageCount})` : ''}`)
	
	return lines.join('\n')
}

function getDefaultPrompt(): string {
	return `You are a sales intelligence assistant helping prepare for an upcoming customer meeting.

Analyze the provided account data and generate a comprehensive pre-call brief with the following sections:

## Output Format

Generate a JSON object with these sections:

1. **whosWho**: Array of attendees/key contacts with:
   - name, role, title
   - decisionPower (high/medium/low/unknown)
   - orgChartHints (reporting structure, influence)
   - recentInteractions (summary of recent touchpoints)

2. **recentActivity**: Summary of recent interactions
   - lastCallsSummary (synthesis of recent calls)
   - emailTopics (key themes from emails)
   - tasksCompleted (action items that were completed)
   - lastInteractionDate

3. **predictedAgenda**: Array of likely topics based on:
   - Meeting title/invite details (if available)
   - Current deal stage
   - Recent conversation topics

4. **keyQuestions**: Questions organized by MEDDIC framework
   - meddic: { metrics, economicBuyer, decisionCriteria, decisionProcess, identifyPain, champion }
   - blockers (potential obstacles to discover)
   - successCriteria (what does success look like for them)

5. **demoFocusAreas**: Features to highlight
   - feature, reason, painPoints[]

6. **competitiveLandscape**: Competitors mentioned
   - competitor, mentions[], sentiment, context

7. **customIdeas**: Tailored demo/trial ideas
   - idea, reasoning, evidence[]

## Guidelines

- Handle missing data gracefully (note gaps without fabricating)
- Prioritize insights from recent calls (last 7 days)
- Cross-reference Salesforce, Gong, and Notion data
- Identify MEDDIC gaps that need addressing
- Suggest specific, actionable demo scenarios
- Flag competitive threats with context
- Be concise but actionable

Return ONLY the JSON object, no additional commentary.`
}

function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
}
