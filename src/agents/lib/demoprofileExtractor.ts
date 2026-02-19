/**
 * Demo Profile Extractor
 * 
 * Converts Gong call context (transcripts, metadata, summaries) into a
 * structured DemoProfile that drives demo flow tailoring.
 * 
 * Extracts:
 * - Primary and secondary programming languages
 * - Main pain points from the call
 * - Tools mentioned (GitHub, Jira, etc.)
 * - Use cases for the sale
 * - Persona of the main attendee
 */

import type { OpportunityContext } from '../../agentTypes.js'

// ============================================================================
// Types
// ============================================================================

export type Persona = 'dev' | 'team_lead' | 'engineering_manager' | 'security' | 'platform' | 'other'

export interface DemoProfile {
  /** Primary programming languages mentioned in the call */
  primaryLanguages: string[]
  
  /** Secondary or tertiary languages */
  secondaryLanguages: string[]
  
  /** Main pain points extracted from the call */
  mainPainPoints: string[]
  
  /** Tools mentioned (GitHub, Jira, Docker, etc.) */
  toolsMentioned: string[]
  
  /** Inferred use cases from the conversation */
  useCases: string[]
  
  /** Inferred persona of main speaker */
  persona: Persona
  
  /** Company size/industry if mentioned */
  context?: {
    companySize?: string
    industry?: string
    teamSize?: number
  }
  
  /** Raw extracted signals for debugging */
  signals?: {
    languageMentions: Map<string, number>
    painMentions: Map<string, number>
    toolMentions: Map<string, number>
  }
}

// ============================================================================
// Language Detection
// ============================================================================

const LANGUAGE_KEYWORDS: Record<string, string[]> = {
  python: ['python', 'py', 'jupyter', 'pandas', 'django', 'flask', 'pytorch', 'tensorflow'],
  javascript: ['javascript', 'js', 'node', 'nodejs', 'npm', 'webpack'],
  typescript: ['typescript', 'ts', 'typescript', 'next.js', 'nextjs'],
  go: ['golang', 'go ', 'go.', ' go ', 'microservice'],
  java: ['java', 'spring', 'maven', 'gradle', 'jvm'],
  kotlin: ['kotlin', 'android', 'kotlin '],
  swift: ['swift', 'ios', 'xcode', 'cocoapods'],
  rust: ['rust', 'cargo', 'wasm', 'webassembly'],
  csharp: ['c#', 'csharp', '.net', 'dotnet', 'asp.net'],
  ruby: ['ruby', 'rails', 'gemfile'],
  php: ['php', 'laravel', 'symfony'],
  sql: ['sql', 'postgres', 'postgresql', 'mysql', 'database'],
  react: ['react', 'jsx', 'hooks', 'next.js', 'nextjs'],
  vue: ['vue', 'vuejs', 'vue.js'],
  docker: ['docker', 'kubernetes', 'container'],
  graphql: ['graphql', 'apollo', 'relay'],
}

// ============================================================================
// Pain Point Keywords
// ============================================================================

const PAIN_KEYWORDS: Record<string, string[]> = {
  'code-search': ['search', 'find code', 'locate', 'grep', 'understand', 'discover', 'api discovery'],
  'onboarding': ['onboarding', 'new engineer', 'ramp up', 'learning curve', 'context'],
  'debugging': ['debug', 'troubleshoot', 'error', 'incident', 'trace'],
  'refactoring': ['refactor', 'migrate', 'upgrade', 'update', 'legacy'],
  'monitoring': ['monitor', 'visibility', 'health', 'metrics', 'observability'],
  'collaboration': ['collaborate', 'communication', 'async', 'handoff', 'documentation'],
  'security': ['security', 'vulnerability', 'scan', 'patch', 'compliance'],
  'performance': ['performance', 'slow', 'optimization', 'latency', 'throughput'],
  'scale': ['scale', 'scalable', 'grow', 'large', 'distributed', 'microservice'],
  'code-quality': ['quality', 'test', 'coverage', 'debt', 'technical debt'],
}

// ============================================================================
// Tool Keywords
// ============================================================================

