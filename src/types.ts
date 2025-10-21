// Core account identifier
export interface AccountKey {
	name: string
	domain?: string
	salesforceId?: string
}

// Raw data from MCP servers
export interface IngestedData {
	salesforce: {
		account?: any
		contacts?: any[]
		opportunities?: any[]
		activities?: any[]
		emails?: any[]
		lastSyncedAt: string
	}
	gong: {
		calls?: any[]
		summaries?: any[]
		lastSyncedAt: string
	}
	notion: {
		accountPage?: any
		relatedPages?: any[]
		lastSyncedAt: string
	}
}

// Consolidated snapshot after merging all sources
export interface ConsolidatedSnapshot {
	accountKey: AccountKey
	accountProfile: {
		name: string
		domain?: string
		industry?: string
		size?: string
		summary?: string
	}
	contacts: Contact[]
	opportunities: Opportunity[]
	signals: AccountSignals
	deltas: DeltaAnalysis
	generatedAt: string
}

export interface Contact {
	id?: string
	name: string
	email?: string
	title?: string
	role?: string
	lastInteraction?: string
	source: string[]
}

export interface Opportunity {
	id?: string
	name: string
	stage: string
	amount?: number
	closeDate?: string
	feedbackTrends?: string
	successCriteria?: string
	featureRequests?: string[]
	likelihood?: string
	pathToClose?: string
	source: string[]
}

export interface AccountSignals {
	recentCallInsights?: CallInsight[]
	competitiveMentions?: string[]
	objections?: string[]
	champions?: string[]
	risks?: string[]
	nextActions?: string[]
}

export interface CallInsight {
	date: string
	summary: string
	actionItems?: string[]
	sentiment?: string
	topics?: string[]
}

export interface DeltaAnalysis {
	accountChanges: Delta[]
	contactChanges: Delta[]
	opportunityChanges: Delta[]
}

export interface Delta {
	field: string
	currentValue: any
	proposedValue: any
	source: string[]
	confidence: 'high' | 'medium' | 'low'
}

// Change proposal for CRM
export interface CrmPatchProposal {
	accountKey: AccountKey
	account?: Patch
	contacts?: ContactPatch[]
	opportunities?: OpportunityPatch[]
	generatedAt: string
	approved: boolean
}

export interface Patch {
	id?: string
	changes: Record<string, FieldChange>
}

export interface FieldChange {
	before: any
	after: any
	confidence: 'high' | 'medium' | 'low'
	source: string[]
	reasoning?: string
}

export interface ContactPatch extends Patch {
	email?: string // Key for matching
}

export interface OpportunityPatch extends Patch {
	name?: string // Key for matching
}

// Applied change receipt
export interface ApplyReceipt {
	accountKey: AccountKey
	appliedAt: string
	patches: {
		account?: AppliedPatch
		contacts?: AppliedPatch[]
		opportunities?: AppliedPatch[]
	}
	errors?: string[]
}

export interface AppliedPatch {
	id: string
	success: boolean
	error?: string
	fieldsUpdated?: string[]
}

// Capability detection
export interface Capabilities {
	gong: boolean
	salesforce: boolean
	notion: boolean
	detectedAt: string
}

// Orchestrator input/output
export interface WorkbenchInput {
	accountKey: AccountKey
	forceResearch?: boolean
	forceSync?: boolean
	apply?: boolean
}

export interface WorkbenchResult {
	accountKey: AccountKey
	snapshot: ConsolidatedSnapshot
	draft: CrmPatchProposal
	applied?: ApplyReceipt
	notionMirror?: {
		success: boolean
		pageUrl?: string
		error?: string
	}
	outputDir: string
}

// Executive Summary
export interface ExecutiveSummary {
	accountKey: AccountKey
	problemStatement: string
	solutionFit: string
	successMetrics: string[]
	socialProof: string[]
	nextSteps: string[]
	generatedAt: string
}

// Deal Review
export interface DealReview {
	accountKey: AccountKey
	dealHealthScore: number // 0-100
	status: string
	strategy: string
	riskFactors: RiskFactor[]
	pathToClose: string
	coachingTips: string[]
	blockers: string[]
	champions: string[]
	objections: string[]
	generatedAt: string
}

