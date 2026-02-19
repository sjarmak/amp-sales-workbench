#!/usr/bin/env python3
"""
Leads & Pipeline Generation Analysis
Analyzes 17.7K qualified leads for distribution, channel patterns, and Crossing the Chasm signals.
"""

import csv
import json
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data" / "global"
LEADS_FILE = DATA_DIR / "sfdc_leads_qualified.csv"
OUTPUT_FILE = DATA_DIR / "analysis_leads_pipeline.json"


def load_leads():
    leads = []
    with open(LEADS_FILE, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            leads.append(row)
    return leads


def safe_date(s):
    if not s or s.strip() == "":
        return None
    try:
        return datetime.strptime(s.strip()[:10], "%Y-%m-%d")
    except (ValueError, IndexError):
        return None


def days_between(d1, d2):
    if d1 and d2:
        return (d2 - d1).days
    return None


def pct(n, d):
    if d == 0:
        return 0.0
    return round(100.0 * n / d, 2)


def print_table(title, rows, headers, max_rows=50):
    """Print a formatted table to stdout."""
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}")

    # Compute column widths
    col_widths = [len(h) for h in headers]
    for row in rows[:max_rows]:
        for i, val in enumerate(row):
            col_widths[i] = max(col_widths[i], len(str(val)))

    # Header
    header_line = "  ".join(str(h).ljust(col_widths[i]) for i, h in enumerate(headers))
    print(header_line)
    print("-" * len(header_line))

    for row in rows[:max_rows]:
        print("  ".join(str(v).ljust(col_widths[i]) for i, v in enumerate(row)))

    if len(rows) > max_rows:
        print(f"  ... ({len(rows) - max_rows} more rows)")
    print()


def analyze_lead_source_distribution(leads):
    """Q1: Lead source distribution."""
    source_counts = Counter()
    source_category_counts = Counter()
    source_converted = Counter()

    for lead in leads:
        src = lead.get("lead_source", "").strip() or "(blank)"
        cat = lead.get("lead_person_source_category", "").strip() or "(blank)"
        orig_cat = lead.get("lead_original_person_source_category", "").strip() or "(blank)"
        converted = lead.get("lead_converted", "0") == "1"

        source_counts[src] += 1
        source_category_counts[cat] += 1
        if converted:
            source_converted[src] += 1

    rows = []
    for src, count in source_counts.most_common():
        conv = source_converted.get(src, 0)
        rows.append((src, count, conv, pct(conv, count)))

    print_table(
        "LEAD SOURCE DISTRIBUTION (lead_source field)",
        rows,
        ["Lead Source", "Count", "Converted", "Conv%"]
    )

    # Person source category
    cat_converted = Counter()
    for lead in leads:
        cat = lead.get("lead_person_source_category", "").strip() or "(blank)"
        if lead.get("lead_converted", "0") == "1":
            cat_converted[cat] += 1

    rows2 = []
    for cat, count in source_category_counts.most_common():
        conv = cat_converted.get(cat, 0)
        rows2.append((cat, count, conv, pct(conv, count)))

    print_table(
        "PERSON SOURCE CATEGORY DISTRIBUTION",
        rows2,
        ["Source Category", "Count", "Converted", "Conv%"]
    )

    return {
        "lead_source": {src: {"count": c, "converted": source_converted.get(src, 0), "conversion_rate": pct(source_converted.get(src, 0), c)} for src, c in source_counts.most_common()},
        "person_source_category": {cat: {"count": c, "converted": cat_converted.get(cat, 0), "conversion_rate": pct(cat_converted.get(cat, 0), c)} for cat, c in source_category_counts.most_common()},
    }


def analyze_person_source_detail(leads):
    """Detailed person source analysis."""
    person_source = Counter()
    person_source_converted = Counter()
    person_source_detail = Counter()

    for lead in leads:
        ps = lead.get("lead_person_source", "").strip() or "(blank)"
        psd = lead.get("lead_person_source_detail", "").strip() or "(blank)"
        converted = lead.get("lead_converted", "0") == "1"

        person_source[ps] += 1
        person_source_detail[psd] += 1
        if converted:
            person_source_converted[ps] += 1

    rows = []
    for ps, count in person_source.most_common(30):
        conv = person_source_converted.get(ps, 0)
        rows.append((ps, count, conv, pct(conv, count)))

    print_table(
        "PERSON SOURCE DISTRIBUTION (top 30)",
        rows,
        ["Person Source", "Count", "Converted", "Conv%"]
    )

    return {ps: {"count": c, "converted": person_source_converted.get(ps, 0), "conversion_rate": pct(person_source_converted.get(ps, 0), c)} for ps, c in person_source.most_common()}


