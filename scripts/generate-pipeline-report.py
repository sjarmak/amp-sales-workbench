#!/usr/bin/env python3
"""Pipeline Strategy Marketing Report Generator.

Reads the four analysis JSON outputs and synthesizes key findings into
a presentation-ready HTML report with actionable insights for the marketing team.

Reads:
  data/global/analysis_pipeline_strategy.json
  data/global/analysis_entry_points.json
  data/global/analysis_account_stages.json
  data/global/analysis_pain_product_affinity.json

Outputs:
  data/global/pipeline_strategy_report.html
  Terminal summary of key findings
"""

import json
from datetime import datetime
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "global"

PIPELINE_PATH = DATA_DIR / "analysis_pipeline_strategy.json"
ENTRY_PATH = DATA_DIR / "analysis_entry_points.json"
STAGES_PATH = DATA_DIR / "analysis_account_stages.json"
AFFINITY_PATH = DATA_DIR / "analysis_pain_product_affinity.json"
OUTPUT_HTML = DATA_DIR / "pipeline_strategy_report.html"


def load_json(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def fmt_currency(val: float) -> str:
    if abs(val) >= 1_000_000:
        return f"${val / 1_000_000:.1f}M"
    if abs(val) >= 1_000:
        return f"${val / 1_000:.0f}K"
    return f"${val:.0f}"


def pct(num: int, denom: int) -> str:
    if denom == 0:
        return "-"
    return f"{num / denom * 100:.0f}%"


# ---------------------------------------------------------------------------
# Terminal summary
# ---------------------------------------------------------------------------

def print_terminal_summary(pipeline: dict, entry: dict, stages: dict, affinity: dict) -> None:
    print()
    print("=" * 80)
    print("  SOURCEGRAPH PIPELINE STRATEGY: KEY FINDINGS SYNTHESIS")
    print("  Code Search Family | Last 12 Months | 986 Opportunities")
    print("=" * 80)

    # --- Executive Summary ---
    summary = pipeline.get("data_summary", {})
    won = summary.get("won", 0)
    lost = summary.get("lost", 0)
    active = summary.get("open", 0)
    total = won + lost + active

    print()
    print("  EXECUTIVE SUMMARY")
    print("  -" * 20)
    print(f"  Pipeline: {total} opps | Won: {won} | Lost: {lost} | Open: {active}")

    # Win rates by source
    wr = pipeline.get("q2_pipeline_mechanics", {}).get("win_rates_by_source", {})
    print()
    print("  TOP FINDING #1: Account Planning is 12x more effective than SDR Outbound")
    ap = wr.get("Account Planning", {})
    sdr = wr.get("SDR Outbound", {})
    ae = wr.get("AE Outbound", {})
    inb = wr.get("Inbound", {})
    if ap and sdr:
        ap_closed = ap["opps"] - (ap["opps"] - ap["won"])  # won count
        sdr_total = sdr["opps"]
        print(f"    Account Planning: {ap['won']} won / {ap['opps']} opps = {pct(ap['won'], ap['opps'])} win rate")
        print(f"    AE Outbound:     {ae.get('won', 0)} won / {ae.get('opps', 0)} opps = {pct(ae.get('won', 0), ae.get('opps', 0))} win rate")
        print(f"    Inbound:         {inb.get('won', 0)} won / {inb.get('opps', 0)} opps = {pct(inb.get('won', 0), inb.get('opps', 0))} win rate")
        print(f"    SDR Outbound:    {sdr['won']} won / {sdr['opps']} opps = {pct(sdr['won'], sdr['opps'])} win rate")

    # Speed
    q5 = pipeline.get("q5_decision_moments", {})
    dtc = q5.get("stage_velocity", {}).get("opp_days_qual_to_won", {})
    print()
    print("  TOP FINDING #2: Won deals close fast -- median 13 days from qualification")
    if dtc:
        print(f"    Qualified -> Won: median {dtc.get('median', 0):.0f} days, mean {dtc.get('mean', 0):.0f} days (n={dtc.get('n', 0)})")

    # Stall
    q6 = pipeline.get("q6_acceleration_stall", {})
    stall = q6.get("stage_duration_won_vs_lost", {})
    print()
    print("  TOP FINDING #3: Lost deals spend 2-4x longer at every stage")
    for field, label in [
        ("previous_days_in_stage_2", "Qualification"),
        ("previous_days_in_stage_3", "Solution Mapping"),
        ("previous_days_in_stage_4", "Tech Validation"),
        ("previous_days_in_stage_5", "EB Sign Off"),
    ]:
        s = stall.get(field, {})
        wm = s.get("won_median", 0)
        lm = s.get("lost_median", 0)
        ratio = lm / wm if wm > 0 else 0
        print(f"    {label:<20} Won: {wm:.0f}d  Lost: {lm:.0f}d  ({ratio:.1f}x)")

    # ICP
    icp = pipeline.get("q3_icp", {})
    print()
    print("  TOP FINDING #4: Capital Markets & Internet Software dominate won iARR")
    ind = icp.get("industry_distribution", {})
    for industry, data in list(ind.items())[:5]:
        print(f"    {industry:<40} {data['count']:>3} won  {fmt_currency(data['iarr'])}")

    # Competitors
    q7 = pipeline.get("q7_competitor_landscape", {})
    comp_stats = q7.get("competitor_stats", {})
    print()
    print("  TOP FINDING #5: Near-zero win rate against AI coding tools")
    for comp in ["GitHub Copilot", "Cursor", "Claude Code", "Windsurf / Codeium", "Do Nothing / Status Quo"]:
        s = comp_stats.get(comp, {})
        if s:
            print(f"    {comp:<25} {s['opps']:>3} opps  {s['win_rate']:.0f}% win rate  {fmt_currency(s.get('lost_iarr', 0))} lost iARR")

    # Value drivers
    vd = affinity.get("value_distribution", {})
    print()
    print("  TOP FINDING #6: AI/agentic workflows is the #1 value driver (67% of accounts)")
    total_accts = affinity.get("summary", {}).get("accounts_with_signals", 1)
    for v, c in list(vd.items())[:5]:
        print(f"    {v:<30} {c:>3} accounts ({pct(c, total_accts)})")

    # Objections
    od = affinity.get("objection_distribution", {})
    print()
    print("  TOP FINDING #7: Pricing is the #1 objection (54% of accounts)")
    for o, c in list(od.items())[:5]:
        print(f"    {o:<30} {c:>3} accounts ({pct(c, total_accts)})")

    # Stage distribution
    sd = stages.get("stage_distribution", {})
    print()
    print("  ACCOUNT STAGE DISTRIBUTION (204 accounts from SF notes + Gong)")
    for stage, count in sd.items():
        bar = "#" * (count // 2)
        print(f"    {stage:<22} {count:>3}  {bar}")

    # Lost-to
    lost_to = q5.get("lost_to_competitor", {})
    print()
    print("  LOST TO COMPETITOR (explicit field)")
    for comp, count in sorted(lost_to.items(), key=lambda x: x[1], reverse=True)[:5]:
        print(f"    {comp:<25} {count:>3}")

    print()
    print("=" * 80)
    print("  STRATEGIC RECOMMENDATIONS")
    print("=" * 80)
    print()
    print("  1. DOUBLE DOWN ON ACCOUNT PLANNING")
    print("     49% win rate vs 4% SDR. Reallocate BDR effort toward warm expansion motions.")
    print()
    print("  2. SPEED KILLS (THE COMPETITION)")
    print("     Won deals close in 13 days median. If a deal stalls past 30 days at any")
    print("     stage, probability of winning drops dramatically. Build pipeline velocity")
    print("     dashboards with stage-time alerts.")
    print()
    print("  3. REPOSITION AGAINST AI CODING TOOLS")
    print("     7% win rate vs Copilot/Cursor is unsustainable. The competition field")
    print("     shows AI coding tools are displacing deals. Marketing needs battlecards")
    print("     that reframe: Sourcegraph is the context layer UNDERNEATH coding tools,")
    print("     not competing with them.")
    print()
    print("  4. LEAD WITH AI/AGENTIC + MIGRATION USE CASES")
    print("     67% of accounts mention AI/agentic workflows, 62% mention migration.")
    print("     These are the door-openers. Build campaign messaging around these themes.")
    print()
    print("  5. TARGET CAPITAL MARKETS & INTERNET SOFTWARE")
    print("     Capital Markets: $1.45M won iARR from 47 deals (highest industry).")
    print("     Internet Software: $1.04M from 36 deals. Build vertical playbooks.")
    print()
    print("  6. ADDRESS PRICING OBJECTION HEAD-ON")
    print("     54% of accounts raise pricing. Create ROI calculators, TCO comparisons,")
    print("     and consumption-based packaging talking points.")
    print()
    print("  7. FIX THE 'DO NOTHING' GAP")
    print("     40% win rate against 'Do Nothing' means the value prop lands when there's")
    print("     no incumbent. For the 60% lost to inaction, improve urgency creation --")
    print("     quantify cost of status quo.")
    print()


# ---------------------------------------------------------------------------
# HTML report
# ---------------------------------------------------------------------------

def build_html(pipeline: dict, entry: dict, stages: dict, affinity: dict) -> str:
    summary = pipeline.get("data_summary", {})
    won = summary.get("won", 0)
    lost = summary.get("lost", 0)
    active = summary.get("open", 0)
    total = won + lost + active

    wr = pipeline.get("q2_pipeline_mechanics", {}).get("win_rates_by_source", {})
    q5 = pipeline.get("q5_decision_moments", {})
    q6 = pipeline.get("q6_acceleration_stall", {})
    q7 = pipeline.get("q7_competitor_landscape", {})
    icp = pipeline.get("q3_icp", {})
    vd = affinity.get("value_distribution", {})
    od = affinity.get("objection_distribution", {})
    sd = stages.get("stage_distribution", {})
    comp_stats = q7.get("competitor_stats", {})
    comp_freq = q7.get("competitor_frequency", {})
    stall = q6.get("stage_duration_won_vs_lost", {})
    velocity = q5.get("stage_velocity", {})
    total_accts = affinity.get("summary", {}).get("accounts_with_signals", 1)

    # Build source breakdown rows
    source_rows = ""
    for src in ["Account Planning", "AE Outbound", "Inbound", "Referral", "SDR Outbound"]:
        s = wr.get(src, {})
        if s:
            w = s.get("won", 0)
            o = s.get("opps", 0)
            wr_val = f"{w / o * 100:.0f}%" if o > 0 else "-"
            source_rows += f"<tr><td>{src}</td><td class='num'>{o}</td><td class='num'>{w}</td><td class='num'>{wr_val}</td></tr>\n"

    # Industry rows
    ind = icp.get("industry_distribution", {})
    industry_rows = ""
    for industry, data in list(ind.items())[:8]:
        industry_rows += f"<tr><td>{industry}</td><td class='num'>{data['count']}</td><td class='num'>{fmt_currency(data['iarr'])}</td></tr>\n"

    # Competitor rows
    comp_rows = ""
    for comp in ["GitHub Copilot", "Cursor", "Claude Code", "Windsurf / Codeium",
                  "Do Nothing / Status Quo", "Internal Build", "GitHub Search",
                  "OpenAI Codex / ChatGPT", "Google Gemini", "GitLab"]:
        s = comp_stats.get(comp, {})
        if s:
            comp_rows += (
                f"<tr><td>{comp}</td>"
                f"<td class='num'>{s['opps']}</td>"
                f"<td class='num'>{s['won']}</td>"
                f"<td class='num'>{s['lost']}</td>"
                f"<td class='num'>{s['open']}</td>"
                f"<td class='num'>{s['win_rate']:.0f}%</td>"
                f"<td class='num'>{fmt_currency(s.get('lost_iarr', 0))}</td>"
                f"</tr>\n"
            )

    # Stage velocity rows
    stall_rows = ""
    for field, label in [
        ("previous_days_in_stage_1", "Interest"),
        ("previous_days_in_stage_2", "Qualification"),
        ("previous_days_in_stage_3", "Solution Mapping"),
        ("previous_days_in_stage_4", "Tech Validation"),
        ("previous_days_in_stage_5", "EB Sign Off"),
    ]:
        s = stall.get(field, {})
        wm = s.get("won_median", 0)
        lm = s.get("lost_median", 0)
        ratio = f"{lm / wm:.1f}x" if wm > 0 else "-"
        stall_rows += f"<tr><td>{label}</td><td class='num'>{wm:.0f}d</td><td class='num'>{lm:.0f}d</td><td class='num'>{ratio}</td></tr>\n"

    # Value driver rows
    vd_rows = ""
    for v, c in vd.items():
        p = f"{c / total_accts * 100:.0f}%"
        bar_w = int(c / total_accts * 200)
        vd_rows += f"<tr><td>{v}</td><td class='num'>{c}</td><td class='num'>{p}</td><td><div class='bar' style='width:{bar_w}px'></div></td></tr>\n"

    # Objection rows
    od_rows = ""
    for o, c in od.items():
        p = f"{c / total_accts * 100:.0f}%"
        bar_w = int(c / total_accts * 200)
        od_rows += f"<tr><td>{o}</td><td class='num'>{c}</td><td class='num'>{p}</td><td><div class='bar bar-red' style='width:{bar_w}px'></div></td></tr>\n"

    # Stage distribution rows
    stage_rows = ""
    total_stage_accts = sum(sd.values())
    for stage, count in sd.items():
        p = f"{count / total_stage_accts * 100:.0f}%" if total_stage_accts > 0 else "-"
        bar_w = int(count / max(sd.values(), default=1) * 150)
        stage_rows += f"<tr><td>{stage}</td><td class='num'>{count}</td><td class='num'>{p}</td><td><div class='bar bar-blue' style='width:{bar_w}px'></div></td></tr>\n"

    # Product by stage
    pbs = stages.get("product_by_stage", {})
    product_stage_rows = ""
    for stage_name in ["Discovery", "Demo", "POC/Trial", "Procurement", "Active Customer", "Renewal/Expansion"]:
        counts = pbs.get(stage_name, {})
        cs = counts.get("Code Search", 0)
        bc = counts.get("Batch Changes", 0)
        ds = counts.get("Deep Search", 0)
        mcp = counts.get("MCP", 0)
        product_stage_rows += f"<tr><td>{stage_name}</td><td class='num'>{cs}</td><td class='num'>{bc}</td><td class='num'>{ds}</td><td class='num'>{mcp}</td></tr>\n"

    # Opp type breakdown
    ot = pipeline.get("q2_pipeline_mechanics", {}).get("opportunity_type", {})
    opp_type_rows = ""
    for otype, count in ot.items():
        opp_type_rows += f"<tr><td>{otype}</td><td class='num'>{count}</td><td class='num'>{pct(count, total)}</td></tr>\n"

    # Engineer band rows
    eng = icp.get("engineer_bands", {})
    eng_rows = ""
    for band in ["<100", "100-500", "500-2000", "2000-10000", "10000+"]:
        c = eng.get(band, 0)
        eng_rows += f"<tr><td>{band}</td><td class='num'>{c}</td></tr>\n"

    # Co-occurrence
    cooc = q7.get("co_occurrence", {})
    cooc_rows = ""
    for pair, count in list(cooc.items())[:10]:
        cooc_rows += f"<tr><td>{pair}</td><td class='num'>{count}</td></tr>\n"

    # Lost-to competitor
    lost_to = q5.get("lost_to_competitor", {})
    lost_to_rows = ""
    for comp, count in sorted(lost_to.items(), key=lambda x: x[1], reverse=True):
        lost_to_rows += f"<tr><td>{comp}</td><td class='num'>{count}</td></tr>\n"

    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sourcegraph Pipeline Strategy Report</title>
<style>
  :root {{
    --sg-purple: #A112FF;
    --sg-dark: #1E1B2E;
    --sg-gray: #343A46;
    --sg-light: #F5F5F7;
    --sg-green: #00B265;
    --sg-red: #FF5543;
    --sg-orange: #FF8800;
    --sg-blue: #00CBEC;
  }}
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #fff;
    color: #1a1a2e;
    line-height: 1.5;
    max-width: 1100px;
    margin: 0 auto;
    padding: 40px 24px;
  }}
  h1 {{
    font-size: 28px;
    font-weight: 700;
    color: var(--sg-dark);
    margin-bottom: 4px;
  }}
  .subtitle {{
    font-size: 15px;
    color: #666;
    margin-bottom: 32px;
  }}
  h2 {{
    font-size: 20px;
    font-weight: 600;
    color: var(--sg-dark);
    margin-top: 40px;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 2px solid var(--sg-purple);
  }}
  h3 {{
    font-size: 16px;
    font-weight: 600;
    color: #444;
    margin-top: 24px;
    margin-bottom: 8px;
  }}
  .kpi-grid {{
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
    margin-bottom: 32px;
  }}
  .kpi {{
    background: var(--sg-light);
    border-radius: 8px;
    padding: 20px;
    text-align: center;
  }}
  .kpi .value {{
    font-size: 32px;
    font-weight: 700;
    color: var(--sg-dark);
  }}
  .kpi .label {{
    font-size: 13px;
    color: #666;
    margin-top: 4px;
  }}
  .kpi.highlight {{
    background: var(--sg-purple);
  }}
  .kpi.highlight .value,
  .kpi.highlight .label {{
    color: #fff;
  }}
  .kpi.warn {{
    background: #FFF3E0;
  }}
  .kpi.warn .value {{
    color: var(--sg-orange);
  }}
  .insight-box {{
    background: #F3E8FF;
    border-left: 4px solid var(--sg-purple);
    border-radius: 0 8px 8px 0;
    padding: 16px 20px;
    margin: 16px 0 24px;
    font-size: 14px;
  }}
  .insight-box strong {{
    display: block;
    margin-bottom: 4px;
    color: var(--sg-dark);
  }}
  .danger-box {{
    background: #FFEBEE;
    border-left: 4px solid var(--sg-red);
    border-radius: 0 8px 8px 0;
    padding: 16px 20px;
    margin: 16px 0 24px;
    font-size: 14px;
  }}
  .danger-box strong {{
    display: block;
    margin-bottom: 4px;
    color: #C62828;
  }}
  .success-box {{
    background: #E8F5E9;
    border-left: 4px solid var(--sg-green);
    border-radius: 0 8px 8px 0;
    padding: 16px 20px;
    margin: 16px 0 24px;
    font-size: 14px;
  }}
  .success-box strong {{
    display: block;
    margin-bottom: 4px;
    color: #2E7D32;
  }}
  table {{
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0 20px;
    font-size: 14px;
  }}
  th {{
    text-align: left;
    font-weight: 600;
    padding: 8px 12px;
    background: var(--sg-light);
    border-bottom: 2px solid #ddd;
    font-size: 13px;
    color: #555;
  }}
  td {{
    padding: 6px 12px;
    border-bottom: 1px solid #eee;
  }}
  td.num {{
    text-align: right;
    font-variant-numeric: tabular-nums;
  }}
  tr:hover {{
    background: #fafafa;
  }}
  .bar {{
    height: 14px;
    background: var(--sg-purple);
    border-radius: 3px;
    min-width: 2px;
  }}
  .bar-red {{
    background: var(--sg-red);
  }}
  .bar-blue {{
    background: var(--sg-blue);
  }}
  .two-col {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }}
  @media (max-width: 768px) {{
    .two-col {{ grid-template-columns: 1fr; }}
  }}
  .rec {{
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 16px 20px;
    margin: 8px 0;
  }}
  .rec-num {{
    display: inline-block;
    width: 28px;
    height: 28px;
    line-height: 28px;
    text-align: center;
    background: var(--sg-purple);
    color: #fff;
    border-radius: 50%;
    font-weight: 700;
    font-size: 14px;
    margin-right: 8px;
  }}
  .rec-title {{
    font-weight: 600;
    font-size: 15px;
    display: inline;
  }}
  .rec p {{
    margin-top: 8px;
    font-size: 14px;
    color: #444;
  }}
  .footer {{
    margin-top: 48px;
    padding-top: 16px;
    border-top: 1px solid #ddd;
    font-size: 12px;
    color: #999;
  }}
