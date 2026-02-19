/**
 * Portfolio Knowledge Base Builder
 * 
 * Merges batch analysis results, deduplicates patterns, scores them,
 * and builds the final knowledge base for agent injection
 */

import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import type {
  BatchAnalysisResult,
  GlobalKnowledgeBase,
  UseCase,
  Objection,
  SuccessFactor,
  CompetitorMention,
  SegmentProfile,
} from './types.js'

const PORTFOLIO_DIR = 'data/global'

/**
 * Build portfolio knowledge base from batch analysis results
 */
export async function buildPortfolioKnowledgeBase(
  batchResults: BatchAnalysisResult[],
  sourceCallCount: number,
  sourceAccounts: string[] = []
): Promise<GlobalKnowledgeBase> {
  console.log('\n🏗️  Building Portfolio Knowledge Base...')

  // Merge all batch results
  const allUseCases = batchResults.flatMap((b) => b.useCases)
  const allObjections = batchResults.flatMap((b) => b.objections)
  const allSuccessFactors = batchResults.flatMap((b) => b.successFactors)
  const allCompetitors = batchResults.flatMap((b) => b.competitors)
  const allSegments = batchResults.flatMap((b) => b.segments)

  console.log(`   Raw patterns: ${allUseCases.length} use cases, ${allObjections.length} objections, ${allSuccessFactors.length} success factors`)

  // Deduplicate and score
  const useCases = deduplicateAndScoreUseCases(allUseCases)
  const objections = deduplicateAndScoreObjections(allObjections)
  const successFactors = deduplicateAndScoreSuccessFactors(allSuccessFactors)
  const competitors = deduplicateAndScoreCompetitors(allCompetitors)
  const segments = deduplicateAndScoreSegments(allSegments)

  console.log(`   Deduplicated: ${useCases.length} use cases, ${objections.length} objections, ${successFactors.length} success factors`)

  // Generate context documents
  const contextDocuments = {
    featuresOverview: generateFeaturesOverview(useCases),
    competitiveContext: generateCompetitiveContext(competitors),
    segmentProfiles: generateSegmentProfiles(segments),
    objectionPlaybook: generateObjectionPlaybook(objections),
    successStories: generateSuccessStories(useCases, segments),
  }

  // Build cross-reference matrices
  const matrices = {
    featureByIndustry: buildFeatureByIndustryMatrix(segments, useCases),
    objectionBySegment: buildObjectionBySegmentMatrix(segments),
    useCaseByFeature: buildUseCaseByFeatureMatrix(useCases),
  }

  // Assemble KB
  const kb: GlobalKnowledgeBase = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    sourceCallCount,
    sourceAccountCount: sourceAccounts.length,
    patterns: {
      useCases,
      objections,
      successFactors,
      competitorMentions: competitors,
      segments,
    },
    contextDocuments,
    matrices,
  }

  // Save to disk
  const outputPath = join(PORTFOLIO_DIR, 'knowledge_base.json')
  await mkdir(PORTFOLIO_DIR, { recursive: true })
  await writeFile(outputPath, JSON.stringify(kb, null, 2), 'utf-8')
  console.log(`   ✓ Saved to ${outputPath}`)

  return kb
}

/**
 * Deduplicate use cases by fuzzy matching and sum frequencies
 */
