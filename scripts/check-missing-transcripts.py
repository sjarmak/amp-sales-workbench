#!/usr/bin/env python3
"""
Check which COMPLETED calls are missing transcripts that actually exist in Gong.
Samples calls to find gaps in transcript coverage.

Usage: python3 check-missing-transcripts.py --sample 20
"""

import os
import json
import argparse
import requests
import base64
import polars as pl
from pathlib import Path

def get_missing_completed():
    """Get COMPLETED calls without transcripts."""
    parquet_path = Path.home() / "gong_data" / "data" / "bronze" / "calls.parquet"
    df = pl.read_parquet(parquet_path)
    
    missing = (
        df.filter(
            (pl.col('has_transcript') == False) & 
            (pl.col('status') == 'COMPLETED')
        )
        .sort('created_at', descending=True)
        .select(['call_id', 'title', 'created_at'])
    )
    
    return missing.to_dicts()

def check_transcript_exists(call_id: int, api_key: str, api_secret: str) -> bool:
    """Check if transcript exists in Gong."""
    credentials = base64.b64encode(f"{api_key}:{api_secret}".encode()).decode()
    
    headers = {
        "Authorization": f"Basic {credentials}",
        "Content-Type": "application/json",
    }
    
    try:
        response = requests.post(
            "https://api.gong.io/v2/calls/transcript",
            json={"filter": {"callIds": [str(call_id)]}},
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('callTranscripts') and data['callTranscripts'][0].get('transcript'):
                return True
        
        return False
    except Exception as e:
        print(f"Error checking {call_id}: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Check for missed transcripts")
    parser.add_argument("--sample", type=int, default=20, help="Number to sample")
    args = parser.parse_args()
    
    api_key = os.environ.get('GONG_ACCESS_KEY')
    api_secret = os.environ.get('GONG_ACCESS_SECRET')
    
    if not api_key or not api_secret:
        print("❌ GONG_ACCESS_KEY and GONG_ACCESS_SECRET required")
        return
    
    print("📖 Checking for missed transcripts...")
    missing = get_missing_completed()
    print(f"Total COMPLETED calls without transcripts: {len(missing)}\n")
    
    if len(missing) == 0:
        print("✅ All COMPLETED calls have transcripts!")
        return
    
    # Sample check
    sample_size = min(args.sample, len(missing))
    print(f"🔍 Sampling {sample_size} calls...")
    
    has_transcript = []
    missing_transcript = []
    
    for i, call in enumerate(missing[:sample_size]):
        print(f"[{i+1}/{sample_size}] Checking {call['call_id']}...", end=" ", flush=True)
        
        exists = check_transcript_exists(call['call_id'], api_key, api_secret)
        
        if exists:
            has_transcript.append(call)
            print("✅ HAS TRANSCRIPT")
        else:
            missing_transcript.append(call)
            print("❌ No transcript")
    
    print(f"\n📊 Results:")
    print(f"   Transcripts exist but missed: {len(has_transcript)}")
    print(f"   Genuinely missing: {len(missing_transcript)}")
    
    if has_transcript:
        print(f"\n🔴 Missed calls (need re-fetch):")
        for call in has_transcript[:10]:
            print(f"   [{call['call_id']}] {call['title']}")
        if len(has_transcript) > 10:
            print(f"   ... and {len(has_transcript) - 10} more")
    
    if missing_transcript:
        print(f"\n⚪ Calls without transcripts in Gong:")
        for call in missing_transcript[:5]:
            print(f"   [{call['call_id']}] {call['title']}")

if __name__ == "__main__":
    main()
