import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { execute } from '@sourcegraph/amp-sdk'
import type { AccountKey } from '../types.js'

export type BackfillableField =
	| 'Industry'
	| 'Company_Size__c'
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

export async function runBackfillAgent(
	accountKey: AccountKey,
	accountDataDir: string,
	fieldsToBackfill?: BackfillableField[]
): Promise<BackfillReport> {
	console.log('\n🔍 Running AI Backfill Agent...')

	const defaultFields: BackfillableField[] = [
		'Industry',
		'Company_Size__c',
		'Pain_Points__c',
		'Use_Case__c',
		'Decision_Criteria__c',
		'Budget_Range__c',
		'Timeline__c',
		'Competitors_Evaluated__c',
	]

	const targetFields = fieldsToBackfill || defaultFields

	// Load all available data
	const rawData = await loadAccountData(accountDataDir)
	const promptTemplate = await readFile(
		join(process.cwd(), 'prompts/backfill.md'),
		'utf-8'
	)

	// Build context
	const context = buildBackfillPrompt(accountKey, targetFields, rawData)

	// Execute with Amp SDK
	const report = await executeBackfill(promptTemplate, context)

	// Save outputs
	const backfillDir = join(accountDataDir, 'backfill')
	await mkdir(backfillDir, { recursive: true })

	const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
	const baseFilename = `backfill-${timestamp}`

	await writeFile(
		join(backfillDir, `${baseFilename}.json`),
		JSON.stringify(report, null, 2),
		'utf-8'
	)

	await writeFile(
		join(backfillDir, `${baseFilename}.yaml`),
		formatBackfillYaml(report),
		'utf-8'
	)

	console.log(`   ✓ Backfill proposals saved to ${backfillDir}`)
	console.log(
		`   ℹ️  Review ${baseFilename}.yaml and apply with Salesforce sync if approved`
	)

	return report
}

async function loadAccountData(accountDataDir: string): Promise<any> {
	const data: any = {
		salesforce: null,
		gong: null,
		snapshots: [],
	}

	try {
		const rawSfPath = join(accountDataDir, 'raw/salesforce.json')
		data.salesforce = JSON.parse(await readFile(rawSfPath, 'utf-8'))
	} catch {}

	try {
		const rawGongPath = join(accountDataDir, 'raw/gong_calls.json')
		data.gong = JSON.parse(await readFile(rawGongPath, 'utf-8'))
	} catch {}

	return data
}

function buildBackfillPrompt(
	accountKey: AccountKey,
	targetFields: BackfillableField[],
	rawData: any
): string {
	const sections: string[] = []

	sections.push(`# AI Backfill Request`)
	sections.push(`Account: ${accountKey.name}`)
	sections.push(`Fields to Backfill: ${targetFields.join(', ')}`)
	sections.push('')

	sections.push('## Available Data')
	sections.push('```json')
	sections.push(JSON.stringify(rawData, null, 2))
	sections.push('```')

	return sections.join('\n')
}

async function executeBackfill(
	promptTemplate: string,
	context: string
): Promise<BackfillReport> {
	const fullPrompt = `${promptTemplate}\n\n---\n\n${context}\n\nAnalyze the historical data and propose values for missing CRM fields as a BackfillReport JSON object.`

	let accumulatedText = ''

	for await (const message of execute({ prompt: fullPrompt })) {
		if (message.type === 'assistant') {
			for (const block of message.message.content) {
				if (block.type === 'text') {
					accumulatedText += block.text
				}
			}
			process.stdout.write('.')
		}
	}

	console.log('')

	return parseBackfillReport(accumulatedText)
}

function parseBackfillReport(text: string): BackfillReport {
	const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/)
	const jsonText = jsonMatch ? jsonMatch[1] : text

	try {
		return JSON.parse(jsonText)
	} catch (error) {
		throw new Error(
			`Failed to parse backfill report: ${error instanceof Error ? error.message : 'Unknown error'}`
		)
	}
}

function formatBackfillYaml(report: BackfillReport): string {
	const lines: string[] = []

	lines.push(`# AI Backfill Proposals for ${report.accountKey.name}`)
	lines.push(`# Generated: ${new Date(report.generatedAt).toLocaleString()}`)
	lines.push(`# Review these proposals and apply approved changes to Salesforce`)
	lines.push('')
	lines.push('proposals:')

	for (const proposal of report.proposals) {
		lines.push(`  - field: ${proposal.field}`)
		lines.push(`    currentValue: ${JSON.stringify(proposal.currentValue)}`)
		lines.push(`    proposedValue: ${JSON.stringify(proposal.proposedValue)}`)
		lines.push(`    confidence: ${proposal.confidence}`)
		lines.push(`    reasoning: "${proposal.reasoning.replace(/"/g, '\\"')}"`)
		lines.push(`    sourceEvidence:`)
		for (const evidence of proposal.sourceEvidence) {
			lines.push(`      - source: ${evidence.source}`)
			if (evidence.date) lines.push(`        date: "${evidence.date}"`)
			lines.push(`        excerpt: "${evidence.excerpt.replace(/"/g, '\\"')}"`)
			if (evidence.sourceId) lines.push(`        sourceId: "${evidence.sourceId}"`)
		}
		lines.push('')
	}

	lines.push('# To apply these changes:')
	lines.push('# 1. Review each proposal carefully')
	lines.push('# 2. Edit or remove any incorrect proposals')
	lines.push('# 3. Run: npm run manage "<account>" -- --apply-backfill <filename>')

	return lines.join('\n')
}
