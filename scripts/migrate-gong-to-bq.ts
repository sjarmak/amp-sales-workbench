#!/usr/bin/env tsx

/**
 * Migrate Gong calls from local parquet to BigQuery
 * 
 * Usage:
 *   tsx scripts/migrate-gong-to-bq.ts
 *   DEBUG=1 tsx scripts/migrate-gong-to-bq.ts --dry-run
 */

import { insertRows, executeQuery, getGcpConfig } from '../src/services/bqClient.js'
import { queryGongCallsFromParquet, type ParquetGongCall } from '../src/clients/gongParquetClient.js'
import { createHash } from 'crypto'

interface GongCallRecord {
  call_id: string
  call_uuid: string
  title: string
  created_at: string
  duration_seconds: number
  direction: string
  disposition: string
  status: string
  has_transcript: boolean
  transcript_text: string | null
  summary: string | null
  action_items: string[] | null
  next_steps: string[] | null
  topics: string[] | null
  gong_created_at: string
  gong_updated_at: string
}

interface MigrationStats {
  totalRead: number
  totalInserted: number
  failedRows: Array<{ callId: string; error: string }>
  duration: number
  startTime: Date
}

/**
 * Migrate Gong calls from parquet to BigQuery
 */
export async function migrateGongToBQ(options: {
  batchSize?: number
  dryRun?: boolean
  limit?: number
}): Promise<MigrationStats> {
  const config = getGcpConfig()
  const startTime = new Date()
  const stats: MigrationStats = {
    totalRead: 0,
    totalInserted: 0,
    failedRows: [],
    duration: 0,
    startTime,
  }

  console.log('[Gong Migration] Starting migration from parquet to BigQuery')
  console.log(`[Gong Migration] Target: ${config.projectId}.${config.datasetId}.gong.calls`)
  console.log(`[Gong Migration] Dry run: ${options.dryRun ? 'yes' : 'no'}`)

  try {
    // Verify BigQuery table exists
    console.log('[Gong Migration] Verifying BigQuery table...')
    const tableExists = await checkTableExists('gong.calls')
    if (!tableExists) {
      throw new Error('BigQuery table gong.calls does not exist. Run Phase 1 setup first.')
    }
    console.log('[Gong Migration] ✅ Table verified')

    // Read all calls from parquet
    console.log('[Gong Migration] Reading Gong calls from parquet...')
    const parquetCalls = await queryGongCallsFromParquet({
      searchTerms: [], // Empty search returns all calls (with date range)
      limit: options.limit || 100000,
    })

    stats.totalRead = parquetCalls.length
    console.log(`[Gong Migration] Read ${stats.totalRead} calls from parquet`)

    if (stats.totalRead === 0) {
      console.log('[Gong Migration] ⚠️  No calls found in parquet, exiting')
      return stats
    }

    // Transform parquet calls to BigQuery records
    console.log('[Gong Migration] Transforming records...')
    const bqRecords = parquetCalls.map((call: ParquetGongCall): GongCallRecord => ({
      call_id: String(call.call_id),
      call_uuid: '', // Parquet may not have UUID, generate if needed
      title: call.title || 'Untitled',
      created_at: call.created_at,
      duration_seconds: call.browser_duration_sec || 0,
      direction: call.direction || 'Unknown',
      disposition: call.disposition || 'Unknown',
      status: call.status || 'Unknown',
      has_transcript: call.has_transcript || false,
      transcript_text: call.transcript_text || null,
      summary: call.summary || null,
      action_items: call.action_items || null,
      next_steps: call.next_steps || null,
      topics: call.topics || null,
      gong_created_at: new Date().toISOString(),
      gong_updated_at: new Date().toISOString(),
    }))

    if (options.dryRun) {
      console.log('[Gong Migration] DRY RUN: Would insert the following sample record:')
      console.log(JSON.stringify(bqRecords[0], null, 2))
      stats.totalInserted = bqRecords.length
      return stats
    }

    // Insert in batches
    const batchSize = options.batchSize || 1000
    console.log(`[Gong Migration] Inserting in batches of ${batchSize}...`)

    for (let i = 0; i < bqRecords.length; i += batchSize) {
      const batch = bqRecords.slice(i, i + batchSize)
      const progress = `${Math.min(i + batchSize, bqRecords.length)}/${bqRecords.length}`

      try {
        await insertRows('gong.calls', batch)
        stats.totalInserted += batch.length
        console.log(`[Gong Migration] ✅ Batch ${progress} inserted`)
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        console.error(`[Gong Migration] ❌ Batch ${progress} failed: ${err.message}`)

        // Track failed rows
        batch.forEach(row => {
          stats.failedRows.push({
            callId: row.call_id,
            error: err.message.substring(0, 100),
          })
        })
      }
    }

    // Verify migration
    console.log('[Gong Migration] Verifying migration...')
    const count = await getRecordCount('gong.calls')
    console.log(`[Gong Migration] BigQuery now contains ${count} Gong calls`)

    console.log('[Gong Migration] ✅ Migration complete')
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    console.error('[Gong Migration] ❌ Migration failed:', err.message)
    throw err
  } finally {
    stats.duration = Date.now() - startTime.getTime()
  }

  return stats
}

/**
 * Check if BigQuery table exists
 */
async function checkTableExists(tableId: string): Promise<boolean> {
  const config = getGcpConfig()
  try {
    const result = await executeQuery(`
      SELECT 1
      FROM \`${config.projectId}.${config.datasetId}.__TABLES__\`
      WHERE table_id = @table_id
      LIMIT 1
    `, {
      params: { table_id: tableId.split('.')[1] || tableId },
    })
    return result.length > 0
  } catch {
    return false
  }
}

/**
 * Get record count in a table
 */
async function getRecordCount(tableId: string): Promise<number> {
  const config = getGcpConfig()
  const result = await executeQuery<{ count: number }>(`
    SELECT COUNT(*) as count
    FROM \`${config.projectId}.${config.datasetId}.${tableId}\`
  `)
  return result[0]?.count || 0
}

/**
 * Print migration summary
 */
function printSummary(stats: MigrationStats): void {
  console.log('\n' + '='.repeat(60))
  console.log('MIGRATION SUMMARY')
  console.log('='.repeat(60))
  console.log(`Start time:     ${stats.startTime.toISOString()}`)
  console.log(`Duration:       ${stats.duration}ms (${(stats.duration / 1000).toFixed(1)}s)`)
  console.log(`Records read:   ${stats.totalRead}`)
  console.log(`Records inserted: ${stats.totalInserted}`)
  console.log(`Success rate:   ${((stats.totalInserted / stats.totalRead) * 100).toFixed(1)}%`)

  if (stats.failedRows.length > 0) {
    console.log(`\nFailed rows (${stats.failedRows.length}):`)
    stats.failedRows.slice(0, 5).forEach(row => {
      console.log(`  - Call ${row.callId}: ${row.error}`)
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
  const limit = process.argv.find(arg => arg.startsWith('--limit='))
    ?.split('=')[1]
    ? parseInt(process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '0')
    : undefined

  const stats = await migrateGongToBQ({
    dryRun,
    limit,
  })

  printSummary(stats)

  if (stats.failedRows.length > 0) {
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
