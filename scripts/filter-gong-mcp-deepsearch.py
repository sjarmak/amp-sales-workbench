#!/usr/bin/env python3
"""Filter Gong calls portfolio to MCP and Deep Search mentions."""

import json
import re
import sys
from collections import Counter
from pathlib import Path

INPUT_PATH = Path(__file__).resolve().parent.parent / "data" / "global" / "gong_calls_portfolio.jsonl"
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "data" / "global" / "gong_mcp_deepsearch_subset.jsonl"

SEARCH_FIELDS = [
    "title",
    "spotlight_brief",
    "spotlight_key_points",
    "spotlight_next_steps",
    "transcript_text",
]

KEYWORDS = {
    "MCP": re.compile(r"\bMCP\b", re.IGNORECASE),
    "deep search": re.compile(r"deep\s*search", re.IGNORECASE),
}


def extract_matched_terms(record: dict) -> list[str]:
    matched = []
    searchable = " ".join(str(record.get(f) or "") for f in SEARCH_FIELDS)
    for term, pattern in KEYWORDS.items():
        if pattern.search(searchable):
            matched.append(term)
    return matched


def main() -> None:
    if not INPUT_PATH.exists():
        print(f"Error: input file not found: {INPUT_PATH}", file=sys.stderr)
        sys.exit(1)

    records = []
    with open(INPUT_PATH, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            records.append(json.loads(line))

    print(f"Total records read: {len(records)}")

    matched_records = []
    term_counts: Counter = Counter()
    dates = []

    for rec in records:
        terms = extract_matched_terms(rec)
        if terms:
            rec_out = {**rec, "matched_terms": terms}
            matched_records.append(rec_out)
            for t in terms:
                term_counts[t] += 1
            date_val = rec.get("created_at") or rec.get("planned_start") or ""
            if date_val:
                dates.append(date_val[:10])

    with open(OUTPUT_PATH, "w") as f:
        for rec in matched_records:
            f.write(json.dumps(rec) + "\n")

    has_spotlight = sum(
        1 for r in matched_records if r.get("spotlight_brief") or r.get("spotlight_key_points")
    )
    has_transcript = sum(1 for r in matched_records if r.get("transcript_text"))

    print(f"\n--- Filter Results ---")
    print(f"Matching records: {len(matched_records)}")
    print(f"\nMatches by term:")
    for term, count in term_counts.most_common():
        print(f"  {term}: {count}")
    if dates:
        dates.sort()
        print(f"\nDate range: {dates[0]} to {dates[-1]}")
    print(f"\nData coverage:")
    print(f"  With spotlight data: {has_spotlight}")
    print(f"  With transcript data: {has_transcript}")
    print(f"\nOutput written to: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