</style>
</head>
<body>

<h1>Sourcegraph Pipeline Strategy Report</h1>
<p class="subtitle">Code Search Family &middot; Last 12 Months &middot; Generated {now}</p>

<!-- KPI Grid -->
<div class="kpi-grid">
  <div class="kpi highlight">
    <div class="value">{total}</div>
    <div class="label">Total Opportunities</div>
  </div>
  <div class="kpi">
    <div class="value">{won}</div>
    <div class="label">Won</div>
  </div>
  <div class="kpi">
    <div class="value">{lost}</div>
    <div class="label">Lost</div>
  </div>
  <div class="kpi">
    <div class="value">{active}</div>
    <div class="label">Open</div>
  </div>
  <div class="kpi warn">
    <div class="value">13d</div>
    <div class="label">Median Days to Close (Won)</div>
  </div>
</div>

<!-- Q1 + Q2: Discovery & Pipeline Mechanics -->
<h2>1. How Buyers Find Us &amp; Pipeline Mechanics</h2>

<div class="success-box">
  <strong>Key Insight: Account Planning dominates win rates</strong>
  Account Planning delivers 49% win rate vs 4% for SDR Outbound. AE Outbound runs at 32%.
  Inbound volume is high (390 opps) but converts at just 10%.
</div>

<div class="two-col">
  <div>
    <h3>Win Rate by Source</h3>
    <table>
      <tr><th>Source</th><th>Opps</th><th>Won</th><th>Win Rate</th></tr>
      {source_rows}
    </table>
  </div>
  <div>
    <h3>Pipeline by Opportunity Type</h3>
    <table>
      <tr><th>Type</th><th>Count</th><th>% of Total</th></tr>
      {opp_type_rows}
    </table>
  </div>
