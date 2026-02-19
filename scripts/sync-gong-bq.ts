
import { execSync } from 'child_process'
import { join } from 'path'
import { homedir } from 'os'
import { existsSync } from 'fs'

// Configuration
const DATASET = 'sales_workbench'
const TABLE = 'gong_calls'
const PARQUET_PATH = join(homedir(), 'gong_data', 'data', 'bronze', 'calls.parquet')
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || '' // Optional: let bq use default

async function main() {
  console.log('🚀 Starting Gong Lakehouse <-> BigQuery Sync...')

  // 1. Check Prerequisites
  try {
    execSync('bq version', { stdio: 'ignore' })
  } catch (error) {
    console.error('❌ Error: "bq" CLI is not installed or not in PATH.')
    console.error('Please install the Google Cloud SDK: https://cloud.google.com/sdk/docs/install')
    process.exit(1)
  }

  if (!existsSync(PARQUET_PATH)) {
    console.error(`❌ Error: Parquet lakehouse file not found at ${PARQUET_PATH}`)
    console.error('Please ensure your local lakehouse is populated.')
    process.exit(1)
  }

  // 2. Ensure Dataset Exists
  console.log(`\n📦 Checking dataset '${DATASET}'...`)
  try {
    execSync(`bq show ${DATASET}`, { stdio: 'ignore' })
    console.log('   Dataset exists.')
  } catch (error) {
    console.log('   Creating dataset...')
    try {
      execSync(`bq mk ${DATASET}`)
      console.log('   ✅ Dataset created.')
    } catch (mkError) {
      console.error('   ❌ Failed to create dataset:', mkError)
      process.exit(1)
    }
  }

  // 3. Upload Parquet Data
  console.log(`\n📤 Uploading Gong data from ${PARQUET_PATH}...`)
  try {
    // --replace=true overwrites the table
    // --source_format=PARQUET tells BQ to parse parquet
    const cmd = `bq load --replace=true --source_format=PARQUET ${DATASET}.${TABLE} "${PARQUET_PATH}"`
    execSync(cmd, { stdio: 'inherit' })
    console.log('   ✅ Data upload complete.')
  } catch (error) {
    console.error('   ❌ Failed to upload data:', error)
    process.exit(1)
  }

  // 4. Verify and Sample
  console.log('\n🔍 Verifying data...')
  try {
    const countResult = execSync(`bq query --nouse_legacy_sql --format=json "SELECT count(*) as count FROM \`${DATASET}.${TABLE}\`"`).toString()
    const count = JSON.parse(countResult)[0].count
    console.log(`   Table ${DATASET}.${TABLE} now contains ${count} rows.`)
  } catch (error) {
    console.warn('   ⚠️ Could not verify row count:', error)
  }

  // 5. Provide Join Instruction
  console.log('\n🔗 NEXT STEPS: Connect with Salesforce Data')
  console.log('To join this data with your Salesforce BigQuery table, run a query like:')
  console.log('\n' + '-'.repeat(50))
  console.log(`
SELECT 
  g.title as call_title,
  g.created_at,
  s.Name as opportunity_name,
  s.Amount
FROM \`${DATASET}.${TABLE}\` g
JOIN \`your_salesforce_dataset.Opportunity\` s 
  ON g.title LIKE CONCAT('%', s.Account.Name, '%')
WHERE g.created_at > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
LIMIT 10
  `.trim())
  console.log('-'.repeat(50) + '\n')
  
  console.log('✅ Sync pipeline completed successfully.')
}

main().catch(console.error)