def analyze_first_touchpoint(leads):
    """First touchpoint analysis."""
    tp_counts = Counter()
    tp_converted = Counter()

    for lead in leads:
        tp = lead.get("lead_first_touchPoint", "").strip() or "(blank)"
        converted = lead.get("lead_converted", "0") == "1"
        tp_counts[tp] += 1
        if converted:
            tp_converted[tp] += 1

    rows = []
    for tp, count in tp_counts.most_common(30):
        conv = tp_converted.get(tp, 0)
        rows.append((tp, count, conv, pct(conv, count)))

    print_table(
        "FIRST TOUCHPOINT DISTRIBUTION (top 30)",
        rows,
        ["First Touchpoint", "Count", "Converted", "Conv%"]
    )

    return {tp: {"count": c, "converted": tp_converted.get(tp, 0), "conversion_rate": pct(tp_converted.get(tp, 0), c)} for tp, c in tp_counts.most_common()}


def analyze_campaign_types(leads):
    """Campaign type analysis."""
    camp_type = Counter()
    camp_converted = Counter()

    for lead in leads:
        ct = lead.get("lead_first_responded_campaign_type", "").strip() or "(blank)"
        converted = lead.get("lead_converted", "0") == "1"
        camp_type[ct] += 1
        if converted:
            camp_converted[ct] += 1

    rows = []
    for ct, count in camp_type.most_common():
        conv = camp_converted.get(ct, 0)
        rows.append((ct, count, conv, pct(conv, count)))

    print_table(
        "FIRST RESPONDED CAMPAIGN TYPE",
        rows,
        ["Campaign Type", "Count", "Converted", "Conv%"]
    )

    return {ct: {"count": c, "converted": camp_converted.get(ct, 0), "conversion_rate": pct(camp_converted.get(ct, 0), c)} for ct, c in camp_type.most_common()}


def analyze_mql_pql_distribution(leads):
    """MQL vs PQL distribution."""
    mql_count = 0
    pql_count = 0
    both_count = 0
    neither_count = 0
    mql_converted = 0
    pql_converted = 0
    both_converted = 0
    neither_converted = 0

    pql_grade_counts = Counter()
    pql_grade_converted = Counter()
    mql_reason_counts = Counter()
    mql_reason_converted = Counter()

    for lead in leads:
        mql = lead.get("mql_flg", "0") == "1"
        pql = lead.get("pql_flg", "0") == "1"
        converted = lead.get("lead_converted", "0") == "1"

        grade = lead.get("pql_grade", "").strip() or "(none)"
        reason = lead.get("most_recent_mql_reason_c", "").strip() or "(none)"

        if mql and pql:
            both_count += 1
            if converted:
                both_converted += 1
        elif mql:
            mql_count += 1
            if converted:
                mql_converted += 1
        elif pql:
            pql_count += 1
            if converted:
                pql_converted += 1
        else:
            neither_count += 1
            if converted:
                neither_converted += 1

        if pql:
            pql_grade_counts[grade] += 1
            if converted:
                pql_grade_converted[grade] += 1

        if mql:
            mql_reason_counts[reason] += 1
            if converted:
                mql_reason_converted[reason] += 1

    rows = [
        ("MQL only", mql_count, mql_converted, pct(mql_converted, mql_count)),
        ("PQL only", pql_count, pql_converted, pct(pql_converted, pql_count)),
        ("Both MQL+PQL", both_count, both_converted, pct(both_converted, both_count)),
        ("Neither", neither_count, neither_converted, pct(neither_converted, neither_count)),
    ]

    print_table(
        "MQL vs PQL DISTRIBUTION",
        rows,
        ["Type", "Count", "Converted", "Conv%"]
    )

    # PQL grades
    grade_rows = []
    for g, c in pql_grade_counts.most_common():
        conv = pql_grade_converted.get(g, 0)
        grade_rows.append((g, c, conv, pct(conv, c)))

    print_table(
        "PQL GRADE DISTRIBUTION",
        grade_rows,
        ["PQL Grade", "Count", "Converted", "Conv%"]
    )

    # MQL reasons
    reason_rows = []
    for r, c in mql_reason_counts.most_common(20):
        conv = mql_reason_converted.get(r, 0)
        reason_rows.append((r, c, conv, pct(conv, c)))

    print_table(
        "MQL REASON DISTRIBUTION (top 20)",
        reason_rows,
        ["MQL Reason", "Count", "Converted", "Conv%"]
    )

    return {
        "summary": {
            "mql_only": {"count": mql_count, "converted": mql_converted, "rate": pct(mql_converted, mql_count)},
            "pql_only": {"count": pql_count, "converted": pql_converted, "rate": pct(pql_converted, pql_count)},
            "both": {"count": both_count, "converted": both_converted, "rate": pct(both_converted, both_count)},
            "neither": {"count": neither_count, "converted": neither_converted, "rate": pct(neither_converted, neither_count)},
        },
        "pql_grades": {g: {"count": c, "converted": pql_grade_converted.get(g, 0), "rate": pct(pql_grade_converted.get(g, 0), c)} for g, c in pql_grade_counts.most_common()},
        "mql_reasons": {r: {"count": c, "converted": mql_reason_converted.get(r, 0), "rate": pct(mql_reason_converted.get(r, 0), c)} for r, c in mql_reason_counts.most_common()},
    }


