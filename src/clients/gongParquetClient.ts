/**
 * Client for querying Gong data from local Parquet lakehouse (~/gong_data)
 * 
 * Uses Python subprocess to query Parquet files with Polars
 * Bronze layer: ~/gong_data/data/bronze/calls.parquet
 * Silver layer: ~/gong_data/data/silver/calls_enriched.parquet
 */

import { spawn } from 'child_process';
import { homedir } from 'os';
import { join } from 'path';

export interface ParquetGongCall {
  call_id: number;
  title: string;
  created_at: string;
  browser_duration_sec: number | null;
  direction: string;
  disposition: string;
  status: string;
  has_transcript: boolean;
  transcript_text: string | null;
  // Optional enriched fields from Silver layer (future)
  summary?: string;
  action_items?: string[];
  next_steps?: string[];
  topics?: string[];
}

interface QueryGongCallsParams {
  accountNames: string[];  // Search terms to match in title
  from?: string;           // ISO timestamp
  to?: string;             // ISO timestamp
  limit?: number;
}

export interface PortfolioQueryParams {
  featureFilter?: string[];        // Optional: ["code search", "deep search", "code insights", "batch changes"]
  dateRange?: {
    from: string  // ISO date
    to: string
  }
  limit?: number                  // Default: all
  minTranscriptLength?: number    // Skip calls without meaningful transcripts (default: 100 chars)
}

/**
 * Query Gong calls from Parquet lakehouse
 */
export async function queryGongCallsFromParquet(
  params: QueryGongCallsParams
): Promise<ParquetGongCall[]> {
  const gongDataPath = join(homedir(), 'gong_data');
  const parquetPath = join(gongDataPath, 'data', 'bronze', 'calls.parquet');

  // Build Python query script
  const pythonScript = buildQueryScript(parquetPath, params);

  // Execute via Python subprocess
  const result = await executePythonScript(pythonScript, gongDataPath);

  return JSON.parse(result);
}

/**
 * Query ALL Gong calls from Parquet lakehouse for portfolio analysis
 * 
 * Supports optional feature filtering and date range.
 * Used for cross-account pattern extraction.
 */
export async function queryPortfolioCallsFromParquet(
  params: PortfolioQueryParams
): Promise<ParquetGongCall[]> {
  const gongDataPath = join(homedir(), 'gong_data');
  const parquetPath = join(gongDataPath, 'data', 'bronze', 'calls.parquet');

  // Build Python query script
  const pythonScript = buildPortfolioQueryScript(parquetPath, params);

  // Execute via Python subprocess
  const result = await executePythonScript(pythonScript, gongDataPath);

  return JSON.parse(result);
}

/**
 * Build Python script to query Parquet with Polars
 */
function buildQueryScript(
  parquetPath: string,
  params: QueryGongCallsParams
): string {
  const { accountNames, from, to, limit = 50 } = params;

  // Build filter conditions
  // Search in title, transcript_text, and brief for account mentions
  const titleFilters = accountNames
    .map(name => `(pl.col('title').str.contains('(?i)${escapeRegex(name)}') | pl.col('transcript_text').str.contains('(?i)${escapeRegex(name)}') | pl.col('brief').str.contains('(?i)${escapeRegex(name)}'))`)
    .join(' | ');

  const dateFilters: string[] = [];
  if (from) {
    dateFilters.push(`(pl.col('created_at') >= pl.lit('${from}').str.to_datetime(format='%Y-%m-%dT%H:%M:%S%.fZ'))`);
  }
  if (to) {
    dateFilters.push(`(pl.col('created_at') <= pl.lit('${to}').str.to_datetime(format='%Y-%m-%dT%H:%M:%S%.fZ'))`);
  }

  const allFilters = [
    `(${titleFilters})`,
    ...dateFilters
  ].filter(Boolean).join(' & ');

  return `
import polars as pl
import json

df = pl.read_parquet('${parquetPath}')

# Apply filters
filtered = df.filter(${allFilters})

# Sort by date descending and limit
result = filtered.sort('created_at', descending=True).head(${limit})

# Select columns and convert to JSON
# IMPORTANT: Cast call_id to string to avoid JavaScript precision loss
# JavaScript Number.MAX_SAFE_INTEGER is ~9e15, Gong call IDs can be ~2e18
output = result.select([
    'call_id',
    'title', 
    'created_at',
    'browser_duration_sec',
    'direction',
    'disposition',
    'status',
    'has_transcript',
    'transcript_text'
]).to_dicts()

# Convert call_id to string to preserve precision
for row in output:
    row['call_id'] = str(row['call_id'])

print(json.dumps(output, default=str))
`.trim();
}

/**
 * Build Python script for portfolio query (all calls, optional feature filtering)
 */
function buildPortfolioQueryScript(
  parquetPath: string,
  params: PortfolioQueryParams
): string {
  const { featureFilter, dateRange, limit } = params;

  // Build filter conditions
  const filterConditions: string[] = [];

  // Date range filtering (optional)
  if (dateRange?.from) {
    filterConditions.push(
      `(pl.col('created_at') >= pl.lit('${dateRange.from}').str.to_datetime(format='%Y-%m-%dT%H:%M:%S%.fZ'))`
    );
  }
  if (dateRange?.to) {
    filterConditions.push(
      `(pl.col('created_at') <= pl.lit('${dateRange.to}').str.to_datetime(format='%Y-%m-%dT%H:%M:%S%.fZ'))`
    );
  }

  // Feature filtering: search in title or transcript for feature keywords
  if (featureFilter && featureFilter.length > 0) {
    const featurePatterns = featureFilter
      .map(f => `pl.col('title').str.contains('(?i)${escapeRegex(f)}') | pl.col('transcript_text').str.contains('(?i)${escapeRegex(f)}')`)
      .join(' | ');
    filterConditions.push(`(${featurePatterns})`);
  }

  // Require transcript exists (quality filtering)
  filterConditions.push(`pl.col('transcript_text').is_not_null()`);

  const allFilters = filterConditions.length > 0
    ? filterConditions.join(' & ')
    : 'True';

  const limitClause = limit ? `head(${limit})` : '';

  return `
import polars as pl
import json

df = pl.read_parquet('${parquetPath}')

# Apply filters
filtered = df.filter(${allFilters})

# Sort by date descending
${limitClause ? `result = filtered.sort('created_at', descending=True).${limitClause}` : `result = filtered.sort('created_at', descending=True)`}

# Select columns and convert to JSON
# IMPORTANT: Cast call_id to string to avoid JavaScript precision loss
output = result.select([
    'call_id',
    'title', 
    'created_at',
    'browser_duration_sec',
    'direction',
    'disposition',
    'status',
    'has_transcript',
    'transcript_text'
]).to_dicts()

# Convert call_id to string to preserve precision
for row in output:
    row['call_id'] = str(row['call_id'])

print(json.dumps(output, default=str))
`.trim();
}

/**
 * Execute Python script and return stdout
 */
function executePythonScript(script: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Use venv Python if available, otherwise system Python
    const venvPython = join(cwd, 'venv', 'bin', 'python');
    const python = venvPython; // Assume venv exists

    const proc = spawn(python, ['-c', script], {
      cwd,
      env: { ...process.env }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(
          `Python script failed (exit ${code}): ${stderr}\n\nScript:\n${script}`
        ));
      } else {
        resolve(stdout.trim());
      }
    });

    proc.on('error', (err) => {
      reject(new Error(
        `Failed to spawn Python process: ${err.message}\n` +
        `Make sure Python with polars is available at: ${python}`
      ));
    });
  });
}

/**
 * Escape regex special characters for Polars str.contains
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
