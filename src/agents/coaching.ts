import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { execute } from '@sourcegraph/amp-sdk'
import type { AccountKey } from '../types.js'
import { callGongRetrieveTranscripts } from '../phases/ingest/mcp-wrapper.js'

export interface CoachingFeedback {
	accountKey: AccountKey
	callMetadata: {
		title: string
		date: string
		duration: number
		participants: string[]
		callId: string
	}
	analysis: {
		talkRatio: {
			rep: number
			customer: number
			assessment: string
			recommendation: string
		}
		technicalDepth: {
			rating: 'excellent' | 'good' | 'adequate' | 'needs-improvement'
			strengths: string[]
			improvements: string[]
		}
		objectionHandling: {
			objectionsRaised: string[]
			responses: ObjectionResponse[]
			overallRating: 'excellent' | 'good' | 'needs-improvement'
		}
		discoveryQuality: {
			rating: 'excellent' | 'good' | 'adequate' | 'needs-improvement'
			questionsAsked: string[]
			missedOpportunities: string[]
		}
		nextStepClarity: {
			rating: 'clear' | 'somewhat-clear' | 'unclear'
			nextStepsAgreed: string[]
			recommendation: string
		}
		meddic?: {
			metrics: string
			economicBuyer: string
			decisionCriteria: string
			decisionProcess: string
			identifyPain: string
			champion: string
			overallScore: number
		}
	}
	whatWentWell: string[]
	areasToImprove: string[]
	specificExamples: CoachingExample[]
	recommendedActions: RecommendedAction[]
	coachingTips: string[]
	generatedAt: string
}

export interface ObjectionResponse {
	objection: string
	response: string
	effectiveness: 'excellent' | 'good' | 'needs-improvement'
	betterApproach?: string
}

export interface CoachingExample {
	timestamp: string
	context: string
	whatHappened: string
	impact: 'positive' | 'negative' | 'neutral'
	lesson: string
}

export interface RecommendedAction {
	action: string
	why: string
	howTo: string
	priority: 'high' | 'medium' | 'low'
}

export async function generateCoachingFeedback(
	accountKey: AccountKey,
	callId: string,
	accountDataDir?: string
): Promise<CoachingFeedback> {
	if (!accountDataDir) {
		const slug = accountKey.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
		accountDataDir = join(process.cwd(), 'data', 'accounts', slug)
	}

	console.log(`   Generating coaching feedback...`)

	// Get call transcript
	const callData = await getCallData(callId)
	if (!callData) {
		throw new Error(`Could not retrieve call data for callId: ${callId}`)
	}

	console.log(`   Analyzing call: ${callData.title}`)

	// Use Amp SDK to analyze call
	const coachingData = await analyzeCallForCoaching(callData, accountKey)

	// Save outputs (NOT to Salesforce - internal only)
	const coachingDir = join(accountDataDir, 'coaching')
	await mkdir(coachingDir, { recursive: true })

	const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

	// Save JSON
	const jsonPath = join(coachingDir, `coaching-${timestamp}.json`)
	await writeFile(jsonPath, JSON.stringify(coachingData, null, 2), 'utf-8')
	console.log(`   Saved: ${jsonPath}`)

	// Save Markdown
	const mdPath = join(coachingDir, `coaching-${timestamp}.md`)
	const markdown = generateMarkdown(coachingData)
	await writeFile(mdPath, markdown, 'utf-8')
	console.log(`   Saved: ${mdPath}`)

	return coachingData
}

async function getCallData(callId: string): Promise<any> {
	const result = await callGongRetrieveTranscripts({ callIds: [callId] })
	if (result.callTranscripts && result.callTranscripts.length > 0) {
		return result.callTranscripts[0]
	}
	return null
}

async function analyzeCallForCoaching(
	callData: any,
	accountKey: AccountKey
): Promise<CoachingFeedback> {
	const promptPath = join(process.cwd(), 'prompts', 'coaching.md')
	const promptTemplate = await readFile(promptPath, 'utf-8')

	const context = `# Call Transcript\n\n\`\`\`json\n${JSON.stringify(callData, null, 2)}\n\`\`\``

	const fullPrompt = `${promptTemplate}\n\n---\n\n${context}\n\nGenerate the coaching feedback analysis.`

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
		callMetadata: {
			title: callData.title || 'Unknown Call',
			date: callData.started || new Date().toISOString(),
			duration: callData.duration || 0,
			participants: (callData.parties || []).map((p: any) => p.emailAddress || p.name).filter(Boolean),
			callId: callData.callId,
		},
		analysis: parsedResponse.analysis,
		whatWentWell: parsedResponse.whatWentWell || [],
		areasToImprove: parsedResponse.areasToImprove || [],
		specificExamples: parsedResponse.specificExamples || [],
		recommendedActions: parsedResponse.recommendedActions || [],
		coachingTips: parsedResponse.coachingTips || [],
		generatedAt: new Date().toISOString(),
	}
}