def analyze_product_usage_signals(leads):
    """Product usage and PLG signals."""
    # Key product flags
    flags = [
        "product_ltm_signup_flg_private", "product_ltm_signup_flg_cloud",
        "product_ltm_login_flg_private", "product_ltm_login_flg_cloud",
        "product_last60day_login_flg_private", "product_last60day_login_flg_cloud",
        "product_last60day_signup_flg_private", "product_last60day_signup_flg_cloud",
        "product_ltm_login_flg_overall", "product_ltm_signup_flg_overall",
        "product_last60day_login_flg_overall", "product_last60day_signup_flg_overall",
    ]

    flag_counts = {f: 0 for f in flags}
    flag_converted = {f: 0 for f in flags}
    flag_total = {f: 0 for f in flags}

    # Product activity tiers
    active_private = 0
    active_cloud = 0
    active_any = 0
    has_search_private = 0
    has_search_cloud = 0
    has_codehost = 0
    has_repo = 0

    converted_active_any = 0
    converted_not_active = 0
    total_active_any = 0
    total_not_active = 0

    cody_flags = Counter()
    cody_converted = Counter()

    for lead in leads:
        converted = lead.get("lead_converted", "0") == "1"

        for f in flags:
            val = lead.get(f, "0")
            if val == "1":
                flag_counts[f] += 1
                if converted:
                    flag_converted[f] += 1

        ltm_login = lead.get("product_ltm_login_flg_overall", "0") == "1"
        if ltm_login:
            total_active_any += 1
            if converted:
                converted_active_any += 1
        else:
            total_not_active += 1
            if converted:
                converted_not_active += 1

        # Search/codehost/repo
        sp = lead.get("product_search_completed_private", "").strip()
        sc = lead.get("product_search_completed_cloud", "").strip()
        ch_p = lead.get("product_codehost_added_private", "").strip()
        ch_c = lead.get("product_codehost_added_cloud", "").strip()
        repo = lead.get("product_repo_added_private", "").strip().lower()

        if sp and sp not in ("", "0", "0.0"):
            has_search_private += 1
        if sc and sc not in ("", "0", "0.0"):
            has_search_cloud += 1
        if (ch_p and ch_p not in ("", "0", "0.0", "false")) or (ch_c and ch_c not in ("", "0", "0.0", "false")):
            has_codehost += 1
        if repo and repo not in ("", "0", "0.0", "false"):
            has_repo += 1

        # Cody flags
        cf = lead.get("cody_flags_c", "").strip()
        if cf:
            cody_flags[cf] += 1
            if converted:
                cody_converted[cf] += 1

    rows = []
    for f in flags:
        c = flag_counts[f]
        conv = flag_converted[f]
        rows.append((f.replace("product_", ""), c, conv, pct(conv, c) if c > 0 else 0))

    print_table(
        "PRODUCT USAGE FLAGS",
        rows,
        ["Flag", "Active", "Converted", "Conv%"]
    )

    print(f"\n  Product engagement summary:")
    print(f"    Has search (private): {has_search_private}")
    print(f"    Has search (cloud):   {has_search_cloud}")
    print(f"    Has codehost added:   {has_codehost}")
    print(f"    Has repo added:       {has_repo}")
    print(f"\n    LTM active (any): {total_active_any} -> converted {converted_active_any} ({pct(converted_active_any, total_active_any)}%)")
    print(f"    Not active:       {total_not_active} -> converted {converted_not_active} ({pct(converted_not_active, total_not_active)}%)")

    if cody_flags:
        cf_rows = []
        for cf, c in cody_flags.most_common(15):
            conv = cody_converted.get(cf, 0)
            cf_rows.append((cf[:60], c, conv, pct(conv, c)))
        print_table("CODY FLAGS", cf_rows, ["Flag", "Count", "Converted", "Conv%"])

    return {
        "flags": {f: {"count": flag_counts[f], "converted": flag_converted[f], "rate": pct(flag_converted[f], flag_counts[f]) if flag_counts[f] > 0 else 0} for f in flags},
        "engagement": {
            "search_private": has_search_private,
            "search_cloud": has_search_cloud,
            "codehost_added": has_codehost,
            "repo_added": has_repo,
        },
        "active_vs_not": {
            "ltm_active": {"count": total_active_any, "converted": converted_active_any, "rate": pct(converted_active_any, total_active_any)},
            "not_active": {"count": total_not_active, "converted": converted_not_active, "rate": pct(converted_not_active, total_not_active)},
        },
        "cody_flags": {cf: {"count": c, "converted": cody_converted.get(cf, 0)} for cf, c in cody_flags.most_common()},
    }


