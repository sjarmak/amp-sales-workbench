import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import type { AccountKey, CrmPatchProposal, ApplyReceipt, AppliedPatch } from '../../types.js'
import { callSalesforceGetRecord, callSalesforceUpdateRecord } from '../ingest/mcp-wrapper.js'

export async function applySalesforceChanges(
	accountKey: AccountKey,
	draftYamlPath: string,
	accountDataDir: string
): Promise<ApplyReceipt> {
	console.log(`   Loading draft: ${draftYamlPath}`)

	// Read and parse YAML
	const yamlContent = await readFile(draftYamlPath, 'utf-8')
	const proposal = parseYamlProposal(yamlContent)

	// Validate approval
	if (!proposal.approved) {
		throw new Error('Draft must be approved before applying. Set approved: true in YAML.')
	}

	const receipt: ApplyReceipt = {
		accountKey,
		appliedAt: new Date().toISOString(),
		patches: {},
		errors: [],
	}

	// Apply account changes
	if (proposal.account && proposal.account.changes) {
		console.log('   Applying account changes...')
		try {
			const result = await applyAccountPatch(proposal.account)
			receipt.patches.account = result
		} catch (error) {
			receipt.errors?.push(`Account: ${error instanceof Error ? error.message : 'Unknown error'}`)
		}
	}

	// Apply contact changes
	if (proposal.contacts && proposal.contacts.length > 0) {
		console.log(`   Applying ${proposal.contacts.length} contact changes...`)
		receipt.patches.contacts = []
		for (const contactPatch of proposal.contacts) {
			try {
				const result = await applyContactPatch(contactPatch)
				receipt.patches.contacts.push(result)
			} catch (error) {
				receipt.errors?.push(`Contact ${contactPatch.email}: ${error instanceof Error ? error.message : 'Unknown error'}`)
			}
		}
	}

	// Apply opportunity changes
	if (proposal.opportunities && proposal.opportunities.length > 0) {
		console.log(`   Applying ${proposal.opportunities.length} opportunity changes...`)
		receipt.patches.opportunities = []
		for (const oppPatch of proposal.opportunities) {
			try {
				const result = await applyOpportunityPatch(oppPatch)
				receipt.patches.opportunities.push(result)
			} catch (error) {
				receipt.errors?.push(`Opportunity ${oppPatch.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
			}
		}
	}

	// Save receipt
	const appliedDir = join(accountDataDir, 'applied')
	await mkdir(appliedDir, { recursive: true })

	const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '')
	const receiptPath = join(appliedDir, `apply-${timestamp}.json`)
	await writeFile(receiptPath, JSON.stringify(receipt, null, 2), 'utf-8')
	console.log(`   Saved receipt: ${receiptPath}`)

	return receipt
}

function parseYamlProposal(yaml: string): CrmPatchProposal {
	// TODO: Use proper YAML parser (js-yaml or similar)
	// For now, this is a placeholder that would need a YAML library
	console.warn('YAML parsing stubbed - needs js-yaml package')
	
	// Return minimal structure
	return {
		accountKey: { name: 'Unknown', salesforceId: '' },
		generatedAt: new Date().toISOString(),
		approved: false,
	}
}

async function applyAccountPatch(patch: any): Promise<AppliedPatch> {
	if (!patch.id) {
		throw new Error('Account ID required')
	}

	// Check optimistic concurrency
	const currentRecord = await fetchSalesforceRecord('Account', patch.id)
	
	// Build update payload with only changed fields
	const updates: Record<string, any> = {}
	const fieldsUpdated: string[] = []

	for (const [field, change] of Object.entries(patch.changes || {})) {
		const changeData = change as any
		
		// Verify current value matches expected "before" value
		if (currentRecord[field] !== changeData.before) {
			console.warn(`Concurrency conflict on ${field}: expected "${changeData.before}", found "${currentRecord[field]}"`)
			// Skip this field to avoid overwriting unexpected changes
			continue
		}

		updates[field] = changeData.after
		fieldsUpdated.push(field)
	}

	if (fieldsUpdated.length === 0) {
		return {
			id: patch.id,
			success: true,
			fieldsUpdated: [],
		}
	}

	// Apply update via Salesforce MCP
	await updateSalesforceRecord('Account', patch.id, updates)

	return {
		id: patch.id,
		success: true,
		fieldsUpdated,
	}
}

async function applyContactPatch(patch: any): Promise<AppliedPatch> {
	if (!patch.id) {
		throw new Error('Contact ID required')
	}

	// Similar logic to applyAccountPatch
	const currentRecord = await fetchSalesforceRecord('Contact', patch.id)
	
	const updates: Record<string, any> = {}
	const fieldsUpdated: string[] = []

	for (const [field, change] of Object.entries(patch.changes || {})) {
		const changeData = change as any
		
		if (currentRecord[field] !== changeData.before) {
			console.warn(`Concurrency conflict on Contact ${field}`)
			continue
		}

		updates[field] = changeData.after
		fieldsUpdated.push(field)
	}

	if (fieldsUpdated.length > 0) {
		await updateSalesforceRecord('Contact', patch.id, updates)
	}

	return {
		id: patch.id,
		success: true,
		fieldsUpdated,
	}
}

async function applyOpportunityPatch(patch: any): Promise<AppliedPatch> {
	if (!patch.id) {
		throw new Error('Opportunity ID required')
	}

	const currentRecord = await fetchSalesforceRecord('Opportunity', patch.id)
	
	const updates: Record<string, any> = {}
	const fieldsUpdated: string[] = []

	for (const [field, change] of Object.entries(patch.changes || {})) {
		const changeData = change as any
		
		if (currentRecord[field] !== changeData.before) {
			console.warn(`Concurrency conflict on Opportunity ${field}`)
			continue
		}

		updates[field] = changeData.after
		fieldsUpdated.push(field)
	}

	if (fieldsUpdated.length > 0) {
		await updateSalesforceRecord('Opportunity', patch.id, updates)
	}

	return {
		id: patch.id,
		success: true,
		fieldsUpdated,
	}
}

async function fetchSalesforceRecord(objectType: string, id: string): Promise<any> {
	return await callSalesforceGetRecord({ objectType, id })
}

async function updateSalesforceRecord(
	objectType: string,
	id: string,
	updates: Record<string, any>
): Promise<void> {
	await callSalesforceUpdateRecord({ objectType, id, data: updates })
}
