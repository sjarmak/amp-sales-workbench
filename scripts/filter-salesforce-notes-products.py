#!/usr/bin/env python3
"""Filter Salesforce notes JSONL to product-area mentions (Code Search, Batch Changes, Deep Search, MCP)."""

import json
import re
import sys
from collections import Counter
from pathlib import Path

INPUT_PATH = Path(__file__).resolve().parent.parent / "data" / "global" / "salesforce_notes.jsonl"
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "data" / "global" / "salesforce_notes_product_subset.jsonl"

SEARCH_FIELDS = ["subject", "note_text"]

PRODUCT_PATTERNS = {
    "Code Search": re.compile(
        r"code\s*search|search.*code|searching.*codebase|structural\s*search|"
        r"search\s*(?:query|queries|result|syntax|filter|scope)|"
        r"regex\s*search|symbol\s*search|find.*(?:code|function|class|definition)",
        re.IGNORECASE,
    ),
    "Batch Changes": re.compile(
        r"batch\s*change|batch\s*spec|large.?scale\s*(?:change|refactor)|"
        r"codemod|code\s*mod|campaign|changeset|"
        r"mass\s*(?:update|edit|refactor|change)|"
        r"bulk\s*(?:change|update|edit|refactor)",
        re.IGNORECASE,
    ),
    "Deep Search": re.compile(
        r"deep\s*search|exhaustive\s*search|comprehensive\s*search|"
        r"search\s*(?:everywhere|all\s*repos|entire)|"
        r"cross.?repo\s*search|global\s*search",
        re.IGNORECASE,
    ),
    "MCP": re.compile(
        r"\bMCP\b|model\s*context\s*protocol|"
        r"context\s*protocol|mcp\s*server",
        re.IGNORECASE,
    ),
}


def extract_matched_products(record: dict) -> list[str]:
    searchable = " ".join(str(record.get(f) or "") for f in SEARCH_FIELDS)
    matched = []
    for product, pattern in PRODUCT_PATTERNS.items():
        if pattern.search(searchable):
            matched.append(product)
    return matched


def main() -> None:
    if not INPUT_PATH.exists():
        print(f"Error: input file not found: {INPUT_PATH}", file=sys.stderr)
        print("Run convert-salesforce-notes.py first.", file=sys.stderr)
        sys.exit(1)

    records = []
    with open(INPUT_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(json.loads(line))

    print(f"Total records read: {len(records)}")

    matched_records = []
    product_counts: Counter = Counter()
    account_counts: Counter = Counter()

    for rec in records:
        products = extract_matched_products(rec)
        if products:
            rec_out = {**rec, "matched_products": products}
            matched_records.append(rec_out)
            for p in products:
                product_counts[p] += 1
            if rec.get("account_id"):
                account_counts[rec["account_id"]] += 1

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        for rec in matched_records:
            f.write(json.dumps(rec) + "\n")

    dates = []
    for r in matched_records:
        d = r.get("created_at") or ""
        if d:
            dates.append(d[:10])

    print(f"\n--- Filter Results ---")
    print(f"Matching records: {len(matched_records)}")
    print(f"Unique accounts: {len(account_counts)}")
    print(f"\nMatches by product area:")
    for product, count in product_counts.most_common():
        print(f"  {product}: {count}")
    if dates:
        dates.sort()
        print(f"\nDate range: {dates[0]} to {dates[-1]}")

    multi_product = sum(1 for r in matched_records if len(r.get("matched_products", [])) > 1)
    print(f"Records matching multiple products: {multi_product}")
    print(f"\nOutput written to: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
