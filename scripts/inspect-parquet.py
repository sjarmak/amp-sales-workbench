#!/usr/bin/env python3
"""Inspect Parquet schema and sample data from ~/gong_data"""

import polars as pl
from pathlib import Path

# Read bronze calls
bronze_path = Path.home() / "gong_data" / "data" / "bronze" / "calls.parquet"
df = pl.read_parquet(bronze_path)

print("=== Bronze Calls Schema ===")
print(f"Shape: {df.shape}")
print(f"\nColumns ({len(df.columns)}):")
for col in df.columns:
    print(f"  - {col}: {df[col].dtype}")

print("\n=== Sample Rows ===")
print(df.select(['call_id', 'title', 'created_at', 'browser_duration_sec']).head(3))

print("\n=== Account Filtering Test ===")
# Test filtering for an account (replace with actual account name)
test_calls = df.filter(pl.col('title').str.contains('(?i)acme'))
print(f"Calls with 'acme' in title: {len(test_calls)}")
if len(test_calls) > 0:
    print(test_calls.select(['call_id', 'title', 'created_at']).head(3))
