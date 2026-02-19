/**
 * Gong BigQuery Client
 * 
 * Queries Gong calls from BigQuery instead of local parquet files.
 * Replaces gongParquetClient for cloud-native data access.
 * 
 * Features:
 * - Direct SQL queries against gong.calls table
 * - Fuzzy matching on account names/search terms
 * - Transcript caching with hash-based deduplication
 * - Automatic index usage for performance
 */

import { executeQuery, getGcpConfig } from '../services/bqClient.js'
import { createHash } from 'crypto'

export interface GongCall {
  call_id: string
  call_uuid: string
  title: string
  created_at: string
  duration_seconds: number
  direction: string
  disposition: string
  status: string
  has_transcript: boolean
  transcript_text?: string | null
  summary?: string
  action_items?: string[]
  next_steps?: string[]
  topics?: string[]
  gong_created_at: string
  gong_updated_at: string
}

export interface QueryGongCallsParams {
  searchTerms: string[]
  fromDate?: string // ISO timestamp
  toDate?: string
  limit?: number
  accountId?: string
}

/**
 * Query Gong calls from BigQuery with fuzzy matching on search terms
 */
export async function queryGongCalls(params: QueryGongCallsParams): Promise<GongCall[]> {
  const config = getGcpConfig()
  const { searchTerms, fromDate, toDate, limit = 50 } = params

  if (!searchTerms || searchTerms.length === 0) {
    return []
  }

  // Build OR conditions for multiple search terms
  const searchConditions = searchTerms
    .map((_, i) => {
      const paramName = `search_term_${i}`
      return `(title LIKE CONCAT('%', @${paramName}, '%') OR transcript_text LIKE CONCAT('%', @${paramName}, '%'))`
    })
    .join(' OR ')

  let whereClause = `(${searchConditions})`

  if (fromDate) {
    whereClause += ` AND created_at >= @from_date`
  }
  if (toDate) {
    whereClause += ` AND created_at <= @to_date`
  }

  whereClause += ` AND has_transcript = true`

  const sql = `
    SELECT
      call_id,
      call_uuid,
      title,
      created_at,
      duration_seconds,
      direction,
      disposition,
      status,
      has_transcript,
      transcript_text,
      summary,
      action_items,
      next_steps,
      topics,
      gong_created_at,
      gong_updated_at
    FROM \`${config.projectId}.${config.datasetId}.gong.calls\`
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT @limit
  `

  // Build params object
  const paramObj: Record<string, any> = { limit }
  searchTerms.forEach((term, i) => {
    paramObj[`search_term_${i}`] = term
  })
  if (fromDate) paramObj.from_date = fromDate
  if (toDate) paramObj.to_date = toDate

  const rows = await executeQuery<GongCall>(sql, { params: paramObj })
  return rows
}

/**
 * Get a single call transcript
 */
export async function getCallTranscript(callId: string): Promise<string | null> {
  const config = getGcpConfig()

  const sql = `
    SELECT transcript_text
    FROM \`${config.projectId}.${config.datasetId}.gong.calls\`
    WHERE call_id = @call_id
    LIMIT 1
  `

  const rows = await executeQuery<{ transcript_text: string | null }>(sql, {
    params: { call_id: callId },
  })

  return rows[0]?.transcript_text || null
}

/**
 * Cache a transcript with hash-based deduplication
 * 
 * Uses MERGE to update if hash differs, skip if same
 */
export async function cacheTranscript(
  callId: string,
  transcript: string,
  metadata?: { summary?: string; actionItems?: string[] }
): Promise<boolean> {
  const config = getGcpConfig()
  const transcriptHash = createHash('sha256').update(transcript).digest('hex')

  const sql = `
    MERGE \`${config.projectId}.${config.datasetId}.enriched.transcripts\` T
    USING (
      SELECT
        @call_id as call_id,
        @transcript_hash as transcript_hash,
        @transcript_text as transcript_text,
        @summary as summary,
        @action_items as action_items,
        CURRENT_TIMESTAMP() as cached_at
    ) S
    ON T.call_id = S.call_id
    WHEN MATCHED AND T.transcript_hash != S.transcript_hash THEN
      UPDATE SET
        transcript_text = S.transcript_text,
        transcript_hash = S.transcript_hash,
        summary = S.summary,
        action_items = S.action_items,
        cached_at = S.cached_at
    WHEN NOT MATCHED THEN
      INSERT (
        transcript_id,
        call_id,
        transcript_text,
        transcript_hash,
        summary,
        action_items,
        cached_at
      ) VALUES (
        GENERATE_UUID(),
        S.call_id,
        S.transcript_text,
        S.transcript_hash,
        S.summary,
        S.action_items,
        S.cached_at
      )
  `

  const params: Record<string, any> = {
    call_id: callId,
    transcript_hash: transcriptHash,
    transcript_text: transcript,
    summary: metadata?.summary,
    action_items: metadata?.actionItems,
  }

  try {
    await executeQuery(sql, { params })
    return true
  } catch (err) {
    console.error(`[gongBQ] Failed to cache transcript for ${callId}:`, err)
    return false
  }
}

/**
 * Get cached transcript (O(1) lookup)
 */
export async function getCachedTranscript(callId: string): Promise<string | null> {
  const config = getGcpConfig()

  const sql = `
    SELECT transcript_text
    FROM \`${config.projectId}.${config.datasetId}.enriched.transcripts\`
    WHERE call_id = @call_id
    LIMIT 1
  `

  const rows = await executeQuery<{ transcript_text: string | null }>(sql, {
    params: { call_id: callId },
  })

  return rows[0]?.transcript_text || null
}

/**
 * Get call count per account (for analytics)
 */
export async function getCallCountByAccount(
  limit: number = 100
): Promise<Array<{ account_name: string; call_count: number }>> {
  const config = getGcpConfig()

  const sql = `
    SELECT
      SUBSTR(title, 1, STRPOS(title, ' ') - 1) as account_name,
      COUNT(*) as call_count
    FROM \`${config.projectId}.${config.datasetId}.gong.calls\`
    WHERE title IS NOT NULL AND title != ''
    GROUP BY account_name
    ORDER BY call_count DESC
    LIMIT @limit
  `

  return executeQuery<{ account_name: string; call_count: number }>(sql, {
    params: { limit },
  })
}

/**
 * Get recent calls for account (for freshness checks)
 */
export async function getRecentCallsForAccount(
  accountName: string,
  maxAge: number = 14 // days
): Promise<GongCall[]> {
  const config = getGcpConfig()

  const sql = `
    SELECT
      call_id,
      call_uuid,
      title,
      created_at,
      duration_seconds,
      direction,
      disposition,
      status,
      has_transcript,
      transcript_text,
      summary,
      action_items,
      next_steps,
      topics,
      gong_created_at,
      gong_updated_at
    FROM \`${config.projectId}.${config.datasetId}.gong.calls\`
    WHERE title LIKE CONCAT('%', @account_name, '%')
      AND created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @max_age DAY)
    ORDER BY created_at DESC
  `

  return executeQuery<GongCall>(sql, {
    params: { account_name: accountName, max_age: maxAge },
  })
}
