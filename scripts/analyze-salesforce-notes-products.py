#!/usr/bin/env python3
"""Generate structured analysis report from product-filtered Salesforce notes."""

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

INPUT_PATH = Path(__file__).resolve().parent.parent / "data" / "global" / "salesforce_notes_product_subset.jsonl"
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "data" / "global" / "salesforce_notes_product_analysis.md"
TLDR_PATH = Path(__file__).resolve().parent.parent / "data" / "global" / "tldrs" / "tldr-salesforce-notes.md"


DEAL_SIGNAL_PATTERNS = {
    "Win Signal": re.compile(
        r"clos(?:ed|ing)\s*won|signed|go.?live|deploy|launch|production|live\s*in|"
        r"renew|expand|upsell|success|adopted|rolled\s*out",
        re.IGNORECASE,
    ),
    "Loss / Risk Signal": re.compile(
        r"clos(?:ed|ing)\s*lost|churn|cancel|not\s*renew|competitor\s*(?:won|chose|selected)|"
        r"at.?risk|downgrade|disengage|went\s*(?:with|to)\s*(?:copilot|cursor|tabnine|codeium)",
        re.IGNORECASE,
    ),
    "Objection": re.compile(
        r"concern|blocker|friction|pushback|objection|resistance|"
        r"too\s*(?:expensive|complex|slow)|not\s*(?:ready|interested|convinced)|"
        r"budget|pricing\s*(?:issue|concern|feedback)",
        re.IGNORECASE,
    ),
    "Next Step": re.compile(
        r"next\s*step|follow.?up|schedule|action\s*item|"
        r"POC|proof\s*of\s*concept|pilot|trial|eval|"
        r"demo|meeting|call\s*(?:with|scheduled)",
        re.IGNORECASE,
    ),
    "Technical Requirement": re.compile(
        r"integrat|API|SDK|SSO|SAML|SCIM|self.?host|on.?prem|"
        r"compliance|SOC\s*2|FedRAMP|air.?gap|VPN|"
        r"performance|latency|SLA|uptime",
        re.IGNORECASE,
    ),
}


