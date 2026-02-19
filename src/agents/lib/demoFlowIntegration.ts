/**
 * Demo Flow Integration
 * 
 * Bridges extracted demo profiles and selected repositories with the
 * customized demo agent, ensuring LLM receives proper context about:
 * - Which repositories to reference
 * - How to tailor examples to the customer's stack
 * - ADS-specific domain context for feature mapping
 */

import type { DemoProfile } from './demoprofileExtractor.js'
import type { SelectedDemoRepo } from './adsRepositorySelector.js'
import { ADS_FEATURE_MAPPINGS } from '../../config/demoRepoConfig.js'

// ============================================================================
// Types
// ============================================================================

export interface DemoFlowContext {
  /** Selected repositories for this demo */
  repos: SelectedDemoRepo[]
  
  /** Extracted customer profile */
  profile: DemoProfile
  
  /** Context for LLM about feature mapping */
  featureMapping: FeatureContext[]
  
  /** Instructions for LLM on how to use this context */
  instructions: string
}

export interface FeatureContext {
  feature: string
  adsContext: string
  relevance: string
  examples: string[]
}

// ============================================================================
// Context Building
// ============================================================================

/**
 * Build complete demo flow context for the LLM.
 */
export function buildDemoFlowContext(
  repos: SelectedDemoRepo[],
  profile: DemoProfile
): DemoFlowContext {
  const featureMapping = buildFeatureContext(profile)
  const instructions = buildInstructions(repos, profile)
  
  return {
    repos,
    profile,
    featureMapping,
    instructions,
  }
}

/**
 * Build feature context for the LLM about which features to emphasize.
 */
function buildFeatureContext(profile: DemoProfile): FeatureContext[] {
  const contexts: FeatureContext[] = []
  
  // Select features based on use cases
  const featureKeys = Object.keys(ADS_FEATURE_MAPPINGS)
  
  for (const key of featureKeys) {
    const mapping = ADS_FEATURE_MAPPINGS[key]
    
    // Check if this feature is relevant to the customer's use cases
    const isRelevant = mapping.useCases.some((uc) =>
      profile.useCases.some((puc) => puc.toLowerCase().includes(uc) || uc.includes(puc.toLowerCase()))
    )
    
    if (isRelevant) {
      contexts.push({
        feature: mapping.feature,
        adsContext: mapping.adsContext,
        relevance: buildFeatureRelevance(mapping, profile),
        examples: mapping.exampleQueries,
      })
    }
  }
  
  // If no features matched, include all for fallback
  if (contexts.length === 0) {
    for (const mapping of Object.values(ADS_FEATURE_MAPPINGS)) {
      contexts.push({
        feature: mapping.feature,
        adsContext: mapping.adsContext,
        relevance: `General interest based on ${mapping.useCases.join(', ')}`,
        examples: mapping.exampleQueries,
      })
    }
  }
  
  return contexts
}

/**
 * Build a custom relevance statement for a feature.
 */
function buildFeatureRelevance(mapping: any, profile: DemoProfile): string {
  const parts: string[] = []
  
  // Check which use cases match
  const matchingUseCases = mapping.useCases.filter((uc: string) =>
    profile.useCases.some((puc) => puc.toLowerCase().includes(uc) || uc.includes(puc.toLowerCase()))
  )
  
  if (matchingUseCases.length > 0) {
    parts.push(`Directly relevant to ${matchingUseCases.join(', ')}`)
  }
  
  // Check for pain point alignment
  const alignment = mapPainsToPainKeywords(profile.mainPainPoints)
  if (alignment.length > 0) {
    parts.push(`Addresses ${alignment.join(', ')}`)
  }
  
  // Check for tool alignment
  if (profile.toolsMentioned.length > 0) {
    parts.push(`Integrates with ${profile.toolsMentioned.slice(0, 2).join(', ')}`)
  }
  
  return parts.length > 0
    ? parts.join('; ')
    : 'Core capability for software development'
}

