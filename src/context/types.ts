/**
 * Local Context Store Types
 * 
 * Consolidated account context aggregating all data sources
 * for fast local access without re-parsing raw files.
 */

export interface AccountContext {
	/** Account metadata */
	account: {
		name: string
		domain?: string
		salesforceId?: string
		slug: string
	}

	/** Salesforce data */
	salesforce?: {
		account?: any
		contacts?: any[]
		opportunities?: any[]
		activities?: any[]
		lastSyncedAt?: string
	}

	/** Gong call data */
	gong?: {
		calls?: Array<{
			id: string
			title: string
			startTime: string
			duration: number
			participants: string[]
		}>
		summaries?: Array<{
			callId: string
			transcript: string
			summary?: string
			actionItems?: string[]
			nextSteps?: string[]
			topics?: string[]
		}>
		lastSyncedAt?: string
	}

	/** Prospector research data */
	prospector?: {
		ranAt?: string
		files?: Array<{
			filename: string
			content: string
		}>
	}

	/** Notion pages */
	notion?: {
		accountPage?: any
		relatedPages?: any[]
		lastSyncedAt?: string
	}

	/** When this context was built */
	generatedAt: string
}
