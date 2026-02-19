/**
 * Portfolio Batch Analyzer
 * 
 * Splits 16K Gong calls into batches and runs parallel LLM analysis
 * to extract patterns (use cases, objections, success factors, competitors, segments)
 */

import { execute } from '@sourcegraph/amp-sdk'
import type { ParquetGongCall } from '../clients/gongParquetClient.js'
import type { BatchAnalysisResult } from './types.js'

const BATCH_SIZE = 100
const CONCURRENT_BATCHES = 5

/**
 * Analyze a batch of Gong calls to extract patterns
 */
export async function analyzeCallBatch(
  calls: ParquetGongCall[],
  batchNumber: number
): Promise<BatchAnalysisResult> {
  console.log(`[batch-${batchNumber}] Analyzing ${calls.length} calls...`)

  const startTime = Date.now()

  // Build the prompt with the batch data
  const prompt = buildBatchAnalysisPrompt(calls, batchNumber)

  // Call LLM via Amp SDK (streaming response)
  let responseText = ''
  for await (const message of execute({ prompt })) {
    if (message.type === 'assistant') {
      for (const block of message.message.content) {
        if (block.type === 'text') {
          responseText += block.text
        }
      }
    }
  }

  const elapsed = Date.now() - startTime
  console.log(`[batch-${batchNumber}] Complete in ${(elapsed / 1000).toFixed(1)}s`)

  // Parse and validate result
  try {
    // Extract JSON from response (may be wrapped in markdown)
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) ||
                      responseText.match(/\{[\s\S]*\}/)
    const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : responseText
    const parsed = JSON.parse(jsonStr)
    
    return {
      batch: batchNumber,
      useCases: parseUseCases(parsed.useCases || []),
      objections: parseObjections(parsed.objections || []),
      successFactors: parseSuccessFactors(parsed.successFactors || []),
      competitors: parseCompetitors(parsed.competitors || []),
      segments: parseSegments(parsed.segments || []),
    }
  } catch (err) {
    console.error(`[batch-${batchNumber}] Failed to parse LLM response:`, err)
    // Return empty batch result on parse failure
    return {
      batch: batchNumber,
      useCases: [],
      objections: [],
      successFactors: [],
      competitors: [],
      segments: [],
    }
  }
}

/**
 * Analyze all Gong calls in parallel batches
 */
export async function analyzePortfolioCalls(
  calls: ParquetGongCall[]
): Promise<BatchAnalysisResult[]> {
  console.log(`\n📊 Analyzing ${calls.length} portfolio calls in batches of ${BATCH_SIZE}...`)

  // Split into batches
  const batches = chunk(calls, BATCH_SIZE)
  console.log(`   Split into ${batches.length} batches`)

  // Process in parallel with concurrency limit
  const results: BatchAnalysisResult[] = []

  for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
    const batchSlice = batches.slice(i, i + CONCURRENT_BATCHES)
    const batchNumbers = batchSlice.map((_, idx) => i + idx)

    console.log(`\n🔄 Processing batches ${batchNumbers[0]}-${batchNumbers[batchNumbers.length - 1]}...`)

    const batchPromises = batchSlice.map((batch, idx) =>
      analyzeCallBatch(batch, i + idx).catch((err) => {
        console.error(`[batch-${i + idx}] Error:`, err)
        // Return empty result on error
        return {
          batch: i + idx,
          useCases: [],
          objections: [],
          successFactors: [],
          competitors: [],
          segments: [],
        }
      })
    )

    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults)

    // Optional: Add delay between concurrent batch groups to avoid rate limits
    if (i + CONCURRENT_BATCHES < batches.length) {
      console.log('   ⏸️  Rate limiting delay...')
      await delay(2000)
    }
  }

  console.log(`\n✅ Analysis complete: ${results.length} batches processed`)
  return results
}

/**
 * Build the LLM prompt for batch analysis
 */