export interface RiskFactor {
	risk: string
	severity: 'high' | 'medium' | 'low'
	mitigation?: string
}

// Qualification
export type QualMethodology = 'MEDDIC' | 'BANT' | 'SPICED'

export interface QualificationReport {
	accountKey: AccountKey
	methodology: QualMethodology
	criteria: QualCriterion[]
	overallScore: number // Average of criteria scores
	gaps: QualGap[]
	suggestedQuestions: string[]
	proposedFieldUpdates: Patch
	generatedAt: string
}

export interface QualCriterion {
	name: string
	score: number // 1-5
	evidence: string[]
	interpretation: string
}

export interface QualGap {
	criterion: string
	missingInfo: string
	priority: 'high' | 'medium' | 'low'
}

// Handoff
export type HandoffType = 'SE→AE' | 'AE→CS' | 'CS→Support'

export interface HandoffContext {
	accountKey: AccountKey
	handoffType: HandoffType
	problemSummary: string
	technicalEnvironment: {
		stack?: string[]
		deployment?: string
		integrations?: string[]
		scale?: string
	}
	stakeholders: Array<{
		name: string
		role: string
		engagement: string
		concerns?: string[]
	}>
	successCriteria: string[]
	completedWork: string[]
	knownBlockers: string[]
	openQuestions: string[]
	nextActions: string[]
	artifacts: Array<{
		type: 'call' | 'demo' | 'doc' | 'poc' | 'trial'
		title: string
		url?: string
		date?: string
		summary?: string
	}>
	timeline: {
		startDate?: string
		keyDates?: Array<{ date: string; event: string }>
		targetDate?: string
	}
	trialResults?: {
		duration?: string
		metrics?: Record<string, string>
		feedback?: string
		outcome?: string
	}
	generatedAt: string
}

// Closed-Lost
export type ClosedLostReason =
	| 'Price'
	| 'Features'
	| 'Timing'
	| 'Competitor'
	| 'Budget'
	| 'No Decision'
	| 'Technical Fit'
	| 'Champion Lost'
	| 'Other'

export interface ClosedLostAnalysis {
	accountKey: AccountKey
	opportunityId?: string
	opportunityName?: string
	primaryReason: ClosedLostReason
	secondaryFactors: string[]
	competitorWon?: string
	objectionHistory: Array<{
		date?: string
		objection: string
		response?: string
		resolved: boolean
	}>
	whatCouldHaveBeenDifferent: string[]
	lessonsLearned: string[]
	productFeedback: Array<{
		category: 'Missing Feature' | 'Pricing' | 'Usability' | 'Integration' | 'Performance' | 'Support'
		detail: string
		priority: 'high' | 'medium' | 'low'
	}>
	competitiveIntel: Array<{
		competitor: string
		strengthsTheyLeveraged: string[]
		ourWeaknesses: string[]
	}>
	proposedSalesforceUpdates: {
		closedLostReason: ClosedLostReason
		closedLostDetails?: string
		competitor?: string
		lessonsLearned?: string
	}
	generatedAt: string
}

// AI Backfill
export type BackfillableField =
	| 'Industry'
	| 'Company_Size__c'
	| 'Annual_Revenue__c'
	| 'Pain_Points__c'
	| 'Use_Case__c'
	| 'Decision_Criteria__c'
	| 'Budget_Range__c'
	| 'Timeline__c'
	| 'Competitors_Evaluated__c'
	| 'Technical_Requirements__c'
	| 'Integration_Needs__c'
	| 'Security_Requirements__c'
	| 'Compliance_Needs__c'

export interface BackfillProposal {
	field: BackfillableField
	currentValue: any
	proposedValue: any
	confidence: 'high' | 'medium' | 'low'
	sourceEvidence: Array<{
		source: 'call' | 'email' | 'note' | 'transcript'
		date?: string
		excerpt: string
		sourceId?: string
	}>
	reasoning: string
}

export interface BackfillReport {
	accountKey: AccountKey
	proposals: BackfillProposal[]
	generatedAt: string
}

