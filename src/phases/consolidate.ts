import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { executeWithMode } from '../lib/amp-executor.js'
import type {
	AccountKey,
	IngestedData,
	ConsolidatedSnapshot,
} from '../types.js'

export async function consolidateData(
	accountKey: AccountKey,
	ingestedData: IngestedData,
	accountDataDir: string
): Promise<ConsolidatedSnapshot> {
	console.log('   Merging data sources with AI...')

	// Load consolidation prompt
	const promptPath = join(process.cwd(), 'prompts/consolidate.md')
	const promptTemplate = await readFile(promptPath, 'utf-8')

	// Load prospecting data if available
	const prospectingData = await loadProspectingData(accountDataDir)

	// Build context for AI
	const context = buildConsolidationContext(
		accountKey,
		ingestedData,
		prospectingData
	)

	// Execute consolidation with Amp SDK
	const snapshot = await executeConsolidation(promptTemplate, context)

	// Save snapshot
	const snapshotsDir = join(accountDataDir, 'snapshots')
	await mkdir(snapshotsDir, { recursive: true })

	const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '')
	const snapshotFile = join(snapshotsDir, `snapshot-${timestamp}.json`)

	await writeFile(snapshotFile, JSON.stringify(snapshot, null, 2), 'utf-8')
	console.log(`   Saved snapshot: ${snapshotFile}`)

	return snapshot
}

async function loadProspectingData(
	accountDataDir: string
): Promise<any | null> {
	try {
		const prospectingDir = join(accountDataDir, 'prospecting')
		// Try to load latest prospecting results
		// amp-prospector typically creates files like company-profile.json, news.json, etc.
		const profilePath = join(prospectingDir, 'company-profile.json')
		const content = await readFile(profilePath, 'utf-8')
		return JSON.parse(content)
	} catch (error) {
		return null
	}
}

function buildConsolidationContext(
	accountKey: AccountKey,
	ingestedData: IngestedData,
	prospectingData: any
): string {
	const sections: string[] = []
	const dataGaps: string[] = []

	sections.push(`# Account: ${accountKey.name}`)
	if (accountKey.domain) {
		sections.push(`Domain: ${accountKey.domain}`)
	}
	if (accountKey.salesforceId) {
		sections.push(`Salesforce ID: ${accountKey.salesforceId}`)
	}
	sections.push('')

	// Prospect Research
	if (prospectingData) {
		sections.push('## Prospect Research Data')
		sections.push('```json')
		sections.push(JSON.stringify(prospectingData, null, 2))
		sections.push('```')
		sections.push('')
	}

	// Salesforce
	if (ingestedData.salesforce && !ingestedData.salesforce.warning) {
		sections.push('## Salesforce Data')
		sections.push('```json')
		sections.push(JSON.stringify(ingestedData.salesforce, null, 2))
		sections.push('```')
		sections.push('')
	} else {
		dataGaps.push('Salesforce')
	}

	// Gong
	if (ingestedData.gong && ingestedData.gong.calls && !ingestedData.gong.warning) {
		sections.push('## Gong Call Data')
		sections.push('```json')
		sections.push(JSON.stringify(ingestedData.gong, null, 2))
		sections.push('```')
		sections.push('')
	} else {
		dataGaps.push('Gong')
	}

	// Notion
	if (ingestedData.notion && ingestedData.notion.relatedPages && !ingestedData.notion.warning) {
		sections.push('## Notion Knowledge Base')
		sections.push('```json')
		sections.push(JSON.stringify(ingestedData.notion, null, 2))
		sections.push('```')
		sections.push('')
	} else {
		dataGaps.push('Notion')
	}

	// Add data gap notice
	if (dataGaps.length > 0) {
		sections.push(`\n⚠️  **Data Gaps**: Missing data from ${dataGaps.join(', ')}. Consolidation will be based on available sources only.\n`)
	}

	return sections.join('\n')
}

async function executeConsolidation(
	promptTemplate: string,
	context: string
): Promise<ConsolidatedSnapshot> {
	const fullPrompt = `${promptTemplate}\n\n---\n\n${context}\n\nPlease consolidate this data into a ConsolidatedSnapshot JSON object.`

	let accumulatedText = ''

	// Execute with Amp SDK in fast mode (data consolidation is straightforward)
	for await (const message of executeWithMode({
		prompt: fullPrompt,
		mode: 'fast',
	})) {
		if (message.type === 'assistant') {
			// Extract text from content array
			for (const block of message.message.content) {
				if (block.type === 'text') {
					accumulatedText += block.text
				}
			}
			process.stdout.write('.') // Progress indicator
		}
	}

	console.log('') // New line after progress dots

	// Parse JSON from response
	const snapshot = parseConsolidatedSnapshot(accumulatedText)

	return snapshot
}

function parseConsolidatedSnapshot(text: string): ConsolidatedSnapshot {
	// Extract JSON from markdown code blocks if present
	const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/)
	const jsonText = jsonMatch ? jsonMatch[1] : text

	try {
		return JSON.parse(jsonText)
	} catch (error) {
		throw new Error(
			`Failed to parse consolidated snapshot: ${error instanceof Error ? error.message : 'Unknown error'}`
		)
	}
}