</div>

<!-- Q3: ICP -->
<h2>2. Ideal Customer Profile</h2>

<div class="insight-box">
  <strong>Key Insight: Capital Markets is the #1 vertical</strong>
  $1.45M won iARR from 47 deals. Internet Software & Services follows at $1.04M.
  Strategic accounts (98) and SMB (62) are the largest segments. Sweet spot: 500-2000 engineers.
</div>

<div class="two-col">
  <div>
    <h3>Top Industries (Won iARR)</h3>
    <table>
      <tr><th>Industry</th><th>Won Opps</th><th>Won iARR</th></tr>
      {industry_rows}
    </table>
  </div>
  <div>
    <h3>Engineer Count Bands (Won Opps)</h3>
    <table>
      <tr><th>Band</th><th>Won Opps</th></tr>
      {eng_rows}
    </table>
  </div>
</div>

<!-- Q4: Pain / Entry Points -->
<h2>3. Value Drivers &amp; Objections</h2>

<div class="insight-box">
  <strong>Key Insight: AI/agentic workflows is the top door-opener</strong>
  67% of accounts mention AI/agentic workflows as a value driver. Migration/modernization (62%)
  and onboarding (56%) follow closely. These three themes should anchor campaign messaging.
</div>

<div class="two-col">
  <div>
    <h3>Value Drivers (% of 165 accounts)</h3>
    <table>
      <tr><th>Value Driver</th><th>N</th><th>%</th><th></th></tr>
      {vd_rows}
    </table>
  </div>
  <div>
    <h3>Objections (% of 165 accounts)</h3>
    <table>
      <tr><th>Objection</th><th>N</th><th>%</th><th></th></tr>
      {od_rows}
    </table>
  </div>
