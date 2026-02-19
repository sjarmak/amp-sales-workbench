/**
 * Configuration for linking Gong calls to Salesforce records
 * 
 * This module provides typed configuration for detecting and linking Gong calls
 * stored as Salesforce Tasks back to Gong call metadata. Used by:
 * - salesforce.ts: fetchActivities to detect Gong-linked tasks
 * - consolidate.ts: map SF tasks to Gong calls for unified timeline
 */

import { readFile } from 'fs/promises'
import { join } from 'path'

/**
 * Configuration for matching Salesforce Tasks to Gong calls
 */
export interface GongSfdcTaskMatching {
	/** Patterns to match in Task.Subject field */
	subjectPatterns: string[]
	/** Patterns to match in Task.Description field (e.g., Gong URLs) */
	descriptionPatterns: string[]
}

/**
 * Custom Salesforce field names for Gong integration
 * These vary by org based on Gong package installation
 */
export interface GongSfdcCustomFields {
	task: {
		/** Custom field storing Gong call ID on Task records */
		gongCallId: string
		/** Custom field storing Gong recording URL on Task records */
		gongRecordingUrl: string
	}
	opportunity: {
		/** Last Gong call date rollup on Opportunity */
		lastGongCallDate: string
		/** Count of Gong calls linked to Opportunity */
		gongCallCount: string
	}
	account: {
		/** Last Gong call date rollup on Account */
		lastGongCallDate: string
		/** Total Gong calls linked to Account */
		totalGongCalls: string
	}
}

/**
 * Configuration for fuzzy matching when direct Gong_Call_Id__c is not available
 */
export interface GongSfdcFuzzyMatching {
	/** Enable fuzzy matching by date and title */
	enabled: boolean
	/** Time window (minutes) to consider for matching calls */
	timeWindowMinutes: number
	/** Minimum similarity score (0-1) for title matching */
	titleSimilarityThreshold: number
}

/**
 * Behavior settings for linking operations
 */
export interface GongSfdcLinkingBehavior {
	/** Create Activity in SF if Gong call has no corresponding Task */
	createActivityIfMissing: boolean
	/** Update existing Activity with Gong metadata */
	updateExistingActivity: boolean
	/** Link Gong calls to Opportunity when possible */
	linkToOpportunity: boolean
	/** Link Gong calls to Contact when possible */
	linkToContact: boolean
}

/**
 * Complete Gong-SFDC configuration
 */
export interface GongSfdcConfig {
	version: string
	taskMatching: GongSfdcTaskMatching
	customFields: GongSfdcCustomFields
	fuzzyMatching: GongSfdcFuzzyMatching
	linkingBehavior: GongSfdcLinkingBehavior
}

/**
 * Cached configuration instance
 */
let cachedConfig: GongSfdcConfig | null = null

/**
 * Load Gong-SFDC configuration from JSON file
 * Uses config/salesforceGongConfig.json, falls back to defaults if not found
 */
export async function loadGongSfdcConfig(): Promise<GongSfdcConfig> {
	if (cachedConfig) {
		return cachedConfig
	}

	try {
		const configPath = join(process.cwd(), 'config', 'salesforceGongConfig.json')
		const content = await readFile(configPath, 'utf-8')
		const json = JSON.parse(content)
		cachedConfig = json.config as GongSfdcConfig
		return cachedConfig
	} catch (error) {
		// Return default configuration
		cachedConfig = getDefaultConfig()
		return cachedConfig
	}
}

/**
 * Get default configuration (used when config file is missing)
 */
function getDefaultConfig(): GongSfdcConfig {
	return {
		version: '1.0-default',
		taskMatching: {
			subjectPatterns: ['Gong', 'Call Recording', '[Gong]'],
			descriptionPatterns: ['gong.io/call', 'app.gong.io'],
		},
		customFields: {
			task: {
				gongCallId: 'Gong_Call_Id__c',
				gongRecordingUrl: 'Gong_Recording_URL__c',
			},
			opportunity: {
				lastGongCallDate: 'Last_Gong_Call_Date__c',
				gongCallCount: 'Gong_Call_Count__c',
			},
			account: {
				lastGongCallDate: 'Last_Gong_Call_Date__c',
				totalGongCalls: 'Total_Gong_Calls__c',
			},
		},
		fuzzyMatching: {
			enabled: true,
			timeWindowMinutes: 30,
			titleSimilarityThreshold: 0.7,
		},
		linkingBehavior: {
			createActivityIfMissing: false,
			updateExistingActivity: true,
			linkToOpportunity: true,
			linkToContact: true,
		},
	}
}

/**
 * Check if a Salesforce Task is a Gong-linked activity
 * @param task Salesforce Task record
 * @param config Optional config (loaded if not provided)
 */
export async function isGongLinkedTask(
	task: { Subject?: string; Description?: string; [key: string]: any },
	config?: GongSfdcConfig
): Promise<boolean> {
	const cfg = config || (await loadGongSfdcConfig())

	// Check for direct Gong call ID field
	const gongIdField = cfg.customFields.task.gongCallId
	if (task[gongIdField]) {
		return true
	}

	// Check subject patterns
	const subject = (task.Subject || '').toLowerCase()
	for (const pattern of cfg.taskMatching.subjectPatterns) {
		if (subject.includes(pattern.toLowerCase())) {
			return true
		}
	}

	// Check description patterns
	const description = (task.Description || '').toLowerCase()
	for (const pattern of cfg.taskMatching.descriptionPatterns) {
		if (description.includes(pattern.toLowerCase())) {
			return true
		}
	}

	return false
}

/**
 * Extract Gong call ID from a Salesforce Task
 * Tries custom field first, then parses from description URL
 */
export async function extractGongCallId(
	task: { Subject?: string; Description?: string; [key: string]: any },
	config?: GongSfdcConfig
): Promise<string | null> {
	const cfg = config || (await loadGongSfdcConfig())

	// Try custom field first
	const gongIdField = cfg.customFields.task.gongCallId
	if (task[gongIdField]) {
		return String(task[gongIdField])
	}

	// Try to extract from Gong URL in description
	const description = task.Description || ''
	const urlMatch = description.match(/gong\.io\/call\/(\d+)/i) ||
		description.match(/app\.gong\.io\/call[s]?\/(\d+)/i)
	if (urlMatch) {
		return urlMatch[1]
	}

	return null
}

/**
 * Clear cached configuration (for testing)
 */
export function clearConfigCache(): void {
	cachedConfig = null
}
