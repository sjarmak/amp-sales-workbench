/**
 * ADS Repository Selector
 * 
 * Selects appropriate demo repositories from the ADS GitHub organization
 * based on a DemoProfile.
 * 
 * Selection logic:
 * 1. Try to find repos matching primary language
 * 2. If no match, use secondary languages
 * 3. Match on architecture patterns (microservices, data pipelines, etc.)
 * 4. Fall back to curated default repositories
 */

import type { DemoProfile } from './demoprofileExtractor.js'
import {
  getDemoRepoOrg,
  getCuratedDemoRepos,
  getDefaultDemoRepo,
  getDemoLanguagePrefs,
  type CuratedRepo,
} from '../../config/demoRepoConfig.js'

// ============================================================================
// Types
// ============================================================================

export interface SelectedDemoRepo {
  url: string
  name: string
  description: string
  languages: string[]
  rationale: string
  alternateUrls?: string[]
}

// ============================================================================
// Repository Selection
// ============================================================================

/**
 * Select 1-3 demo repositories based on the demo profile.
 * 
 * Selection strategy:
 * 1. Score curated repos by language match
 * 2. Score by architecture pattern match
 * 3. Return top 1-3 repos
 * 4. Always include rationale explaining the match
 */
export function selectAdsDemoRepos(profile: DemoProfile): SelectedDemoRepo[] {
  const curatedRepos = getCuratedDemoRepos()
  
  if (curatedRepos.length === 0) {
    return getDefaultDemoRepo() ? [createDefaultRepo()] : []
  }
  
  // Score each repo
  const scores = curatedRepos.map((repo) => ({
    repo,
    score: scoreRepository(repo, profile),
    rationale: buildRationale(repo, profile),
  }))
  
  // Sort by score (descending)
  scores.sort((a, b) => b.score - a.score)
  
  // Return top 1-3 repos
  const selected = scores.slice(0, Math.min(3, scores.length))
  
  return selected.map((item) => ({
    url: item.repo.url,
    name: extractRepoName(item.repo.url),
    description: item.repo.description,
    languages: item.repo.languages,
    rationale: item.rationale,
    alternateUrls: getAlternateRepos(item.repo, curatedRepos),
  }))
}

/**
 * Score a repository against the demo profile.
 */
function scoreRepository(repo: CuratedRepo, profile: DemoProfile): number {
  let score = 0
  
  // Language matching (0-50 points)
  const allLanguages = [...profile.primaryLanguages, ...profile.secondaryLanguages]
  const matchingLanguages = repo.languages.filter((lang) =>
    allLanguages.some((userLang) => isSimilarLanguage(userLang, lang))
  )
  
  if (matchingLanguages.length > 0) {
    score += 30 // Base score for any language match
    score += matchingLanguages.length * 10 // Bonus for each match
  }
  
  // Architecture pattern matching (0-30 points)
  if (profile.useCases.includes('api-design') && repo.architecturePatterns.includes('api-service')) {
    score += 20
  }
  if (profile.useCases.includes('scalability') && repo.architecturePatterns.includes('microservices')) {
    score += 20
  }
  if (profile.useCases.includes('data-processing') && repo.architecturePatterns.includes('data-pipeline')) {
    score += 20
  }
  
  // Pain point alignment (0-20 points)
  if (profile.mainPainPoints.includes('scale') && repo.architecturePatterns.includes('microservices')) {
    score += 10
  }
  if (profile.mainPainPoints.includes('onboarding')) {
    // Prefer well-documented, popular repos
    score += 5
  }
  
  return score
}

/**
 * Build a natural language rationale for why this repo was selected.
 */
function buildRationale(repo: CuratedRepo, profile: DemoProfile): string {
  const parts: string[] = []
  
  // Match on languages
  const matchingLanguages = repo.languages.filter((lang) =>
    [...profile.primaryLanguages, ...profile.secondaryLanguages].some((userLang) =>
      isSimilarLanguage(userLang, lang)
    )
  )
  
  if (matchingLanguages.length > 0) {
    if (matchingLanguages.length === 1) {
      parts.push(`matches your ${matchingLanguages[0]} codebase`)
    } else {
      parts.push(`supports ${matchingLanguages.join(', ')}`)
    }
  }
  
  // Match on patterns/use cases
  if (profile.useCases.includes('api-design') && repo.architecturePatterns.includes('api-service')) {
    parts.push('demonstrates API service patterns')
  }
  if (profile.useCases.includes('scalability') && repo.architecturePatterns.includes('microservices')) {
    parts.push('shows microservices architecture at scale')
  }
  if (profile.useCases.includes('data-processing') && repo.architecturePatterns.includes('data-pipeline')) {
    parts.push('illustrates data pipeline and ETL patterns')
  }
  
  // Generic fallback
  if (parts.length === 0) {
    parts.push('is a representative ADS repository with real-world code examples')
  }
  
  return parts.length > 0 ? parts.join(' and ') : 'ADS repository for demo purposes'
}

/**
 * Get alternate repository suggestions for fallback.
 */