def analyze_title_levels(leads):
    """Title level distribution and conversion."""
    level_counts = Counter()
    level_converted = Counter()

    for lead in leads:
        level = lead.get("lead_title_level", "").strip() or "(blank)"
        converted = lead.get("lead_converted", "0") == "1"
        level_counts[level] += 1
        if converted:
            level_converted[level] += 1

    rows = []
    for lv, c in level_counts.most_common():
        conv = level_converted.get(lv, 0)
        rows.append((lv, c, conv, pct(conv, c)))

    print_table(
        "TITLE LEVEL DISTRIBUTION",
        rows,
        ["Title Level", "Count", "Converted", "Conv%"]
    )

    return {lv: {"count": c, "converted": level_converted.get(lv, 0), "rate": pct(level_converted.get(lv, 0), c)} for lv, c in level_counts.most_common()}


def analyze_lead_status(leads):
    """Lead status and sub-status distribution."""
    status_counts = Counter()
    substatus_counts = Counter()
    lifecycle_counts = Counter()

    for lead in leads:
        st = lead.get("lead_status", "").strip() or "(blank)"
        sub = lead.get("lead_sub_status", "").strip() or "(blank)"
        lc = lead.get("lead_lifecycle_stage", "").strip() or "(blank)"
        status_counts[st] += 1
        substatus_counts[sub] += 1
        lifecycle_counts[lc] += 1

    rows = [(st, c) for st, c in status_counts.most_common()]
    print_table("LEAD STATUS DISTRIBUTION", rows, ["Status", "Count"])

    rows2 = [(sub, c) for sub, c in substatus_counts.most_common(20)]
    print_table("LEAD SUB-STATUS DISTRIBUTION (top 20)", rows2, ["Sub-Status", "Count"])

    rows3 = [(lc, c) for lc, c in lifecycle_counts.most_common()]
    print_table("LIFECYCLE STAGE DISTRIBUTION", rows3, ["Lifecycle", "Count"])

    return {
        "status": dict(status_counts.most_common()),
        "sub_status": dict(substatus_counts.most_common()),
        "lifecycle": dict(lifecycle_counts.most_common()),
    }