function deduplicateAndScoreUseCases(useCases: UseCase[]): UseCase[] {
  const grouped = new Map<string, UseCase[]>()

  // Group by similarity
  for (const uc of useCases) {
    let found = false
    for (const [key, group] of grouped) {
      if (fuzzyMatch(uc.title, key) > 0.7) {
        group.push(uc)
        found = true
        break
      }
    }
    if (!found) {
      grouped.set(uc.title, [uc])
    }
  }

  // Merge groups
  return Array.from(grouped.values())
    .map((group) => ({
      ...group[0],
      frequency: group.reduce((sum, uc) => sum + uc.frequency, 0),
      exampleQuotes: [...new Set(group.flatMap((uc) => uc.exampleQuotes))].slice(0, 5),
      relatedIndustries: [...new Set(group.flatMap((uc) => uc.relatedIndustries))],
      relatedFeatures: [...new Set(group.flatMap((uc) => uc.relatedFeatures))],
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 50) // Top 50
}

/**
 * Deduplicate objections and sum frequencies
 */
function deduplicateAndScoreObjections(objections: Objection[]): Objection[] {
  const grouped = new Map<string, Objection[]>()

  for (const obj of objections) {
    let found = false
    for (const [key, group] of grouped) {
      if (fuzzyMatch(obj.description, key) > 0.7) {
        group.push(obj)
        found = true
        break
      }
    }
    if (!found) {
      grouped.set(obj.description, [obj])
    }
  }

  return Array.from(grouped.values())
    .map((group) => ({
      ...group[0],
      frequency: group.reduce((sum, obj) => sum + obj.frequency, 0),
      exampleQuotes: [...new Set(group.flatMap((obj) => obj.exampleQuotes))].slice(0, 3),
      rebuttalSuggestions: [...new Set(group.flatMap((obj) => obj.rebuttalSuggestions))],
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 30)
}

/**
 * Deduplicate success factors and sum weights
 */
function deduplicateAndScoreSuccessFactors(factors: SuccessFactor[]): SuccessFactor[] {
  const grouped = new Map<string, SuccessFactor[]>()

  for (const sf of factors) {
    let found = false
    for (const [key, group] of grouped) {
      if (fuzzyMatch(sf.title, key) > 0.7) {
        group.push(sf)
        found = true
        break
      }
    }
    if (!found) {
      grouped.set(sf.title, [sf])
    }
  }

  return Array.from(grouped.values())
    .map((group) => ({
      ...group[0],
      weight: Math.min(1.0, group.reduce((sum, sf) => sum + sf.weight, 0) / group.length),
      relatedUseCases: [...new Set(group.flatMap((sf) => sf.relatedUseCases))],
      relatedFeatures: [...new Set(group.flatMap((sf) => sf.relatedFeatures))],
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 20)
}

/**
 * Deduplicate competitors and sum frequencies
 */
function deduplicateAndScoreCompetitors(competitors: CompetitorMention[]): CompetitorMention[] {
  const grouped = new Map<string, CompetitorMention[]>()

  for (const comp of competitors) {
    const key = comp.competitorName.toLowerCase()
    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key)!.push(comp)
  }

  return Array.from(grouped.values())
    .map((group) => ({
      ...group[0],
      frequency: group.reduce((sum, comp) => sum + comp.frequency, 0),
      useCasesCompeted: [...new Set(group.flatMap((comp) => comp.useCasesCompeted))],
    }))
    .sort((a, b) => b.frequency - a.frequency)
}

/**
 * Deduplicate segments and sum call counts
 */
function deduplicateAndScoreSegments(segments: SegmentProfile[]): SegmentProfile[] {
  const grouped = new Map<string, SegmentProfile[]>()

  for (const seg of segments) {
    const key = seg.name.toLowerCase()
    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key)!.push(seg)
  }

  return Array.from(grouped.values())
    .map((group) => ({
      ...group[0],
      callCount: group.reduce((sum, seg) => sum + seg.callCount, 0),
      topUseCases: [...new Set(group.flatMap((seg) => seg.topUseCases))].slice(0, 5),
      topObjections: [...new Set(group.flatMap((seg) => seg.topObjections))].slice(0, 3),
    }))
    .sort((a, b) => b.callCount - a.callCount)
}

/**
 * Generate features overview document
 */
function generateFeaturesOverview(useCases: UseCase[]): string {
  const features = new Map<string, number>()
  useCases.forEach((uc) => {
    uc.relatedFeatures.forEach((f) => {
      features.set(f, (features.get(f) || 0) + uc.frequency)
    })
  })

  let doc = '# Sourcegraph Features Across Portfolio\n\n'
  Array.from(features.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([feature, count]) => {
      doc += `- **${feature}**: ${count} mentions across use cases\n`
    })

  return doc
}

/**
 * Generate competitive context document
 */
function generateCompetitiveContext(competitors: CompetitorMention[]): string {
  let doc = '# Competitive Intelligence\n\n'
  competitors.slice(0, 10).forEach((comp) => {
    doc += `## ${comp.competitorName}\n`
    doc += `- Mentions: ${comp.frequency}\n`
    doc += `- Customer sentiment: ${comp.customerSentiment}\n`
    doc += `- Use cases competed: ${comp.useCasesCompeted.join(', ')}\n`
    doc += `- Context: ${comp.contextSummary}\n\n`
  })
  return doc
}

/**
 * Generate segment profiles document
 */
function generateSegmentProfiles(segments: SegmentProfile[]): string {
  let doc = '# Market Segments\n\n'
  segments.forEach((seg) => {
    doc += `## ${seg.name}\n`
    doc += `- Calls analyzed: ${seg.callCount}\n`
    if (seg.topUseCases.length > 0) {
      doc += `- Top use cases: ${seg.topUseCases.join(', ')}\n`
    }
    if (seg.topObjections.length > 0) {
      doc += `- Common objections: ${seg.topObjections.join(', ')}\n`
    }
    doc += '\n'
  })
  return doc
}

/**
 * Generate objection playbook document
 */
function generateObjectionPlaybook(objections: Objection[]): string {
  let doc = '# Objection Handling Playbook\n\n'
  objections.slice(0, 15).forEach((obj) => {
    doc += `## "${obj.description}"\n`
    doc += `- Frequency: ${obj.frequency} mentions\n`
    if (obj.rebuttalSuggestions.length > 0) {
      doc += `- Suggested approach: ${obj.rebuttalSuggestions[0]}\n`
    }
    doc += '\n'
  })
  return doc
}

/**
 * Generate success stories document
 */
function generateSuccessStories(useCases: UseCase[], _segments: SegmentProfile[]): string {
  let doc = '# Customer Success Patterns\n\n'
  useCases.slice(0, 10).forEach((uc) => {
    doc += `## ${uc.title}\n`
    doc += `- Frequency: ${uc.frequency} calls\n`
    if (uc.relatedIndustries.length > 0) {
      doc += `- Industries: ${uc.relatedIndustries.slice(0, 3).join(', ')}\n`
    }
    if (uc.exampleQuotes.length > 0) {
      doc += `- Customer quote: "${uc.exampleQuotes[0]}"\n`
    }
    doc += '\n'
  })
  return doc
}

/**
 * Build feature by industry matrix
 */
function buildFeatureByIndustryMatrix(
  segments: SegmentProfile[],
  useCases: UseCase[]
): Record<string, string[]> {
  const matrix: Record<string, string[]> = {}
  segments.forEach((seg) => {
    const features = new Set<string>()
    seg.topUseCases.forEach((ucId) => {
      const uc = useCases.find((u) => u.id === ucId)
      if (uc) {
        uc.relatedFeatures.forEach((f) => features.add(f))
      }
    })
    matrix[seg.name] = Array.from(features)
  })
  return matrix
}

/**
 * Build objection by segment matrix
 */
function buildObjectionBySegmentMatrix(
  segments: SegmentProfile[]
  // Note: objections param could be used for cross-reference, keeping signature for future extension
): Record<string, string[]> {
  const matrix: Record<string, string[]> = {}
  segments.forEach((seg) => {
    matrix[seg.name] = seg.topObjections.slice(0, 3)
  })
  return matrix
}

/**
 * Build use case by feature matrix
 */
function buildUseCaseByFeatureMatrix(useCases: UseCase[]): Record<string, string[]> {
  const matrix: Record<string, string[]> = {}
  useCases.forEach((uc) => {
    uc.relatedFeatures.forEach((feature) => {
      if (!matrix[feature]) {
        matrix[feature] = []
      }
      matrix[feature].push(uc.id)
    })
  })
  return matrix
}

/**
 * Simple fuzzy match (0.0-1.0 similarity)
 */
function fuzzyMatch(a: string, b: string): number {
  const aWords = a.toLowerCase().split(/\s+/)
  const bWords = b.toLowerCase().split(/\s+/)
  const intersection = aWords.filter((w) => bWords.includes(w)).length
  const union = new Set([...aWords, ...bWords]).size
  return union === 0 ? 0 : intersection / union
}
