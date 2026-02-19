/**
 * Portfolio Analysis CLI
 * 
 * Commands for extracting, analyzing, and building portfolio KB
 */

import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { extractPortfolioCalls } from './extractor.js'
import { analyzePortfolioCalls } from './batch-analyzer.js'
import { buildPortfolioKnowledgeBase } from './kb-builder.js'

const PORTFOLIO_DIR = 'data/global'

/**
 * Extract all portfolio calls from Parquet
 */
export async function cmdExtract() {
  console.log('🚀 Portfolio Extraction')
  try {
    const result = await extractPortfolioCalls({
      featureFilter: [
        'code search',
        'code insights',
        'deep search',
        'batch changes',
      ],
    })
    console.log(`\n✅ Extraction complete: ${result.callCount} calls extracted`)
    console.log(`   File: ${result.outputPath}`)
  } catch (err) {
    console.error('❌ Extraction failed:', err)
    process.exit(1)
  }
}

/**
 * Analyze extracted calls with LLM
 */
export async function cmdAnalyze() {
  console.log('🚀 Portfolio LLM Analysis')

  try {
    // Load extracted calls
    const jsonlPath = join(PORTFOLIO_DIR, 'gong_calls_portfolio.jsonl')
    const jsonlContent = await readFile(jsonlPath, 'utf-8')
    const calls = jsonlContent
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line))

    console.log(`   Loaded ${calls.length} calls from ${jsonlPath}`)

    // Analyze batches
    const batchResults = await analyzePortfolioCalls(calls)

    console.log(`\n✅ Analysis complete: ${batchResults.length} batches analyzed`)

    // Save batch results
    const resultsPath = join(PORTFOLIO_DIR, 'patterns_portfolio.json')
    await writeFile(resultsPath, JSON.stringify(batchResults, null, 2), 'utf-8')
    console.log(`   File: ${resultsPath}`)
  } catch (err) {
    console.error('❌ Analysis failed:', err)
    process.exit(1)
  }
}

/**
 * Build knowledge base from batch analysis
 */
export async function cmdBuild() {
  console.log('🚀 Portfolio KB Builder')

  try {
    // Load batch results
    const resultsPath = join(PORTFOLIO_DIR, 'patterns_portfolio.json')
    const resultsContent = await readFile(resultsPath, 'utf-8')
    const batchResults = JSON.parse(resultsContent)

    // Load call count from metadata
    const metaPath = join(PORTFOLIO_DIR, '_meta.json')
    const metaContent = await readFile(metaPath, 'utf-8')
    const meta = JSON.parse(metaContent)

    console.log(`   Loaded ${batchResults.length} batch results`)

    // Build KB
    const kb = await buildPortfolioKnowledgeBase(
      batchResults,
      meta.extractedCallCount || 0,
      [] // TODO: Track source accounts in metadata
    )

    console.log(`\n✅ KB built successfully`)
    console.log(`   ${kb.patterns.useCases.length} use cases`)
    console.log(`   ${kb.patterns.objections.length} objections`)
    console.log(`   ${kb.patterns.successFactors.length} success factors`)
    console.log(`   ${kb.patterns.competitorMentions.length} competitors`)
    console.log(`   ${kb.patterns.segments.length} segments`)
  } catch (err) {
    console.error('❌ KB build failed:', err)
    process.exit(1)
  }
}

/**
 * Run full pipeline: extract -> analyze -> build KB
 */
export async function cmdRefresh() {
  console.log('🚀 Full Portfolio Refresh')
  try {
    await cmdExtract()
    await cmdAnalyze()
    await cmdBuild()
    console.log('\n✅ Portfolio refresh complete!')
  } catch (err) {
    console.error('❌ Refresh failed:', err)
    process.exit(1)
  }
}

/**
 * Check KB status
 */
export async function cmdStatus() {
  console.log('📊 Portfolio KB Status')
  try {
    const metaPath = join(PORTFOLIO_DIR, '_meta.json')
    const metaContent = await readFile(metaPath, 'utf-8')
    const meta = JSON.parse(metaContent)

    console.log(`   Last extracted: ${meta.lastExtractedAt || 'Never'}`)
    console.log(`   Last analyzed: ${meta.lastAnalyzedAt || 'Never'}`)
    console.log(`   Last KB built: ${meta.lastKbBuiltAt || 'Never'}`)
    console.log(`   Call count: ${meta.extractedCallCount || 0}`)
  } catch (err) {
    console.log('   KB not yet generated')
  }
}

// CLI handler
const command = process.argv[2]

switch (command) {
  case 'extract':
    cmdExtract()
    break
  case 'analyze':
    cmdAnalyze()
    break
  case 'build':
    cmdBuild()
    break
  case 'refresh':
    cmdRefresh()
    break
  case 'status':
    cmdStatus()
    break
  default:
    console.log('Usage: tsx src/portfolio/cli.ts <extract|analyze|build|refresh|status>')
}
