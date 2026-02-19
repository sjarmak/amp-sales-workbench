#!/usr/bin/env tsx

/**
 * Initialize Data Layer
 * 
 * Process Salesforce CSV and build account index
 */

import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { loadSalesforceAccountsCSV, buildAccountIndex, saveAccountIndex } from '../src/services/csvProcessor.js'
import { DataLayerService, getDefaultDataLayerConfig, createDataLayerService } from '../src/services/dataLayerService.js'

const projectDir = join(process.cwd())
const tablesDir = join(projectDir, 'data', 'tables')
const csvPath = join(tablesDir, 'salesforce_accounts.csv')

async function main() {
	console.log('📊 Initializing Data Layer...\n')

	// Check CSV exists
	if (!existsSync(csvPath)) {
		console.error(`❌ CSV not found at ${csvPath}`)
		process.exit(1)
	}

	console.log(`📁 Loading Salesforce accounts from CSV...`)
	const records = loadSalesforceAccountsCSV(csvPath)
	console.log(`✅ Loaded ${records.length} accounts`)

	console.log(`\n🔍 Building search index...`)
	const index = buildAccountIndex(records)
	console.log(`✅ Indexed ${index.accountsById.size} accounts by ID`)
	console.log(`✅ Indexed ${index.accountsByLegalName.size} accounts by legal name`)
	console.log(`✅ Indexed ${index.accountsByDomain.size} accounts by domain`)

	// Save index
	const indexPath = join(tablesDir, 'salesforce_accounts_index.json')
	console.log(`\n💾 Saving index to ${indexPath}...`)
	saveAccountIndex(index, indexPath)
	console.log(`✅ Index saved`)

	// Initialize DataLayerService
	console.log(`\n⚙️  Initializing DataLayerService...`)
	const config = getDefaultDataLayerConfig(projectDir)
	const service = new DataLayerService(config)
	await service.initialize()
	const stats = service.getStats()
	console.log(`✅ Service initialized`)
	console.log(`   Total accounts: ${stats.totalAccounts}`)
	console.log(`   Accounts with Gong links: ${stats.accountsWithGongLinks}`)
	console.log(`   Total linked Gong calls: ${stats.totalLinkedCalls}`)

	// Test search
	console.log(`\n🧪 Testing search...`)
	const testResults = service.searchAccounts('sourcegraph', { limit: 3 })
	if (testResults.length > 0) {
		console.log(`✅ Found ${testResults.length} results for "sourcegraph"`)
		testResults.forEach((r) => {
			console.log(`   - ${r.account.name} (${r.account.account_id})`)
		})
	} else {
		console.log(`⚠️  No results for "sourcegraph" (this is OK, depends on data)`)
	}

	console.log(`\n✨ Data layer initialization complete!`)
	console.log(`\n📚 Usage:`)
	console.log(`   import { createDataLayerService } from './src/services/dataLayerService.js'`)
	console.log(`   const service = await createDataLayerService(process.cwd())`)
	console.log(`   const results = service.searchAccounts('Company Name')`)
}

main().catch((error) => {
	console.error('❌ Error:', error.message)
	process.exit(1)
})
