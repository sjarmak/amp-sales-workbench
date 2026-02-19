#!/usr/bin/env python3
"""Convert Salesforce activity notes CSV to JSONL for the data lake."""

import csv
import json
import sys
from pathlib import Path

INPUT_PATH = Path.home() / "Downloads" / "salesforce_notes_dat_013026.csv"
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "data" / "global" / "salesforce_notes.jsonl"

INT_FIELDS = {"note_len", "note_rank_within_account"}
FLOAT_FIELDS = {"usefulness_score"}
BOOL_FIELDS = {"is_truncated"}

GONG_LINK_PATTERN = "gong.io"


def cast_value(key: str, value: str):
    if not value:
        return None
    if key in INT_FIELDS:
        try:
            return int(value)
        except ValueError:
            return None
    if key in FLOAT_FIELDS:
        try:
            return float(value)
        except ValueError:
            return None
    if key in BOOL_FIELDS:
        return value.lower() in ("true", "1", "yes")
    return value


def main() -> None:
    if not INPUT_PATH.exists():
        print(f"Error: input file not found: {INPUT_PATH}", file=sys.stderr)
        sys.exit(1)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    total = 0
    accounts = set()
    score_sum = 0.0
    score_count = 0
    has_gong_count = 0
    truncated_count = 0

    with open(INPUT_PATH, "r", newline="", encoding="utf-8") as fin, \
         open(OUTPUT_PATH, "w", encoding="utf-8") as fout:
        reader = csv.DictReader(fin)
        for row in reader:
            record = {k: cast_value(k, v) for k, v in row.items()}
            record["source_system"] = "salesforce"

            note_text = record.get("note_text") or ""
            subject = record.get("subject") or ""
            record["has_gong_link"] = GONG_LINK_PATTERN in note_text.lower() or GONG_LINK_PATTERN in subject.lower()

            fout.write(json.dumps(record) + "\n")
            total += 1
            if record.get("account_id"):
                accounts.add(record["account_id"])
            if record.get("usefulness_score") is not None:
                score_sum += record["usefulness_score"]
                score_count += 1
            if record.get("has_gong_link"):
                has_gong_count += 1
            if record.get("is_truncated"):
                truncated_count += 1

    avg_score = score_sum / score_count if score_count else 0

    print(f"--- Conversion Stats ---")
    print(f"Total records: {total}")
    print(f"Unique accounts: {len(accounts)}")
    print(f"Average usefulness_score: {avg_score:.2f}")
    print(f"Records with Gong link: {has_gong_count}")
    print(f"Truncated notes: {truncated_count}")
    print(f"Output written to: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