const TOOL_KEYWORDS: Record<string, string[]> = {
  github: ['github', 'gh ', 'actions', 'workflows'],
  gitlab: ['gitlab', 'gitlab-ci'],
  bitbucket: ['bitbucket', 'bitbucket pipeline'],
  jira: ['jira', 'atlassian'],
  confluence: ['confluence', 'wiki'],
  slack: ['slack'],
  jenkins: ['jenkins', 'ci/cd'],
  docker: ['docker', 'dockerfile'],
  kubernetes: ['kubernetes', 'k8s', 'helm'],
  terraform: ['terraform', 'iac', 'infrastructure'],
  aws: ['aws', 'amazon', 'ec2', 's3'],
  gcp: ['gcp', 'google cloud', 'cloud'],
  azure: ['azure', 'microsoft'],
  elasticsearch: ['elasticsearch', 'elastic'],
  datadog: ['datadog'],
  newrelic: ['new relic', 'newrelic'],
}

// ============================================================================
// Persona Keywords
// ============================================================================

const PERSONA_KEYWORDS: Record<Persona, string[]> = {
  dev: ['developer', 'engineer', 'software', 'coding', 'technical', 'individual contributor'],
  team_lead: ['tech lead', 'lead engineer', 'lead', 'senior engineer', 'principal'],
  engineering_manager: ['manager', 'director', 'vp of eng', 'head of', 'engineering leadership', 'team management'],
  platform: ['platform', 'infrastructure', 'devops', 'sre', 'reliability'],
  security: ['security', 'infosec', 'compliance', 'ciso', 'security engineer'],
  other: [],
}

// ============================================================================
// Main Extraction Function
// ============================================================================

/**
 * Extract demo profile from opportunity context.
 * Analyzes Gong transcript, activities, and account data to build a profile.
 */
export function extractDemoProfile(context: OpportunityContext): DemoProfile {
  const transcript = context.recentTranscript || []
  const activities = context.activities || []
  const account = context.salesforceSnapshot?.account
  const contacts = context.salesforceSnapshot?.contacts || []
  
  // Combine all text sources for analysis
  const fullText = [
    ...transcript.map(t => t.text),
    ...activities.map(a => [a.title, a.summary].filter(Boolean).join(' ')),
    context.accountName,
    account?.Industry || '',
    contacts.map(c => [c.Name, c.Title, c.Email].filter(Boolean).join(' ')).join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  
  // Extract languages
  const languageMentions = countKeywordMatches(fullText, LANGUAGE_KEYWORDS)
  const primaryLanguages = getMostCommon(languageMentions, 2)
  const secondaryLanguages = getMostCommon(languageMentions, 3).slice(2)
  
  // Extract pain points
  const painMentions = countKeywordMatches(fullText, PAIN_KEYWORDS)
  const mainPainPoints = getMostCommon(painMentions, 3)
  
  // Extract tools
  const toolMentions = countKeywordMatches(fullText, TOOL_KEYWORDS)
  const toolsMentioned = getMostCommon(toolMentions, 5)
  
  // Extract use cases based on pain points and context
  const useCases = inferUseCases(mainPainPoints, toolsMentioned, primaryLanguages)
  
  // Infer persona from contact titles and keywords
  const persona = inferPersona(contacts, fullText)
  
  // Extract company context
  const companyContext = extractCompanyContext(account)
  
  return {
    primaryLanguages,
    secondaryLanguages,
    mainPainPoints,
    toolsMentioned,
    useCases,
    persona,
    context: companyContext,
    signals: {
      languageMentions,
      painMentions,
      toolMentions,
    },
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Count keyword matches in text, returning a map of category -> count.
 */
function countKeywordMatches(text: string, keywordMap: Record<string, string[]>): Map<string, number> {
  const result = new Map<string, number>()
  
  for (const [category, keywords] of Object.entries(keywordMap)) {
    let count = 0
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
      const matches = text.match(regex)
      count += matches ? matches.length : 0
    }
    if (count > 0) {
      result.set(category, count)
    }
  }
  
  return result
}

/**
 * Get the top N categories by mention count.
 */
function getMostCommon(map: Map<string, number>, limit: number): string[] {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => key)
}

/**
 * Infer use cases from pain points, tools, and languages.
 */
function inferUseCases(
  painPoints: string[],
  tools: string[],
  languages: string[]
): string[] {
  const useCases: Set<string> = new Set()
  
  // Pain-based inferences
  const painToUseCase: Record<string, string> = {
    'code-search': 'code-exploration',
    'onboarding': 'onboarding',
    'debugging': 'incident-response',
    'refactoring': 'refactoring',
    'monitoring': 'observability',
    'collaboration': 'team-efficiency',
    'security': 'security-scanning',
    'performance': 'optimization',
    'scale': 'scalability',
    'code-quality': 'quality-assurance',
  }
  
  for (const pain of painPoints) {
    if (painToUseCase[pain]) {
      useCases.add(painToUseCase[pain])
    }
  }
  
  // Tool-based inferences
  if (tools.includes('github') || tools.includes('gitlab')) {
    useCases.add('vcs-integration')
  }
  if (tools.includes('kubernetes') || tools.includes('docker')) {
    useCases.add('infrastructure')
  }
  if (tools.includes('jenkins')) {
    useCases.add('cicd')
  }
  
  // Language-based inferences
  if (languages.includes('python') || languages.includes('go')) {
    useCases.add('backend-development')
  }
  if (languages.includes('javascript') || languages.includes('typescript') || languages.includes('react')) {
    useCases.add('frontend-development')
  }
  
  // Always include general code exploration
  if (useCases.size === 0) {
    useCases.add('code-exploration')
  }
  
  return Array.from(useCases)
}

/**
 * Infer persona from contact information and text keywords.
 */
function inferPersona(contacts: any[], text: string): Persona {
  // Check contact titles first
  for (const contact of contacts) {
    const title = (contact.Title || '').toLowerCase()
    
    for (const keyword of PERSONA_KEYWORDS.engineering_manager) {
      if (title.includes(keyword)) return 'engineering_manager'
    }
    for (const keyword of PERSONA_KEYWORDS.platform) {
      if (title.includes(keyword)) return 'platform'
    }
    for (const keyword of PERSONA_KEYWORDS.security) {
      if (title.includes(keyword)) return 'security'
    }
    for (const keyword of PERSONA_KEYWORDS.team_lead) {
      if (title.includes(keyword)) return 'team_lead'
    }
    for (const keyword of PERSONA_KEYWORDS.dev) {
      if (title.includes(keyword)) return 'dev'
    }
  }
  
  // Check keywords in text
  for (const [persona, keywords] of Object.entries(PERSONA_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return persona as Persona
      }
    }
  }
  
  return 'other'
}

