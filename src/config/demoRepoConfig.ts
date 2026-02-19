/**
 * Demo Repository Configuration
 * 
 * Centralized configuration for demo repository selection, including:
 * - Demo repository source (ADS, custom, or none)
 * - GitHub organization details
 * - Curated fallback repositories
 * - Feature-to-use-case mappings
 * 
 * This module allows switching demo repository sources without modifying
 * demo flow logic or prompt templates.
 */

// ============================================================================
// Configuration Types
// ============================================================================

export type DemoRepoProvider = 'ads' | 'custom' | 'none'

export interface DemoRepoConfig {
  /** Provider type for demo repos */
  provider: DemoRepoProvider
  
  /** GitHub organization to source demo repos from */
  org?: string
  
  /** Default repository to use if no match found */
  defaultRepo?: string
  
  /** Language preferences for repo selection */
  languagePrefs?: string[]
  
  /** Curated repositories to fall back to */
  curatedRepos?: CuratedRepo[]
  
  /** Cache configuration for demo repositories */
  cacheRepos?: boolean
  cacheTTLHours?: number
}

export interface CuratedRepo {
  url: string
  description: string
  languages: string[]
  architecturePatterns: string[]
}

export interface DemoRepositorySource {
  org: string
  name: string
  url: string
  description: string
  languages: string[]
  stars?: number
  topicsRelevant?: string[]
}

// ============================================================================
// Configuration Registry
// ============================================================================

/**
 * Default demo repository configuration.
 * Currently set to use ADS (NASA/Harvard Astrophysics Data System).
 */
export const DEFAULT_DEMO_CONFIG: DemoRepoConfig = {
  provider: 'ads',
  org: 'adsabs',
  defaultRepo: 'https://github.com/adsabs/adsabs-core',
  languagePrefs: ['Python', 'JavaScript', 'TypeScript'],
  curatedRepos: [
    {
      url: 'https://github.com/adsabs/adsabs-core',
      description: 'Core ADS application - main search and discovery interface. Large-scale academic search platform with multi-language stack (Python backend, React frontend)',
      languages: ['Python', 'JavaScript', 'TypeScript'],
      architecturePatterns: ['microservices', 'distributed-search', 'api-driven'],
    },
    {
      url: 'https://github.com/adsabs/ADSimport',
      description: 'Data ingestion and normalization pipeline. Shows ETL patterns, data processing, and large-scale document handling',
      languages: ['Python'],
      architecturePatterns: ['data-pipeline', 'batch-processing', 'etl'],
    },
    {
      url: 'https://github.com/adsabs/vault',
      description: 'Vault service for managing citations and collections. Demonstrates API design and data management',
      languages: ['Python'],
      architecturePatterns: ['api-service', 'data-management'],
    },
    {
      url: 'https://github.com/adsabs/solr_service',
      description: 'Search infrastructure built on Solr. Shows integration with enterprise search engines',
      languages: ['Python', 'Java'],
      architecturePatterns: ['search-infra', 'service-integration'],
    },
  ],
  cacheRepos: true,
  cacheTTLHours: 24,
}

// ============================================================================
// Provider-Specific Configurations
// ============================================================================

/**
 * ADS (NASA/Harvard Astrophysics Data System) configuration.
 * Public academic search platform with excellent code examples.
 */
export const ADS_CONFIG: DemoRepoConfig = {
  provider: 'ads',
  org: 'adsabs',
  defaultRepo: 'https://github.com/adsabs/adsabs-core',
  languagePrefs: ['Python', 'JavaScript', 'TypeScript'],
  curatedRepos: DEFAULT_DEMO_CONFIG.curatedRepos,
  cacheRepos: true,
  cacheTTLHours: 24,
}

/**
 * Custom configuration template for future use.
 * Allows pointing to any GitHub organization.
 */
export function createCustomDemoConfig(
  org: string,
  defaultRepo?: string,
  languagePrefs?: string[]
): DemoRepoConfig {
  return {
    provider: 'custom',
    org,
    defaultRepo,
    languagePrefs,
    cacheRepos: true,
    cacheTTLHours: 24,
  }
}

// ============================================================================
// Feature-to-Use-Case Mappings for ADS Context
// ============================================================================

/**
 * Maps demo profile use cases to ADS-specific features and examples.
 * Shapes how features are explained in the context of an academic search platform.
 */