</div>

<!-- Q5: Decision Moments -->
<h2>4. Decision Velocity &amp; Stall Points</h2>

<div class="danger-box">
  <strong>Warning: Lost deals spend 2-4x longer at every stage</strong>
  Won deals move through Qualification in 8 days median; lost deals take 17. At Tech Validation,
  won deals spend 11 days vs 30 for lost deals (2.9x). If a deal stalls past 2x the won median
  at any stage, it is at severe risk.
</div>

<div class="two-col">
  <div>
    <h3>Stage Duration: Won vs Lost (Median Days)</h3>
    <table>
      <tr><th>Stage</th><th>Won</th><th>Lost</th><th>Ratio</th></tr>
      {stall_rows}
    </table>
  </div>
  <div>
    <h3>Account Stage Distribution (204 accounts)</h3>
    <table>
      <tr><th>Stage</th><th>N</th><th>%</th><th></th></tr>
      {stage_rows}
    </table>
  </div>
</div>

<!-- Product by stage -->
<h3>Product Mentions by Pipeline Stage</h3>
<table>
  <tr><th>Stage</th><th>Code Search</th><th>Batch Changes</th><th>Deep Search</th><th>MCP</th></tr>
  {product_stage_rows}
</table>

<!-- Q7: Competitor Landscape -->
<h2>5. Competitive Landscape</h2>

