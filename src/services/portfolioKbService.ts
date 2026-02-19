/**
 * Portfolio Knowledge Base Service
 * 
 * Extracts patterns from all Gong calls to build a portfolio-level knowledge base.
 * Identifies common use cases, objections, success factors, and competitors.
 */

import { writeFileSync, readFileSync, existsSync } from 'fs'
import type { ParquetGongCall } from '../clients/gongParquetClient.js'
import { queryPortfolioCallsFromParquet } from '../clients/gongParquetClient.js'

export interface PortfolioKnowledgeBase {
	version: 1
	generatedAt: string
	callsAnalyzed: number
	useCases: UseCase[]
	objections: ObjectionPattern[]
	successFactors: SuccessFactor[]
	competitors: CompetitorMention[]
	summary: {
		topUseCases: string[]
		topObjections: string[]
		mostMentionedCompetitors: string[]
		commonSuccessThemes: string[]
	}
}

export interface UseCase {
	category: string
	description: string
	frequency: number
	keywords: string[]
	callExamples: string[] // Call IDs
	contexts: string[] // Brief snippets where mentioned
}

export interface ObjectionPattern {
	objection: string
	frequency: number
	resolution?: string
	howResolved?: string
	keywords: string[]
	callExamples: string[]
	successRate?: 'high' | 'medium' | 'low'
}

export interface SuccessFactor {
	factor: string
	description: string
	frequency: number
	keywords: string[]
	callExamples: string[]
	relatedUseCases: string[]
}

export interface CompetitorMention {
	competitor: string
	frequency: number
	context: 'lost_to' | 'evaluated_with' | 'mentioned' | 'replaced'
	keywords: string[]
	callExamples: string[]
}

/**
 * Extract portfolio patterns from Gong calls
 */
export async function extractPortfolioPatterns(
	outputPath: string
): Promise<PortfolioKnowledgeBase> {
	console.log('📊 Extracting portfolio patterns from Gong calls...')

	// Query all calls with transcripts
	const calls = await queryPortfolioCallsFromParquet({
		minTranscriptLength: 100,
	})

	console.log(`   ✓ Retrieved ${calls.length} calls with transcripts`)

	// Extract patterns using heuristic-based analysis
	const useCases = extractUseCases(calls)
	const objections = extractObjections(calls)
	const successFactors = extractSuccessFactors(calls)
	const competitors = extractCompetitors(calls)

	const kb: PortfolioKnowledgeBase = {
		version: 1,
		generatedAt: new Date().toISOString(),
		callsAnalyzed: calls.length,
		useCases,
		objections,
		successFactors,
		competitors,
		summary: {
			topUseCases: useCases
				.sort((a, b) => b.frequency - a.frequency)
				.slice(0, 5)
				.map((u) => u.category),
			topObjections: objections
				.sort((a, b) => b.frequency - a.frequency)
				.slice(0, 5)
				.map((o) => o.objection),
			mostMentionedCompetitors: competitors
				.sort((a, b) => b.frequency - a.frequency)
				.slice(0, 5)
				.map((c) => c.competitor),
			commonSuccessThemes: successFactors
				.sort((a, b) => b.frequency - a.frequency)
				.slice(0, 5)
				.map((s) => s.factor),
		},
	}

	// Save KB
	writeFileSync(outputPath, JSON.stringify(kb, null, 2))
	console.log(`   ✓ Portfolio KB saved: ${outputPath}`)

	return kb
}

/**
 * Extract use cases from call transcripts
 */
