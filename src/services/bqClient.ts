/**
 * BigQuery Client Abstraction
 * 
 * Provides connection pooling and query execution against BigQuery.
 * Handles authentication via service account key file (dev) or OIDC (production).
 * 
 * Usage:
 *   const rows = await executeQuery('SELECT * FROM dataset.table WHERE id = @id', {
 *     params: { id: '123' }
 *   })
 */

import { BigQuery } from '@google-cloud/bigquery'

export interface GcpConfig {
  projectId: string
  datasetId: string
  serviceAccountEmail?: string
  keyFile?: string
}

let bqInstance: BigQuery | null = null

/**
 * Get BigQuery config from environment
 */
export function getGcpConfig(): GcpConfig {
  return {
    projectId: process.env.GCP_PROJECT_ID || 'your-gcp-project',
    datasetId: process.env.GCP_DATASET_ID || 'your_dataset',
    serviceAccountEmail: process.env.GCP_SERVICE_ACCOUNT_EMAIL,
    keyFile: process.env.GCP_KEY_FILE,
  }
}

/**
 * Get singleton BigQuery client instance
 */
export async function getBigQueryClient(): Promise<BigQuery> {
  if (bqInstance) return bqInstance

  const config = getGcpConfig()

  bqInstance = new BigQuery({
    projectId: config.projectId,
    keyFilename: config.keyFile, // undefined in production (uses OIDC)
  })

  // Verify connectivity on first use
  try {
    const gcp = getGcpConfig()
    await bqInstance.dataset(gcp.datasetId).exists()
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    const cfg = getGcpConfig()
    throw new Error(`Failed to connect to BigQuery dataset ${cfg.datasetId}: ${error.message}`)
  }

  return bqInstance
}

/**
 * Execute a BigQuery query with optional parameters
 */
export async function executeQuery<T extends Record<string, any>>(
  sql: string,
  options?: {
    params?: Record<string, any>
    maxResults?: number
  }
): Promise<T[]> {
  const bq = await getBigQueryClient()
  const query = {
    query: sql,
    location: 'US',
    ...options,
  }

  try {
    const [rows] = await bq.query(query)
    return (rows || []) as T[]
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    throw new Error(`BigQuery query failed: ${error.message}\nSQL: ${sql}`)
  }
}

/**
 * Insert rows into a table
 */
export async function insertRows(
  tableId: string,
  rows: Record<string, any>[]
): Promise<void> {
  if (rows.length === 0) return

  const bq = await getBigQueryClient()
  const config = getGcpConfig()
  const table = bq.dataset(config.datasetId).table(tableId)

  try {
    await table.insert(rows, {
      skipInvalidRows: false,
      ignoreUnknownValues: true,
    })
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    throw new Error(`Failed to insert rows into ${tableId}: ${error.message}`)
  }
}

/**
 * Upsert rows using MERGE statement (upsert on primary key)
 */
export async function upsertRows(
  tableId: string,
  rows: Record<string, any>[],
  uniqueKey: string[]
): Promise<void> {
  if (rows.length === 0) return

  const config = getGcpConfig()

  // Build MERGE statement
  const columns = Object.keys(rows[0])
  const nonKeyColumns = columns.filter(col => !uniqueKey.includes(col))

  const updateSetClauses = nonKeyColumns.map(col => `T.${col} = S.${col}`).join(', ')
  const insertColumns = columns.join(', ')
  const insertValueRefs = columns.map(col => `S.${col}`).join(', ')
  const joinConditions = uniqueKey.map(k => `T.${k} = S.${k}`).join(' AND ')

  // Convert rows to VALUES clause format
  const valuesClauses = rows
    .map(row => {
      const values = columns.map(col => {
        const val = row[col]
        if (val === null) return 'NULL'
        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`
        if (typeof val === 'boolean') return val ? 'true' : 'false'
        if (val instanceof Date) return `TIMESTAMP('${val.toISOString()}')`
        return String(val)
      })
      return `(${values.join(', ')})`
    })
    .join(', ')

  const sql = `
    MERGE \`${config.projectId}.${config.datasetId}.${tableId}\` T
    USING (
      SELECT ${columns.map((col, i) => `col${i} as ${col}`).join(', ')}
      FROM (
        SELECT * FROM UNNEST([
          STRUCT<${columns.map(col => `${col} STRING`).join(', ')}>(
            ${valuesClauses}
          )
        ])
      )
    ) S
    ON ${joinConditions}
    WHEN MATCHED THEN
      UPDATE SET ${updateSetClauses}
    WHEN NOT MATCHED THEN
      INSERT (${insertColumns})
      VALUES (${insertValueRefs})
  `

  try {
    await executeQuery(sql)
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    throw new Error(`Failed to upsert rows in ${tableId}: ${error.message}`)
  }
}

/**
 * Delete rows matching a condition
 */
export async function deleteRows(
  tableId: string,
  whereClause: string,
  params?: Record<string, any>
): Promise<number> {
  const config = getGcpConfig()

  const sql = `
    DELETE FROM \`${config.projectId}.${config.datasetId}.${tableId}\`
    WHERE ${whereClause}
  `

  const bq = await getBigQueryClient()

  try {
    const [job] = await bq.createQueryJob({
      query: sql,
      location: 'US',
      ...(params && { params }),
    })

    // Ensure job completes before returning
    await job.getQueryResults()
    return job.metadata?.statistics?.query?.numDmlAffectedRows || 0
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    throw new Error(`Failed to delete rows from ${tableId}: ${error.message}`)
  }
}

/**
 * Check if a table exists
 */
export async function tableExists(tableId: string): Promise<boolean> {
  const bq = await getBigQueryClient()
  const config = getGcpConfig()

  try {
    const [exists] = await bq
      .dataset(config.datasetId)
      .table(tableId)
      .exists()
    return exists
  } catch {
    return false
  }
}
