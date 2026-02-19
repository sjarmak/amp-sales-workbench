#!/usr/bin/env python3
"""
Crossing the Chasm Beachhead Analysis
Joins sfdc_opportunities.csv with sfdc_account_details.csv on account_id
to produce industry-level strategic metrics.
"""

import csv
import json
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path
import re

DATA_DIR = Path(__file__).parent.parent / "data" / "global"
OPPS_CSV = DATA_DIR / "sfdc_opportunities.csv"
ACCOUNTS_CSV = DATA_DIR / "sfdc_account_details.csv"
OUTPUT_JSON = DATA_DIR / "analysis_beachhead.json"


def parse_date(s):
    """Parse YYYY-MM-DD date string, return None if empty/invalid."""
    if not s or s.strip() == "":
        return None
    try:
        return datetime.strptime(s.strip(), "%Y-%m-%d")
    except ValueError:
        return None


def parse_float(s):
    """Parse float, return None if empty/invalid."""
    if not s or s.strip() == "":
        return None
    try:
        return float(s.strip())
    except ValueError:
        return None


def parse_int(s):
    """Parse int, return None if empty/invalid."""
    if not s or s.strip() == "":
        return None
    try:
        return int(float(s.strip()))
    except ValueError:
        return None


def parse_bool(s):
    """Parse boolean string."""
    if not s:
        return False
    return s.strip().lower() == "true"


