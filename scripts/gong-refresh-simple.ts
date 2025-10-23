#!/usr/bin/env tsx
/**
 * Simple Gong refresh script for use with amp -x
 * 
 * Usage: amp -x --dangerously-allow-all "$(cat scripts/gong-refresh-simple.ts)" AccountName [since]
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const accountName = process.argv[2];
const since = process.argv[3]; // Optional: ISO date string

if (!accountName) {
  console.error('Usage: gong-refresh-simple.ts <accountName> [since]');
  process.exit(1);
}

console.log(`Fetching Gong calls for ${accountName}...`);

// Use MCP tools that should be available in amp context
const calls: any[] = [];
const summaries: any[] = [];
const transcriptMeta: Record<string, { hash: string; fetchedAt: string }> = {};

try {
  // List calls
  const listParams: any = {};
  if (since) {
    listParams.fromDateTime = since;
  }
  
  console.log('Calling mcp__gong_extended__list_calls...');
  const callsResult = await (globalThis as any).mcp__gong_extended__list_calls(listParams);
  
  console.log(`Got ${callsResult.calls?.length || 0} total calls`);
  
  // Filter for account name in participants or title
  const filtered = (callsResult.calls || []).filter((call: any) => {
    const titleMatch = call.title?.toLowerCase().includes(accountName.toLowerCase());
    const participantMatch = call.participants?.some((p: string) => 
      p.toLowerCase().includes(accountName.toLowerCase())
    );
    return titleMatch || participantMatch;
  });
  
  console.log(`Found ${filtered.length} calls matching "${accountName}"`);
  
  // Get transcripts for matching calls (limit to 10 most recent)
  const callsToFetch = filtered.slice(0, 10);
  const callIds = callsToFetch.map((c: any) => c.id);
  
  calls.push(...callsToFetch);
  
  if (callIds.length > 0) {
    console.log(`Fetching transcripts for ${callIds.length} calls...`);
    const transcriptResult = await (globalThis as any).mcp__gong_extended__retrieve_transcripts({ callIds });
    
    if (transcriptResult.transcripts) {
      summaries.push(...transcriptResult.transcripts);
      
      // Build transcript metadata
      for (const t of transcriptResult.transcripts) {
        transcriptMeta[t.callId] = {
          hash: `hash-${t.callId}`,
          fetchedAt: new Date().toISOString()
        };
      }
    }
  }
  
  // Save results
  const accountSlug = accountName.toLowerCase().replace(/\s+/g, '-');
  const accountDir = join(process.cwd(), 'data/accounts', accountSlug);
  const rawDir = join(accountDir, 'raw');
  
  mkdirSync(rawDir, { recursive: true });
  
  const output = {
    calls,
    summaries,
    transcripts: transcriptMeta,
    lastSyncedAt: new Date().toISOString()
  };
  
  writeFileSync(join(rawDir, 'gong.json'), JSON.stringify(output, null, 2));
  
  console.log(`✓ Saved ${calls.length} calls with ${summaries.length} transcripts to ${rawDir}/gong.json`);
  
} catch (error: any) {
  console.error('Gong refresh failed:', error.message);
  process.exit(1);
}
