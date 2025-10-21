import { join } from 'path'
import { readFile, writeFile, access } from 'fs/promises'
import type { IngestedData } from '../types.js'

export type DataSource = 'salesforce' | 'gong' | 'notion'

// Map to actual filenames used by api-server
const FILENAME_MAP: Record<DataSource, string> = {
	salesforce: 'salesforce.json',
	gong: 'gong.json', // Use gong.json for consistency (contains calls, summaries, transcripts)
	notion: 'notion_pages.json',
}

export async function loadRawIfExists(
	accountDataDir: string,
	source: DataSource
): Promise<any | null> {
	const filename = FILENAME_MAP[source]
	const rawPath = join(accountDataDir, 'raw', filename)

	try {
		await access(rawPath)
		const content = await readFile(rawPath, 'utf-8')
		return JSON.parse(content)
	} catch {
		return null
	}
}

export async function writeRaw(
	accountDataDir: string,
	source: DataSource,
	data: any
): Promise<void> {
	const filename = FILENAME_MAP[source]
	const rawPath = join(accountDataDir, 'raw', filename)
	await writeFile(rawPath, JSON.stringify(data, null, 2), 'utf-8')
}

/**
 * Merge new data with existing data for incremental updates
 * Uses ID-based upsert strategy
 */
export async function mergeAndWriteRaw(
	accountDataDir: string,
	source: DataSource,
	newData: any
): Promise<any> {
	const existing = await loadRawIfExists(accountDataDir, source)

	if (!existing) {
		// No existing data, just write new data
		await writeRaw(accountDataDir, source, newData)
		return newData
	}

	// Merge based on source type
	let merged: any

	if (source === 'salesforce') {
		merged = mergeSalesforceData(existing, newData)
	} else if (source === 'gong') {
		merged = mergeGongData(existing, newData)
	} else if (source === 'notion') {
		merged = mergeNotionData(existing, newData)
	} else {
		// Fallback: replace
		merged = newData
	}

	await writeRaw(accountDataDir, source, merged)
	return merged
}

function mergeSalesforceData(existing: any, newData: any): any {
	const existingContacts = Array.isArray(existing.contacts) ? existing.contacts : []
	const existingOpportunities = Array.isArray(existing.opportunities) ? existing.opportunities : []
	const existingActivities = Array.isArray(existing.activities) ? existing.activities : []
	
	return {
		account: newData.account || existing.account,
		contacts: mergeById(existingContacts, newData.contacts || []),
		opportunities: mergeById(existingOpportunities, newData.opportunities || []),
		activities: mergeById(existingActivities, newData.activities || []),
	}
}

function mergeGongData(existing: any, newData: any): any {
	const existingCalls = Array.isArray(existing.calls) ? existing.calls : []
	
	return {
		calls: mergeById(existingCalls, newData.calls || [], 'id'),
		transcripts: {
			...(existing.transcripts || {}),
			...(newData.transcripts || {}),
		},
	}
}

function mergeNotionData(existing: any, newData: any): any {
	const existingPages = Array.isArray(existing.pages) ? existing.pages : []
	
	return {
		pages: mergeById(existingPages, newData.pages || [], 'id'),
	}
}

/**
 * Merge arrays by ID, with newer records taking precedence
 * @param existing Existing records
 * @param incoming New records
 * @param idField Field to use as unique identifier (default: 'Id')
 */
function mergeById<T extends Record<string, any>>(
	existing: T[],
	incoming: T[],
	idField: string = 'Id'
): T[] {
	const merged = new Map<string, T>()

	// Add existing records
	for (const record of existing) {
		const id = record[idField]
		if (id) {
			merged.set(id, record)
		}
	}

	// Upsert with incoming records (overwrites existing)
	for (const record of incoming) {
		const id = record[idField]
		if (id) {
			merged.set(id, record)
		}
	}

	return Array.from(merged.values())
}

/**
 * Save all ingested data to raw files
 */
export async function saveAllRawData(
	accountDataDir: string,
	ingestedData: IngestedData
): Promise<void> {
	await Promise.all([
		writeRaw(accountDataDir, 'salesforce', ingestedData.salesforce),
		writeRaw(accountDataDir, 'gong', ingestedData.gong),
		writeRaw(accountDataDir, 'notion', ingestedData.notion),
	])
}
