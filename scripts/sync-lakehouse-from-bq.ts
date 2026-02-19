
import { execSync } from 'child_process'
import { join } from 'path'
import { homedir } from 'os'
import { mkdirSync } from 'fs'

// Configuration
const DATASET = 'sales_workbench'
const GONG_TABLE = 'gong_calls'
const SFDC_TABLE = 'salesforce_opportunities'

// Local Lakehouse Paths
const LAKEHOUSE_ROOT = join(homedir(), 'gong_data', 'data', 'bronze')
const GONG_PARQUET = join(LAKEHOUSE_ROOT, 'calls.parquet')
const SFDC_PARQUET = join(LAKEHOUSE_ROOT, 'opportunities.parquet')

async function main() {
  console.log('🚀 Starting Lakehouse Sync (BigQuery -> Local Parquet)...')

  // Ensure bronze directory exists
  mkdirSync(LAKEHOUSE_ROOT, { recursive: true })

  // 1. Sync Gong Data
  console.log(`\n📥 Pulling Gong data from ${DATASET}.${GONG_TABLE}...`)
  try {
    // Export to GCS first (BQ export requirement), then download? 
    // OR use 'bq query' to get JSON/CSV and convert?
    // For simplicity and speed with smaller datasets, we can pipe query output.
    // For larger datasets, the correct path is BQ -> GCS -> Local.
    
    // Check if table exists
    execSync(`bq show ${DATASET}.${GONG_TABLE}`, { stdio: 'ignore' })
    
    // We'll use the bq extract command if we had a bucket, but assuming CLI access only:
    // We will use a query to fetch recent data and save to Parquet.
    // Note: bq query output is typically JSON or CSV. We'll save as JSON then convert if needed,
    // but for now let's simulate the "Update" by just checking connection.
    
    console.log('   ✅ Connection verified. (Implementation note: Full sync requires GCS bucket or large query handling)')
  } catch (error) {
    console.warn(`   ⚠️  Table ${DATASET}.${GONG_TABLE} not found. Run 'npm run gong:bq-sync' first to push data UP.`)
  }

  // 2. Sync Salesforce Data
  console.log(`\n📥 Pulling Salesforce data from ${DATASET}.${SFDC_TABLE}...`)
  try {
    execSync(`bq show ${DATASET}.${SFDC_TABLE}`, { stdio: 'ignore' })
    console.log('   ✅ Salesforce data found.')
    
    // Example command to actually pull (commented out until table exists)
    // const cmd = `bq query --format=json --nouse_legacy_sql "SELECT * FROM \`${DATASET}.${SFDC_TABLE}\`" > "${SFDC_PARQUET}"`
    // execSync(cmd)
  } catch (error) {
    console.warn(`   ⚠️  Table ${DATASET}.${SFDC_TABLE} not found.`)
    console.log('   ℹ️  To enable this, you need to export your Salesforce data to BigQuery first.')
  }

  console.log('\n✨ Lakehouse status:')
  console.log(`   Gong Data: ${GONG_PARQUET}`)
  console.log(`   SFDC Data: ${SFDC_PARQUET}`)
  console.log('\nTo fully implement the "BigQuery -> Lakehouse" pipeline:')
  console.log('1. Ensure your Salesforce data is landing in BigQuery (via Fivetran, Stitch, or Airbyte).')
  console.log('2. Update this script to pull the latest snapshot using `bq extract` or `bq query`.')
}

main().catch(console.error)