function generateMarkdown(coaching: CoachingFeedback): string {
	let md = `# Coaching Feedback: ${coaching.callMetadata.title}\n\n`
	md += `**Date**: ${new Date(coaching.callMetadata.date).toLocaleDateString()}\n`
	md += `**Duration**: ${Math.round(coaching.callMetadata.duration / 60)} minutes\n`
	md += `**Participants**: ${coaching.callMetadata.participants.join(', ')}\n\n`

	md += `---\n\n`
	md += `⚠️ **Internal Coaching Document** - Not for customer or CRM\n\n`
	md += `---\n\n`

	md += `## Summary\n\n`

	md += `### What Went Well ✅\n\n`
	coaching.whatWentWell.forEach((item) => {
		md += `- ${item}\n`
	})
	md += `\n`

	md += `### Areas to Improve 🎯\n\n`
	coaching.areasToImprove.forEach((item) => {
		md += `- ${item}\n`
	})
	md += `\n`

	md += `## Detailed Analysis\n\n`

	md += `### Talk Ratio\n\n`
	md += `- **Rep**: ${coaching.analysis.talkRatio.rep}%\n`
	md += `- **Customer**: ${coaching.analysis.talkRatio.customer}%\n`
	md += `- **Assessment**: ${coaching.analysis.talkRatio.assessment}\n`
	md += `- **Recommendation**: ${coaching.analysis.talkRatio.recommendation}\n\n`

	md += `### Technical Depth (${coaching.analysis.technicalDepth.rating})\n\n`
	md += `**Strengths**:\n`
	coaching.analysis.technicalDepth.strengths.forEach((strength) => {
		md += `- ${strength}\n`
	})
	md += `\n**Areas for Improvement**:\n`
	coaching.analysis.technicalDepth.improvements.forEach((improvement) => {
		md += `- ${improvement}\n`
	})
	md += `\n`

	md += `### Objection Handling (${coaching.analysis.objectionHandling.overallRating})\n\n`
	coaching.analysis.objectionHandling.responses.forEach((resp) => {
		md += `**Objection**: "${resp.objection}"\n`
		md += `**Response**: "${resp.response}"\n`
		md += `**Effectiveness**: ${resp.effectiveness}\n`
		if (resp.betterApproach) {
			md += `**Better Approach**: ${resp.betterApproach}\n`
		}
		md += `\n`
	})

	md += `### Discovery Quality (${coaching.analysis.discoveryQuality.rating})\n\n`
	md += `**Questions Asked**:\n`
	coaching.analysis.discoveryQuality.questionsAsked.forEach((q) => {
		md += `- ${q}\n`
	})
	md += `\n**Missed Opportunities**:\n`
	coaching.analysis.discoveryQuality.missedOpportunities.forEach((opp) => {
		md += `- ${opp}\n`
	})
	md += `\n`

	md += `### Next Step Clarity (${coaching.analysis.nextStepClarity.rating})\n\n`
	md += `**Next Steps Agreed**:\n`
	coaching.analysis.nextStepClarity.nextStepsAgreed.forEach((step) => {
		md += `- ${step}\n`
	})
	md += `\n**Recommendation**: ${coaching.analysis.nextStepClarity.recommendation}\n\n`

	if (coaching.analysis.meddic) {
		const m = coaching.analysis.meddic
		md += `### MEDDIC Assessment (Score: ${m.overallScore}/10)\n\n`
		md += `- **Metrics**: ${m.metrics}\n`
		md += `- **Economic Buyer**: ${m.economicBuyer}\n`
		md += `- **Decision Criteria**: ${m.decisionCriteria}\n`
		md += `- **Decision Process**: ${m.decisionProcess}\n`
		md += `- **Identify Pain**: ${m.identifyPain}\n`
		md += `- **Champion**: ${m.champion}\n\n`
	}

	if (coaching.specificExamples.length > 0) {
		md += `## Specific Examples\n\n`
		coaching.specificExamples.forEach((example, idx) => {
			md += `### Example ${idx + 1}: ${example.context}\n\n`
			md += `**What Happened**: ${example.whatHappened}\n\n`
			md += `**Impact**: ${example.impact}\n\n`
			md += `**Lesson**: ${example.lesson}\n\n`
		})
	}

	md += `## Recommended Actions\n\n`
	coaching.recommendedActions.forEach((action) => {
		md += `### ${action.action} (${action.priority} priority)\n\n`
		md += `**Why**: ${action.why}\n\n`
		md += `**How To**: ${action.howTo}\n\n`
	})

	md += `## Coaching Tips\n\n`
	coaching.coachingTips.forEach((tip) => {
		md += `- ${tip}\n`
	})
	md += `\n`

	return md
}
