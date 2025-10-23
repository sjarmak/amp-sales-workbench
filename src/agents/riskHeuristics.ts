import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import type { AccountKey, RiskHeuristics, RiskHeuristic, ConsolidatedSnapshot } from '../types.js'

/**
 * Risk Heuristics Agent
 * Analyzes consolidated snapshot data to detect deal risks using heuristic rules.
 * Returns a comprehensive risk assessment with severity, evidence, and mitigation steps.
 */
export async function analyzeRiskHeuristics(
	accountKey: AccountKey,
	accountDataDir: string
): Promise<RiskHeuristics> {
	console.log('   Analyzing risk heuristics...')

	const snapshot = await loadLatestSnapshot(accountDataDir)
	const risks = detectAllRisks(snapshot)

	const reviewsDir = join(accountDataDir, 'reviews')
	await mkdir(reviewsDir, { recursive: true })

	const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '')
	const jsonPath = join(reviewsDir, `risk-heuristics-${timestamp}.json`)
	await writeFile(jsonPath, JSON.stringify(risks, null, 2), 'utf-8')

	const mdContent = formatRisksAsMarkdown(risks, accountKey)
	const mdPath = join(reviewsDir, `risk-heuristics-${timestamp}.md`)
	await writeFile(mdPath, mdContent, 'utf-8')

	console.log(`   Saved risk analysis: ${jsonPath}`)
	return risks
}

async function loadLatestSnapshot(accountDataDir: string): Promise<ConsolidatedSnapshot> {
	const snapshotsDir = join(accountDataDir, 'snapshots')
	const { readdir } = await import('fs/promises')
	const files = await readdir(snapshotsDir)
	const snapshotFiles = files.filter((f) => f.startsWith('snapshot-') && f.endsWith('.json'))

	if (snapshotFiles.length === 0) {
		throw new Error('No consolidated snapshot found. Run consolidation first.')
	}

	snapshotFiles.sort().reverse()
	const latestFile = join(snapshotsDir, snapshotFiles[0])

	const content = await readFile(latestFile, 'utf-8')
	return JSON.parse(content)
}

/**
 * Main detection orchestrator - runs all risk detection functions
 */
function detectAllRisks(snapshot: ConsolidatedSnapshot): RiskHeuristics {
	return {
		noChampion: detectNoChampion(snapshot),
		staleNextMeeting: detectStaleNextMeeting(snapshot),
		approachingCloseDate: detectApproachingCloseDate(snapshot),
		blockersPresent: detectBlockers(snapshot),
		lowEngagement: detectLowEngagement(snapshot),
		competitiveThreats: detectCompetitiveThreats(snapshot),
		budgetUnclear: detectBudgetUnclear(snapshot),
		decisionProcessStalled: detectDecisionProcessStalled(snapshot),
	}
}

// ============================================================================
// Individual Risk Detection Functions
// ============================================================================

/**
 * Detect if there's no identified champion or key influencer
 */
function detectNoChampion(snapshot: ConsolidatedSnapshot): RiskHeuristic {
	const champions = snapshot.signals?.champions || []
	const contacts = snapshot.contacts || []

	const hasChampion = champions.length > 0
	const hasInfluencer = contacts.some((c) => 
		c.role?.toLowerCase().includes('champion') || 
		c.role?.toLowerCase().includes('influencer') ||
		c.role?.toLowerCase().includes('sponsor')
	)

	const detected = !hasChampion && !hasInfluencer

	return {
		detected,
		severity: detected ? 'high' : 'low',
		message: detected
			? 'No champion or key influencer identified in this deal'
			: 'Champion identified',
		evidence: detected
			? ['No contacts with champion/influencer/sponsor role', 'No champions listed in signals']
			: champions.length > 0 ? [`Champions: ${champions.join(', ')}`] : ['Champion roles found in contacts'],
		detectedAt: new Date().toISOString(),
		mitigationSteps: detected
			? [
				'Identify a champion who has budget authority or influence',
				'Build relationship with economic buyer or decision maker',
				'Ask: "Who internally is excited about this solution?"',
			]
			: undefined,
	}
}

/**
 * Detect if next meeting is not scheduled or is too far out (>14 days)
 */
