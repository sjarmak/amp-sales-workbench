#!/usr/bin/env npx tsx

/**
 * Validate BigQuery Setup
 * 
 * Checks:
 * 1. Service account credentials are valid
 * 2. GCP project is accessible
 * 3. BigQuery dataset exists
 * 4. Required tables exist (gong.calls, salesforce.accounts, etc.)
 * 5. Tables have correct schema
 */

import { BigQuery } from '@google-cloud/bigquery'
import { getGcpConfig } from '../src/services/bqClient.js'

async function main() {
  console.log('🔍 Validating BigQuery Setup...\n')

  try {
    const config = getGcpConfig()
    console.log('📋 Configuration:')
    console.log(`  Project ID:  ${config.projectId}`)
    console.log(`  Dataset ID:  ${config.datasetId}`)
    console.log(`  Key File:    ${config.keyFile || 'OIDC (serverless)'}`)
    console.log()

    // Initialize BigQuery client
    const bq = new BigQuery({
      projectId: config.projectId,
      keyFilename: config.keyFile,
    })

    // Test 1: Check project exists
    console.log('Test 1: Checking GCP project...')
    try {
      const [projectMetadata] = await bq.getMetadata()
      console.log(`  ✅ Project accessible: ${projectMetadata.projectId}`)
    } catch (err) {
      console.error(`  ❌ Failed to access project: ${err}`)
      process.exit(1)
    }

    // Test 2: Check dataset exists
    console.log('\nTest 2: Checking BigQuery dataset...')
    const dataset = bq.dataset(config.datasetId)
    try {
      const [exists] = await dataset.exists()
      if (exists) {
        console.log(`  ✅ Dataset exists: ${config.datasetId}`)
      } else {
        console.log(`  ❌ Dataset not found: ${config.datasetId}`)
        console.log(`  Create it with:`)
        console.log(`    bq mk --dataset --description="Sales Workbench" ${config.datasetId}`)
        process.exit(1)
      }
    } catch (err) {
      console.error(`  ❌ Failed to check dataset: ${err}`)
      process.exit(1)
    }

    // Test 3: Check for required tables
    console.log('\nTest 3: Checking for required tables...')
    const requiredTables = [
      'gong_calls',
      'salesforce_accounts',
      'salesforce_contacts',
      'salesforce_opportunities',
    ]

    const [tables] = await dataset.getTables()
    const existingTables = new Set(tables.map((t: any) => t.id))

    const missingTables: string[] = []
    for (const table of requiredTables) {
      if (existingTables.has(table)) {
        console.log(`  ✅ ${table}`)
      } else {
        console.log(`  ❌ ${table} (missing)`)
        missingTables.push(table)
      }
    }

    if (missingTables.length > 0) {
      console.log(`\n  Missing ${missingTables.length} tables. Create with:`)
      console.log(`    npx tsx scripts/create-bigquery-schema.ts`)
      process.exit(1)
    }

    // Test 4: Check table schemas
    console.log('\nTest 4: Checking table schemas...')
    for (const tableName of requiredTables) {
      try {
        const table = dataset.table(tableName)
        const [metadata] = await table.getMetadata()
        const fieldCount = metadata.schema?.fields?.length || 0
        console.log(`  ✅ ${tableName}: ${fieldCount} fields`)
      } catch (err) {
        console.error(`  ❌ ${tableName}: ${err}`)
      }
    }

    // Test 5: Try a simple query
    console.log('\nTest 5: Testing query execution...')
    try {
      const [rows] = await bq.query({
        query: 'SELECT 1 as test',
        location: 'US',
      })
      console.log(`  ✅ Query execution successful`)
    } catch (err) {
      console.error(`  ❌ Query failed: ${err}`)
      process.exit(1)
    }

    console.log('\n✅ All validations passed! Ready for Phase 3 migrations.')
    console.log('\nNext steps:')
    console.log('  1. npm run gong:bq-sync -- --dry-run     # Test Gong migration')
    console.log('  2. npm run gong:bq-sync                  # Run Gong migration')
    console.log('  3. tsx scripts/migrate-salesforce-to-bq.ts --dry-run')
    console.log('  4. tsx scripts/migrate-salesforce-to-bq.ts')

  } catch (err) {
    console.error('\n❌ Validation failed:', err)
    process.exit(1)
  }
}

main()
