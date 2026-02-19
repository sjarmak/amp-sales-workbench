#!/usr/bin/env python3
"""
Merge Redash CSV export with existing Gong Parquet lakehouse.
Usage: python merge-gong-redash.py ~/Downloads/New_Query_2025_12_02.csv
"""

import sys
import os
from pathlib import Path
import polars as pl
from datetime import datetime

def merge_gong_data(csv_file: str):
    """Merge CSV from Redash with existing Parquet."""
    
    csv_path = Path(csv_file).expanduser()
    gong_data_path = Path.home() / "gong_data" / "data" / "bronze"
    parquet_path = gong_data_path / "calls.parquet"
    
    if not csv_path.exists():
        print(f"❌ CSV file not found: {csv_path}")
        sys.exit(1)
    
    print(f"📖 Reading CSV: {csv_path}")
    csv_df = pl.read_csv(csv_path)
    print(f"   Rows: {csv_df.height}, Columns: {csv_df.width}")
    
    # Map Redash columns to Parquet schema
    csv_df = csv_df.rename({
        "BROWSER_DURATION_SEC": "browser_duration_sec",
        "DIRECTION": "direction",
        "DISPOSITION": "disposition",
        "EFFECTIVE_START_DATETIME": "created_at",
        "STATUS": "status",
        "TITLE": "title",
        "CONVERSATION_ID": "call_id",
    })
    
    # Parse timestamps first
    csv_df = csv_df.with_columns([
        pl.col("created_at").str.to_datetime(format="%Y-%m-%d %H:%M"),
    ])
    
    # Cast browser_duration_sec to float
    csv_df = csv_df.with_columns([
        pl.col("browser_duration_sec").cast(pl.Float64),
    ])
    
    # Build final schema matching existing Parquet
    csv_df = csv_df.with_columns([
        pl.col("call_id").cast(pl.Int64),
        pl.lit(None, dtype=pl.Float64).alias("presentation_duration_sec"),
        pl.lit(None, dtype=pl.Int64).alias("question_company_count"),
        pl.lit(None, dtype=pl.Int64).alias("question_non_company_count"),
        pl.lit(None, dtype=pl.Int64).alias("owner_id"),
        pl.col("CALL_URL").alias("call_url"),
        pl.col("CALL_SPOTLIGHT_BRIEF").alias("brief"),
        pl.lit(None, dtype=pl.Utf8).alias("highlights"),
        pl.lit(None, dtype=pl.Utf8).alias("notes"),
        pl.lit(None, dtype=pl.Utf8).alias("transcript_text"),
        pl.lit(False).alias("has_transcript"),
        pl.col("CALL_SPOTLIGHT_TYPE").alias("spotlight_status"),
    ])
    
    # Select final columns in schema order
    select_cols = [
        "call_id",
        "title",
        "direction",
        "disposition",
        "created_at",
        "status",
        "browser_duration_sec",
        "presentation_duration_sec",
        "question_company_count",
        "question_non_company_count",
        "owner_id",
        "call_url",
        "brief",
        "highlights",
        "notes",
        "transcript_text",
        "has_transcript",
        "spotlight_status",
    ]
    
    csv_df = csv_df.select(select_cols)
    
    print(f"\n📊 Transformed CSV schema:")
    print(csv_df.schema)
    
    # Load existing Parquet if it exists
    if parquet_path.exists():
        print(f"\n📖 Reading existing Parquet: {parquet_path}")
        existing_df = pl.read_parquet(parquet_path)
        print(f"   Rows: {existing_df.height}")
        
        # Find calls that are NOT in CSV (older calls)
        csv_call_ids_set = set(csv_df.select("call_id").to_series().to_list())
        
        # Filter existing calls not in CSV
        older_calls = existing_df.filter(~pl.col("call_id").is_in(csv_call_ids_set))
        print(f"\n🔄 Deduplication: {existing_df.height} existing - {csv_df.height} new = {older_calls.height} to keep")
        
        # Concatenate: CSV (newest) + older calls
        merged_df = pl.concat([csv_df, older_calls])
        merged_df = merged_df.sort("created_at", descending=True)
    else:
        print(f"\n✨ No existing Parquet, creating new from CSV")
        gong_data_path.mkdir(parents=True, exist_ok=True)
        merged_df = csv_df
    
    print(f"\n✅ Writing merged data: {parquet_path}")
    print(f"   Total rows: {merged_df.height}")
    merged_df.write_parquet(parquet_path)
    
    print(f"\n🎉 Success! Updated Parquet with {csv_df.height} calls from Redash")
    print(f"   Next sync timestamp: {datetime.now().isoformat()}Z")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python merge-gong-redash.py <csv_file>")
        sys.exit(1)
    
    merge_gong_data(sys.argv[1])
