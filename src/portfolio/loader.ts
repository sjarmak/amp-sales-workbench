/**
 * Portfolio Knowledge Base Loader
 * 
 * Loads the knowledge base from disk and provides utility functions
 * for agents to query and inject relevant patterns
 */

import { readFile } from 'fs/promises'
import { join } from 'path'
import type { GlobalKnowledgeBase, UseCase, Objection, SegmentProfile } from './types.js'

const PORTFOLIO_DIR = 'data/global'
let cachedKb: GlobalKnowledgeBase | null = null

/**
 * Load portfolio knowledge base from disk
 * Uses in-memory cache to avoid repeated disk I/O
 */
export async function loadPortfolioKb(): Promise<GlobalKnowledgeBase | null> {
  // Return cached version if available
  if (cachedKb) {
    return cachedKb
  }

  try {
    const kbPath = join(PORTFOLIO_DIR, 'knowledge_base.json')
    const content = await readFile(kbPath, 'utf-8')
    cachedKb = JSON.parse(content)
    return cachedKb
  } catch (err) {
    // KB not yet generated - return null for graceful degradation
    return null
  }
}

/**
 * Get relevant use cases for a given industry or company segment
 */
export async function getRelevantUseCases(
  industry?: string,
  features?: string[]
): Promise<UseCase[]> {
  const kb = await loadPortfolioKb()
  if (!kb) return []

  let filtered = kb.patterns.useCases

  // Filter by industry if provided
  if (industry) {
    filtered = filtered.filter((uc) =>
      uc.relatedIndustries.some((ind) => ind.toLowerCase().includes(industry.toLowerCase()))
    )
  }

  // Filter by features if provided
  if (features && features.length > 0) {
    filtered = filtered.filter((uc) =>
      features.some((feat) => uc.relatedFeatures.includes(feat))
    )
  }

  return filtered.slice(0, 10) // Top 10 relevant
}

/**
 * Get common objections and handling strategies for a segment
 */
export async function getObjectionsForSegment(segment?: string): Promise<Objection[]> {
  const kb = await loadPortfolioKb()
  if (!kb) return []

  if (!segment) {
    return kb.patterns.objections.slice(0, 10)
  }

  // Get objections relevant to this segment (via matrices)
  const segmentObjections = kb.matrices.objectionBySegment[segment] || []
  return kb.patterns.objections.filter((obj) => segmentObjections.includes(obj.id)).slice(0, 5)
}

/**
 * Build a segment profile for agent context
 */
export async function getSegmentProfile(segmentName: string): Promise<SegmentProfile | null> {
  const kb = await loadPortfolioKb()
  if (!kb) return null

  return kb.patterns.segments.find((seg) =>
    seg.name.toLowerCase() === segmentName.toLowerCase()
  ) || null
}

/**
 * Generate a context string for injecting into agent prompts
 */
export async function generatePortfolioContext(
  industry?: string,
  features?: string[]
): Promise<string> {
  const kb = await loadPortfolioKb()
  if (!kb) return ''

  const useCases = await getRelevantUseCases(industry, features)
  if (useCases.length === 0) return ''

  let context = `## Portfolio Intelligence (${kb.sourceCallCount} calls analyzed)\n\n`

  if (industry) {
    context += `### Use Cases for ${industry}\n`
    useCases.slice(0, 5).forEach((uc) => {
      context += `- **${uc.title}**: ${uc.frequency} mentions (${(uc.winRate ? (uc.winRate * 100).toFixed(0) : '?')}% win rate)\n`
      context += `  Features: ${uc.relatedFeatures.join(', ')}\n`
    })
    context += '\n'
  }

  const objections = await getObjectionsForSegment(industry)
  if (objections.length > 0) {
    context += `### Common Objections\n`
    objections.forEach((obj) => {
      context += `- **"${obj.description}"** (${obj.frequency} mentions)\n`
      if (obj.rebuttalSuggestions.length > 0) {
        context += `  → ${obj.rebuttalSuggestions[0]}\n`
      }
    })
  }

  return context
}

/**
 * Clear cached KB (useful for testing or refresh)
 */
export function clearKbCache(): void {
  cachedKb = null
}