/**
 * Extract company context from account and account name.
 */
function extractCompanyContext(
  account: any
): DemoProfile['context'] {
  return {
    companySize: account?.NumberOfEmployees
      ? formatCompanySize(account.NumberOfEmployees)
      : undefined,
    industry: account?.Industry,
    teamSize: account?.NumberOfEmployees ? parseInt(account.NumberOfEmployees) : undefined,
  }
}

/**
 * Format employee count into a human-readable company size.
 */
function formatCompanySize(count: number | string): string {
  const num = typeof count === 'string' ? parseInt(count) : count
  if (num < 50) return 'startup'
  if (num < 200) return 'small'
  if (num < 1000) return 'medium'
  if (num < 5000) return 'large'
  return 'enterprise'
}

// ============================================================================
// Profile Formatting
// ============================================================================

/**
 * Format demo profile as a readable string for logging/debugging.
 */
export function formatDemoProfile(profile: DemoProfile): string {
  return `
Demo Profile:
  Languages: ${profile.primaryLanguages.join(', ') || 'None'}
  Secondary: ${profile.secondaryLanguages.join(', ') || 'None'}
  Pain Points: ${profile.mainPainPoints.join(', ') || 'None'}
  Tools: ${profile.toolsMentioned.join(', ') || 'None'}
  Use Cases: ${profile.useCases.join(', ') || 'None'}
  Persona: ${profile.persona}
  Company: ${[profile.context?.companySize, profile.context?.industry].filter(Boolean).join(', ') || 'Unknown'}
`.trim()
}

/**
 * Validate demo profile has minimum required data.
 */
export function isValidDemoProfile(profile: DemoProfile): boolean {
  // Must have at least one of: language, pain point, or use case
  return (
    profile.primaryLanguages.length > 0 ||
    profile.mainPainPoints.length > 0 ||
    profile.useCases.length > 0
  )
}

/**
 * Get a fallback default demo profile for cases where context is minimal.
 */
export function getDefaultDemoProfile(): DemoProfile {
  return {
    primaryLanguages: ['Python'],
    secondaryLanguages: ['JavaScript', 'TypeScript'],
    mainPainPoints: ['code-search', 'onboarding'],
    toolsMentioned: ['github'],
    useCases: ['code-exploration', 'onboarding'],
    persona: 'other',
    context: {
      companySize: 'medium',
    },
  }
}