function detectStaleNextMeeting(snapshot: ConsolidatedSnapshot): RiskHeuristic {
	const upcomingMeetings = snapshot.upcomingMeetings || []
	const now = new Date()

	const nextMeeting = upcomingMeetings
		.filter((m) => new Date(m.startTime) > now)
		.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0]

	if (!nextMeeting) {
		return {
			detected: true,
			severity: 'high',
			message: 'No upcoming meetings scheduled',
			evidence: ['No meetings found in calendar'],
			detectedAt: new Date().toISOString(),
			mitigationSteps: [
				'Schedule next meeting before end of current call/email',
				'Propose specific times to maintain momentum',
				'Ask: "When can we schedule a follow-up?"',
			],
		}
	}

	const meetingDate = new Date(nextMeeting.startTime)
	const daysUntilMeeting = Math.floor((meetingDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
	const detected = daysUntilMeeting > 14

	return {
		detected,
		severity: detected ? 'medium' : 'low',
		message: detected
			? `Next meeting is ${daysUntilMeeting} days out`
			: `Next meeting scheduled in ${daysUntilMeeting} days`,
		evidence: detected
			? [`Next meeting: ${meetingDate.toLocaleDateString()}`, `${daysUntilMeeting} days until meeting`]
			: [`Next meeting: ${meetingDate.toLocaleDateString()}`],
		detectedAt: new Date().toISOString(),
		threshold: 14,
		mitigationSteps: detected
			? [
				'Schedule an interim check-in or touchpoint',
				'Send value-add content to stay engaged',
				'Ask if there are blockers preventing earlier meeting',
			]
			: undefined,
	}
}

/**
 * Detect if close date is <30 days away but deal is in early stage or low probability
 */
function detectApproachingCloseDate(snapshot: ConsolidatedSnapshot): RiskHeuristic {
	const opportunities = snapshot.opportunities || []
	const now = new Date()

	const atRiskOpps = opportunities.filter((opp) => {
		if (!opp.closeDate) return false

		const closeDate = new Date(opp.closeDate)
		const daysToClose = Math.floor((closeDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))

		if (daysToClose > 30 || daysToClose < 0) return false

		const earlyStage = ['Discovery', 'Qualification', 'Demo', 'Needs Analysis'].some((stage) =>
			opp.stage.toLowerCase().includes(stage.toLowerCase())
		)

		return earlyStage
	})

	const detected = atRiskOpps.length > 0

	return {
		detected,
		severity: detected ? 'critical' : 'low',
		message: detected
			? `${atRiskOpps.length} opportunity(ies) closing soon but in early stage`
			: 'No imminent close date risks',
		evidence: detected
			? atRiskOpps.map((opp) => {
				const closeDate = new Date(opp.closeDate!)
				const daysToClose = Math.floor((closeDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
				return `${opp.name}: ${opp.stage}, closes in ${daysToClose} days`
			})
			: [],
		detectedAt: new Date().toISOString(),
		threshold: 30,
		mitigationSteps: detected
			? [
				'Reassess close date - is it realistic given current stage?',
				'Push close date out or accelerate deal activities',
				'Identify what needs to happen to close on time',
			]
			: undefined,
	}
}

/**
 * Detect active blockers mentioned in signals or call transcripts
 */
function detectBlockers(snapshot: ConsolidatedSnapshot): RiskHeuristic {
	const risks = snapshot.signals?.risks || []
	const recentCalls = snapshot.signals?.recentCallInsights || []

	const blockerKeywords = ['blocker', 'blocked', 'obstacle', 'red flag', 'concern', 'issue', 'problem', 'roadblock']

	const blockerEvidence: string[] = []

	risks.forEach((risk) => {
		if (blockerKeywords.some((kw) => risk.toLowerCase().includes(kw))) {
			blockerEvidence.push(`Risk: ${risk}`)
		}
	})

	recentCalls.forEach((call) => {
		if (call.summary && blockerKeywords.some((kw) => call.summary.toLowerCase().includes(kw))) {
			blockerEvidence.push(`Call ${call.date}: ${call.summary.substring(0, 100)}`)
		}
		if (call.sentiment && ['negative', 'concerned'].includes(call.sentiment.toLowerCase())) {
			blockerEvidence.push(`Call ${call.date}: Negative sentiment detected`)
		}
	})

	const detected = blockerEvidence.length > 0

	return {
		detected,
		severity: detected ? 'high' : 'low',
		message: detected ? `${blockerEvidence.length} blocker(s) detected` : 'No active blockers detected',
		evidence: detected ? blockerEvidence : [],
		detectedAt: new Date().toISOString(),
		mitigationSteps: detected
			? [
				'Address blockers immediately in next conversation',
				'Escalate to senior stakeholders if needed',
				'Document mitigation plan for each blocker',
			]
			: undefined,
	}
}

/**
 * Detect declining engagement based on call frequency or attendance
 */
function detectLowEngagement(snapshot: ConsolidatedSnapshot): RiskHeuristic {
	const recentCalls = snapshot.signals?.recentCallInsights || []

	if (recentCalls.length === 0) {
		return {
			detected: true,
			severity: 'high',
			message: 'No recent call activity',
			evidence: ['No calls found in recent history'],
			detectedAt: new Date().toISOString(),
			mitigationSteps: [
				'Reach out immediately to re-engage',
				'Ask if priorities have changed',
				'Offer value-add content or insights',
			],
		}
	}

	const now = new Date()
	const recentCallDates = recentCalls
		.map((c) => new Date(c.date))
		.sort((a, b) => b.getTime() - a.getTime())

	if (recentCallDates.length === 0) {
		return {
			detected: false,
			severity: 'low',
			message: 'Engagement level unknown',
			evidence: [],
			detectedAt: new Date().toISOString(),
		}
	}

	const lastCallDate = recentCallDates[0]
	const daysSinceLastCall = Math.floor((now.getTime() - lastCallDate.getTime()) / (24 * 60 * 60 * 1000))

	const detected = daysSinceLastCall > 21

	return {
		detected,
		severity: detected ? 'medium' : 'low',
		message: detected
			? `Last call was ${daysSinceLastCall} days ago`
			: `Recent engagement (last call ${daysSinceLastCall} days ago)`,
		evidence: detected
			? [`Last call: ${lastCallDate.toLocaleDateString()}`, `${daysSinceLastCall} days since last call`]
			: [`Last call: ${lastCallDate.toLocaleDateString()}`],
		detectedAt: new Date().toISOString(),
		threshold: 21,
		mitigationSteps: detected
			? [
				'Schedule a catch-up call or check-in',
				'Send personalized message to re-engage',
				'Assess if deal is still active',
			]
			: undefined,
	}
}

/**
 * Detect competitive threats from mentions in calls or signals
 */
function detectCompetitiveThreats(snapshot: ConsolidatedSnapshot): RiskHeuristic {
	const competitiveMentions = snapshot.signals?.competitiveMentions || []
	const recentCalls = snapshot.signals?.recentCallInsights || []

	const competitorKeywords = ['competitor', 'alternative', 'versus', 'comparing', 'evaluating']

	const threatEvidence: string[] = []

	competitiveMentions.forEach((mention) => {
		threatEvidence.push(`Competitor mentioned: ${mention}`)
	})

	recentCalls.forEach((call) => {
		if (call.summary && competitorKeywords.some((kw) => call.summary.toLowerCase().includes(kw))) {
			threatEvidence.push(`Call ${call.date}: Competitive discussion detected`)
		}
		if (call.topics && call.topics.some((t) => competitorKeywords.some((kw) => t.toLowerCase().includes(kw)))) {
			threatEvidence.push(`Call ${call.date}: Competitive topics discussed`)
		}
	})

	const detected = threatEvidence.length > 0

	return {
		detected,
		severity: detected ? 'medium' : 'low',
		message: detected
			? `${threatEvidence.length} competitive signal(s) detected`
			: 'No competitive threats detected',
		evidence: detected ? threatEvidence : [],
		detectedAt: new Date().toISOString(),
		mitigationSteps: detected
			? [
				'Prepare competitive battle card and differentiation talking points',
				'Ask: "What are you comparing us against?"',
				'Emphasize unique value propositions and customer wins',
			]
			: undefined,
	}
}

/**
 * Detect unclear or stalled budget discussions
 */
function detectBudgetUnclear(snapshot: ConsolidatedSnapshot): RiskHeuristic {
	const opportunities = snapshot.opportunities || []
	const recentCalls = snapshot.signals?.recentCallInsights || []
	const objections = snapshot.signals?.objections || []

	const budgetKeywords = ['budget', 'pricing', 'cost', 'price', 'expensive', 'affordability']
	const stalledKeywords = ['waiting', 'pending', 'unclear', 'tbd', 'not sure']

	const budgetEvidence: string[] = []

	opportunities.forEach((opp) => {
		if (!opp.amount || opp.amount === 0) {
			budgetEvidence.push(`${opp.name}: No deal amount set`)
		}
	})

	objections.forEach((obj) => {
		if (budgetKeywords.some((kw) => obj.toLowerCase().includes(kw))) {
			budgetEvidence.push(`Objection: ${obj}`)
		}
	})

	recentCalls.forEach((call) => {
		if (call.summary && budgetKeywords.some((kw) => call.summary.toLowerCase().includes(kw))) {
			const hasStalled = stalledKeywords.some((kw) => call.summary.toLowerCase().includes(kw))
			if (hasStalled) {
				budgetEvidence.push(`Call ${call.date}: Budget discussion stalled`)
			}
		}
	})

	const detected = budgetEvidence.length > 0

	return {
		detected,
		severity: detected ? 'medium' : 'low',
		message: detected ? `${budgetEvidence.length} budget signal(s) detected` : 'Budget discussions clear',
		evidence: detected ? budgetEvidence : [],
		detectedAt: new Date().toISOString(),
		mitigationSteps: detected
			? [
				'Ask: "What budget has been allocated for this initiative?"',
				'Discuss ROI and business case to justify investment',
				'Identify who controls budget and get them engaged',
			]
			: undefined,
	}
}

/**
 * Detect stalled decision process (security review, legal, procurement)
 */
function detectDecisionProcessStalled(snapshot: ConsolidatedSnapshot): RiskHeuristic {
	const recentCalls = snapshot.signals?.recentCallInsights || []
	const nextActions = snapshot.signals?.nextActions || []
	const risks = snapshot.signals?.risks || []

	const processKeywords = ['security', 'legal', 'procurement', 'compliance', 'review', 'approval']
	const stalledKeywords = ['pending', 'waiting', 'delayed', 'stuck', 'slow', 'hold']

	const stallEvidence: string[] = []

	recentCalls.forEach((call) => {
		if (call.summary) {
			const hasProcess = processKeywords.some((kw) => call.summary.toLowerCase().includes(kw))
			const hasStalled = stalledKeywords.some((kw) => call.summary.toLowerCase().includes(kw))
			if (hasProcess && hasStalled) {
				stallEvidence.push(`Call ${call.date}: Decision process appears stalled`)
			}
		}
	})

	nextActions.forEach((action) => {
		const hasProcess = processKeywords.some((kw) => action.toLowerCase().includes(kw))
		const hasStalled = stalledKeywords.some((kw) => action.toLowerCase().includes(kw))
		if (hasProcess && hasStalled) {
			stallEvidence.push(`Next action: ${action}`)
		}
	})

	risks.forEach((risk) => {
		const hasProcess = processKeywords.some((kw) => risk.toLowerCase().includes(kw))
		if (hasProcess) {
			stallEvidence.push(`Risk: ${risk}`)
		}
	})

	const detected = stallEvidence.length > 0

	return {
		detected,
		severity: detected ? 'high' : 'low',
		message: detected
			? `${stallEvidence.length} decision process risk(s) detected`
			: 'No decision process risks detected',
		evidence: detected ? stallEvidence : [],
		detectedAt: new Date().toISOString(),
		mitigationSteps: detected
			? [
				'Identify specific approval gates and timeline for each',
				'Ask: "What are the steps to get final approval?"',
				'Offer to support security/legal reviews with documentation',
				'Escalate to executive sponsor if process is stuck',
			]
			: undefined,
	}
}

// ============================================================================
// Formatting
// ============================================================================

function formatRisksAsMarkdown(risks: RiskHeuristics, accountKey: AccountKey): string {
	const lines: string[] = []

	lines.push(`# Risk Heuristics: ${accountKey.name}`)
	lines.push(`Generated: ${new Date().toISOString()}`)
	lines.push('')

	const riskEntries = Object.entries(risks) as [string, RiskHeuristic][]
	const detectedRisks = riskEntries.filter(([_, r]) => r.detected)

	lines.push(`## Summary`)
	lines.push(`- **Total Risks Detected**: ${detectedRisks.length}`)
	lines.push(`- **Critical**: ${detectedRisks.filter(([_, r]) => r.severity === 'critical').length}`)
	lines.push(`- **High**: ${detectedRisks.filter(([_, r]) => r.severity === 'high').length}`)
	lines.push(`- **Medium**: ${detectedRisks.filter(([_, r]) => r.severity === 'medium').length}`)
	lines.push(`- **Low**: ${detectedRisks.filter(([_, r]) => r.severity === 'low').length}`)
	lines.push('')

	if (detectedRisks.length === 0) {
		lines.push(`## ✅ No Risks Detected`)
		lines.push(`All risk heuristics passed. Deal appears healthy.`)
		return lines.join('\n')
	}

	lines.push(`## Detected Risks`)
	lines.push('')

	const sortedRisks = detectedRisks.sort((a, b) => {
		const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
		return severityOrder[a[1].severity] - severityOrder[b[1].severity]
	})

	for (const [name, risk] of sortedRisks) {
		const emoji = {
			critical: '🔴',
			high: '🟠',
			medium: '🟡',
			low: '🟢',
		}[risk.severity]

		lines.push(`### ${emoji} ${formatRiskName(name)} (${risk.severity.toUpperCase()})`)
		lines.push(`**Message**: ${risk.message}`)
		lines.push('')

		if (risk.evidence.length > 0) {
			lines.push(`**Evidence**:`)
			risk.evidence.forEach((e) => lines.push(`- ${e}`))
			lines.push('')
		}

		if (risk.mitigationSteps && risk.mitigationSteps.length > 0) {
			lines.push(`**Mitigation Steps**:`)
			risk.mitigationSteps.forEach((step) => lines.push(`- ${step}`))
			lines.push('')
		}
	}

	return lines.join('\n')
}

function formatRiskName(camelCase: string): string {
	return camelCase
		.replace(/([A-Z])/g, ' $1')
		.replace(/^./, (str) => str.toUpperCase())
		.trim()
}

// Export for use in API and CLI
export { detectAllRisks, loadLatestSnapshot }