<div class="danger-box">
  <strong>Critical: 7% win rate against AI coding tools</strong>
  GitHub Copilot (82 opps, 7% win), Cursor (77 opps, 8% win), and Claude Code (37 opps, 0% win)
  dominate the competitive field. Cursor is the #1 "lost to" competitor (17 deals). Only against
  "Do Nothing / Status Quo" does Sourcegraph win at 40%.
</div>

<h3>Win Rate by Competitor</h3>
<table>
  <tr><th>Competitor</th><th>Opps</th><th>Won</th><th>Lost</th><th>Open</th><th>Win%</th><th>Lost iARR</th></tr>
  {comp_rows}
</table>

<div class="two-col">
  <div>
    <h3>Lost To (Explicit Field)</h3>
    <table>
      <tr><th>Competitor</th><th>Count</th></tr>
      {lost_to_rows}
    </table>
  </div>
  <div>
    <h3>Competitor Co-occurrence</h3>
    <table>
      <tr><th>Pair</th><th>Opps</th></tr>
      {cooc_rows}
    </table>
  </div>
</div>

<!-- Recommendations -->
<h2>6. Strategic Recommendations</h2>

<div class="rec">
  <span class="rec-num">1</span>
  <div class="rec-title">Double Down on Account Planning</div>
  <p>49% win rate vs 4% SDR Outbound. Reallocate BDR capacity toward warm expansion
  and account-based motions. Every incremental Account Planning opp is worth ~12 SDR opps.</p>
