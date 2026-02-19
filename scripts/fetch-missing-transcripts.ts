#!/usr/bin/env tsx
/**
 * Batch fetch missing transcripts from Gong and update Parquet
 * Usage: npx tsx scripts/fetch-missing-transcripts.ts [--limit 50] [--delay 1000]
 * 
 * Options:
 *   --limit N     Max transcripts to fetch per run (default: 50)
 *   --delay MS    Delay between API calls in ms (default: 1000)
 *   --dry-run     Show what would be updated without fetching
 */

import { readFile, writeFile } from 'fs/promises'
import { spawn } from 'child_process'
import { homedir } from 'os'
import { join } from 'path'
import type { Amp } from '@sourcegraph/amp'

interface GongCall {
  call_id: number
  title: string
  created_at: string
  has_transcript: boolean
  transcript_text: string | null
  [key: string]: any
}

interface TranscriptResult {
  callId: number
  transcript: string
  summary?: string
  actionItems?: string[]
  nextSteps?: string[]
  topics?: string[]
  fetchedAt: string
}

const args = process.argv.slice(2)
const limit = parseInt(args[args.indexOf('--limit') + 1] || '50', 10)
const delay = parseInt(args[args.indexOf('--delay') + 1] || '1000', 10)
const dryRun = args.includes('--dry-run')

async function loadParquet(): Promise<GongCall[]> {
  const pythonScript = `
import polars as pl
import json
from pathlib import Path

parquet_path = Path.home() / "gong_data" / "data" / "bronze" / "calls.parquet"
df = pl.read_parquet(parquet_path)

# Filter calls without transcripts
missing = df.filter(pl.col('has_transcript') == False).sort('created_at', descending=True)

# Return as JSON
output = missing.select(['call_id', 'title', 'created_at', 'has_transcript', 'transcript_text']).to_dicts()
print(json.dumps(output, default=str))
`

  return new Promise((resolve, reject) => {
    const proc = spawn('python3', ['-c', pythonScript], {
      cwd: homedir(),
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python failed: ${stderr}`))
      } else {
        try {
          resolve(JSON.parse(stdout.trim()))
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${e}`))
        }
      }
    })
  })
}

async function fetchTranscriptFromMcp(callId: number): Promise<TranscriptResult | null> {
  // Try to use Amp SDK if available (when running in Amp context)
  if (typeof globalThis.amp !== 'undefined') {
    try {
      const amp = globalThis.amp as Amp
      const result = await amp.execute({
        toolName: 'mcp__gong_extended__retrieve_transcripts',
        input: {
          callIds: [callId.toString()],
        },
      })

      if (result.callTranscripts?.length > 0) {
        const data = result.callTranscripts[0]
        const transcript = (data.transcript || [])
          .map((seg: any) => {
            const shortId = seg.speakerId?.toString().slice(-4) || 'Unknown'
            const text = (seg.sentences || []).map((s: any) => s.text).join(' ')
            return `Speaker ...${shortId}: ${text}`
          })
          .join('\n')

        return {
          callId,
          transcript,
          summary: data.summary,
          actionItems: data.actionItems,
          nextSteps: data.nextSteps,
          topics: data.topics?.map((t: any) => t.name || t),
          fetchedAt: new Date().toISOString(),
        }
      }
    } catch (error) {
      console.warn(`MCP fetch failed for call ${callId}:`, error)
    }
  }

  return null
}

async function updateParquetWithTranscripts(updates: TranscriptResult[]): Promise<void> {
  if (updates.length === 0) {
    console.log('No transcripts to update')
    return
  }

  const pythonScript = `
import polars as pl
import json
from pathlib import Path

# Read updates from stdin
updates_json = '''${JSON.stringify(updates)}'''
updates = json.loads(updates_json)

# Load existing Parquet
parquet_path = Path.home() / "gong_data" / "data" / "bronze" / "calls.parquet"
df = pl.read_parquet(parquet_path)

# Create update map
update_map = {int(u['callId']): u for u in updates}

# Update transcript_text and has_transcript columns
def update_row(call_id):
  if call_id in update_map:
    return update_map[call_id]['transcript']
  return None

def update_flag(call_id):
  return call_id in update_map

# Apply updates
df = df.with_columns([
  pl.col('call_id').map_elements(update_row, return_dtype=pl.Utf8 | pl.Null).alias('transcript_text_new'),
  pl.col('call_id').map_elements(update_flag, return_dtype=pl.Boolean).alias('has_transcript_new'),
])

# Use new values where we have updates, keep old values otherwise
df = df.with_columns([
  pl.when(pl.col('has_transcript_new')).then(pl.col('transcript_text_new')).otherwise(pl.col('transcript_text')).alias('transcript_text'),
  pl.when(pl.col('has_transcript_new')).then(pl.col('has_transcript_new')).otherwise(pl.col('has_transcript')).alias('has_transcript'),
]).drop(['transcript_text_new', 'has_transcript_new'])

# Write back
df.write_parquet(parquet_path)
print(f'Updated {len(updates)} transcripts')
`

  return new Promise((resolve, reject) => {
    const proc = spawn('python3', ['-c', pythonScript], {
      cwd: homedir(),
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python failed: ${stderr}`))
      } else {
        console.log(stdout)
        resolve()
      }
    })
  })
}

async function main() {
  try {
    console.log('📖 Loading calls without transcripts from Parquet...')
    const missingCalls = await loadParquet()
    console.log(`Found ${missingCalls.length} calls without transcripts`)

    if (missingCalls.length === 0) {
      console.log('✅ All calls have transcripts!')
      return
    }

    const toFetch = missingCalls.slice(0, limit)
    console.log(`\n📥 Will fetch ${toFetch.length} transcripts (limit: ${limit})`)

    if (dryRun) {
      console.log('\n🏷️  Dry run - calls to fetch:')
      toFetch.forEach((call, i) => {
        console.log(`  ${i + 1}. [${call.call_id}] ${call.title} (${call.created_at})`)
      })
      return
    }

    // Fetch transcripts with rate limiting
    const updates: TranscriptResult[] = []
    for (let i = 0; i < toFetch.length; i++) {
      const call = toFetch[i]
      console.log(`\n[${i + 1}/${toFetch.length}] Fetching transcript for call ${call.call_id}...`)

      const result = await fetchTranscriptFromMcp(call.call_id)
      if (result) {
        updates.push(result)
        console.log(`  ✅ Fetched ${result.transcript.length} chars`)
      } else {
        console.log(`  ⏭️  No transcript available`)
      }

      // Rate limit
      if (i < toFetch.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    if (updates.length === 0) {
      console.log('\n⚠️  No transcripts were fetched')
      return
    }

    console.log(`\n✏️  Updating Parquet with ${updates.length} transcripts...`)
    await updateParquetWithTranscripts(updates)

    console.log(`\n🎉 Success! Updated ${updates.length} / ${toFetch.length} transcripts`)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()
