/**
 * Portfolio Call Extractor
 * 
 * Queries the Gong Parquet lakehouse for all calls and saves to JSONL
 * for batch analysis
 */

import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { queryPortfolioCallsFromParquet } from '../clients/gongParquetClient.js'

const PORTFOLIO_DIR = 'data/global'

export interface ExtractorOptions {
  featureFilter?: string[]
  dateRange?: {
    from: string
    to: string
  }
  limit?: number
  minTranscriptLength?: number
}

/**
 * Extract all portfolio calls from Parquet and save to JSONL
 */
export async function extractPortfolioCalls(options?: ExtractorOptions) {
  console.log('\n📥 Extracting portfolio calls from Parquet...')

  // Ensure output directory exists
  await mkdir(PORTFOLIO_DIR, { recursive: true })

  // Query Parquet
  console.log('   Querying Parquet lakehouse...')
  const calls = await queryPortfolioCallsFromParquet({
    featureFilter: options?.featureFilter || [
      'code search',
      'code insights',
      'deep search',
      'batch changes',
    ],
    dateRange: options?.dateRange,
    limit: options?.limit,
    minTranscriptLength: options?.minTranscriptLength,
  })

  console.log(`   ✓ Found ${calls.length} calls matching portfolio criteria`)

  // Save to JSONL
  const outputPath = join(PORTFOLIO_DIR, 'gong_calls_portfolio.jsonl')
  const jsonlContent = calls
    .map((call) => JSON.stringify(call))
    .join('\n')

  await writeFile(outputPath, jsonlContent, 'utf-8')
  console.log(`   ✓ Saved to ${outputPath}`)

  // Update metadata
  await updateMeta({
    lastExtractedAt: new Date().toISOString(),
    extractedCallCount: calls.length,
  })

  return {
    callCount: calls.length,
    outputPath,
  }
}

/**
 * Update portfolio metadata
 */
async function updateMeta(updates: Record<string, any>) {
  const metaPath = join(PORTFOLIO_DIR, '_meta.json')

  let meta: any = {
    version: 1,
    lastExtractedAt: null,
    lastAnalyzedAt: null,
    lastKbBuiltAt: null,
    extractedCallCount: 0,
    analyzedBatchCount: 0,
  }

  // Try to read existing metadata
  try {
    const existing = await import(`../../${metaPath}`).catch(() => null)
    if (existing) {
      meta = { ...meta, ...existing }
    }
  } catch (err) {
    // Ignore if doesn't exist
  }

  // Apply updates
  meta = { ...meta, ...updates }

  // Write back
  await writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8')
}
