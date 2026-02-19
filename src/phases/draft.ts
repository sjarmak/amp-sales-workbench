import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { execute } from '@sourcegraph/amp-sdk'
import type { ConsolidatedSnapshot, CrmPatchProposal, Capabilities } from '../types.js'

export async function generateDrafts(
	snapshot: ConsolidatedSnapshot,
	accountDataDir: string,
	_capabilities?: Capabilities
): Promise<CrmPatchProposal> {
	console.log('   Generating change proposals...')

	// Create drafts directory
	const draftsDir = join(accountDataDir, 'drafts')
	await mkdir(draftsDir, { recursive: true })

	const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '')

	// Note: Executive summary and deal review agents have been migrated to the new framework
	// They should be called via the agent-runner or directly with OpportunityContext
	// For now, we skip these and proceed with the CRM patches

	// Generate CRM patch proposal YAML
	const patchProposal = await generatePatchProposal(snapshot)
	const yamlPath = join(draftsDir, `crm-draft-${timestamp}.yaml`)
	await writeFile(yamlPath, patchProposal.yaml, 'utf-8')
	console.log(`   ✓ CRM draft: ${yamlPath}`)

	// Generate summary markdown
	const summary = await generateSummary(snapshot)
	const summaryPath = join(draftsDir, `summary-${timestamp}.md`)
	await writeFile(summaryPath, summary, 'utf-8')
	console.log(`   ✓ Summary: ${summaryPath}`)

	return patchProposal.proposal
}

async function generatePatchProposal(
	snapshot: ConsolidatedSnapshot
): Promise<{ proposal: CrmPatchProposal; yaml: string }> {
	const promptPath = join(process.cwd(), 'prompts/draft-patches.md')
	const promptTemplate = await readFile(promptPath, 'utf-8')

	const context = `# Consolidated Snapshot\n\n\`\`\`json\n${JSON.stringify(snapshot, null, 2)}\n\`\`\``

	const fullPrompt = `${promptTemplate}\n\n---\n\n${context}\n\nGenerate the CRM patch proposal YAML document.`

	let yamlContent = ''

	for await (const message of execute({ prompt: fullPrompt })) {
		if (message.type === 'assistant') {
			for (const block of message.message.content) {
				if (block.type === 'text') {
					yamlContent += block.text
				}
			}
			process.stdout.write('.') // Progress indicator
		}
	}

	console.log('') // New line

	// Extract YAML from markdown code blocks if present
	const yamlMatch = yamlContent.match(/```ya?ml\n([\s\S]*?)\n```/)
	const yaml = yamlMatch ? yamlMatch[1] : yamlContent

	// Parse the proposal structure (for now, just create minimal structure)
	const proposal: CrmPatchProposal = {
		accountKey: snapshot.accountKey,
		generatedAt: new Date().toISOString(),
		approved: false,
	}

	return { proposal, yaml }
}

async function generateSummary(
	snapshot: ConsolidatedSnapshot
): Promise<string> {
	const promptPath = join(process.cwd(), 'prompts/draft-summary.md')
	const promptTemplate = await readFile(promptPath, 'utf-8')

	const context = `# Consolidated Snapshot\n\n\`\`\`json\n${JSON.stringify(snapshot, null, 2)}\n\`\`\``

	const fullPrompt = `${promptTemplate}\n\n---\n\n${context}\n\nGenerate the markdown summary document.`

	let summaryContent = ''

	for await (const message of execute({ prompt: fullPrompt })) {
		if (message.type === 'assistant') {
			for (const block of message.message.content) {
				if (block.type === 'text') {
					summaryContent += block.text
				}
			}
			process.stdout.write('.') // Progress indicator
		}
	}

	console.log('') // New line

	// Extract markdown from code blocks if present
	const mdMatch = summaryContent.match(/```markdown\n([\s\S]*?)\n```/)
	const markdown = mdMatch ? mdMatch[1] : summaryContent

	return markdown
}