def analyze_time_to_conversion(leads):
    """Time from lead creation to conversion."""
    buckets = Counter()  # days buckets
    by_source = defaultdict(list)
    total_days = []

    for lead in leads:
        if lead.get("lead_converted", "0") != "1":
            continue

        created = safe_date(lead.get("lead_created_date", ""))
        converted = safe_date(lead.get("lead_converted_date", ""))
        d = days_between(created, converted)

        if d is not None and d >= 0:
            total_days.append(d)
            src = lead.get("lead_source", "").strip() or "(blank)"
            by_source[src].append(d)

            if d == 0:
                buckets["Same day"] += 1
            elif d <= 3:
                buckets["1-3 days"] += 1
            elif d <= 7:
                buckets["4-7 days"] += 1
            elif d <= 14:
                buckets["8-14 days"] += 1
            elif d <= 30:
                buckets["15-30 days"] += 1
            elif d <= 60:
                buckets["31-60 days"] += 1
            elif d <= 90:
                buckets["61-90 days"] += 1
            elif d <= 180:
                buckets["91-180 days"] += 1
            else:
                buckets["180+ days"] += 1

    ordered = ["Same day", "1-3 days", "4-7 days", "8-14 days", "15-30 days", "31-60 days", "61-90 days", "91-180 days", "180+ days"]
    rows = [(b, buckets.get(b, 0), pct(buckets.get(b, 0), len(total_days))) for b in ordered]

    print_table(
        "TIME TO CONVERSION (created -> converted)",
        rows,
        ["Bucket", "Count", "% of Converted"]
    )

    if total_days:
        total_days.sort()
        median = total_days[len(total_days) // 2]
        avg = sum(total_days) / len(total_days)
        p25 = total_days[len(total_days) // 4]
        p75 = total_days[3 * len(total_days) // 4]
        print(f"  Converted leads with valid dates: {len(total_days)}")
        print(f"  Mean: {avg:.1f} days | Median: {median} days | P25: {p25} days | P75: {p75} days")

    # By source
    src_rows = []
    for src, days_list in sorted(by_source.items(), key=lambda x: -len(x[1])):
        if len(days_list) < 5:
            continue
        days_list.sort()
        med = days_list[len(days_list) // 2]
        avg_d = sum(days_list) / len(days_list)
        src_rows.append((src, len(days_list), f"{avg_d:.1f}", med))

    print_table(
        "MEDIAN TIME TO CONVERSION BY LEAD SOURCE",
        src_rows,
        ["Lead Source", "N", "Mean Days", "Median Days"]
    )

    return {
        "overall": {
            "total_with_dates": len(total_days),
            "mean_days": round(sum(total_days) / len(total_days), 1) if total_days else 0,
            "median_days": total_days[len(total_days) // 2] if total_days else 0,
            "p25_days": total_days[len(total_days) // 4] if total_days else 0,
            "p75_days": total_days[3 * len(total_days) // 4] if total_days else 0,
        },
        "buckets": {b: buckets.get(b, 0) for b in ordered},
        "by_source": {src: {"n": len(dl), "mean": round(sum(dl)/len(dl), 1), "median": dl[len(dl)//2]} for src, dl in by_source.items() if len(dl) >= 5},
    }


def analyze_assignment_path(leads):
    """Assignment path analysis (SDR vs AE direct)."""
    path_counts = Counter()
    path_converted = Counter()

    sdr_assigned = 0
    sdr_converted = 0
    ae_direct = 0
    ae_direct_converted = 0

    for lead in leads:
        path = lead.get("lead_assignment_path", "").strip() or "(blank)"
        converted = lead.get("lead_converted", "0") == "1"
        has_sdr = lead.get("lead_sdr_name", "").strip() != ""
        has_ae = lead.get("lead_ae_name", "").strip() != ""

        path_counts[path] += 1
        if converted:
            path_converted[path] += 1

        if has_sdr:
            sdr_assigned += 1
            if converted:
                sdr_converted += 1
        elif has_ae:
            ae_direct += 1
            if converted:
                ae_direct_converted += 1

    rows = []
    for p, c in path_counts.most_common():
        conv = path_converted.get(p, 0)
        rows.append((p, c, conv, pct(conv, c)))

    print_table(
        "ASSIGNMENT PATH DISTRIBUTION",
        rows,
        ["Path", "Count", "Converted", "Conv%"]
    )

    print(f"\n  SDR-assigned leads: {sdr_assigned} -> converted {sdr_converted} ({pct(sdr_converted, sdr_assigned)}%)")
    print(f"  AE-direct leads:   {ae_direct} -> converted {ae_direct_converted} ({pct(ae_direct_converted, ae_direct)}%)")

    # Top AEs by conversion
    ae_counts = Counter()
    ae_conv = Counter()
    for lead in leads:
        ae = lead.get("lead_ae_name", "").strip()
        if ae:
            ae_counts[ae] += 1
            if lead.get("lead_converted", "0") == "1":
                ae_conv[ae] += 1

    ae_rows = []
    for ae, c in ae_counts.most_common(20):
        conv = ae_conv.get(ae, 0)
        ae_rows.append((ae, c, conv, pct(conv, c)))

    print_table("TOP 20 AEs BY LEAD VOLUME", ae_rows, ["AE Name", "Leads", "Converted", "Conv%"])

    # Top SDRs by conversion
    sdr_counts = Counter()
    sdr_conv_counts = Counter()
    for lead in leads:
        sdr = lead.get("lead_sdr_name", "").strip()
        if sdr:
            sdr_counts[sdr] += 1
            if lead.get("lead_converted", "0") == "1":
                sdr_conv_counts[sdr] += 1

    sdr_rows = []
    for sdr, c in sdr_counts.most_common(20):
        conv = sdr_conv_counts.get(sdr, 0)
        sdr_rows.append((sdr, c, conv, pct(conv, c)))

    print_table("TOP 20 SDRs BY LEAD VOLUME", sdr_rows, ["SDR Name", "Leads", "Converted", "Conv%"])

    return {
        "paths": {p: {"count": c, "converted": path_converted.get(p, 0), "rate": pct(path_converted.get(p, 0), c)} for p, c in path_counts.most_common()},
        "sdr_vs_ae": {
            "sdr_assigned": {"count": sdr_assigned, "converted": sdr_converted, "rate": pct(sdr_converted, sdr_assigned)},
            "ae_direct": {"count": ae_direct, "converted": ae_direct_converted, "rate": pct(ae_direct_converted, ae_direct)},
        },
    }


def analyze_account_concentration(leads):
    """Account-level lead concentration (referral/WOM proxy)."""
    acct_counts = Counter()
    acct_converted = Counter()
    acct_sources = defaultdict(set)

    for lead in leads:
        acct = lead.get("lead_account_name", "").strip() or "(no account)"
        converted = lead.get("lead_converted", "0") == "1"
        src = lead.get("lead_person_source", "").strip() or "(blank)"

        acct_counts[acct] += 1
        if converted:
            acct_converted[acct] += 1
        acct_sources[acct].add(src)

    # Distribution of leads per account
    leads_per_acct = list(acct_counts.values())
    multi_lead = sum(1 for c in leads_per_acct if c > 1)
    high_density = sum(1 for c in leads_per_acct if c >= 5)
    very_high = sum(1 for c in leads_per_acct if c >= 10)

    print(f"\n{'='*80}")
    print(f"  ACCOUNT CONCENTRATION (referral/WOM proxy)")
    print(f"{'='*80}")
    print(f"  Total unique accounts: {len(acct_counts)}")
    print(f"  Multi-lead accounts (2+): {multi_lead} ({pct(multi_lead, len(acct_counts))}%)")
    print(f"  High-density accounts (5+): {high_density}")
    print(f"  Very high-density accounts (10+): {very_high}")

    # Top accounts by lead count
    rows = []
    for acct, c in acct_counts.most_common(30):
        conv = acct_converted.get(acct, 0)
        n_sources = len(acct_sources.get(acct, set()))
        rows.append((acct[:50], c, conv, pct(conv, c), n_sources))

    print_table(
        "TOP 30 ACCOUNTS BY LEAD VOLUME",
        rows,
        ["Account", "Leads", "Converted", "Conv%", "Sources"]
    )

    return {
        "unique_accounts": len(acct_counts),
        "multi_lead_accounts": multi_lead,
        "high_density_5plus": high_density,
        "very_high_10plus": very_high,
        "top_accounts": {acct: {"leads": c, "converted": acct_converted.get(acct, 0), "sources": len(acct_sources.get(acct, set()))} for acct, c in acct_counts.most_common(50)},
    }


def analyze_temporal_patterns(leads):
    """Monthly lead creation trends."""
    monthly = Counter()
    monthly_converted = Counter()
    monthly_pql = Counter()
    monthly_mql = Counter()

    for lead in leads:
        created = lead.get("lead_created_date", "").strip()
        if not created or len(created) < 7:
            continue
        month = created[:7]  # YYYY-MM
        converted = lead.get("lead_converted", "0") == "1"
        pql = lead.get("pql_flg", "0") == "1"
        mql = lead.get("mql_flg", "0") == "1"

        monthly[month] += 1
        if converted:
            monthly_converted[month] += 1
        if pql:
            monthly_pql[month] += 1
        if mql:
            monthly_mql[month] += 1

    rows = []
    for month in sorted(monthly.keys()):
        c = monthly[month]
        conv = monthly_converted.get(month, 0)
        pql_c = monthly_pql.get(month, 0)
        mql_c = monthly_mql.get(month, 0)
        rows.append((month, c, conv, pct(conv, c), mql_c, pql_c))

    print_table(
        "MONTHLY LEAD CREATION TREND",
        rows,
        ["Month", "Created", "Converted", "Conv%", "MQL", "PQL"]
    )

    return {month: {"created": monthly[month], "converted": monthly_converted.get(month, 0), "mql": monthly_mql.get(month, 0), "pql": monthly_pql.get(month, 0)} for month in sorted(monthly.keys())}


def analyze_prospect_type(leads):
    """Prospect type analysis (lead vs contact)."""
    pt_counts = Counter()
    pt_converted = Counter()

    for lead in leads:
        pt = lead.get("prospect_type", "").strip() or "(blank)"
        converted = lead.get("lead_converted", "0") == "1"
        pt_counts[pt] += 1
        if converted:
            pt_converted[pt] += 1

    rows = []
    for pt, c in pt_counts.most_common():
        conv = pt_converted.get(pt, 0)
        rows.append((pt, c, conv, pct(conv, c)))

    print_table("PROSPECT TYPE", rows, ["Type", "Count", "Converted", "Conv%"])

    return {pt: {"count": c, "converted": pt_converted.get(pt, 0), "rate": pct(pt_converted.get(pt, 0), c)} for pt, c in pt_counts.most_common()}


def analyze_inbound_vs_outbound_cross(leads):
    """Cross-tabulation: Source category x MQL/PQL x Conversion."""
    combos = Counter()
    combo_converted = Counter()

    for lead in leads:
        cat = lead.get("lead_person_source_category", "").strip() or "(blank)"
        mql = lead.get("mql_flg", "0") == "1"
        pql = lead.get("pql_flg", "0") == "1"
        converted = lead.get("lead_converted", "0") == "1"

        if mql and pql:
            qual = "MQL+PQL"
        elif mql:
            qual = "MQL"
        elif pql:
            qual = "PQL"
        else:
            qual = "Neither"

        key = (cat, qual)
        combos[key] += 1
        if converted:
            combo_converted[key] += 1

    rows = []
    for (cat, qual), c in sorted(combos.items(), key=lambda x: (-x[1])):
        conv = combo_converted.get((cat, qual), 0)
        rows.append((cat, qual, c, conv, pct(conv, c)))

    print_table(
        "SOURCE CATEGORY x QUALIFICATION x CONVERSION",
        rows,
        ["Source Category", "Qualification", "Count", "Converted", "Conv%"]
    )

    return {f"{cat}|{qual}": {"count": c, "converted": combo_converted.get((cat, qual), 0), "rate": pct(combo_converted.get((cat, qual), 0), c)} for (cat, qual), c in combos.items()}


def analyze_triblio_intent(leads):
    """Triblio intent score analysis."""
    has_score_30 = 0
    has_score_7 = 0
    score_buckets_30 = Counter()
    score_converted_30 = Counter()
    is_mqa = 0
    mqa_converted = 0

    for lead in leads:
        converted = lead.get("lead_converted", "0") == "1"
        s30 = lead.get("lead_triblio_account_score_last_30_days", "").strip()
        s7 = lead.get("lead_triblio_account_score_last_7_days", "").strip()
        mqa = lead.get("lead_triblio_is_mqa", "").strip().lower()

        if s30 and s30 not in ("", "0", "0.0"):
            has_score_30 += 1
            try:
                score = float(s30)
                if score < 10:
                    bucket = "1-9"
                elif score < 25:
                    bucket = "10-24"
                elif score < 50:
                    bucket = "25-49"
                elif score < 75:
                    bucket = "50-74"
                else:
                    bucket = "75+"
                score_buckets_30[bucket] += 1
                if converted:
                    score_converted_30[bucket] += 1
            except ValueError:
                pass

        if s7 and s7 not in ("", "0", "0.0"):
            has_score_7 += 1

        if mqa == "true":
            is_mqa += 1
            if converted:
                mqa_converted += 1

    print(f"\n{'='*80}")
    print(f"  TRIBLIO INTENT SIGNALS")
    print(f"{'='*80}")
    print(f"  Leads with 30-day score > 0: {has_score_30}")
    print(f"  Leads with 7-day score > 0: {has_score_7}")
    print(f"  Triblio MQA leads: {is_mqa} -> converted {mqa_converted} ({pct(mqa_converted, is_mqa)}%)")

    ordered_buckets = ["1-9", "10-24", "25-49", "50-74", "75+"]
    rows = []
    for b in ordered_buckets:
        c = score_buckets_30.get(b, 0)
        conv = score_converted_30.get(b, 0)
        rows.append((b, c, conv, pct(conv, c) if c > 0 else 0))

    print_table("TRIBLIO 30-DAY SCORE BUCKETS", rows, ["Score Range", "Count", "Converted", "Conv%"])

    return {
        "has_30day_score": has_score_30,
        "has_7day_score": has_score_7,
        "mqa": {"count": is_mqa, "converted": mqa_converted, "rate": pct(mqa_converted, is_mqa)},
        "score_buckets_30d": {b: {"count": score_buckets_30.get(b, 0), "converted": score_converted_30.get(b, 0)} for b in ordered_buckets},
    }


def analyze_plg_cloud_instances(leads):
    """PLG cloud instance analysis."""
    instance_counts = Counter()
    instance_converted = Counter()

    for lead in leads:
        inst = lead.get("plg_cloud_instance_c", "").strip()
        if not inst:
            continue
        converted = lead.get("lead_converted", "0") == "1"
        instance_counts[inst] += 1
        if converted:
            instance_converted[inst] += 1

    if instance_counts:
        rows = []
        for inst, c in instance_counts.most_common(20):
            conv = instance_converted.get(inst, 0)
            rows.append((inst[:60], c, conv, pct(conv, c)))
        print_table("PLG CLOUD INSTANCES (top 20)", rows, ["Instance", "Count", "Converted", "Conv%"])
    else:
        print("\n  No PLG cloud instance data found.")

    return {inst: {"count": c, "converted": instance_converted.get(inst, 0)} for inst, c in instance_counts.most_common()}


def crossing_the_chasm_summary(leads, results):
    """Synthesize findings into Crossing the Chasm answers."""
    print(f"\n{'#'*80}")
    print(f"  CROSSING THE CHASM: STRATEGIC FINDINGS")
    print(f"{'#'*80}")

    total = len(leads)
    converted_total = sum(1 for l in leads if l.get("lead_converted", "0") == "1")

    print(f"\n  BASELINE: {total} leads, {converted_total} converted ({pct(converted_total, total)}%)")

    # Q1: Strongest inbound demand segments
    print(f"\n  Q1: WHICH SEGMENTS GENERATE THE MOST INBOUND DEMAND?")
    print(f"  ---")
    inbound_sources = results.get("person_source", {})
    for src, data in sorted(inbound_sources.items(), key=lambda x: -x[1].get("count", 0))[:10]:
        print(f"    {src}: {data['count']} leads, {data['converted']} converted ({data['conversion_rate']}%)")

    # Q2: Highest conversion segments
    print(f"\n  Q2: WHICH SEGMENTS HAVE HIGHEST LEAD-TO-OPP CONVERSION?")
    print(f"  ---")
    # By source category
    cats = results.get("source_distribution", {}).get("person_source_category", {})
    for cat, data in sorted(cats.items(), key=lambda x: -x[1].get("conversion_rate", 0)):
        if data["count"] >= 50:
            print(f"    {cat}: {data['conversion_rate']}% ({data['converted']}/{data['count']})")

    # Q3: PLG strength
    print(f"\n  Q3: WHERE IS PRODUCT-LED GROWTH (PQL) STRONGEST?")
    print(f"  ---")
    mql_pql = results.get("mql_pql", {}).get("summary", {})
    for k, v in mql_pql.items():
        print(f"    {k}: {v['count']} leads, {v.get('converted', 0)} converted ({v.get('rate', 0)}%)")

    # Q4: Efficient channels
    print(f"\n  Q4: WHICH CHANNELS ARE MOST EFFICIENT?")
    print(f"  ---")
    campaigns = results.get("campaign_types", {})
    for ct, data in sorted(campaigns.items(), key=lambda x: -x[1].get("conversion_rate", 0)):
        if data["count"] >= 20:
            print(f"    {ct}: {data['conversion_rate']}% conv ({data['converted']}/{data['count']})")

    # Q5: Referral density
    print(f"\n  Q5: IS THERE REFERRAL DENSITY / WORD-OF-MOUTH SIGNAL?")
    print(f"  ---")
    acct = results.get("account_concentration", {})
    print(f"    Unique accounts: {acct.get('unique_accounts', 0)}")
    print(f"    Multi-lead accounts (2+): {acct.get('multi_lead_accounts', 0)}")
    print(f"    High-density (5+): {acct.get('high_density_5plus', 0)}")
    print(f"    Very high (10+): {acct.get('very_high_10plus', 0)}")

    # Q6: Outbound success
    print(f"\n  Q6: WHICH SEGMENTS SHOW REPEATABLE OUTBOUND SUCCESS?")
    print(f"  ---")
    cross = results.get("source_qual_cross", {})
    outbound_keys = [(k, v) for k, v in cross.items() if "Outbound" in k or "Sales" in k or "SDR" in k]
    for k, v in sorted(outbound_keys, key=lambda x: -x[1].get("count", 0)):
        print(f"    {k}: {v['count']} leads, {v['converted']} converted ({v['rate']}%)")


def main():
    print("Loading leads data...")
    leads = load_leads()
    print(f"Loaded {len(leads)} leads")

    results = {}

    # 1. Lead source distribution
    results["source_distribution"] = analyze_lead_source_distribution(leads)

    # 2. Person source detail
    results["person_source"] = analyze_person_source_detail(leads)

    # 3. First touchpoint
    results["first_touchpoint"] = analyze_first_touchpoint(leads)

    # 4. Campaign types
    results["campaign_types"] = analyze_campaign_types(leads)

    # 5. MQL vs PQL
    results["mql_pql"] = analyze_mql_pql_distribution(leads)

    # 6. Product usage / PLG
    results["product_usage"] = analyze_product_usage_signals(leads)

    # 7. Title levels
    results["title_levels"] = analyze_title_levels(leads)

    # 8. Lead status
    results["lead_status"] = analyze_lead_status(leads)

    # 9. Time to conversion
    results["time_to_conversion"] = analyze_time_to_conversion(leads)

    # 10. Assignment path
    results["assignment_path"] = analyze_assignment_path(leads)

    # 11. Account concentration
    results["account_concentration"] = analyze_account_concentration(leads)

    # 12. Temporal patterns
    results["temporal"] = analyze_temporal_patterns(leads)

    # 13. Prospect type
    results["prospect_type"] = analyze_prospect_type(leads)

    # 14. Inbound vs outbound cross
    results["source_qual_cross"] = analyze_inbound_vs_outbound_cross(leads)

    # 15. Triblio intent
    results["triblio_intent"] = analyze_triblio_intent(leads)

    # 16. PLG cloud instances
    results["plg_cloud"] = analyze_plg_cloud_instances(leads)

    # Strategic summary
    crossing_the_chasm_summary(leads, results)

    # Save JSON
    with open(OUTPUT_FILE, "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\n\nResults saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