function getAlternateRepos(primary: CuratedRepo, allRepos: CuratedRepo[]): string[] {
  return allRepos
    .filter((repo) => repo.url !== primary.url)
    .slice(0, 2)
    .map((repo) => repo.url)
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if two language names are similar/equivalent.
 */
function isSimilarLanguage(lang1: string, lang2: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[+#]/g, '').trim()
  const n1 = normalize(lang1)
  const n2 = normalize(lang2)
  
  // Exact match
  if (n1 === n2) return true
  
  // Common aliases
  const aliases: Record<string, string[]> = {
    javascript: ['js', 'nodejs', 'node'],
    typescript: ['ts'],
    python: ['py', 'python3', 'python2'],
    csharp: ['c#', 'cs'],
    golang: ['go'],
    'c++': ['cpp', 'cplusplus'],
  }
  
  for (const [primary, alts] of Object.entries(aliases)) {
    if (n1 === primary && alts.includes(n2)) return true
    if (n2 === primary && alts.includes(n1)) return true
  }
  
  return false
}

/**
 * Extract repository name from URL.
 * Example: 'https://github.com/adsabs/adsabs-core' -> 'adsabs-core'
 */
function extractRepoName(url: string): string {
  const match = url.match(/\/([^/]+)$/)
  return match ? match[1] : url
}

/**
 * Create a default repo entry from config.
 */
function createDefaultRepo(): SelectedDemoRepo {
  const defaultUrl = getDefaultDemoRepo()
  if (!defaultUrl) {
    throw new Error('No default demo repository configured')
  }
  
  const org = getDemoRepoOrg() || 'adsabs'
  const langPrefs = getDemoLanguagePrefs()
  
  return {
    url: defaultUrl,
    name: extractRepoName(defaultUrl),
    description: `Default ${org} repository for demonstrations`,
    languages: langPrefs,
    rationale: `Default demo repository from ${org} organization`,
  }
}

// ============================================================================
// Repository Validation
// ============================================================================

/**
 * Validate that a repository URL is valid.
 */
export function isValidRepoUrl(url: string): boolean {
  try {
    // Must be a valid GitHub URL
    return /^https:\/\/github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+\/?$/.test(url)
  } catch {
    return false
  }
}

/**
 * Normalize a repository URL (remove trailing slash, ensure https).
 */
export function normalizeRepoUrl(url: string): string {
  if (!url) return ''
  
  // Remove trailing slash
  url = url.replace(/\/$/, '')
  
  // Ensure https
  if (url.startsWith('http://')) {
    url = url.replace('http://', 'https://')
  }
  
  return url
}

// ============================================================================
// Search Query Generation
// ============================================================================

/**
 * Generate example search queries for a selected repository.
 */
export function generateExampleQueries(
  repo: SelectedDemoRepo,
  profile: DemoProfile
): Array<{ query: string; description: string }> {
  const queries: Array<{ query: string; description: string }> = []
  const repoName = extractRepoName(repo.url)
  
  // Language-specific queries
  if (repo.languages.includes('Python')) {
    queries.push({
      query: `repo:^${repo.url.replace('https://github.com/', '')}$ class:symbol`,
      description: 'Find all Python class definitions',
    })
    queries.push({
      query: `repo:^${repo.url.replace('https://github.com/', '')}$ import requests`,
      description: 'Track external API dependencies',
    })
  }
  
  if (repo.languages.includes('JavaScript') || repo.languages.includes('TypeScript')) {
    queries.push({
      query: `repo:^${repo.url.replace('https://github.com/', '')}$ import.*from`,
      description: 'Find all module imports',
    })
    queries.push({
      query: `repo:^${repo.url.replace('https://github.com/', '')}$ async function`,
      description: 'Locate asynchronous patterns',
    })
  }
  
  // Pain-point specific queries
  if (profile.mainPainPoints.includes('api-discovery')) {
    queries.push({
      query: `repo:^${repo.url.replace('https://github.com/', '')}$ def.*api OR class.*API`,
      description: 'Find API definitions and patterns',
    })
  }
  
  if (profile.mainPainPoints.includes('debugging')) {
    queries.push({
      query: `repo:^${repo.url.replace('https://github.com/', '')}$ error OR exception OR logger`,
      description: 'Locate error handling and logging',
    })
  }
  
  if (profile.mainPainPoints.includes('security')) {
    queries.push({
      query: `repo:^${repo.url.replace('https://github.com/', '')}$ auth OR password OR token`,
      description: 'Find security-related code',
    })
  }
  
  // Architecture-specific queries
  if (profile.useCases.includes('refactoring')) {
    queries.push({
      query: `repo:^${repo.url.replace('https://github.com/', '')}$ TODO OR FIXME`,
      description: 'Find technical debt and refactoring opportunities',
    })
  }
  
  // Default queries if none generated
  if (queries.length === 0) {
    queries.push({
      query: `repo:^${repo.url.replace('https://github.com/', '')}$ type:file`,
      description: `Browse files in ${repoName}`,
    })
    queries.push({
      query: `repo:^${repo.url.replace('https://github.com/', '')}$ def OR class`,
      description: 'Find main classes and functions',
    })
  }
  
  return queries
}
