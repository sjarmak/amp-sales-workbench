import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { executeWithMode } from '../lib/amp-executor.js'
import type {
	AccountKey,
	IngestedData,
	ConsolidatedSnapshot,
} from '../types.js'
import { createGongSfdcLinks, getLinkageStats } from './consolidate/gongSfdcLinker.js'
import { buildInteractionTimeline, getTimelineStats } from './consolidate/interactionTimeline.js'
import { createDataLayerService } from '../services/dataLayerService.js'

export async function consolidateData(
	accountKey: AccountKey,
	ingestedData: IngestedData,
	accountDataDir: string
): Promise<ConsolidatedSnapshot> {
	console.log('   Merging data sources with AI...')

	// RFC Phase 1: Create Gong-SFDC links before AI consolidation
	const gongSfdcLinks = await createGongSfdcLinks(ingestedData, accountKey.salesforceId)
	if (gongSfdcLinks.length > 0) {
		const stats = getLinkageStats(gongSfdcLinks)
		console.log(`   ✓ Linked ${stats.total} Gong calls to Salesforce (${stats.linkedToOpportunity} to opportunities)`)
	}

	// RFC Phase 2: Build unified interaction timeline
	const interactionTimeline = await buildInteractionTimeline(ingestedData, gongSfdcLinks)
	if (interactionTimeline.interactions.length > 0) {
		const timelineStats = getTimelineStats(interactionTimeline)
		console.log(`   ✓ Built interaction timeline: ${timelineStats.total} interactions (${interactionTimeline.interactionCounts.calls} calls, ${interactionTimeline.interactionCounts.emails} emails)`)
	}

	// Load consolidation prompt
	const promptPath = join(process.cwd(), 'prompts/consolidate.md')
	const promptTemplate = await readFile(promptPath, 'utf-8')

	// Load prospecting data if available
	const prospectingData = await loadProspectingData(accountDataDir)

	// Load portfolio KB for agent context
	let portfolioKb: any = null
	try {
		const dataLayer = await createDataLayerService(process.cwd())
		portfolioKb = dataLayer.getPortfolioKb()
		if (portfolioKb) {
			console.log(
				`   ✓ Portfolio KB loaded: ${portfolioKb.callsAnalyzed} calls analyzed, ${portfolioKb.useCases.length} use cases`
			)
		}
	} catch (error) {
		// Portfolio KB is optional
		console.log(
			`   ℹ️  Portfolio KB not available: ${error instanceof Error ? error.message : 'Unknown error'}`
		)
	}

	// Build context for AI (include Gong-SFDC links, timeline summary, and portfolio KB)
	const context = buildConsolidationContext(
		accountKey,
		ingestedData,
		prospectingData,
		gongSfdcLinks,
		interactionTimeline,
		portfolioKb
	)

	// Execute consolidation with Amp SDK
	const snapshot = await executeConsolidation(promptTemplate, context)

	// Add Gong-SFDC links and timeline to snapshot
	snapshot.gongSfdcLinks = gongSfdcLinks
	snapshot.interactionTimeline = interactionTimeline

	// Enrich snapshot with data layer information (company context + Gong linkage)
	try {
		const dataLayer = await createDataLayerService(process.cwd())
		if (accountKey.salesforceId) {
			const enrichedAccount = dataLayer.enrichAccountWithGongCalls(accountKey.salesforceId)
			if (enrichedAccount) {
				// Add company context to account profile
				snapshot.accountProfile = {
					...snapshot.accountProfile,
					industry: enrichedAccount.industry || snapshot.accountProfile.industry,
					employees: enrichedAccount.number_of_employees || undefined,
					revenue: enrichedAccount.annual_revenue || undefined,
					website: enrichedAccount.website || undefined,
					domain: enrichedAccount.company_domain_name_c || snapshot.accountProfile.domain,
				}
				
				// Add linked Gong calls to snapshot metadata if available
				if (enrichedAccount.gong_calls) {
					snapshot.dataLayerEnrichment = {
						gongCalls: enrichedAccount.gong_calls,
						linkedAt: new Date().toISOString(),
					}
				}
			}
		}
	} catch (error) {
		// Data layer enrichment is optional - don't fail consolidation if it's unavailable
		console.log(
			`   ℹ️  Data layer enrichment skipped: ${error instanceof Error ? error.message : 'Unknown error'}`
		)
	}

	// Save snapshot
	const snapshotsDir = join(accountDataDir, 'snapshots')
	await mkdir(snapshotsDir, { recursive: true })

	const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '')
	const snapshotFile = join(snapshotsDir, `snapshot-${timestamp}.json`)

	await writeFile(snapshotFile, JSON.stringify(snapshot, null, 2), 'utf-8')
	console.log(`   Saved snapshot: ${snapshotFile}`)

	return snapshot
}

async function loadProspectingData(
	accountDataDir: string
): Promise<any | null> {
	try {
		const prospectingDir = join(accountDataDir, 'prospecting')
		// Try to load latest prospecting results
		// amp-prospector typically creates files like company-profile.json, news.json, etc.
		const profilePath = join(prospectingDir, 'company-profile.json')
		const content = await readFile(profilePath, 'utf-8')
		return JSON.parse(content)
	} catch (error) {
		return null
	}
}