def load_records() -> list[dict]:
    records = []
    with open(INPUT_PATH, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(json.loads(line))
    return records


def get_text(record: dict) -> str:
    parts = []
    for field in ("subject", "note_text"):
        val = record.get(field)
        if val:
            parts.append(str(val))
    return " ".join(parts)


def truncate(text: str, max_len: int = 120) -> str:
    if not text or len(text) <= max_len:
        return text or ""
    return text[:max_len].rstrip() + "..."


def build_report(records: list[dict]) -> str:
    lines: list[str] = []
    w = lines.append
    total = len(records)

    # -- Header --
    w("# Salesforce Notes -- Product Area Analysis")
    w("")

    # -- 1. Dataset Overview --
    w("## 1. Dataset Overview")
    w("")

    accounts = set(r.get("account_id") for r in records if r.get("account_id"))
    product_counts: Counter = Counter()
    for r in records:
        for p in r.get("matched_products", []):
            product_counts[p] += 1

    dates = sorted(d[:10] for r in records if (d := r.get("created_at", "")))
    scores = [r["usefulness_score"] for r in records if r.get("usefulness_score") is not None]

    w(f"- **Total records:** {total}")
    w(f"- **Unique accounts:** {len(accounts)}")
    if dates:
        w(f"- **Date range:** {dates[0]} to {dates[-1]}")
    if scores:
        avg = sum(scores) / len(scores)
        w(f"- **Usefulness score:** avg {avg:.1f}, min {min(scores):.1f}, max {max(scores):.1f}")
    w("")

    w("### Product Area Breakdown")
    w("")
    w("| Product Area | Records | % of Subset |")
    w("|-------------|---------|-------------|")
    for product, count in product_counts.most_common():
        pct = count / total * 100
        w(f"| {product} | {count} | {pct:.0f}% |")
    w("")

    multi = sum(1 for r in records if len(r.get("matched_products", [])) > 1)
    w(f"Records matching multiple products: {multi}")
    w("")

    # -- 2. Product Area Deep Dive --
    w("## 2. Product Area Deep Dive")
    w("")

    by_product: dict[str, list[dict]] = defaultdict(list)
    for r in records:
        for p in r.get("matched_products", []):
            by_product[p].append(r)

    for product in ["Code Search", "Batch Changes", "Deep Search", "MCP"]:
        precs = by_product.get(product, [])
        if not precs:
            continue

        w(f"### {product} ({len(precs)} records)")
        w("")

        # Top accounts
        paccts: Counter = Counter()
        for r in precs:
            aid = r.get("account_id")
            if aid:
                paccts[aid] += 1

        w("**Top accounts:**")
        w("")
        w("| Account ID | Records |")
        w("|-----------|---------|")
        for aid, cnt in paccts.most_common(10):
            w(f"| `{aid}` | {cnt} |")
        w("")

        # Sample excerpts
        w("**Sample excerpts:**")
        w("")
        sorted_precs = sorted(precs, key=lambda x: x.get("usefulness_score") or 0, reverse=True)
        for r in sorted_precs[:5]:
            subj = truncate(r.get("subject") or "", 80)
            note = truncate(r.get("note_text") or "", 120)
            date = (r.get("created_at") or "")[:10]
            score = r.get("usefulness_score")
            score_str = f" (score: {score:.0f})" if score is not None else ""
            w(f"- **{date}**{score_str}: {subj}")
            if note:
                w(f"  > {note}")
        w("")

        # Timeline
        pmonthly: Counter = Counter()
        for r in precs:
            d = r.get("created_at") or ""
            if d:
                pmonthly[d[:7]] += 1

        if pmonthly:
            w("**Monthly volume:**")
            w("")
            w("| Month | Records |")
            w("|-------|---------|")
            for month in sorted(pmonthly.keys()):
                w(f"| {month} | {pmonthly[month]} |")
            w("")

    # -- 3. Deal Signal Extraction --
    w("## 3. Deal Signal Extraction")
    w("")

    signal_counts: Counter = Counter()
    signal_examples: dict[str, list[dict]] = defaultdict(list)

    for rec in records:
        text = get_text(rec)
        for label, pattern in DEAL_SIGNAL_PATTERNS.items():
            if pattern.search(text):
                signal_counts[label] += 1
                if len(signal_examples[label]) < 3:
                    signal_examples[label].append(rec)

    w("| Signal Type | Records | % of Subset |")
    w("|------------|---------|-------------|")
    for label, count in signal_counts.most_common():
        pct = count / total * 100
        w(f"| {label} | {count} | {pct:.0f}% |")
    w("")

    for label in ["Win Signal", "Loss / Risk Signal", "Objection"]:
        examples = signal_examples.get(label, [])
        if examples:
            w(f"**{label} examples:**")
            w("")
            for r in examples:
                subj = truncate(r.get("subject") or "", 80)
                date = (r.get("created_at") or "")[:10]
                w(f"- {date}: {subj}")
            w("")

    # -- 4. Account-Level Insights --
    w("## 4. Account-Level Insights (Top 20)")
    w("")

    acct_data: dict[str, dict] = {}
    for r in records:
        aid = r.get("account_id")
        if not aid:
            continue
        if aid not in acct_data:
            acct_data[aid] = {
                "count": 0,
                "products": set(),
                "scores": [],
                "has_gong": False,
                "latest_date": "",
            }
        entry = acct_data[aid]
        entry["count"] += 1
        for p in r.get("matched_products", []):
            entry["products"].add(p)
        if r.get("usefulness_score") is not None:
            entry["scores"].append(r["usefulness_score"])
        if r.get("has_gong_link"):
            entry["has_gong"] = True
        d = r.get("created_at") or ""
        if d > entry["latest_date"]:
            entry["latest_date"] = d

    sorted_accounts = sorted(acct_data.items(), key=lambda x: x[1]["count"], reverse=True)

    w("| Account ID | Records | Products | Avg Score | Gong Link | Latest |")
    w("|-----------|---------|----------|-----------|-----------|--------|")
    for aid, data in sorted_accounts[:20]:
        avg = sum(data["scores"]) / len(data["scores"]) if data["scores"] else 0
        products = ", ".join(sorted(data["products"]))
        gong = "Yes" if data["has_gong"] else ""
        latest = data["latest_date"][:10]
        w(f"| `{aid}` | {data['count']} | {products} | {avg:.0f} | {gong} | {latest} |")
    w("")

    # -- 5. Temporal Trends --
    w("## 5. Temporal Trends")
    w("")

    monthly: Counter = Counter()
    for r in records:
        d = r.get("created_at") or ""
        if d:
            monthly[d[:7]] += 1

    w("| Month | Records |")
    w("|-------|---------|")
    for month in sorted(monthly.keys()):
        w(f"| {month} | {monthly[month]} |")
    w("")

    # -- 6. Quality-Weighted Analysis --
    w("## 6. Quality-Weighted Analysis")
    w("")

    score_buckets = {"High (70+)": 0, "Medium (40-70)": 0, "Low (<40)": 0, "No score": 0}
    for r in records:
        s = r.get("usefulness_score")
        if s is None:
            score_buckets["No score"] += 1
        elif s >= 70:
            score_buckets["High (70+)"] += 1
        elif s >= 40:
            score_buckets["Medium (40-70)"] += 1
        else:
            score_buckets["Low (<40)"] += 1

    w("### Score Distribution")
    w("")
    w("| Bucket | Records | % |")
    w("|--------|---------|---|")
    for bucket, count in score_buckets.items():
        pct = count / total * 100 if total else 0
        w(f"| {bucket} | {count} | {pct:.0f}% |")
    w("")

    # Product area by quality tier
    w("### Product Mentions by Quality Tier")
    w("")
    tier_products: dict[str, Counter] = {"High (70+)": Counter(), "Medium (40-70)": Counter(), "Low (<40)": Counter()}
    for r in records:
        s = r.get("usefulness_score")
        if s is None:
            continue
        if s >= 70:
            tier = "High (70+)"
        elif s >= 40:
            tier = "Medium (40-70)"
        else:
            tier = "Low (<40)"
        for p in r.get("matched_products", []):
            tier_products[tier][p] += 1

    w("| Product | High (70+) | Medium (40-70) | Low (<40) |")
    w("|---------|-----------|----------------|-----------|")
    for product in ["Code Search", "Batch Changes", "Deep Search", "MCP"]:
        h = tier_products["High (70+)"].get(product, 0)
        m = tier_products["Medium (40-70)"].get(product, 0)
        lo = tier_products["Low (<40)"].get(product, 0)
        w(f"| {product} | {h} | {m} | {lo} |")
    w("")

    # -- 7. Cross-Source Correlation --
    w("## 7. Cross-Source Correlation (Gong Overlap)")
    w("")

    gong_linked = [r for r in records if r.get("has_gong_link")]
    w(f"- **Records with Gong link:** {len(gong_linked)} ({len(gong_linked)/total*100:.0f}% of subset)")
    w("")

    if gong_linked:
        gong_products: Counter = Counter()
        for r in gong_linked:
            for p in r.get("matched_products", []):
                gong_products[p] += 1

        w("| Product | With Gong Link | Without | Gong % |")
        w("|---------|---------------|---------|--------|")
        for product in ["Code Search", "Batch Changes", "Deep Search", "MCP"]:
            with_gong = gong_products.get(product, 0)
            without = product_counts.get(product, 0) - with_gong
            pct = with_gong / product_counts[product] * 100 if product_counts.get(product) else 0
            w(f"| {product} | {with_gong} | {without} | {pct:.0f}% |")
        w("")

        gong_accts = set(r.get("account_id") for r in gong_linked if r.get("account_id"))
        w(f"Unique accounts with Gong-linked notes: {len(gong_accts)}")
    w("")

    return "\n".join(lines)


def build_tldr(records: list[dict]) -> str:
    lines: list[str] = []
    w = lines.append

    total = len(records)
    accounts = set(r.get("account_id") for r in records if r.get("account_id"))

    product_counts: Counter = Counter()
    for r in records:
        for p in r.get("matched_products", []):
            product_counts[p] += 1

    w("# TLDR: Salesforce Notes -- Product Area Analysis")
    w("")
    w(f"**Source:** {total} Salesforce activity notes across {len(accounts)} accounts, filtered to product-area mentions.")
    w("")
    w("## Key Numbers")
    w("")
    for product, count in product_counts.most_common():
        w(f"- **{product}:** {count} mentions")
    w("")

    gong_linked = sum(1 for r in records if r.get("has_gong_link"))
    w(f"- **Gong-linked notes:** {gong_linked} ({gong_linked/total*100:.0f}%)")
    w("")

    scores = [r["usefulness_score"] for r in records if r.get("usefulness_score") is not None]
    if scores:
        high_quality = sum(1 for s in scores if s >= 70)
        w(f"- **High-quality notes (score 70+):** {high_quality}")
    w("")

    w("## Top Accounts by Volume")
    w("")
    acct_counts: Counter = Counter()
    for r in records:
        aid = r.get("account_id")
        if aid:
            acct_counts[aid] += 1
    for aid, cnt in acct_counts.most_common(10):
        w(f"- `{aid}`: {cnt} notes")
    w("")

    w("## Deal Signals")
    w("")
    signal_counts: Counter = Counter()
    for rec in records:
        text = " ".join(str(rec.get(f) or "") for f in ("subject", "note_text"))
        for label, pattern in DEAL_SIGNAL_PATTERNS.items():
            if pattern.search(text):
                signal_counts[label] += 1

    for label, count in signal_counts.most_common():
        w(f"- **{label}:** {count} records")
    w("")

    w("---")
    w(f"*Full report: `data/global/salesforce_notes_product_analysis.md`*")
    w("")

    return "\n".join(lines)


def main() -> None:
    if not INPUT_PATH.exists():
        print(f"Error: input file not found: {INPUT_PATH}")
        print("Run filter-salesforce-notes-products.py first.")
        return

    records = load_records()
    print(f"Loaded {len(records)} records from subset")

    report = build_report(records)
    OUTPUT_PATH.write_text(report, encoding="utf-8")
    print(f"Report written to: {OUTPUT_PATH}")
    print(f"Report length: {len(report)} chars, {report.count(chr(10))} lines")

    tldr = build_tldr(records)
    TLDR_PATH.parent.mkdir(parents=True, exist_ok=True)
    TLDR_PATH.write_text(tldr, encoding="utf-8")
    print(f"TLDR written to: {TLDR_PATH}")


if __name__ == "__main__":
    main()
