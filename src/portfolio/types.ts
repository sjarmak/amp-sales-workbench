/**
 * Portfolio-level knowledge base types
 * 
 * Used for cross-account pattern extraction from 16K Gong calls
 */

/**
 * Use case identified from Gong calls
 */
export interface UseCase {
  id: string
  title: string
  description: string
  frequency: number // How many calls mentioned this
  relatedIndustries: string[]
  relatedFeatures: string[] // code_search, code_insights, deep_search, batch_changes
  exampleQuotes: string[] // Real excerpts from calls
  winRate?: number // 0.0-1.0, if linked to Salesforce outcomes
}

/**
 * Objection or concern raised by customers
 */
export interface Objection {
  id: string
  description: string
  frequency: number
  relatedSegments: string[] // mid-market-saas, enterprise, etc
  rebuttalSuggestions: string[]
  exampleQuotes: string[]
}

/**
 * Success factor or critical winning condition
 */
export interface SuccessFactor {
  id: string
  title: string
  description: string
  weight: number // 0.0-1.0, relative importance
  relatedUseCases: string[]
  relatedFeatures: string[]
}

/**
 * Competitor mentioned in calls
 */
export interface CompetitorMention {
  competitorName: string
  frequency: number
  contextSummary: string
  useCasesCompeted: string[]
  customerSentiment: 'positive' | 'neutral' | 'negative' | 'evaluating'
}

/**
 * Market segment profile (by industry, company size, etc)
 */
export interface SegmentProfile {
  id: string
  name: string // e.g., "Mid-Market SaaS"
  callCount: number
  topUseCases: string[] // Top use cases for this segment
  topObjections: string[]
  avgDealSize?: number
  avgSalesVelocity?: string // e.g., "3-6 months"
}

/**
 * Individual batch analysis result from LLM
 */
export interface BatchAnalysisResult {
  batch: number
  useCases: UseCase[]
  objections: Objection[]
  successFactors: SuccessFactor[]
  competitors: CompetitorMention[]
  segments: SegmentProfile[]
}

/**
 * Global knowledge base built from all batch results
 */
export interface GlobalKnowledgeBase {
  version: string
  generatedAt: string
  sourceCallCount: number
  sourceAccountCount: number

  patterns: {
    useCases: UseCase[]
    objections: Objection[]
    successFactors: SuccessFactor[]
    competitorMentions: CompetitorMention[]
    segments: SegmentProfile[]
  }

  // Generated context documents for agent injection
  contextDocuments: {
    featuresOverview: string
    competitiveContext: string
    segmentProfiles: string
    objectionPlaybook: string
    successStories: string
  }

  // Matrices for cross-reference queries
  matrices: {
    featureByIndustry: Record<string, string[]>
    objectionBySegment: Record<string, string[]>
    useCaseByFeature: Record<string, string[]>
  }
}

/**
 * Portfolio analysis metadata
 */
export interface PortfolioMeta {
  version: number
  lastExtractedAt: string // Last time we queried Parquet
  lastAnalyzedAt: string // Last time we ran LLM analysis
  lastKbBuiltAt: string // Last time we built the KB
  extractedCallCount: number
  analyzedBatchCount: number
}
