// Core account identifier
export interface AccountKey {
	name: string
	domain?: string
	salesforceId?: string
	notionPageId?: string // Optional: Per-account Notion page for write-back
	capabilities?: CapabilitiesExtended // Optional: Track which integrations have data for this account
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
	riskHeuristics?: RiskHeuristics // Optional: Computed risk factors for deal health
	upcomingMeetings?: CalendarEvent[] // Optional: Auto-linked calendar events
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

// Capability detection and tracking
export interface Capabilities {
	gong: boolean
	salesforce: boolean
	notion: boolean
	detectedAt: string
}

/**
 * Extended capabilities with OAuth status and last sync metadata
 */
export interface CapabilitiesExtended {
	salesforce: IntegrationCapability
	gong: IntegrationCapability
	notion: IntegrationCapability
	calendar?: IntegrationCapability // Optional for calendar integration
	email?: IntegrationCapability // Optional for email integration
	slack?: IntegrationCapability // Optional for Slack integration
	detectedAt: string
}

/**
 * Individual integration capability with connection status
 */
export interface IntegrationCapability {
	connected: boolean
	oauthStatus?: 'active' | 'expired' | 'invalid' | 'not_configured'
	lastSyncAt?: string
	lastSyncStatus?: 'success' | 'failed' | 'partial'
	syncErrorMessage?: string
	dataAvailable: boolean // Whether any data has been fetched
	recordCount?: number // Approximate count of synced records
}

/**
 * Meeting auto-linking: Calendar event with Salesforce association
 */
export interface CalendarEvent {
	id: string
	title: string
	startTime: string
	endTime: string
	attendees: Attendee[]
	source: 'google' | 'outlook' | 'ical'
	meetingLink?: string
	description?: string
}

/**
 * Attendee information for calendar events
 */
export interface Attendee {
	email: string
	name?: string
	responseStatus?: 'accepted' | 'declined' | 'tentative' | 'needs_action'
}

/**
 * Matching rule for linking calendar events to Salesforce opportunities
 */
export interface AttendeeMatchRule {
	ruleType: 'domain' | 'exact_email' | 'contact_lookup'
	value: string
	priority: number // Lower = higher priority
}

/**
 * Proposed link between calendar event and Salesforce opportunity
 */
export interface MeetingOpportunityLink {
	calendarEventId: string
	opportunityId: string
	opportunityName: string
	confidence: 'high' | 'medium' | 'low'
	confidenceScore: number // 0-100
	matchReasons: string[] // e.g., "2/3 attendees match account contacts", "Domain match"
	matchedAttendees: Array<{
		email: string
		contactId?: string
		contactName?: string
		matchType: 'exact' | 'domain' | 'fuzzy'
	}>
	suggestedAction: 'create_activity' | 'link_only' | 'ignore'
	createdAt: string
}

/**
 * Result of meeting auto-linking for an account
 */
export interface MeetingAutoLinkResult {
	accountKey: AccountKey
	proposedLinks: MeetingOpportunityLink[]
	unmatchedEvents: CalendarEvent[] // Events that couldn't be confidently linked
	appliedLinks?: Array<{
		linkId: string
		salesforceActivityId?: string
		appliedAt: string
		success: boolean
		error?: string
	}>
	generatedAt: string
}

/**
 * Risk heuristics for deal health monitoring
 */
export interface RiskHeuristics {
	noChampion: RiskHeuristic
	staleNextMeeting: RiskHeuristic
	approachingCloseDate: RiskHeuristic
	blockersPresent: RiskHeuristic
	lowEngagement: RiskHeuristic
	competitiveThreats: RiskHeuristic
	budgetUnclear: RiskHeuristic
	decisionProcessStalled: RiskHeuristic
}

/**
 * Individual risk heuristic with severity and detection logic
 */
export interface RiskHeuristic {
	detected: boolean
	severity: 'critical' | 'high' | 'medium' | 'low'
	message: string
	evidence: string[] // Supporting data points
	detectedAt?: string
	threshold?: number // Numeric threshold used for detection (e.g., days since last meeting)
	mitigationSteps?: string[]
}

/**
 * Daily digest preferences per user or team
 */
export interface DigestPreferences {
	userId?: string
	teamId?: string
	enabled: boolean
	timezone: string // IANA timezone (e.g., "America/New_York")
	deliveryTime: string // HH:MM format (e.g., "08:00")
	deliveryChannel: 'email' | 'slack' | 'both'
	emailAddress?: string
	slackChannelId?: string
	contentPreferences: DigestContentPreferences
	accountFilters?: DigestAccountFilters
	updatedAt: string
}

/**
 * Content preferences for daily digest
 */
export interface DigestContentPreferences {
	includeNewLeads: boolean
	includeCallSummaries: boolean
	includeRiskAlerts: boolean
	includeUpcomingMeetings: boolean
	includeStaleOpportunities: boolean
	includeActionItems: boolean
	includeDealHealthScores: boolean
	includeCompetitiveIntel: boolean
	minRiskSeverity?: 'critical' | 'high' | 'medium' | 'low' // Only show risks at or above this level
}

/**
 * Filters for which accounts to include in digest
 */
export interface DigestAccountFilters {
	accountOwners?: string[] // Salesforce user IDs
	accountSegments?: string[] // e.g., "Enterprise", "Mid-Market"
	industries?: string[]
	minDealSize?: number
	stages?: string[] // Opportunity stages to monitor
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

// Meeting Summary
export interface MeetingSummary {
	accountKey: AccountKey
	callId: string
	callTitle?: string
	callDate?: string
	objectives: string[]
	blockers: string[]
	nextSteps: string[]
	stakeholders: Stakeholder[]
	meddicHints: MEDDICHints
	generatedAt: string
}

export interface Stakeholder {
	name?: string
	role?: string
	engagementLevel: 'high' | 'medium' | 'low'
	keyComments?: string[]
}

export interface MEDDICHints {
	metrics: string[] // ROI, KPIs, success metrics mentioned
	economicBuyer: string[] // Budget authority, final decision maker signals
	decisionCriteria: string[] // Requirements, evaluation factors
	decisionProcess: string[] // Approval steps, timeline, stakeholders involved
	identifyPain: string[] // Problems, challenges, pain points
	champion: string[] // Internal advocate, enthusiasm signals
}