function extractUseCases(calls: ParquetGongCall[]): UseCase[] {
	const useCaseMap = new Map<string, UseCase>()

	const useCasePatterns = [
		{
			category: 'Code Search',
			keywords: ['code search', 'searching code', 'find code', 'grep', 'search repository'],
		},
		{
			category: 'Batch Changes',
			keywords: ['batch change', 'mass update', 'refactor at scale', 'apply change'],
		},
		{
			category: 'Code Insights',
			keywords: ['code insight', 'analytics', 'code health', 'quality metrics'],
		},
		{
			category: 'Deep Search',
			keywords: ['deep search', 'semantic search', 'ai search'],
		},
		{
			category: 'Code Intelligence',
			keywords: ['code intelligence', 'navigation', 'hover info', 'go to definition'],
		},
		{
			category: 'DevSecOps',
			keywords: ['security', 'vulnerability', 'secret', 'compliance'],
		},
		{
			category: 'Migration',
			keywords: ['migration', 'upgrade', 'version', 'modernize'],
		},
		{
			category: 'Monorepo Management',
			keywords: ['monorepo', 'multi-repo', 'large codebase'],
		},
	]

	for (const call of calls) {
		const text = `${call.title} ${call.transcript_text || ''}`.toLowerCase()

		for (const pattern of useCasePatterns) {
			const mentioned = pattern.keywords.some((kw) => text.includes(kw.toLowerCase()))
			if (mentioned) {
				const existing = useCaseMap.get(pattern.category) || {
					category: pattern.category,
					description: `${pattern.category} use case`,
					frequency: 0,
					keywords: pattern.keywords,
					callExamples: [],
					contexts: [],
				}

				existing.frequency++
				existing.callExamples.push(String(call.call_id))
				// Extract snippet (max 150 chars)
				const keywordMatches = pattern.keywords.filter((kw) =>
					text.includes(kw.toLowerCase())
				)
				if (keywordMatches.length > 0) {
					const idx = text.indexOf(keywordMatches[0].toLowerCase())
					const snippet = text.substring(Math.max(0, idx - 50), idx + 100)
					existing.contexts.push(snippet.trim())
				}

				useCaseMap.set(pattern.category, existing)
			}
		}
	}

	return Array.from(useCaseMap.values())
}

/**
 * Extract objections and resolution patterns
 */
function extractObjections(calls: ParquetGongCall[]): ObjectionPattern[] {
	const objectionMap = new Map<string, ObjectionPattern>()

	const objectionPatterns = [
		{
			objection: 'Cost / Budget Concerns',
			keywords: [
				'cost',
				'price',
				'budget',
				'expensive',
				'investment',
				'roi',
				'payback',
			],
			resolutionKeywords: ['free trial', 'pilot', 'discount', 'discount', 'value', 'save time'],
		},
		{
			objection: 'Integration Complexity',
			keywords: ['integration', 'api', 'plugin', 'compatible', 'toolchain', 'setup'],
			resolutionKeywords: ['easy integration', 'rest api', 'plugin', 'deploy', 'automated'],
		},
		{
			objection: 'Data Privacy / Security',
			keywords: [
				'security',
				'privacy',
				'compliance',
				'soc2',
				'gdpr',
				'hipaa',
				'encrypt',
				'trust',
			],
			resolutionKeywords: [
				'soc2 certified',
				'encryption',
				'on-premise',
				'compliance',
				'audit',
			],
		},
		{
			objection: 'Existing Tool Satisfaction',
			keywords: ['already have', 'using', 'current tool', 'alternative', 'competing'],
			resolutionKeywords: ['better than', 'more powerful', 'faster', 'cheaper'],
		},
		{
			objection: 'User Adoption / Training',
			keywords: ['learning curve', 'train', 'adoption', 'team', 'learning', 'difficult'],
			resolutionKeywords: ['easy to learn', 'training', 'documentation', 'support'],
		},
		{
			objection: 'Performance / Scale Concerns',
			keywords: ['performance', 'slow', 'large', 'scale', 'latency', 'big codebase'],
			resolutionKeywords: ['fast', 'scalable', 'optimized', 'handles large'],
		},
	]

	for (const call of calls) {
		const text = `${call.title} ${call.transcript_text || ''}`.toLowerCase()

		for (const pattern of objectionPatterns) {
			const hasObjection = pattern.keywords.some((kw) => text.includes(kw.toLowerCase()))
			if (hasObjection) {
				const existing = objectionMap.get(pattern.objection) || {
					objection: pattern.objection,
					frequency: 0,
					keywords: pattern.keywords,
					callExamples: [],
				}

				existing.frequency++
				existing.callExamples.push(String(call.call_id))

				// Check if resolution is present
				const hasResolution = pattern.resolutionKeywords.some((kw) =>
					text.includes(kw.toLowerCase())
				)
				if (hasResolution) {
					existing.successRate = 'high'
					if (!existing.howResolved) {
						const resKw = pattern.resolutionKeywords.find((kw) =>
							text.includes(kw.toLowerCase())
						)
						if (resKw) {
							const idx = text.indexOf(resKw.toLowerCase())
							existing.howResolved = text
								.substring(Math.max(0, idx - 50), idx + 100)
								.trim()
						}
					}
				}

				objectionMap.set(pattern.objection, existing)
			}
		}
	}

	return Array.from(objectionMap.values())
}

