#!/usr/bin/env tsx
/**
 * Batch fetch missing transcripts using Gong MCP server.
 * Queries Parquet for calls without transcripts and fetches them via MCP.
 * 
 * Usage: npx tsx scripts/fetch-transcripts-mcp.ts --limit 50 --dry-run
 */

import { spawn } from 'child_process'
import { homedir } from 'os'
import { writeFile } from 'fs/promises'
import { join } from 'path'

interface GongCall {
  call_id: number
  title: string
  created_at: string
}

const args = process.argv.slice(2)
const limit = parseInt(args[args.indexOf('--limit') + 1] || '50', 10)
const dryRun = args.includes('--dry-run')

async function loadMissingCalls(limit: number): Promise<GongCall[]> {
  return new Promise((resolve, reject) => {
    const pythonScript = `
import polars as pl
import json
from pathlib import Path

parquet_path = Path.home() / "gong_data" / "data" / "bronze" / "calls.parquet"
df = pl.read_parquet(parquet_path)

# Filter calls without transcripts, most recent first
missing = (
    df.filter(pl.col('has_transcript') == False)
    .sort('created_at', descending=True)
    .select(['call_id', 'title', 'created_at'])
    .head(${limit})
)

output = missing.to_dicts()
print(json.dumps(output, default=str))
`

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

async function fetchViaGongMcp(callIds: string[]): Promise<any> {
  // Use the Gong MCP server directly
  // This would normally be done via Amp SDK, but for standalone we need to call the MCP server
  
  // For now, just log what we would fetch
  console.log(`📥 Would fetch ${callIds.length} transcripts via Gong MCP`)
  return null
}

async function main() {
  console.log('📖 Loading calls without transcripts...')
  const missingCalls = await loadMissingCalls(limit)
  
  console.log(`Found ${missingCalls.length} calls without transcripts`)
  
  if (missingCalls.length === 0) {
    console.log('✅ All calls have transcripts!')
    return
  }
  
  if (dryRun) {
    console.log(`\n🏷️  Dry run - would fetch ${missingCalls.length} transcripts:`)
    missingCalls.forEach((call, i) => {
      console.log(`  ${i + 1}. [${call.call_id}] ${call.title}`)
    })
    return
  }
  
  console.log(`\n⚠️  To actually fetch, run this inside Amp context where MCP servers are available`)
  console.log(`Run: npx tsx scripts/fetch-transcripts-mcp.ts --limit ${limit}`)
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
