#!/usr/bin/env python3
"""
Export Parquet data to BigQuery JSON Lines format.
Converts ~/gong_data/calls.parquet to a format suitable for BigQuery.

Usage:
    python3 scripts/export-parquet-to-bq.py [--limit 500] [--output gong_sample.jsonl]
"""

import json
import os
import sys
from pathlib import Path
from typing import Optional
import argparse

try:
    import polars as pl
except ImportError:
    print("❌ polars not found. Install with: pip install polars")
    sys.exit(1)


def export_gong_parquet_to_jsonl(
    parquet_path: str,
    output_path: str,
    limit: Optional[int] = None,
    verbose: bool = True
) -> dict:
    """
    Export Gong Parquet file to BigQuery-compatible JSONL.
    
    Args:
        parquet_path: Path to calls.parquet
        output_path: Output JSONL file
        limit: Max rows to export (None = all)
        verbose: Print progress
    
    Returns:
        Stats dict with row count and any errors
    """
    stats = {
        'rows_read': 0,
        'rows_written': 0,
        'errors': [],
        'sample_columns': [],
    }
    
    # Read parquet
    if verbose:
        print(f"📖 Reading parquet: {parquet_path}")
    
    if not os.path.exists(parquet_path):
        print(f"❌ File not found: {parquet_path}")
        sys.exit(1)
    
    df = pl.read_parquet(parquet_path)
    stats['rows_read'] = len(df)
    
    if verbose:
        print(f"✅ Loaded {len(df)} rows")
        print(f"   Columns: {df.columns}")
    
    # Limit rows if specified
    if limit and len(df) > limit:
        df = df.head(limit)
        if verbose:
            print(f"📊 Limited to {limit} rows")
    
    # Convert to JSONL
    if verbose:
        print(f"🔄 Converting to JSON Lines...")
    
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_file, 'w') as f:
        for i, row in enumerate(df.iter_rows(named=True)):
            try:
                # Convert row to JSON-serializable dict
                json_row = {}
                for k, v in row.items():
                    if v is None:
                        json_row[k] = None
                    elif hasattr(v, 'isoformat'):
                        # Convert datetime to ISO string
                        json_row[k] = v.isoformat()
                    elif isinstance(v, (list, dict)):
                        json_row[k] = v
                    else:
                        json_row[k] = v
                
                f.write(json.dumps(json_row) + '\n')
                stats['rows_written'] += 1
                
                # Print sample of first row
                if i == 0:
                    stats['sample_columns'] = list(json_row.keys())
                    if verbose:
                        print(f"   Sample row: {list(json_row.keys())}")
                
                # Progress indicator
                if verbose and (i + 1) % 100 == 0:
                    print(f"   ✓ Processed {i + 1} rows...")
            
            except Exception as e:
                stats['errors'].append(f"Row {i}: {str(e)}")
    
    if verbose:
        print(f"✅ Exported {stats['rows_written']} rows to {output_path}")
        if stats['errors']:
            print(f"⚠️  {len(stats['errors'])} errors encountered")
    
    return stats


def load_into_bigquery(jsonl_path: str, dataset: str, table: str, project_id: Optional[str] = None) -> bool:
    """
    Load JSONL file into BigQuery using bq CLI.
    
    Args:
        jsonl_path: Path to JSONL file
        dataset: BigQuery dataset
        table: BigQuery table name
        project_id: GCP project ID (optional)
    
    Returns:
        True if successful
    """
    import subprocess
    
    print(f"\n📤 Loading into BigQuery...")
    
    # Build bq load command
    cmd = [
        'bq',
        'load',
        '--source_format=NEWLINE_DELIMITED_JSON',
        '--autodetect',
        '--replace',
    ]
    
    if project_id:
        cmd.extend(['--project_id', project_id])
    
    cmd.extend([
        f'{dataset}.{table}',
        jsonl_path,
    ])
    
    if not os.path.exists(jsonl_path):
        print(f"❌ File not found: {jsonl_path}")
        return False
    
    print(f"   Command: {' '.join(cmd)}")
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            print(f"✅ Loaded into {dataset}.{table}")
            return True
        else:
            print(f"❌ Error: {result.stderr}")
            return False
    
    except FileNotFoundError:
        print("❌ bq CLI not found. Install: gcloud components install bq")
        return False


def main():
    parser = argparse.ArgumentParser(
        description='Export Gong Parquet to BigQuery',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  # Export first 500 rows from ~/gong_data
  python3 scripts/export-parquet-to-bq.py --limit 500
  
  # Export all rows
  python3 scripts/export-parquet-to-bq.py
  
  # Export and load into BigQuery
  python3 scripts/export-parquet-to-bq.py \\
    --limit 100 \\
    --load \\
    --dataset test_sales \\
    --table gong_calls
        '''
    )
    
    parser.add_argument(
        '--parquet',
        default=os.path.expanduser('~/gong_data/data/bronze/calls.parquet'),
        help='Path to parquet file (default: ~/gong_data/data/bronze/calls.parquet)'
    )
    
    parser.add_argument(
        '--output',
        default='gong_sample.jsonl',
        help='Output JSONL file (default: gong_sample.jsonl)'
    )
    
    parser.add_argument(
        '--limit',
        type=int,
        default=500,
        help='Max rows to export (default: 500, set to 0 for all)'
    )
    
    parser.add_argument(
        '--load',
        action='store_true',
        help='Load into BigQuery after export'
    )
    
    parser.add_argument(
        '--dataset',
        default='test_sales',
        help='BigQuery dataset (default: test_sales)'
    )
    
    parser.add_argument(
        '--table',
        default='gong_calls',
        help='BigQuery table (default: gong_calls)'
    )
    
    parser.add_argument(
        '--project',
        help='GCP project ID (optional)'
    )
    
    args = parser.parse_args()
    
    # Export
    limit = args.limit if args.limit > 0 else None
    stats = export_gong_parquet_to_jsonl(
        args.parquet,
        args.output,
        limit=limit,
        verbose=True
    )
    
    # Print summary
    print(f"\n📊 Summary:")
    print(f"   Rows read: {stats['rows_read']}")
    print(f"   Rows written: {stats['rows_written']}")
    print(f"   Columns: {', '.join(stats['sample_columns'][:5])}...")
    
    if stats['errors']:
        print(f"   Errors: {len(stats['errors'])}")
        for error in stats['errors'][:3]:
            print(f"     - {error}")
    
    # Load if requested
    if args.load:
        success = load_into_bigquery(
            args.output,
            args.dataset,
            args.table,
            args.project
        )
        
        if success:
            print(f"\n✅ Export and load complete!")
            print(f"\nVerify with:")
            print(f"  bq query 'SELECT COUNT(*) FROM {args.dataset}.{args.table}'")
        else:
            print(f"\n❌ Load failed")
            sys.exit(1)
    else:
        print(f"\n📤 Next: Load with bq CLI:")
        print(f"\n   bq load --source_format=NEWLINE_DELIMITED_JSON \\\\")
        print(f"     --autodetect \\\\")
        print(f"     {args.dataset}.{args.table} \\\\")
        print(f"     {args.output}")


if __name__ == '__main__':
    main()