</div>

<div class="rec">
  <span class="rec-num">2</span>
  <div class="rec-title">Build Pipeline Velocity Dashboards</div>
  <p>Won deals close in 13 days median. Create stage-time alerts: if any deal exceeds
  2x the won-deal median at its current stage, trigger an intervention (manager review,
  executive sponsor engagement, or commercial offer acceleration).</p>
</div>

<div class="rec">
  <span class="rec-num">3</span>
  <div class="rec-title">Reposition Against AI Coding Tools</div>
  <p>7% win rate vs Copilot/Cursor is existential. Stop competing as an "AI coding assistant."
  Reframe Sourcegraph as the <strong>context infrastructure layer</strong> that makes ALL coding tools
  better -- the MCP server, the enterprise search backbone, the batch change engine. Create
  battlecards focused on "and" positioning, not "or."</p>
</div>

<div class="rec">
  <span class="rec-num">4</span>
  <div class="rec-title">Lead Campaigns with AI/Agentic + Migration</div>
  <p>67% of accounts mention AI/agentic workflows; 62% mention migration/modernization.
  Build demand gen around these themes: "Context for your AI agents" and "Migrate at scale."
  These resonate across every segment.</p>
</div>

<div class="rec">
  <span class="rec-num">5</span>
  <div class="rec-title">Build Vertical Playbooks for Capital Markets</div>
  <p>$1.45M won iARR from Capital Markets (47 deals). Create industry-specific collateral,
  case studies, and event strategies. Semiconductor ($600K) and Banks ($414K) are the next
  wave to target.</p>
