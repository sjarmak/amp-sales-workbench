#!/usr/bin/env python3
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path
import polars as pl

# Configuration
BQ_DATASET = "sales_workbench"
BQ_TABLE = "gong_calls"
LAKEHOUSE_PATH = Path.home() / "gong_data" / "data" / "bronze" / "calls.parquet"
MAX_ROWS = 10000  # Safety limit for incremental batch

def get_max_timestamp(parquet_path: Path) -> str:
    """Read the Parquet file and find the latest created_at timestamp."""
    if not parquet_path.exists():
        return None
    
    try:
        # Scan parquet is lazy and efficient
        df = pl.read_parquet(parquet_path)
        if df.height == 0:
            return None
            
        max_date = df["created_at"].max()
        # Format as string for SQL comparison
        return max_date
    except Exception as e:
        print(f"⚠️  Warning: Could not read existing parquet file: {e}")
        return None

def fetch_from_bigquery(since_date: str = None):
    """Run bq query to fetch new calls."""
    
    # Select matching columns to your schema
    cols = [
        "call_id", "title", "direction", "disposition", "created_at", 
        "status", "browser_duration_sec", "presentation_duration_sec",
        "owner_id", "call_url", "brief", "highlights", "notes", 
        "transcript_text", "has_transcript", "spotlight_status"
    ]
    
    col_str = ", ".join(cols)
    
    where_clause = ""
    if since_date:
        # Ensure we handle ISO strings correctly in SQL
        where_clause = f"WHERE created_at > TIMESTAMP('{since_date}')"
    
    query = f"""
        SELECT {col_str}
        FROM `{BQ_DATASET}.{BQ_TABLE}`
        {where_clause}
        ORDER BY created_at ASC
        LIMIT {MAX_ROWS}
    """
    
    print(f"🔍 Executing BQ Query (Since: {since_date or 'BEGINNING'})...")
    
    # Run bq query command
    # --format=json gives us structured data we can parse
    cmd = [
        "bq", "query", 
        "--format=json", 
        "--nouse_legacy_sql", 
        f"--max_rows={MAX_ROWS}",
        query
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"❌ BQ Error: {result.stderr}")
        sys.exit(1)
        
    return json.loads(result.stdout)

def main():
    print(f"🚀 Starting Incremental Sync: BigQuery -> {LAKEHOUSE_PATH}")
    
    # 1. Check local state
    last_sync = get_max_timestamp(LAKEHOUSE_PATH)
    
    # 2. Fetch new data
    new_records = fetch_from_bigquery(last_sync)
    
    if not new_records:
        print("✅ No new calls found in BigQuery. Local lakehouse is up to date.")
        return

    print(f"📥 Fetched {len(new_records)} new calls from BigQuery.")
    
    # 3. Convert to DataFrame
    new_df = pl.DataFrame(new_records)
    
    # Ensure created_at is parsed as datetime to match parquet schema
    # Polars JSON ingest often treats strings as strings, need to cast
    if "created_at" in new_df.columns:
        new_df = new_df.with_columns(
            pl.col("created_at").str.to_datetime().alias("created_at")
        )

    # 4. Merge and Save
    if LAKEHOUSE_PATH.exists() and last_sync:
        print("twisted Merging with existing lakehouse...")
        existing_df = pl.read_parquet(LAKEHOUSE_PATH)
        
        # Concat
        combined_df = pl.concat([existing_df, new_df], how="vertical")
        
        # Deduplicate just in case (by call_id)
        if "call_id" in combined_df.columns:
            combined_df = combined_df.unique(subset=["call_id"], keep="last")
            
        final_df = combined_df
    else:
        print("🆕 Creating new lakehouse file...")
        final_df = new_df
        # Ensure parent dir exists
        LAKEHOUSE_PATH.parent.mkdir(parents=True, exist_ok=True)

    # 5. Write back
    final_df.write_parquet(LAKEHOUSE_PATH, compression="zstd")
    
    print(f"✅ Sync Complete. Total calls in lakehouse: {final_df.height}")
    print(f"💾 Saved to: {LAKEHOUSE_PATH}")

if __name__ == "__main__":
    main()