function buildBatchAnalysisPrompt(calls: ParquetGongCall[], batchNumber: number): string {
  // Prepare call summaries
  const callSummaries = calls.slice(0, 100).map((call, idx) => {
    const transcript = call.transcript_text
      ? call.transcript_text.slice(0, 1500) // First 1500 chars to save tokens
      : 'No transcript'

    return `
Call ${idx + 1}: ${call.title}
Date: ${call.created_at}
Duration: ${call.browser_duration_sec ? Math.round(call.browser_duration_sec / 60) : '?'} mins
Transcript (excerpt):
${transcript}
---`
  })

  return `You are a sales intelligence analyst analyzing Gong call transcripts to extract portfolio-level patterns.

BATCH ${batchNumber}: ${calls.length} Gong Calls

${callSummaries.join('\n')}

Extract the following patterns from these calls:

1. **Use Cases**: What problems/opportunities customers are trying to solve. Include industry context where mentioned.
2. **Objections**: Customer concerns or hesitations raised during calls.
3. **Success Factors**: What seems to drive deals forward or close them.
4. **Competitors**: Which competitors are mentioned and in what context.
5. **Segments**: Identify market segments (by industry, company size, role, etc) evident in the calls.

For each category, provide:
- ID (slug format, e.g., "uc-code-onboarding")
- Description/title
- Frequency count (how many calls mention this)
- Related features: code_search, code_insights, deep_search, batch_changes, or other
- Relevant quotes from the transcripts
- Industry/segment context where applicable

**Response format (JSON):**
{
  "useCases": [
    {
      "id": "string (slug)",
      "title": "string",
      "description": "string",
      "frequency": number,
      "relatedIndustries": ["string"],
      "relatedFeatures": ["string"],
      "exampleQuotes": ["string"]
    }
  ],
  "objections": [
    {
      "id": "string (slug)",
      "description": "string",
      "frequency": number,
      "relatedSegments": ["string"],
      "rebuttalSuggestions": ["string"],
      "exampleQuotes": ["string"]
    }
  ],
  "successFactors": [
    {
      "id": "string (slug)",
      "title": "string",
      "description": "string",
      "weight": 0.5,
      "relatedUseCases": ["string"],
      "relatedFeatures": ["string"]
    }
  ],
  "competitors": [
    {
      "competitorName": "string",
      "frequency": number,
      "contextSummary": "string",
      "useCasesCompeted": ["string"],
      "customerSentiment": "positive|neutral|negative|evaluating"
    }
  ],
  "segments": [
    {
      "id": "string (slug)",
      "name": "string",
      "callCount": number,
      "topUseCases": ["string"],
      "topObjections": ["string"]
    }
  ]
}

Focus on patterns that appear 2+ times in this batch. Be concise and data-driven.`
}

/**
 * Parse use cases from LLM response
 */
function parseUseCases(input: any[]): any[] {
  if (!Array.isArray(input)) return []
  return input
    .filter((uc) => uc?.title && uc?.description)
    .slice(0, 20) // Limit to top 20 per batch
}

/**
 * Parse objections from LLM response
 */
function parseObjections(input: any[]): any[] {
  if (!Array.isArray(input)) return []
  return input
    .filter((obj) => obj?.description)
    .slice(0, 15)
}

/**
 * Parse success factors from LLM response
 */
function parseSuccessFactors(input: any[]): any[] {
  if (!Array.isArray(input)) return []
  return input
    .filter((sf) => sf?.title && sf?.description)
    .slice(0, 15)
}

/**
 * Parse competitors from LLM response
 */
function parseCompetitors(input: any[]): any[] {
  if (!Array.isArray(input)) return []
  return input
    .filter((comp) => comp?.competitorName)
    .slice(0, 10)
}

/**
 * Parse segments from LLM response
 */
function parseSegments(input: any[]): any[] {
  if (!Array.isArray(input)) return []
  return input
    .filter((seg) => seg?.name)
    .slice(0, 10)
}

/**
 * Utility: split array into chunks
 */
function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

/**
 * Utility: delay for rate limiting
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