/**
 * Extract success factors
 */
function extractSuccessFactors(calls: ParquetGongCall[]): SuccessFactor[] {
	const factorMap = new Map<string, SuccessFactor>()

	const successPatterns = [
		{
			factor: 'Executive Sponsorship',
			keywords: [
				'cto',
				'ceo',
				'executive',
				'director',
				'vp',
				'senior leadership',
				'executive sponsor',
			],
		},
		{
			factor: 'Technical Champion',
			keywords: ['engineer', 'developer', 'architect', 'technical lead', 'champion'],
		},
		{
			factor: 'Early Wins / Proof of Value',
			keywords: ['poc', 'pilot', 'quick win', 'demo', 'proof', 'case study'],
		},
		{
			factor: 'Team Alignment',
			keywords: ['alignment', 'team', 'stakeholder', 'consensus', 'buy-in'],
		},
		{
			factor: 'Internal Advocacy',
			keywords: ['advocate', 'champion', 'sponsor', 'push from within', 'internal'],
		},
		{
			factor: 'Competitive Pressure',
			keywords: ['competitive', 'losing deals', 'losing to', 'need to act'],
		},
		{
			factor: 'Regulatory / Compliance Driver',
			keywords: ['comply', 'audit', 'regulated', 'mandate', 'requirement'],
		},
	]

	for (const call of calls) {
		const text = `${call.title} ${call.transcript_text || ''}`.toLowerCase()

		for (const pattern of successPatterns) {
			const mentioned = pattern.keywords.some((kw) => text.includes(kw.toLowerCase()))
			if (mentioned) {
				const existing = factorMap.get(pattern.factor) || {
					factor: pattern.factor,
					description: `${pattern.factor}`,
					frequency: 0,
					keywords: pattern.keywords,
					callExamples: [],
					relatedUseCases: [],
				}

				existing.frequency++
				existing.callExamples.push(String(call.call_id))

				factorMap.set(pattern.factor, existing)
			}
		}
	}

	return Array.from(factorMap.values())
}

/**
 * Extract competitor mentions
 */
function extractCompetitors(calls: ParquetGongCall[]): CompetitorMention[] {
	const competitorMap = new Map<string, CompetitorMention>()

	const competitors = [
		'github',
		'gitlab',
		'bitbucket',
		'aws',
		'azure',
		'google cloud',
		'jira',
		'confluence',
		'slack',
		'teams',
		'jenkins',
		'circleci',
		'datadog',
		'splunk',
		'elastic',
		'newrelic',
		'dynatrace',
	]

	for (const call of calls) {
		const text = `${call.title} ${call.transcript_text || ''}`.toLowerCase()

		for (const competitor of competitors) {
			if (text.includes(competitor.toLowerCase())) {
				const existing = competitorMap.get(competitor) || {
					competitor,
					frequency: 0,
					context: 'mentioned',
					keywords: [competitor],
					callExamples: [],
				}

				existing.frequency++
				existing.callExamples.push(String(call.call_id))

				// Try to infer context
				if (text.includes('lost to ' + competitor) || text.includes('lost ' + competitor)) {
					existing.context = 'lost_to'
				} else if (
					text.includes('evaluated ' + competitor) ||
					text.includes('vs ' + competitor)
				) {
					existing.context = 'evaluated_with'
				} else if (
					text.includes('replacing ' + competitor) ||
					text.includes('replace ' + competitor)
				) {
					existing.context = 'replaced'
				}

				competitorMap.set(competitor, existing)
			}
		}
	}

	return Array.from(competitorMap.values()).filter((c) => c.frequency >= 2) // Only include if mentioned 2+ times
}

/**
 * Load existing portfolio KB
 */
export function loadPortfolioKb(kbPath: string): PortfolioKnowledgeBase | null {
	if (!existsSync(kbPath)) {
		return null
	}

	try {
		const content = readFileSync(kbPath, 'utf-8')
		return JSON.parse(content)
	} catch (error) {
		console.error(`Failed to load portfolio KB: ${error}`)
		return null
	}
}