function buildConsolidationContext(
	accountKey: AccountKey,
	ingestedData: IngestedData,
	prospectingData: any,
	gongSfdcLinks?: import('../types.js').GongSfdcLink[],
	interactionTimeline?: import('../types.js').InteractionTimeline,
	portfolioKb?: any
): string {
	const sections: string[] = []
	const dataGaps: string[] = []

	sections.push(`# Account: ${accountKey.name}`)
	if (accountKey.domain) {
		sections.push(`Domain: ${accountKey.domain}`)
	}
	if (accountKey.salesforceId) {
		sections.push(`Salesforce ID: ${accountKey.salesforceId}`)
	}
	sections.push('')

	// Prospect Research
	if (prospectingData) {
		sections.push('## Prospect Research Data')
		sections.push('```json')
		sections.push(JSON.stringify(prospectingData, null, 2))
		sections.push('```')
		sections.push('')
	}

	// Salesforce
	if (ingestedData.salesforce && !ingestedData.salesforce.warning) {
		sections.push('## Salesforce Data')
		sections.push('```json')
		sections.push(JSON.stringify(ingestedData.salesforce, null, 2))
		sections.push('```')
		sections.push('')
	} else {
		dataGaps.push('Salesforce')
	}

	// Gong
	if (ingestedData.gong && ingestedData.gong.calls && !ingestedData.gong.warning) {
		sections.push('## Gong Call Data')
		sections.push('```json')
		sections.push(JSON.stringify(ingestedData.gong, null, 2))
		sections.push('```')
		sections.push('')
	} else {
		dataGaps.push('Gong')
	}

	// Gong-SFDC Linkage (RFC Phase 1)
	if (gongSfdcLinks && gongSfdcLinks.length > 0) {
		sections.push('## Gong-Salesforce Linkage')
		sections.push('The following Gong calls have been linked to Salesforce records:')
		sections.push('```json')
		sections.push(JSON.stringify(gongSfdcLinks, null, 2))
		sections.push('```')
		sections.push('')
	}

	// Interaction Timeline Summary (RFC Phase 2)
	if (interactionTimeline && interactionTimeline.interactions.length > 0) {
		sections.push('## Unified Interaction Timeline')
		sections.push(`**Summary:** ${interactionTimeline.recentActivitySummary}`)
		sections.push(`**Last Interaction:** ${interactionTimeline.lastInteractionDate || 'Unknown'}`)
		sections.push(`**Counts:** ${interactionTimeline.interactionCounts.calls} calls, ${interactionTimeline.interactionCounts.emails} emails, ${interactionTimeline.interactionCounts.meetings} meetings`)
		sections.push('')
		// Include recent interactions (last 10) for context
		const recentInteractions = interactionTimeline.interactions.slice(0, 10)
		sections.push('**Recent Interactions:**')
		sections.push('```json')
		sections.push(JSON.stringify(recentInteractions, null, 2))
		sections.push('```')
		sections.push('')
	}

	// Notion
	if (ingestedData.notion && ingestedData.notion.relatedPages && !ingestedData.notion.warning) {
		sections.push('## Notion Knowledge Base')
		sections.push('```json')
		sections.push(JSON.stringify(ingestedData.notion, null, 2))
		sections.push('```')
		sections.push('')
	} else {
		dataGaps.push('Notion')
	}

	// Portfolio Knowledge Base (Portfolio-level patterns for context)
	if (portfolioKb && portfolioKb.summary) {
		sections.push('## Portfolio Context (Cross-Account Patterns)')
		sections.push(`Analyzed ${portfolioKb.callsAnalyzed} customer calls to identify portfolio patterns.`)
		sections.push('')
		sections.push('**Top Use Cases in Portfolio:**')
		portfolioKb.summary.topUseCases.forEach((uc: string) => sections.push(`- ${uc}`))
		sections.push('')
		sections.push('**Common Objections (and How We Overcome Them):**')
		portfolioKb.summary.topObjections.forEach((obj: string) => sections.push(`- ${obj}`))
		sections.push('')
		sections.push('**Success Factors for Deals:**')
		portfolioKb.summary.commonSuccessThemes.forEach((theme: string) => sections.push(`- ${theme}`))
		sections.push('')
		sections.push('**Competitors to Be Aware Of:**')
		portfolioKb.summary.mostMentionedCompetitors.forEach((comp: string) => sections.push(`- ${comp}`))
		sections.push('')
	}

	// Add data gap notice
	if (dataGaps.length > 0) {
		sections.push(`\n⚠️  **Data Gaps**: Missing data from ${dataGaps.join(', ')}. Consolidation will be based on available sources only.\n`)
	}

	return sections.join('\n')
}

async function executeConsolidation(
	promptTemplate: string,
	context: string
): Promise<ConsolidatedSnapshot> {
	const fullPrompt = `${promptTemplate}\n\n---\n\n${context}\n\nPlease consolidate this data into a ConsolidatedSnapshot JSON object.`

	let accumulatedText = ''

	// Execute with Amp SDK in fast mode (data consolidation is straightforward)
	for await (const message of executeWithMode({
		prompt: fullPrompt,
		mode: 'fast',
	})) {
		if (message.type === 'assistant') {
			// Extract text from content array
			for (const block of message.message.content) {
				if (block.type === 'text') {
					accumulatedText += block.text
				}
			}
			process.stdout.write('.') // Progress indicator
		}
	}

	console.log('') // New line after progress dots

	// Parse JSON from response
	const snapshot = parseConsolidatedSnapshot(accumulatedText)

	return snapshot
}

function parseConsolidatedSnapshot(text: string): ConsolidatedSnapshot {
	// Extract JSON from markdown code blocks if present
	const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/)
	const jsonText = jsonMatch ? jsonMatch[1] : text

	try {
		return JSON.parse(jsonText)
	} catch (error) {
		throw new Error(
			`Failed to parse consolidated snapshot: ${error instanceof Error ? error.message : 'Unknown error'}`
		)
	}
}
