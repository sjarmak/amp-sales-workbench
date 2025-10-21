import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { execute } from '@sourcegraph/amp-sdk'
import type { AccountKey, QualificationReport, QualMethodology, ConsolidatedSnapshot } from '../types.js'

export async function generateQualification(
	accountKey: AccountKey,
	accountDataDir: string,
	methodology: QualMethodology = 'MEDDIC'
): Promise<QualificationReport> {
	console.log(`   Generating ${methodology} qualification...`)

	// Load latest consolidated snapshot
	const snapshot = await loadLatestSnapshot(accountDataDir)

	// Load prompt template
	const promptPath = join(process.cwd(), 'prompts/qualification.md')
	const promptTemplate = await readFile(promptPath, 'utf-8')

	// Build context
	const context = buildQualificationContext(snapshot, methodology)

	// Execute with Amp SDK
	const report = await executeQualificationGeneration(promptTemplate, context, accountKey, methodology)

	// Save outputs
	const qualDir = join(accountDataDir, 'qualification')
	await mkdir(qualDir, { recursive: true })

	const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '')

	// Save JSON
	const jsonPath = join(qualDir, `qual-${timestamp}.json`)
	await writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf-8')

	// Save Markdown
	const mdContent = formatQualificationAsMarkdown(report)
	const mdPath = join(qualDir, `qual-${timestamp}.md`)
	await writeFile(mdPath, mdContent, 'utf-8')

	console.log(`   Saved qualification report: ${jsonPath}`)
	return report
}

async function loadLatestSnapshot(accountDataDir: string): Promise<ConsolidatedSnapshot> {
	const snapshotsDir = join(accountDataDir, 'snapshots')
	const { readdir } = await import('fs/promises')
	const files = await readdir(snapshotsDir)
	const snapshotFiles = files.filter((f) => f.startsWith('snapshot-') && f.endsWith('.json'))

	if (snapshotFiles.length === 0) {
		throw new Error('No consolidated snapshot found. Run consolidation first.')
	}

	snapshotFiles.sort().reverse()
	const latestFile = join(snapshotsDir, snapshotFiles[0])

	const content = await readFile(latestFile, 'utf-8')
	return JSON.parse(content)
}

function buildQualificationContext(snapshot: ConsolidatedSnapshot, methodology: QualMethodology): string {
	const sections: string[] = []

	sections.push(`# Qualification Methodology: ${methodology}`)
	sections.push('')
	sections.push(getMethodologyDescription(methodology))
	sections.push('')
	sections.push('# Consolidated Account Data')
	sections.push('```json')
	sections.push(JSON.stringify(snapshot, null, 2))
	sections.push('```')

	return sections.join('\n')
}

function getMethodologyDescription(methodology: QualMethodology): string {
	const descriptions: Record<QualMethodology, string> = {
		MEDDIC: `
**MEDDIC Criteria:**
1. **Metrics** - Economic impact, quantifiable value
2. **Economic Buyer** - Who has budget authority
3. **Decision Criteria** - How they will evaluate and decide
4. **Decision Process** - Steps and timeline to purchase
5. **Identify Pain** - Business problems and urgency
6. **Champion** - Internal advocate for the solution
		`.trim(),
		BANT: `
**BANT Criteria:**
1. **Budget** - Financial resources available
2. **Authority** - Decision-making power
3. **Need** - Business problem or requirement
4. **Timeline** - When they need to implement
		`.trim(),
		SPICED: `
**SPICED Criteria:**
1. **Situation** - Current state and context
2. **Pain** - Problems and challenges
3. **Impact** - Consequences of not solving
4. **Critical Event** - Why now, what's driving urgency
5. **Decision** - Who decides and how
		`.trim(),
	}

	return descriptions[methodology]
}

async function executeQualificationGeneration(
	promptTemplate: string,
	context: string,
	accountKey: AccountKey,
	methodology: QualMethodology
): Promise<QualificationReport> {
	const fullPrompt = `${promptTemplate}\n\n---\n\n${context}\n\nGenerate a qualification report as a JSON object.`

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

	// Parse JSON response
	const jsonMatch = accumulatedText.match(/```json\n([\s\S]*?)\n```/)
	const jsonText = jsonMatch ? jsonMatch[1] : accumulatedText

	try {
		const parsed = JSON.parse(jsonText)
		return {
			accountKey,
			methodology,
			criteria: parsed.criteria || [],
			overallScore: parsed.overallScore || 0,
			gaps: parsed.gaps || [],
			suggestedQuestions: parsed.suggestedQuestions || [],
			proposedFieldUpdates: parsed.proposedFieldUpdates || { changes: {} },
			generatedAt: new Date().toISOString(),
		}
	} catch (error) {
		throw new Error(`Failed to parse qualification report: ${error instanceof Error ? error.message : 'Unknown error'}`)
	}
}

function formatQualificationAsMarkdown(report: QualificationReport): string {
	const sections: string[] = []

	sections.push(`# ${report.methodology} Qualification: ${report.accountKey.name}`)
	sections.push(`*Generated: ${new Date(report.generatedAt).toLocaleString()}*`)
	sections.push('')

	sections.push(`## Overall Score: ${report.overallScore.toFixed(1)}/5.0`)
	sections.push('')

	sections.push('## Criteria Assessment')
	report.criteria.forEach((criterion) => {
		const stars = '⭐'.repeat(Math.round(criterion.score))
		sections.push(`### ${criterion.name} - ${criterion.score}/5 ${stars}`)
		sections.push('')
		sections.push(`**Interpretation:** ${criterion.interpretation}`)
		sections.push('')
		if (criterion.evidence.length > 0) {
			sections.push('**Evidence:**')
			criterion.evidence.forEach((ev) => {
				sections.push(`- ${ev}`)
			})
		}
		sections.push('')
	})

	if (report.gaps.length > 0) {
		sections.push('## Gaps & Missing Information')
		const highGaps = report.gaps.filter((g) => g.priority === 'high')
		const medGaps = report.gaps.filter((g) => g.priority === 'medium')
		const lowGaps = report.gaps.filter((g) => g.priority === 'low')

		if (highGaps.length > 0) {
			sections.push('### 🔴 High Priority')
			highGaps.forEach((gap) => {
				sections.push(`- **${gap.criterion}**: ${gap.missingInfo}`)
			})
			sections.push('')
		}

		if (medGaps.length > 0) {
			sections.push('### 🟡 Medium Priority')
			medGaps.forEach((gap) => {
				sections.push(`- **${gap.criterion}**: ${gap.missingInfo}`)
			})
			sections.push('')
		}

		if (lowGaps.length > 0) {
			sections.push('### 🟢 Low Priority')
			lowGaps.forEach((gap) => {
				sections.push(`- **${gap.criterion}**: ${gap.missingInfo}`)
			})
			sections.push('')
		}
	}

	if (report.suggestedQuestions.length > 0) {
		sections.push('## Suggested Discovery Questions')
		report.suggestedQuestions.forEach((q) => {
			sections.push(`- ${q}`)
		})
		sections.push('')
	}

	if (Object.keys(report.proposedFieldUpdates.changes || {}).length > 0) {
		sections.push('## Proposed Salesforce Updates')
		sections.push('```yaml')
		Object.entries(report.proposedFieldUpdates.changes).forEach(([field, change]) => {
			sections.push(`${field}:`)
			sections.push(`  before: ${change.before}`)
			sections.push(`  after: ${change.after}`)
			sections.push(`  confidence: ${change.confidence}`)
		})
		sections.push('```')
	}

	return sections.join('\n')
}
