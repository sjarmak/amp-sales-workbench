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
	outputDir: string
}