export const ADS_FEATURE_MAPPINGS: Record<string, AdsFeatureMapping> = {
  'code-search': {
    feature: 'Universal Code Search',
    adsContext: 'Search across multiple research modules, APIs, and microservices in the ADS platform',
    useCases: ['onboarding', 'incident-response', 'code-exploration'],
    exampleQueries: [
      'Find all references to the search API across different service modules',
      'Search for authentication handling across frontend and backend code',
      'Locate all database connection management patterns',
    ],
  },
  'api-discovery': {
    feature: 'API Discovery & Cross-Service Navigation',
    adsContext: 'Understand how APIs are used across ADS microservices for search, indexing, and user management',
    useCases: ['api-design', 'refactoring', 'integration'],
    exampleQueries: [
      'Where is the search endpoint defined and how is it called?',
      'How does the indexing service communicate with the core application?',
      'Trace the user authentication flow from frontend to backend',
    ],
  },
  'batch-changes': {
    feature: 'Batch Changes for Library Updates',
    adsContext: 'Automate updates across ADS microservices when dependencies or APIs change',
    useCases: ['dependency-updates', 'security-patching', 'api-migrations'],
    exampleQueries: [
      'Update Python dependencies across all services',
      'Migrate from old API version to new version',
      'Apply security patches across multiple repositories',
    ],
  },
  'deep-search': {
    feature: 'Deep Search - AI-Powered Semantic Understanding',
    adsContext: 'Ask natural language questions about how ADS implements search, indexing, and data retrieval',
    useCases: ['code-understanding', 'architecture-exploration', 'onboarding'],
    exampleQueries: [
      'How does ADS handle search result ranking and scoring?',
      'What are the main components of the indexing pipeline?',
      'How does the system manage bibliographic data?',
    ],
  },
  'code-insights': {
    feature: 'Code Insights & Visibility',
    adsContext: 'Track tech debt, migration progress, and patterns across ADS research modules',
    useCases: ['tech-debt-tracking', 'migration-monitoring'],
    exampleQueries: [
      'Track adoption of new API patterns across services',
      'Monitor Python 2 to Python 3 migration progress',
      'Visualize test coverage trends across modules',
    ],
  },
}

export interface AdsFeatureMapping {
  feature: string
  adsContext: string
  useCases: string[]
  exampleQueries: string[]
}

// ============================================================================
// Repository Selection Helpers
// ============================================================================

/**
 * Get the active demo configuration.
 * Reads from environment variable if set, otherwise uses default (ADS).
 */
export function getActiveDemoConfig(): DemoRepoConfig {
  const provider = process.env.DEMO_REPO_PROVIDER as DemoRepoProvider | undefined
  
  if (!provider || provider === 'ads') {
    return ADS_CONFIG
  }
  
  if (provider === 'none') {
    return { provider: 'none' }
  }
  
  // Custom provider - get config from env
  const org = process.env.DEMO_REPO_ORG
  const defaultRepo = process.env.DEMO_DEFAULT_REPO
  const langPrefs = process.env.DEMO_LANGUAGE_PREFS?.split(',')
  
  if (org) {
    return createCustomDemoConfig(org, defaultRepo, langPrefs)
  }
  
  // Fallback to ADS if env vars are incomplete
  return ADS_CONFIG
}

/**
 * Get curated repositories from the active configuration.
 */
export function getCuratedDemoRepos(): CuratedRepo[] {
  const config = getActiveDemoConfig()
  return config.curatedRepos || []
}

/**
 * Get the default demo repository URL.
 */
export function getDefaultDemoRepo(): string | undefined {
  const config = getActiveDemoConfig()
  return config.defaultRepo
}

/**
 * Get the GitHub organization for demo repos.
 */
export function getDemoRepoOrg(): string | undefined {
  const config = getActiveDemoConfig()
  return config.org
}

/**
 * Get language preferences for demo repo selection.
 */
export function getDemoLanguagePrefs(): string[] {
  const config = getActiveDemoConfig()
  return config.languagePrefs || ['Python', 'JavaScript', 'TypeScript']
}

/**
 * Check if demo repos should be cached.
 */
export function shouldCacheDemoRepos(): boolean {
  const config = getActiveDemoConfig()
  return config.cacheRepos !== false
}

/**
 * Get the cache TTL for demo repositories.
 */
export function getDemoCacheTTL(): number {
  const config = getActiveDemoConfig()
  return (config.cacheTTLHours || 24) * 60 * 60 * 1000
}

// ============================================================================
// Environment Variable Documentation
// ============================================================================

/**
 * DEMO_REPO_PROVIDER
 * Values: 'ads' (default), 'custom', 'none'
 * Controls which organization's repositories are used for demos
 * 
 * DEMO_REPO_ORG
 * Required if DEMO_REPO_PROVIDER='custom'
 * GitHub organization name (e.g., 'adsabs', 'kubernetes', 'facebook')
 * 
 * DEMO_DEFAULT_REPO
 * Optional. Full GitHub URL for default repo if no better match found
 * Example: 'https://github.com/adsabs/adsabs-core'
 * 
 * DEMO_LANGUAGE_PREFS
 * Optional. Comma-separated language preferences for repo selection
 * Example: 'Python,JavaScript,TypeScript'
 * 
 * Example environment configuration:
 * 
 * # Use ADS (default)
 * DEMO_REPO_PROVIDER=ads
 * 
 * # Use custom organization
 * DEMO_REPO_PROVIDER=custom
 * DEMO_REPO_ORG=kubernetes
 * DEMO_DEFAULT_REPO=https://github.com/kubernetes/kubernetes
 * DEMO_LANGUAGE_PREFS=Go,Python,TypeScript
 */