</div>

<div class="rec">
  <span class="rec-num">6</span>
  <div class="rec-title">Address Pricing Objection Proactively</div>
  <p>54% of accounts raise pricing as an objection. Create ROI calculators showing
  developer time savings, TCO comparisons against DIY/internal builds, and flexible
  packaging options to defuse early-stage pricing friction.</p>
</div>

<div class="rec">
  <span class="rec-num">7</span>
  <div class="rec-title">Exploit the "Do Nothing" Window</div>
  <p>40% win rate against "Do Nothing" -- highest of any competitive scenario. Prioritize
  accounts where no AI coding tool is entrenched. For the 60% lost to inaction, create
  urgency with "cost of status quo" frameworks and developer productivity benchmarks.</p>
</div>

<div class="footer">
  <p>Data sources: SFDC Opportunities (986 filtered), Account Details (278), Qualified Leads (17.7K),
  Contact Roles (6.1K), Salesforce Notes (244 records, ~120 accounts), Gong Calls (1,168 records).
  Scope: Code Search product family + Enterprise AI, last 12 months. Excludes Amp/Cody-only opportunities.</p>
  <p>Generated: {now} | Source: sg-sales-workbench analysis pipeline</p>
</div>

</body>
</html>"""
    return html


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print("Loading analysis outputs...")
    pipeline = load_json(PIPELINE_PATH)
    entry = load_json(ENTRY_PATH)
    stages = load_json(STAGES_PATH)
    affinity = load_json(AFFINITY_PATH)
    print("  All four datasets loaded.")

    # Terminal summary
    print_terminal_summary(pipeline, entry, stages, affinity)

    # HTML report
    html = build_html(pipeline, entry, stages, affinity)
    with open(OUTPUT_HTML, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"\nHTML report written to: {OUTPUT_HTML}")
    print("  Open in a browser to view the formatted report.")


if __name__ == "__main__":
    main()
