#!/usr/bin/env tsx

/**
 * Migrate Salesforce data from scattered JSON files to BigQuery
 * 
 * Usage:
 *   tsx scripts/migrate-salesforce-to-bq.ts
 *   DEBUG=1 tsx scripts/migrate-salesforce-to-bq.ts --dry-run
 *   tsx scripts/migrate-salesforce-to-bq.ts --entity Accounts
 */

import { insertRows, executeQuery, getGcpConfig } from '../src/services/bqClient.js'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { cwd } from 'process'

interface SFAccount {
  Id: string
  Name: string
  Website?: string
  Industry?: string
  NumberOfEmployees?: number
  BillingCity?: string
  BillingCountry?: string
  LastModifiedDate: string
}

interface SFContact {
  Id: string
  AccountId: string
  FirstName: string
  LastName: string
  Email?: string
  Phone?: string
  Title?: string
  LastModifiedDate: string
}

interface SFOpportunity {
  Id: string
  AccountId: string
  Name: string
  StageName: string
  Amount?: number
  CloseDate: string
  LastModifiedDate: string
}

interface MigrationStats {
  entity: string
  totalRead: number
  totalInserted: number
  failedRows: Array<{ id: string; error: string }>
  duration: number
  startTime: Date
}

/**
 * Migrate Salesforce accounts from JSON files
 */
export async function migrateAccountsToBQ(options: {
  dryRun?: boolean
}): Promise<MigrationStats> {
  const config = getGcpConfig()
  const startTime = new Date()
  const stats: MigrationStats = {
    entity: 'Accounts',
    totalRead: 0,
    totalInserted: 0,
    failedRows: [],
    duration: 0,
    startTime,
  }

  console.log('[SF Migration] Starting Accounts migration')

  try {
    // Scan data/accounts/ for salesforce.json files
    const accountsDir = join(cwd(), 'data', 'accounts')
    const slugs = await readdir(accountsDir)
    const accounts: SFAccount[] = []

    for (const slug of slugs) {
      try {
        const sfPath = join(accountsDir, slug, 'raw', 'salesforce.json')
        const content = await readFile(sfPath, 'utf-8')
        const data = JSON.parse(content)

        if (data.account) {
          accounts.push({
            ...data.account,
            LastModifiedDate: data.account.LastModifiedDate || new Date().toISOString(),
          })
        }
      } catch (err) {
        // Skip invalid entries
        if (process.env.DEBUG) {
          console.log(`[SF Migration] Skipped invalid account entry: ${slug}`)
        }
      }
    }

    stats.totalRead = accounts.length
    console.log(`[SF Migration] Found ${stats.totalRead} accounts in JSON files`)

    if (stats.totalRead === 0) {
      console.log('[SF Migration] ⚠️  No accounts found, exiting')
      return stats
    }

    if (options.dryRun) {
      console.log('[SF Migration] DRY RUN: Would insert the following sample record:')
      console.log(JSON.stringify(accounts[0], null, 2))
      stats.totalInserted = accounts.length
      return stats
    }

    // Insert accounts
    try {
      await insertRows('salesforce.accounts', accounts)
      stats.totalInserted = accounts.length
      console.log(`[SF Migration] ✅ Inserted ${stats.totalInserted} accounts`)
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      console.error(`[SF Migration] ❌ Failed to insert accounts: ${err.message}`)
      stats.failedRows = accounts.map(a => ({
        id: a.Id,
        error: err.message.substring(0, 100),
      }))
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    console.error('[SF Migration] ❌ Failed:', err.message)
    throw err
  } finally {
    stats.duration = Date.now() - startTime.getTime()
  }

  return stats
}

/**
 * Validate migration by comparing row counts
 */
export async function validateMigration(
  sourceCount: number,
  entity: string
): Promise<boolean> {
  const config = getGcpConfig()

  try {
    const result = await executeQuery<{ count: number }>(`
      SELECT COUNT(*) as count
      FROM \`${config.projectId}.${config.datasetId}.salesforce.${entity.toLowerCase()}\`
    `)

    const bqCount = result[0]?.count || 0

    console.log(
      `[SF Migration] Validation: Source=${sourceCount}, BigQuery=${bqCount}`
    )

    if (bqCount === sourceCount) {
      console.log('[SF Migration] ✅ Row counts match!')
      return true
    } else {
      console.warn(
        `[SF Migration] ⚠️  Row count mismatch: expected ${sourceCount}, got ${bqCount}`
      )
      return false
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    console.error('[SF Migration] ❌ Validation failed:', err.message)
    return false
  }
}

/**
 * Print migration summary
 */
function printSummary(stats: MigrationStats): void {
  console.log('\n' + '='.repeat(60))
  console.log(`SALESFORCE ${stats.entity.toUpperCase()} MIGRATION SUMMARY`)
  console.log('='.repeat(60))
  console.log(`Start time:     ${stats.startTime.toISOString()}`)
  console.log(`Duration:       ${stats.duration}ms (${(stats.duration / 1000).toFixed(1)}s)`)
  console.log(`Records read:   ${stats.totalRead}`)
  console.log(`Records inserted: ${stats.totalInserted}`)
  console.log(`Success rate:   ${((stats.totalInserted / stats.totalRead) * 100).toFixed(1)}%`)

  if (stats.failedRows.length > 0) {
    console.log(`\nFailed rows (${stats.failedRows.length}):`)
    stats.failedRows.slice(0, 5).forEach(row => {
      console.log(`  - ${row.id}: ${row.error}`)
    })
    if (stats.failedRows.length > 5) {
      console.log(`  ... and ${stats.failedRows.length - 5} more`)
    }
  }

  console.log('='.repeat(60) + '\n')
}

/**
 * CLI entry point
 */
async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run')
  const entity = process.argv.find(arg => arg.startsWith('--entity='))?.split('=')[1] || 'Accounts'

  console.log(`[SF Migration] Starting Salesforce data migration (entity: ${entity})`)

  let allStats: MigrationStats[] = []

  // Migrate requested entity
  if (entity === 'Accounts' || entity === 'All') {
    const stats = await migrateAccountsToBQ({ dryRun })
    printSummary(stats)
    allStats.push(stats)

    if (!dryRun) {
      await validateMigration(stats.totalRead, 'Accounts')
    }
  }

  // Future: Add Contacts, Opportunities, Activities migrations

  // Print overall summary
  if (allStats.length > 1) {
    console.log('='.repeat(60))
    console.log('OVERALL MIGRATION SUMMARY')
    console.log('='.repeat(60))
    console.log(`Total records read:    ${allStats.reduce((sum, s) => sum + s.totalRead, 0)}`)
    console.log(
      `Total records inserted: ${allStats.reduce((sum, s) => sum + s.totalInserted, 0)}`
    )
    console.log('='.repeat(60) + '\n')
  }

  // Check for failures
  const hasFailed = allStats.some(s => s.failedRows.length > 0)
  if (hasFailed) {
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