/**
 * Map high-level pains to specific pain keywords used in feature mappings.
 */
function mapPainsToPainKeywords(pains: string[]): string[] {
  const painKeywordMap: Record<string, string> = {
    'code-search': 'code discovery',
    'onboarding': 'engineer onboarding',
    'debugging': 'incident response',
    'refactoring': 'code modernization',
    'monitoring': 'code visibility',
    'collaboration': 'team efficiency',
    'security': 'security compliance',
    'performance': 'performance optimization',
    'scale': 'scale management',
    'code-quality': 'code quality',
  }
  
  return pains
    .map((pain) => painKeywordMap[pain] || pain)
    .slice(0, 3)
}

// ============================================================================
// LLM Instructions Building
// ============================================================================

/**
 * Build instructions for the LLM about how to incorporate demo context.
 */
function buildInstructions(repos: SelectedDemoRepo[], profile: DemoProfile): string {
  const repoSection = repos.length > 0 ? buildRepositoryInstructions(repos) : ''
  const profileSection = buildProfileInstructions(profile)
  const domainSection = buildDomainInstructions()
  
  return `
## Demo Flow Customization Instructions

You have been provided with a customer profile extracted from their recent Gong call. Use the following context to tailor your demo recommendations:

${repoSection}

${profileSection}

${domainSection}

## Key Constraints

1. **Repository Selection**: ONLY reference the selected repositories listed above. Do NOT suggest Sourcegraph-internal repositories.
2. **Domain Context**: Frame all examples and features in the context of an academic search platform (ADS) unless customers work with different domains.
3. **Language Alignment**: Prioritize features and examples that match the customer's primary programming languages.
4. **Pain-Driven**: Lead with features that address the customer's identified pain points.
5. **Architecture Awareness**: Reference architectural patterns (microservices, data pipelines, etc.) that match the customer's setup.

## Tone & Framing

- Always explain features in terms of the ADS platform and use cases
- Use concrete examples from the selected repositories
- Frame competitive positioning around academic/research domains rather than enterprise alternatives
- Emphasize how solutions improve developer velocity and code understanding
`.trim()
}

/**
 * Build repository-specific instructions.
 */
function buildRepositoryInstructions(repos: SelectedDemoRepo[]): string {
  if (repos.length === 0) return ''
  
  const repoDescriptions = repos
    .map((repo) => `- **${repo.name}** (${repo.languages.join(', ')}): ${repo.description}\n  Rationale: ${repo.rationale}`)
    .join('\n')
  
  return `### Recommended Demo Repositories

The following repositories have been selected for this customer based on their tech stack and pain points:

${repoDescriptions}

Use these repositories as the PRIMARY examples in your demo flows. All specific queries, navigation examples, and code samples should reference these repositories.`
}

/**
 * Build profile-based instructions.
 */
function buildProfileInstructions(profile: DemoProfile): string {
  const parts: string[] = ['### Customer Profile Context']
  
  if (profile.primaryLanguages.length > 0) {
    parts.push(
      `**Primary Languages**: ${profile.primaryLanguages.join(', ')}\n` +
      `Prioritize examples and features that apply to these languages.`
    )
  }
  
  if (profile.mainPainPoints.length > 0) {
    parts.push(
      `**Key Pain Points**: ${profile.mainPainPoints.join(', ')}\n` +
      `Lead demo sections with features that directly address these issues.`
    )
  }
  
  if (profile.useCases.length > 0) {
    parts.push(
      `**Use Cases**: ${profile.useCases.join(', ')}\n` +
      `Structure the demo to showcase capabilities that support these workflows.`
    )
  }
  
  if (profile.toolsMentioned.length > 0) {
    parts.push(
      `**Tools in Use**: ${profile.toolsMentioned.join(', ')}\n` +
      `Highlight integration points with their existing toolchain.`
    )
  }
  
  if (profile.persona) {
    parts.push(
      `**Persona**: ${profile.persona}\n` +
      `Adjust technical depth and terminology for a ${profile.persona} audience.`
    )
  }
  
  return parts.join('\n\n')
}

