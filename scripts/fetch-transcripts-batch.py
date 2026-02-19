#!/usr/bin/env python3
"""
Batch fetch missing transcripts from Gong API and update Parquet.
Requires GONG_API_KEY environment variable.

Usage:
  python3 fetch-transcripts-batch.py --limit 50 --dry-run
  python3 fetch-transcripts-batch.py --limit 10 --delay 2000
"""

import sys
import os
import json
import argparse
import time
import base64
from pathlib import Path
from datetime import datetime
import requests
import polars as pl

def get_missing_calls(limit: int = 50) -> list[dict]:
    """Load calls without transcripts from Parquet."""
    parquet_path = Path.home() / "gong_data" / "data" / "bronze" / "calls.parquet"
    
    if not parquet_path.exists():
        print(f"❌ Parquet not found: {parquet_path}")
        sys.exit(1)
    
    df = pl.read_parquet(parquet_path)
    
    # Filter calls without transcripts, most recent first
    # Only include calls that are:
    # - In the past (likely recorded)
    # - Completed (not cancelled, scheduled, or failed)
    now = pl.lit(datetime.now())
    missing = (
        df.filter(
            (pl.col('has_transcript') == False) & 
            (pl.col('created_at') < now) &
            (pl.col('status') == 'COMPLETED')
        )
        .sort('created_at', descending=True)
        .select(['call_id', 'title', 'created_at'])
        .head(limit)
    )
    
    calls = missing.to_dicts()
    print(f"📖 Found {len(calls)} past calls without transcripts (limit: {limit})")
    return calls

def fetch_transcript_from_gong(call_id: int, api_key: str, api_secret: str, delay_ms: int = 1000) -> dict | None:
    """Fetch transcript from Gong API."""
    
    # Gong API endpoint
    url = "https://api.gong.io/v2/calls/transcript"
    
    # Gong uses Basic Auth with access_key:access_secret
    credentials = base64.b64encode(f"{api_key}:{api_secret}".encode()).decode()
    
    headers = {
        "Authorization": f"Basic {credentials}",
        "Content-Type": "application/json",
    }
    
    payload = {
        "filter": {
            "callIds": [str(call_id)],
        }
    }
    
    try:
        print(f"  → Fetching transcript for call {call_id}...")
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        
        if response.status_code == 401:
            print(f"  ❌ Unauthorized - check GONG_API_KEY")
            return None
        
        if response.status_code == 429:
            print(f"  ⏱️  Rate limited - sleeping 60s")
            time.sleep(60)
            return None
        
        if response.status_code != 200:
            print(f"  ❌ API error {response.status_code}: {response.text[:100]}")
            return None
        
        data = response.json()
        
        if not data.get('callTranscripts'):
            print(f"  ℹ️  No transcript available")
            return None
        
        transcript_data = data['callTranscripts'][0]
        
        # Parse transcript segments
        transcript_text = ""
        if transcript_data.get('transcript'):
            segments = []
            for segment in transcript_data['transcript']:
                speaker_id = segment.get('speakerId', 'Unknown')
                short_id = str(speaker_id)[-4:] if speaker_id else 'Unknown'
                sentences = ' '.join([s.get('text', '') for s in segment.get('sentences', [])])
                segments.append(f"Speaker ...{short_id}: {sentences}")
            transcript_text = '\n'.join(segments)
        
        result = {
            'call_id': call_id,
            'transcript_text': transcript_text or None,
            'summary': transcript_data.get('summary'),
            'action_items': transcript_data.get('actionItems'),
            'next_steps': transcript_data.get('nextSteps'),
            'topics': [t.get('name', t) if isinstance(t, dict) else t for t in transcript_data.get('topics', [])],
            'fetched_at': datetime.now().isoformat() + 'Z',
            'success': True,
        }
        
        if transcript_text:
            print(f"  ✅ Fetched {len(transcript_text)} chars")
        else:
            print(f"  ⚠️  Empty transcript")
        
        return result
        
    except requests.exceptions.Timeout:
        print(f"  ❌ Request timeout")
        return None
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return None

def update_parquet(updates: list[dict]) -> None:
    """Update Parquet with fetched transcripts."""
    
    parquet_path = Path.home() / "gong_data" / "data" / "bronze" / "calls.parquet"
    
    if not updates:
        print("No transcripts to update")
        return
    
    print(f"\n✏️  Updating Parquet with {len(updates)} transcripts...")
    
    # Load existing Parquet
    df = pl.read_parquet(parquet_path)
    
    # Create lookup for updates
    update_map = {u['call_id']: u for u in updates}
    
    # Update transcript_text and has_transcript columns
    updated_transcript = []
    updated_flag = []
    
    for call_id in df['call_id']:
        if call_id in update_map:
            update = update_map[call_id]
            updated_transcript.append(update['transcript_text'])
            updated_flag.append(bool(update['transcript_text']))  # Only mark if transcript exists
        else:
            updated_transcript.append(None)
            updated_flag.append(False)
    
    # Replace columns
    df = df.with_columns([
        pl.Series('transcript_text', updated_transcript),
        pl.Series('has_transcript', updated_flag),
    ])
    
    # Write back
    df.write_parquet(parquet_path)
    
    print(f"✅ Updated Parquet: {len(updates)} transcripts added")

def main():
    parser = argparse.ArgumentParser(description="Batch fetch Gong transcripts")
    parser.add_argument("--limit", type=int, default=50, help="Max transcripts to fetch")
    parser.add_argument("--delay", type=int, default=1000, help="Delay between requests (ms)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be fetched")
    
    args = parser.parse_args()
    
    # Check API credentials
    api_key = os.environ.get('GONG_ACCESS_KEY')
    api_secret = os.environ.get('GONG_ACCESS_SECRET')
    
    if not args.dry_run:
        if not api_key or not api_secret:
            print("❌ GONG_ACCESS_KEY and GONG_ACCESS_SECRET environment variables required")
            sys.exit(1)
    
    # Get missing calls
    missing_calls = get_missing_calls(args.limit)
    
    if not missing_calls:
        print("✅ All calls have transcripts!")
        return
    
    if args.dry_run:
        print(f"\n🏷️  Dry run - would fetch {len(missing_calls)} transcripts:")
        for i, call in enumerate(missing_calls, 1):
            print(f"  {i}. [{call['call_id']}] {call['title']} ({call['created_at']})")
        return
    
    # Fetch transcripts
    print(f"\n📥 Fetching {len(missing_calls)} transcripts (delay: {args.delay}ms)...\n")
    
    updates = []
    for i, call in enumerate(missing_calls, 1):
        print(f"[{i}/{len(missing_calls)}]", end=" ", flush=True)
        
        result = fetch_transcript_from_gong(call['call_id'], api_key, api_secret)
        if result:
            updates.append(result)
        
        # Rate limit (except on last call)
        if i < len(missing_calls):
            time.sleep(args.delay / 1000.0)
    
    if not updates:
        print(f"\n⚠️  No transcripts were fetched")
        return
    
    # Update Parquet
    update_parquet(updates)
    
    print(f"\n🎉 Success! Fetched {len(updates)} / {len(missing_calls)} transcripts")

if __name__ == "__main__":
    main()