def load_account_industry_map():
    """Load account_id -> industry mapping from account details."""
    account_map = {}
    with open(ACCOUNTS_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            aid = row.get("account_id", "").strip()
            industry = row.get("industry", "").strip()
            eng_count = parse_float(row.get("eng_count", ""))
            num_employees = parse_int(row.get("number_of_employees", ""))
            num_engineers = parse_int(row.get("number_of_engineers", ""))
            annual_revenue = parse_float(row.get("annual_revenue", ""))
            geo = row.get("geo", "").strip()
            region = row.get("region", "").strip()
            tier = row.get("tier", "").strip()
            fy25_seg = row.get("fy_25_segmentation_c", "").strip()
            if aid:
                account_map[aid] = {
                    "industry": industry if industry else "(blank)",
                    "eng_count": eng_count,
                    "number_of_employees": num_employees,
                    "number_of_engineers": num_engineers,
                    "annual_revenue": annual_revenue,
                    "geo": geo,
                    "region": region,
                    "tier": tier,
                    "fy25_segmentation": fy25_seg,
                }
    return account_map


def load_opportunities(account_map):
    """Load all opportunities and enrich with industry from account map."""
    opps = []
    with open(OPPS_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            aid = row.get("account_id", "").strip()
            acct_info = account_map.get(aid, {})
            industry = acct_info.get("industry", "(no account match)")

            created = parse_date(row.get("created_date", ""))
            closed = parse_date(row.get("close_date", ""))
            won_date = parse_date(row.get("opp_won_date", ""))
            iarr = parse_float(row.get("iarr", ""))
            amount = parse_float(row.get("opportunity_amount", ""))
            days_to_close = parse_int(row.get("days_to_close", ""))
            is_won = parse_bool(row.get("is_won", ""))
            is_closed = parse_bool(row.get("is_closed", ""))
            stage = row.get("stage_name", "").strip()

            # Compute cycle length from dates if days_to_close is missing
            cycle_days = days_to_close
            if cycle_days is None and created and closed and is_closed:
                cycle_days = (closed - created).days

            opp = {
                "opportunity_id": row.get("opportunity_id", "").strip(),
                "opportunity_name": row.get("opportunity_name", "").strip(),
                "account_id": aid,
                "account_name": row.get("account_name", "").strip(),
                "industry": industry,
                "opportunity_type": row.get("opportunity_type", "").strip(),
                "stage_name": stage,
                "is_closed": is_closed,
                "is_won": is_won,
                "amount": amount,
                "iarr": iarr,
                "created_date": row.get("created_date", "").strip(),
                "close_date": row.get("close_date", "").strip(),
                "opp_won_date": row.get("opp_won_date", "").strip(),
                "cycle_days": cycle_days,
                "days_to_close": days_to_close,
                "products_included": row.get("products_included", "").strip(),
                "competition": row.get("competition", "").strip(),
                "closed_lost_reason": row.get("closed_lost_reason", "").strip(),
                "closed_won_reason": row.get("closed_won_reason", "").strip(),
                "lost_to_competitor": row.get("lost_to_competitor", "").strip(),
                "compelling_event": row.get("compelling_event", "").strip(),
                "primary_use_case": row.get("primary_use_case", "").strip(),
                "use_cases": row.get("use_cases", "").strip(),
                "lead_source": row.get("lead_source", "").strip(),
                "opportunity_source": row.get("opportunity_source", "").strip(),
                "number_of_engineers_opp": parse_int(row.get("number_of_engineers", "")),
                "purchased_seats": parse_int(row.get("purchased_seats", "")),
                "contract_term": parse_float(row.get("contract_term", "")),
                "forecast_category": row.get("forecast_category", "").strip(),
                "fiscal_quarter": row.get("fiscal_quarter", "").strip(),
                "fiscal_year": row.get("fiscal_year", "").strip(),
                # Account-level enrichment
                "eng_count": acct_info.get("eng_count"),
                "number_of_employees": acct_info.get("number_of_employees"),
                "annual_revenue": acct_info.get("annual_revenue"),
                "geo": acct_info.get("geo", ""),
                "region": acct_info.get("region", ""),
                "tier": acct_info.get("tier", ""),
                "fy25_segmentation": acct_info.get("fy25_segmentation", ""),
            }
            opps.append(opp)
    return opps


def compute_industry_metrics(opps):
    """Compute comprehensive metrics by industry."""
    # Group by industry
    by_industry = defaultdict(list)
    for o in opps:
        by_industry[o["industry"]].append(o)

    results = {}
    for industry, ind_opps in sorted(by_industry.items(), key=lambda x: -len(x[1])):
        total = len(ind_opps)
        closed = [o for o in ind_opps if o["is_closed"]]
        won = [o for o in ind_opps if o["is_won"]]
        lost = [o for o in ind_opps if o["is_closed"] and not o["is_won"]]
        open_opps = [o for o in ind_opps if not o["is_closed"]]

        # Win rate (closed-won / (closed-won + closed-lost))
        win_rate = len(won) / len(closed) if closed else None

        # Deal sizes
        won_iarr = [o["iarr"] for o in won if o["iarr"] is not None]
        lost_iarr = [o["iarr"] for o in lost if o["iarr"] is not None]
        all_iarr = [o["iarr"] for o in ind_opps if o["iarr"] is not None]
        won_amount = [o["amount"] for o in won if o["amount"] is not None]

        # Cycle lengths for closed deals
        won_cycles = [o["cycle_days"] for o in won if o["cycle_days"] is not None and o["cycle_days"] >= 0]
        lost_cycles = [o["cycle_days"] for o in lost if o["cycle_days"] is not None and o["cycle_days"] >= 0]

        # Stage distribution
        stages = Counter(o["stage_name"] for o in ind_opps)

        # Products
        products = Counter()
        for o in ind_opps:
            if o["products_included"]:
                for p in o["products_included"].split(";"):
                    p = p.strip()
                    if p:
                        products[p] += 1

        # Won products
        won_products = Counter()
        for o in won:
            if o["products_included"]:
                for p in o["products_included"].split(";"):
                    p = p.strip()
                    if p:
                        won_products[p] += 1

        # Competition
        competition = Counter()
        for o in ind_opps:
            if o["competition"] and o["competition"].strip():
                competition[o["competition"].strip()] += 1

        # Won competition
        won_competition = Counter()
        for o in won:
            if o["competition"] and o["competition"].strip():
                won_competition[o["competition"].strip()] += 1

        # Lost competition
        lost_competition = Counter()
        for o in lost:
            if o["competition"] and o["competition"].strip():
                lost_competition[o["competition"].strip()] += 1

        # Lost-to competitor
        lost_to = Counter()
        for o in lost:
            if o["lost_to_competitor"] and o["lost_to_competitor"].strip():
                lost_to[o["lost_to_competitor"].strip()] += 1

        # Closed lost reasons
        loss_reasons = Counter()
        for o in lost:
            if o["closed_lost_reason"] and o["closed_lost_reason"].strip():
                loss_reasons[o["closed_lost_reason"].strip()] += 1

        # Opp types
        opp_types = Counter(o["opportunity_type"] for o in ind_opps)
        won_opp_types = Counter(o["opportunity_type"] for o in won)

        # Use cases
        use_cases = Counter()
        for o in ind_opps:
            if o["use_cases"]:
                for uc in o["use_cases"].split(";"):
                    uc = uc.strip()
                    if uc:
                        use_cases[uc] += 1

        # Geo distribution
        geos = Counter(o["geo"] for o in ind_opps if o["geo"])

        # Engineer counts
        eng_counts = [o["eng_count"] for o in ind_opps if o["eng_count"] is not None]
        employee_counts = [o["number_of_employees"] for o in ind_opps if o["number_of_employees"] is not None]

        # FY25 segmentation
        segments = Counter(o["fy25_segmentation"] for o in ind_opps if o["fy25_segmentation"])

        # Unique accounts
        unique_accounts = set(o["account_id"] for o in ind_opps)
        won_accounts = set(o["account_id"] for o in won)

        def safe_avg(lst):
            return sum(lst) / len(lst) if lst else None

        def safe_median(lst):
            if not lst:
                return None
            s = sorted(lst)
            n = len(s)
            if n % 2 == 0:
                return (s[n // 2 - 1] + s[n // 2]) / 2
            return s[n // 2]

        def safe_p25(lst):
            if not lst:
                return None
            s = sorted(lst)
            n = len(s)
            idx = n // 4
            return s[idx]

        def safe_p75(lst):
            if not lst:
                return None
            s = sorted(lst)
            n = len(s)
            idx = (3 * n) // 4
            return s[min(idx, n - 1)]

        results[industry] = {
            "total_opps": total,
            "unique_accounts": len(unique_accounts),
            "won_accounts": len(won_accounts),
            "closed_count": len(closed),
            "won_count": len(won),
            "lost_count": len(lost),
            "open_count": len(open_opps),
            "win_rate": round(win_rate, 4) if win_rate is not None else None,
            "deal_size": {
                "won_iarr_avg": round(safe_avg(won_iarr), 2) if safe_avg(won_iarr) is not None else None,
                "won_iarr_median": round(safe_median(won_iarr), 2) if safe_median(won_iarr) is not None else None,
                "won_iarr_total": round(sum(won_iarr), 2) if won_iarr else 0,
                "won_iarr_min": round(min(won_iarr), 2) if won_iarr else None,
                "won_iarr_max": round(max(won_iarr), 2) if won_iarr else None,
                "won_amount_avg": round(safe_avg(won_amount), 2) if safe_avg(won_amount) is not None else None,
                "won_amount_total": round(sum(won_amount), 2) if won_amount else 0,
                "lost_iarr_avg": round(safe_avg(lost_iarr), 2) if safe_avg(lost_iarr) is not None else None,
                "lost_iarr_total": round(sum(lost_iarr), 2) if lost_iarr else 0,
                "all_iarr_avg": round(safe_avg(all_iarr), 2) if safe_avg(all_iarr) is not None else None,
                "all_iarr_total": round(sum(all_iarr), 2) if all_iarr else 0,
            },
            "cycle_days": {
                "won_avg": round(safe_avg(won_cycles), 1) if safe_avg(won_cycles) is not None else None,
                "won_median": round(safe_median(won_cycles), 1) if safe_median(won_cycles) is not None else None,
                "won_p25": safe_p25(won_cycles),
                "won_p75": safe_p75(won_cycles),
                "won_min": min(won_cycles) if won_cycles else None,
                "won_max": max(won_cycles) if won_cycles else None,
                "lost_avg": round(safe_avg(lost_cycles), 1) if safe_avg(lost_cycles) is not None else None,
                "lost_median": round(safe_median(lost_cycles), 1) if safe_median(lost_cycles) is not None else None,
            },
            "stages": dict(stages.most_common()),
            "products_all": dict(products.most_common()),
            "products_won": dict(won_products.most_common()),
            "competition_all": dict(competition.most_common()),
            "competition_won": dict(won_competition.most_common()),
            "competition_lost": dict(lost_competition.most_common()),
            "lost_to_competitor": dict(lost_to.most_common()),
            "loss_reasons": dict(loss_reasons.most_common()),
            "opp_types": dict(opp_types.most_common()),
            "won_opp_types": dict(won_opp_types.most_common()),
            "use_cases": dict(use_cases.most_common()),
            "geo_distribution": dict(geos.most_common()),
            "fy25_segmentation": dict(segments.most_common()),
            "company_size": {
                "avg_eng_count": round(safe_avg(eng_counts), 0) if safe_avg(eng_counts) is not None else None,
                "median_eng_count": round(safe_median(eng_counts), 0) if safe_median(eng_counts) is not None else None,
                "avg_employees": round(safe_avg(employee_counts), 0) if safe_avg(employee_counts) is not None else None,
                "median_employees": round(safe_median(employee_counts), 0) if safe_median(employee_counts) is not None else None,
            },
        }

    return results


def compute_expansion_analysis(opps):
    """Analyze expansion behavior by industry."""
    # Group by account
    by_account = defaultdict(list)
    for o in opps:
        by_account[o["account_id"]].append(o)

    expansion_data = defaultdict(lambda: {
        "accounts_with_multiple_opps": 0,
        "accounts_total": 0,
        "expansion_opps": 0,
        "renewal_opps": 0,
        "new_biz_opps": 0,
        "total_opps": 0,
        "expansion_rate": None,
        "avg_opps_per_account": None,
        "max_opps_per_account": 0,
        "time_to_first_expansion_days": [],
        "expansion_iarr": [],
        "expansion_won": 0,
        "expansion_lost": 0,
        "accounts_detail": [],
    })

    for aid, acct_opps in by_account.items():
        # Sort by created date
        acct_opps.sort(key=lambda x: x["created_date"] or "")
        industry = acct_opps[0]["industry"]
        account_name = acct_opps[0]["account_name"]
        data = expansion_data[industry]
        data["accounts_total"] += 1
        data["total_opps"] += len(acct_opps)

        if len(acct_opps) > 1:
            data["accounts_with_multiple_opps"] += 1

        data["max_opps_per_account"] = max(data["max_opps_per_account"], len(acct_opps))

        # Count types
        for o in acct_opps:
            otype = o["opportunity_type"]
            if otype == "Expansion":
                data["expansion_opps"] += 1
                if o["is_won"]:
                    data["expansion_won"] += 1
                if o["is_closed"] and not o["is_won"]:
                    data["expansion_lost"] += 1
                if o["iarr"] is not None:
                    data["expansion_iarr"].append(o["iarr"])
            elif otype == "Renewal":
                data["renewal_opps"] += 1
            elif otype == "New Business":
                data["new_biz_opps"] += 1

        # Time to first expansion
        new_biz_won = [o for o in acct_opps if o["opportunity_type"] == "New Business" and o["is_won"]]
        expansions = [o for o in acct_opps if o["opportunity_type"] == "Expansion"]
        if new_biz_won and expansions:
            first_won_date = parse_date(new_biz_won[0].get("opp_won_date") or new_biz_won[0].get("close_date", ""))
            first_exp_date = parse_date(expansions[0].get("created_date", ""))
            if first_won_date and first_exp_date:
                delta = (first_exp_date - first_won_date).days
                if delta >= 0:
                    data["time_to_first_expansion_days"].append(delta)

        # Track top expanding accounts
        if len(acct_opps) >= 3:
            data["accounts_detail"].append({
                "account_name": account_name,
                "account_id": aid,
                "opp_count": len(acct_opps),
                "types": dict(Counter(o["opportunity_type"] for o in acct_opps)),
                "won_count": sum(1 for o in acct_opps if o["is_won"]),
                "total_iarr": sum(o["iarr"] for o in acct_opps if o["iarr"] is not None),
            })

    # Compute summary stats
    results = {}
    for industry, data in sorted(expansion_data.items(), key=lambda x: -x[1]["expansion_opps"]):
        avg_opps = data["total_opps"] / data["accounts_total"] if data["accounts_total"] else None
        expansion_rate = data["accounts_with_multiple_opps"] / data["accounts_total"] if data["accounts_total"] else None
        ttfe = data["time_to_first_expansion_days"]
        exp_iarr = data["expansion_iarr"]

        results[industry] = {
            "accounts_total": data["accounts_total"],
            "accounts_with_multiple_opps": data["accounts_with_multiple_opps"],
            "multi_opp_rate": round(expansion_rate, 4) if expansion_rate is not None else None,
            "total_opps": data["total_opps"],
            "avg_opps_per_account": round(avg_opps, 2) if avg_opps is not None else None,
            "max_opps_per_account": data["max_opps_per_account"],
            "expansion_opps": data["expansion_opps"],
            "renewal_opps": data["renewal_opps"],
            "new_biz_opps": data["new_biz_opps"],
            "expansion_won": data["expansion_won"],
            "expansion_lost": data["expansion_lost"],
            "expansion_win_rate": round(data["expansion_won"] / (data["expansion_won"] + data["expansion_lost"]), 4) if (data["expansion_won"] + data["expansion_lost"]) > 0 else None,
            "expansion_iarr_avg": round(sum(exp_iarr) / len(exp_iarr), 2) if exp_iarr else None,
            "expansion_iarr_total": round(sum(exp_iarr), 2) if exp_iarr else 0,
            "time_to_first_expansion": {
                "avg_days": round(sum(ttfe) / len(ttfe), 1) if ttfe else None,
                "median_days": round(sorted(ttfe)[len(ttfe) // 2], 1) if ttfe else None,
                "min_days": min(ttfe) if ttfe else None,
                "max_days": max(ttfe) if ttfe else None,
                "sample_size": len(ttfe),
            },
            "top_expanding_accounts": sorted(data["accounts_detail"], key=lambda x: -x["opp_count"])[:10],
        }

    return results


def compute_beachhead_scores(industry_metrics, expansion_metrics):
    """Compute composite beachhead scores for each industry.

    Scoring dimensions (all normalized 0-1):
    1. Win Rate (higher = better)
    2. Deal Size (higher avg won iARR = better)
    3. Sales Velocity (shorter cycle = better, inverted)
    4. Volume (more closed deals = more signal)
    5. Expansion Potential (multi-opp rate, expansion iarr)
    """
    # Collect raw values for normalization
    all_win_rates = []
    all_deal_sizes = []
    all_cycles = []
    all_volumes = []
    all_expansion_rates = []

    industries_to_score = []
    for ind, m in industry_metrics.items():
        if m["closed_count"] < 3:  # Minimum sample size
            continue
        if m["win_rate"] is None:
            continue
        industries_to_score.append(ind)
        all_win_rates.append(m["win_rate"])
        ds = m["deal_size"]["won_iarr_avg"] if m["deal_size"]["won_iarr_avg"] else 0
        all_deal_sizes.append(ds)
        cy = m["cycle_days"]["won_median"] if m["cycle_days"]["won_median"] else 999
        all_cycles.append(cy)
        all_volumes.append(m["closed_count"])
        exp = expansion_metrics.get(ind, {})
        all_expansion_rates.append(exp.get("multi_opp_rate", 0) or 0)

    if not industries_to_score:
        return {}

    def normalize(val, vals, invert=False):
        mn, mx = min(vals), max(vals)
        if mx == mn:
            return 0.5
        n = (val - mn) / (mx - mn)
        return 1 - n if invert else n

    scores = {}
    for ind in industries_to_score:
        m = industry_metrics[ind]
        exp = expansion_metrics.get(ind, {})
        wr = m["win_rate"]
        ds = m["deal_size"]["won_iarr_avg"] if m["deal_size"]["won_iarr_avg"] else 0
        cy = m["cycle_days"]["won_median"] if m["cycle_days"]["won_median"] else 999
        vol = m["closed_count"]
        er = exp.get("multi_opp_rate", 0) or 0

        wr_norm = normalize(wr, all_win_rates)
        ds_norm = normalize(ds, all_deal_sizes)
        cy_norm = normalize(cy, all_cycles, invert=True)  # shorter = better
        vol_norm = normalize(vol, all_volumes)
        er_norm = normalize(er, all_expansion_rates)

        # Weighted composite
        composite = (
            0.25 * wr_norm +
            0.20 * ds_norm +
            0.20 * cy_norm +
            0.15 * vol_norm +
            0.20 * er_norm
        )

        scores[ind] = {
            "composite_score": round(composite, 4),
            "win_rate_score": round(wr_norm, 4),
            "deal_size_score": round(ds_norm, 4),
            "velocity_score": round(cy_norm, 4),
            "volume_score": round(vol_norm, 4),
            "expansion_score": round(er_norm, 4),
            "raw_values": {
                "win_rate": wr,
                "avg_won_iarr": ds,
                "median_cycle_days": cy,
                "closed_count": vol,
                "multi_opp_rate": er,
            },
        }

    return dict(sorted(scores.items(), key=lambda x: -x[1]["composite_score"]))


def compute_closed_won_deep_dive(opps):
    """Deep dive into closed-won deals by industry."""
    won = [o for o in opps if o["is_won"]]
    by_industry = defaultdict(list)
    for o in won:
        by_industry[o["industry"]].append(o)

    results = {}
    for industry, ind_opps in sorted(by_industry.items(), key=lambda x: -len(x[1])):
        iarrs = [o["iarr"] for o in ind_opps if o["iarr"] is not None]
        cycles = [o["cycle_days"] for o in ind_opps if o["cycle_days"] is not None and o["cycle_days"] >= 0]

        products = Counter()
        for o in ind_opps:
            if o["products_included"]:
                for p in o["products_included"].split(";"):
                    p = p.strip()
                    if p:
                        products[p] += 1

        competition = Counter()
        for o in ind_opps:
            if o["competition"]:
                competition[o["competition"].strip()] += 1

        won_reasons = Counter()
        for o in ind_opps:
            if o["closed_won_reason"]:
                won_reasons[o["closed_won_reason"].strip()] += 1

        use_cases = Counter()
        for o in ind_opps:
            if o["use_cases"]:
                for uc in o["use_cases"].split(";"):
                    uc = uc.strip()
                    if uc:
                        use_cases[uc] += 1

        opp_types = Counter(o["opportunity_type"] for o in ind_opps)

        results[industry] = {
            "won_count": len(ind_opps),
            "unique_accounts": len(set(o["account_id"] for o in ind_opps)),
            "iarr": {
                "total": round(sum(iarrs), 2) if iarrs else 0,
                "avg": round(sum(iarrs) / len(iarrs), 2) if iarrs else None,
                "median": round(sorted(iarrs)[len(iarrs) // 2], 2) if iarrs else None,
                "min": round(min(iarrs), 2) if iarrs else None,
                "max": round(max(iarrs), 2) if iarrs else None,
            },
            "cycle_days": {
                "avg": round(sum(cycles) / len(cycles), 1) if cycles else None,
                "median": round(sorted(cycles)[len(cycles) // 2], 1) if cycles else None,
                "min": min(cycles) if cycles else None,
                "max": max(cycles) if cycles else None,
            },
            "products": dict(products.most_common()),
            "competition": dict(competition.most_common()),
            "won_reasons": dict(won_reasons.most_common()),
            "use_cases": dict(use_cases.most_common()),
            "opp_types": dict(opp_types.most_common()),
        }

    return results


def compute_closed_lost_deep_dive(opps):
    """Deep dive into closed-lost deals by industry."""
    lost = [o for o in opps if o["is_closed"] and not o["is_won"]]
    by_industry = defaultdict(list)
    for o in lost:
        by_industry[o["industry"]].append(o)

    results = {}
    for industry, ind_opps in sorted(by_industry.items(), key=lambda x: -len(x[1])):
        iarrs = [o["iarr"] for o in ind_opps if o["iarr"] is not None]
        cycles = [o["cycle_days"] for o in ind_opps if o["cycle_days"] is not None and o["cycle_days"] >= 0]

        loss_reasons = Counter()
        for o in ind_opps:
            if o["closed_lost_reason"]:
                loss_reasons[o["closed_lost_reason"].strip()] += 1

        lost_to = Counter()
        for o in ind_opps:
            if o["lost_to_competitor"]:
                lost_to[o["lost_to_competitor"].strip()] += 1

        competition = Counter()
        for o in ind_opps:
            if o["competition"]:
                competition[o["competition"].strip()] += 1

        results[industry] = {
            "lost_count": len(ind_opps),
            "unique_accounts": len(set(o["account_id"] for o in ind_opps)),
            "iarr": {
                "total": round(sum(iarrs), 2) if iarrs else 0,
                "avg": round(sum(iarrs) / len(iarrs), 2) if iarrs else None,
                "median": round(sorted(iarrs)[len(iarrs) // 2], 2) if iarrs else None,
            },
            "cycle_days": {
                "avg": round(sum(cycles) / len(cycles), 1) if cycles else None,
                "median": round(sorted(cycles)[len(cycles) // 2], 1) if cycles else None,
            },
            "loss_reasons": dict(loss_reasons.most_common()),
            "lost_to_competitor": dict(lost_to.most_common()),
            "competition_present": dict(competition.most_common()),
        }

    return results


def print_summary(industry_metrics, beachhead_scores, expansion_metrics, closed_won, closed_lost):
    """Print key findings to terminal."""
    print("=" * 100)
    print("CROSSING THE CHASM -- BEACHHEAD ANALYSIS")
    print("=" * 100)

    # Overall stats
    total_opps = sum(m["total_opps"] for m in industry_metrics.values())
    total_won = sum(m["won_count"] for m in industry_metrics.values())
    total_lost = sum(m["lost_count"] for m in industry_metrics.values())
    total_open = sum(m["open_count"] for m in industry_metrics.values())
    total_industries = len(industry_metrics)
    print(f"\nTotal Opportunities: {total_opps}")
    print(f"  Won: {total_won}  Lost: {total_lost}  Open: {total_open}")
    print(f"  Industries: {total_industries}")
    print()

    # Beachhead Ranking
    print("-" * 100)
    print("BEACHHEAD RANKING (composite score, min 3 closed deals)")
    print("-" * 100)
    print(f"{'Rank':<5} {'Industry':<45} {'Score':<8} {'WinRate':<8} {'AvgDeal':<12} {'Cycle':<8} {'Closed':<8} {'ExpRate':<8}")
    print("-" * 100)
    for i, (ind, s) in enumerate(beachhead_scores.items(), 1):
        rv = s["raw_values"]
        wr_str = f"{rv['win_rate']:.1%}" if rv['win_rate'] else "N/A"
        ds_str = f"${rv['avg_won_iarr']:,.0f}" if rv['avg_won_iarr'] else "N/A"
        cy_str = f"{rv['median_cycle_days']:.0f}d" if rv['median_cycle_days'] and rv['median_cycle_days'] < 999 else "N/A"
        er_str = f"{rv['multi_opp_rate']:.1%}" if rv['multi_opp_rate'] else "0%"
        print(f"{i:<5} {ind:<45} {s['composite_score']:.3f}   {wr_str:<8} {ds_str:<12} {cy_str:<8} {rv['closed_count']:<8} {er_str:<8}")
        if i >= 30:
            print(f"  ... and {len(beachhead_scores) - 30} more industries")
            break

    # Top Win Rate Industries (min 5 closed deals)
    print("\n" + "-" * 100)
    print("TOP WIN RATE INDUSTRIES (min 5 closed deals)")
    print("-" * 100)
    wr_sorted = sorted(
        [(k, v) for k, v in industry_metrics.items() if v["closed_count"] >= 5 and v["win_rate"] is not None],
        key=lambda x: -x[1]["win_rate"]
    )
    for ind, m in wr_sorted[:15]:
        print(f"  {ind:<45} WR={m['win_rate']:.1%}  Won={m['won_count']}  Lost={m['lost_count']}  AvgDeal=${m['deal_size']['won_iarr_avg'] or 0:,.0f}")

    # Largest Deal Size Industries
    print("\n" + "-" * 100)
    print("LARGEST AVG DEAL SIZE (won iARR, min 3 won deals)")
    print("-" * 100)
    ds_sorted = sorted(
        [(k, v) for k, v in industry_metrics.items() if v["won_count"] >= 3 and v["deal_size"]["won_iarr_avg"]],
        key=lambda x: -(x[1]["deal_size"]["won_iarr_avg"] or 0)
    )
    for ind, m in ds_sorted[:15]:
        ds = m["deal_size"]
        print(f"  {ind:<45} Avg=${ds['won_iarr_avg']:,.0f}  Med=${ds['won_iarr_median']:,.0f}  Total=${ds['won_iarr_total']:,.0f}  N={m['won_count']}")

    # Shortest Sales Cycle
    print("\n" + "-" * 100)
    print("SHORTEST SALES CYCLE (won median, min 3 won deals)")
    print("-" * 100)
    cy_sorted = sorted(
        [(k, v) for k, v in industry_metrics.items() if v["won_count"] >= 3 and v["cycle_days"]["won_median"] is not None],
        key=lambda x: x[1]["cycle_days"]["won_median"]
    )
    for ind, m in cy_sorted[:15]:
        cy = m["cycle_days"]
        print(f"  {ind:<45} Med={cy['won_median']:.0f}d  Avg={cy['won_avg']:.0f}d  Range={cy['won_min']}-{cy['won_max']}d  N={m['won_count']}")

    # Top Expanding Industries
    print("\n" + "-" * 100)
    print("TOP EXPANDING INDUSTRIES (by expansion opp count)")
    print("-" * 100)
    exp_sorted = sorted(
        [(k, v) for k, v in expansion_metrics.items() if v["expansion_opps"] > 0],
        key=lambda x: -x[1]["expansion_opps"]
    )
    for ind, e in exp_sorted[:15]:
        ttfe = e["time_to_first_expansion"]
        ttfe_str = f"{ttfe['avg_days']:.0f}d" if ttfe["avg_days"] else "N/A"
        print(f"  {ind:<45} Exp={e['expansion_opps']}  MultiRate={e['multi_opp_rate']:.1%}  TTFExp={ttfe_str}  ExpWR={e.get('expansion_win_rate', 'N/A')}")

    # Loss Analysis Summary
    print("\n" + "-" * 100)
    print("LOSS REASONS SUMMARY (top 15 reasons across all industries)")
    print("-" * 100)
    all_loss_reasons = Counter()
    for ind, m in closed_lost.items():
        for reason, count in m["loss_reasons"].items():
            all_loss_reasons[reason] += count
    for reason, count in all_loss_reasons.most_common(15):
        print(f"  {reason:<55} {count}")

    print("\n" + "-" * 100)
    print("LOST-TO COMPETITOR SUMMARY (top 15)")
    print("-" * 100)
    all_lost_to = Counter()
    for ind, m in closed_lost.items():
        for comp, count in m["lost_to_competitor"].items():
            all_lost_to[comp] += count
    for comp, count in all_lost_to.most_common(15):
        print(f"  {comp:<55} {count}")

    print()


def main():
    print("Loading account industry map...")
    account_map = load_account_industry_map()
    print(f"  Loaded {len(account_map)} accounts")

    print("Loading opportunities...")
    opps = load_opportunities(account_map)
    print(f"  Loaded {len(opps)} opportunities")

    print("Computing industry metrics...")
    industry_metrics = compute_industry_metrics(opps)
    print(f"  Computed for {len(industry_metrics)} industries")

    print("Computing expansion analysis...")
    expansion_metrics = compute_expansion_analysis(opps)

    print("Computing beachhead scores...")
    beachhead_scores = compute_beachhead_scores(industry_metrics, expansion_metrics)

    print("Computing closed-won deep dive...")
    closed_won = compute_closed_won_deep_dive(opps)

    print("Computing closed-lost deep dive...")
    closed_lost = compute_closed_lost_deep_dive(opps)

    print_summary(industry_metrics, beachhead_scores, expansion_metrics, closed_won, closed_lost)

    # Build output
    output = {
        "metadata": {
            "total_opportunities": len(opps),
            "total_accounts_in_map": len(account_map),
            "industries_count": len(industry_metrics),
            "generated_at": datetime.now().isoformat(),
            "source_files": [str(OPPS_CSV), str(ACCOUNTS_CSV)],
        },
        "beachhead_ranking": beachhead_scores,
        "industry_metrics": industry_metrics,
        "expansion_analysis": expansion_metrics,
        "closed_won_deep_dive": closed_won,
        "closed_lost_deep_dive": closed_lost,
    }

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, default=str)
    print(f"\nOutput written to {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