/**
 * Build ADS domain-specific instructions.
 */
function buildDomainInstructions(): string {
  return `### Domain Context: ADS (Academic Search)

You are demonstrating capabilities for an academic/research-focused codebase. Frame all features and examples in this context:

- **Code Search**: Focus on finding research modules, APIs for literature discovery, indexing patterns
- **API Discovery**: Emphasize understanding how search, indexing, and user management services integrate
- **Batch Changes**: Show automating updates across research infrastructure and dependencies
- **Deep Search**: Ask questions about how academic search and indexing work
- **Code Insights**: Track adoption of new search patterns or research methodologies

All queries and examples should be realistic for an academic search platform, not for internal enterprise tools.`
}

// ============================================================================
// Context Serialization
// ============================================================================

/**
 * Serialize demo flow context for inclusion in LLM prompts.
 */
export function serializeDemoFlowContext(context: DemoFlowContext): string {
  const sections: string[] = []
  
  // Repository section
  if (context.repos.length > 0) {
    sections.push('## Selected Demo Repositories\n')
    for (const repo of context.repos) {
      sections.push(`### ${repo.name}`)
      sections.push(`**URL**: ${repo.url}`)
      sections.push(`**Languages**: ${repo.languages.join(', ')}`)
      sections.push(`**Rationale**: ${repo.rationale}`)
      if (repo.alternateUrls && repo.alternateUrls.length > 0) {
        sections.push(`**Alternates**: ${repo.alternateUrls.join(', ')}`)
      }
      sections.push('')
    }
  }
  
  // Profile section
  sections.push('## Customer Profile\n')
  if (context.profile.primaryLanguages.length > 0) {
    sections.push(`- **Languages**: ${context.profile.primaryLanguages.join(', ')}`)
  }
  if (context.profile.mainPainPoints.length > 0) {
    sections.push(`- **Pain Points**: ${context.profile.mainPainPoints.join(', ')}`)
  }
  if (context.profile.useCases.length > 0) {
    sections.push(`- **Use Cases**: ${context.profile.useCases.join(', ')}`)
  }
  if (context.profile.toolsMentioned.length > 0) {
    sections.push(`- **Tools**: ${context.profile.toolsMentioned.join(', ')}`)
  }
  sections.push(`- **Persona**: ${context.profile.persona}`)
  sections.push('')
  
  // Feature mapping
  if (context.featureMapping.length > 0) {
    sections.push('## Recommended Features\n')
    for (const feature of context.featureMapping.slice(0, 5)) {
      sections.push(`### ${feature.feature}`)
      sections.push(`${feature.adsContext}`)
      sections.push(`**Relevance**: ${feature.relevance}`)
      sections.push('')
    }
  }
  
  sections.push(context.instructions)
  
  return sections.join('\n')
}

// ============================================================================
// Error Handling & Validation
// ============================================================================

/**
 * Validate that demo flow context has minimum required data.
 */
export function isValidDemoFlowContext(context: DemoFlowContext): boolean {
  return context.repos.length > 0 && Boolean(context.profile)
}

/**
 * Get a fallback demo flow context when primary selection fails.
 */
export function getFallbackDemoFlowContext(profile: DemoProfile): DemoFlowContext {
  const fallbackRepo: SelectedDemoRepo = {
    url: 'https://github.com/adsabs/adsabs-core',
    name: 'adsabs-core',
    description:
      'Core ADS application - main search and discovery interface. Large-scale academic search platform with multi-language stack',
    languages: ['Python', 'JavaScript', 'TypeScript'],
    rationale: 'Default ADS repository with representative code examples across multiple languages',
  }
  
  return buildDemoFlowContext([fallbackRepo], profile)
}
