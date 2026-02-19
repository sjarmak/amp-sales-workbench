# PRD: Closed-Won Deep Dive Report

## Introduction

Build an end-to-end analysis of all closed-won Code Search family opportunities across FY25 and FY26 (Feb 2024 - Jan 2026), tracing each deal from top-of-funnel entry through close. The report synthesizes SFDC opportunities, accounts, contact roles, qualified leads, Gong calls, and Salesforce notes to produce actionable intelligence for campaign strategy: who buys, how they find us, what stack they run, who champions internally, how long it takes, and what we beat to win.

**Output:** A Python analysis script (pure stdlib) that generates structured JSON **and** a rendered HTML report with tables, charts (inline SVG), and executive summary.

## Goals

- Map the complete buyer journey from first touch to closed-won for every Code Search deal in FY25+FY26
- Identify the dominant lead sources, channels, and touchpoints that produce wins
- Profile the buyer committee: economic buyers, champions, influencers by title/level and role
- Quantify sales cycle velocity by segment, deal size, product, and lead source
- Extract technology stack signals (SCMs, code hosts, languages) from notes and Gong transcripts
- Analyze competitive displacement patterns (what we beat, win rates by competitor)
- Produce a single HTML report with executive summary, data tables, and inline charts suitable for PDF export
- Output structured JSON for downstream consumption by other scripts or dashboards

## User Stories

### US-001: Core data loading and filtering
**Description:** As an analyst, I need a script that loads all six data sources and filters to closed-won Code Search opps in FY25+FY26 so that the analysis covers the correct universe of deals.

**Acceptance Criteria:**
- [ ] Loads sfdc_opportunities.csv, sfdc_account_details.csv, sfdc_contact_roles.csv, sfdc_leads_qualified.csv, salesforce_notes_product_subset.jsonl, gong_calls_portfolio.jsonl
- [ ] Reuses the existing `is_code_search_opp()` product filtering pattern from analyze-pipeline-strategy.py
- [ ] Filters to `is_won == 'true'` (or equivalent boolean) AND `close_date` within FY25 (Feb 2024 - Jan 2025) or FY26 (Feb 2025 - Jan 2026)
- [ ] Joins contact roles, leads, notes, and Gong calls to each opportunity via account_id/opp_id
- [ ] Prints summary counts: total closed-won opps, total iARR, unique accounts, FY25 vs FY26 split
- [ ] Pure stdlib Python (csv, json, re, collections, pathlib, statistics)

### US-002: Lead source and discovery channel analysis
**Description:** As a marketing strategist, I want to know how closed-won customers first heard about us and entered the funnel so I can allocate campaign budget effectively.

**Acceptance Criteria:**
- [ ] Tabulates lead_source distribution for closed-won opps (Inbound, AE Created, SDR Created, Champify, Partner, PLG, etc.)
- [ ] Breaks down first_touchpoint and first_touchpoint_date_c distribution
- [ ] Cross-references with sfdc_leads_qualified.csv to get lead_person_source_category, lead_first_touchpoint, lead_first_responded_campaign_type
- [ ] Shows PLG signal prevalence: what % of closed-won accounts had product signups/logins before sales engagement (product_first_login_private, pql_flg)
- [ ] Computes win rate by lead source (closed-won / total opps per source)
- [ ] Breaks down by FY25 vs FY26 and by deal size tier ($0-50K, $50-200K, $200K+)

### US-003: Buyer persona and committee analysis
**Description:** As a sales strategist, I want to understand who the economic buyers and champions are by title and role so I can target the right personas in campaigns and outreach.

**Acceptance Criteria:**
- [ ] Joins sfdc_contact_roles.csv to closed-won opps
- [ ] Counts and ranks opp_contact_role distribution (Economic Buyer, Champion, Influencer, User Champion, Technical Decision Maker, Procurement, Coach, etc.)
- [ ] Computes average buying committee size (unique contacts per opp) for won deals
- [ ] Cross-references contact emails with sfdc_leads_qualified.csv to get lead_title and lead_title_level (IC, Manager/Lead, Director/VP, C-Level)
- [ ] Produces persona profile: most common titles for Economic Buyer role, most common titles for Champion role
- [ ] Shows committee composition by deal size tier and opportunity type (New Business vs. Expansion vs. Renewal)

### US-004: Sales cycle velocity analysis
**Description:** As a sales leader, I want to know how long deals take to close by segment, product, and entry channel so I can forecast accurately and identify acceleration opportunities.

**Acceptance Criteria:**
- [ ] Computes median, mean, P25, P75 for days_to_close (or close_date minus created_date) for all closed-won opps
- [ ] Breaks down by: deal size tier, opportunity type (New/Expansion/Renewal), lead source, fiscal year, industry
- [ ] Shows stage-by-stage dwell time using opp_days_stage2_to_stage3 through opp_days_stage6_to_won
- [ ] Identifies bottleneck stages (longest median dwell) and acceleration patterns
- [ ] Calculates POC duration (poc_end_date minus poc_start_date) and correlation with win
- [ ] Shows technical_win_achieved rate and its impact on cycle time

### US-005: Technology stack extraction
**Description:** As a campaign strategist, I want to know what SCMs, code hosts, and languages our closed-won customers use so I can tailor messaging and target lookalike accounts.

**Acceptance Criteria:**
- [ ] Text-mines salesforce_notes_product_subset.jsonl for stack mentions: GitHub, GitLab, Bitbucket, Azure DevOps, Perforce, SVN, Gerrit, etc.
- [ ] Text-mines for language mentions: Java, Python, Go, TypeScript, JavaScript, C++, C#, Rust, Ruby, Scala, Kotlin, Swift, etc.
- [ ] Text-mines gong_calls_portfolio.jsonl (spotlight_brief, spotlight_key_points, transcript_text) for same signals
- [ ] Regex-based extraction with case-insensitive matching and word boundaries
- [ ] Produces frequency table of SCMs, code hosts, and languages across closed-won accounts
- [ ] Shows co-occurrence patterns (e.g., GitHub + Java accounts, GitLab + Python accounts)
- [ ] Flags confidence level: "mentioned" vs. "primary" based on frequency of mentions per account

### US-006: Competitive landscape for won deals
**Description:** As a competitive strategist, I want to understand who we displaced in closed-won deals, win rates by competitor, and deal characteristics where we win.

**Acceptance Criteria:**
- [ ] Uses the existing normalized competitor bucket logic (21 categories) from analyze-pipeline-strategy.py
- [ ] For closed-won opps: counts competitor mentions, shows what we beat most often
- [ ] Computes win rate per competitor: closed-won / (closed-won + closed-lost) where that competitor was mentioned
- [ ] Shows average deal size and cycle time for wins against each competitor
- [ ] Cross-tabs competitor with lead source (do competitive deals come from different channels?)
- [ ] Cross-tabs competitor with use case flags
- [ ] Filters out skip values (TBD, N/A, True-Up, Expansion, etc.) per existing pattern

### US-007: Product mix and expansion analysis
**Description:** As a product marketing manager, I want to understand which products are in closed-won bundles and what expansion patterns exist.

**Acceptance Criteria:**
- [ ] Parses products_included field to extract individual products per closed-won opp
- [ ] Shows product frequency: how often each Code Search product appears in won deals
- [ ] Shows common product bundles (top 10 product combinations)
- [ ] Identifies entry product (first opp product for accounts with multiple opps) vs. expansion products
- [ ] Cross-tabs products with deal size, industry, and use case
- [ ] Shows use case flag distribution (use_case_code_reuse_flg, use_case_security_flg, etc.) for closed-won opps

### US-008: Deal profile segmentation
**Description:** As a sales strategist, I want deals segmented into archetypes so I can build targeted playbooks.

**Acceptance Criteria:**
- [ ] Segments closed-won opps by: deal size tier, opportunity type, industry, region/geo, company size (number_of_employees or number_of_engineers)
- [ ] For each segment: median iARR, median cycle time, top lead sources, top competitors, top use cases, average committee size
- [ ] Identifies "fast wins" (< 30 days) vs. "enterprise slog" (> 180 days) with distinguishing characteristics
- [ ] Shows FY25 vs FY26 trends for each segment

### US-009: Structured JSON output
**Description:** As a downstream consumer, I need the analysis results in structured JSON for use in dashboards, presentations, and follow-on scripts.

**Acceptance Criteria:**
- [ ] Writes output to data/global/analysis_closed_won_deep_dive.json
- [ ] JSON structure mirrors report sections: summary, discovery, personas, velocity, stack, competition, products, segments
- [ ] All numeric values are raw numbers (not formatted strings) for downstream computation
- [ ] Includes metadata: run timestamp, filter criteria, record counts

### US-010: HTML report generation
**Description:** As a sales leader, I need a polished HTML report I can share with the team and convert to PDF.

**Acceptance Criteria:**
- [ ] Generates data/global/closed_won_deep_dive_report.html
- [ ] Executive summary at top with headline metrics (total deals, total iARR, avg cycle time, top lead source, top competitor beaten)
- [ ] Each analysis section rendered as formatted tables with headers and row highlights
- [ ] Inline SVG bar charts for: lead source distribution, competitor win frequency, stage dwell times, product frequency
- [ ] Clean, professional styling (no external dependencies -- inline CSS)
- [ ] Print-friendly layout suitable for PDF export via browser print
- [ ] Table of contents with anchor links to each section

## Functional Requirements

- FR-1: Script path: `scripts/analyze-closed-won-deep-dive.py`
- FR-2: All data loaded from `data/global/` directory using relative paths from script location
- FR-3: Product filtering must use identical logic to existing `is_code_search_opp()` function
- FR-4: Date range: FY25 (close_date >= 2024-02-01 AND close_date < 2025-02-01) and FY26 (close_date >= 2025-02-01 AND close_date < 2026-02-01)
- FR-5: Filter to `is_won` == true (handle both string "true"/"True" and boolean)
- FR-6: Handle missing/empty fields gracefully (empty strings, None, "N/A") without crashing
- FR-7: Currency formatting: $1.2M, $500K, $12K style using existing fmt_currency() pattern
- FR-8: Percentage formatting: one decimal place with denominator >= 5 threshold for significance
- FR-9: Stack extraction regexes must use word boundaries to avoid false positives (e.g., "Go" as language vs. "go" as verb)
- FR-10: JSON output must be valid JSON with consistent key naming (snake_case)
- FR-11: HTML output must be self-contained (inline CSS, inline SVG, no external resources)
- FR-12: Terminal output must print aligned summary tables (consistent with existing scripts)
- FR-13: Handle negative iARR values (downsells) correctly in aggregations
- FR-14: Competitor normalization must reuse the 21-bucket regex system from analyze-pipeline-strategy.py
- FR-15: Script must run in under 60 seconds on the existing data set

## Non-Goals

- No new data ingestion or BigQuery queries; uses only existing CSVs and JSONL files in data/global/
- No interactive dashboard or web application; static HTML only
- No machine learning or predictive modeling; descriptive analytics only
- No PII exposure in output (redact individual names, show only titles/roles/levels)
- No Amp or Cody-only opportunity analysis (excluded by product filter)
- No modification of source data files
- No external Python dependencies (pure stdlib)

## Technical Considerations

- **Existing patterns to reuse:** `is_code_search_opp()`, `normalize_competitor()`, `fmt_currency()`, `safe_float()`, `safe_int()`, `parse_bool()` from analyze-pipeline-strategy.py
- **Stack extraction challenge:** "Go" language requires careful disambiguation (word boundary + context); use `\bGo\b` with exclusion of common phrases like "go to", "go ahead", "let's go"
- **Contact-to-lead join:** Match via email address between sfdc_contact_roles.csv and sfdc_leads_qualified.csv to enrich contact roles with title/level
- **Gong-to-account join:** gong_calls_portfolio.jsonl may need fuzzy matching on account name or join through opportunity IDs referenced in salesforce_notes
- **Data volume:** ~986 total Code Search opps; closed-won subset will be smaller. All fits in memory.
- **HTML charts:** Use inline SVG `<rect>` elements for bar charts; no JavaScript or external charting libraries
- **FY boundary:** Sourcegraph FY starts February 1. FY25 = Feb 2024 - Jan 2025. FY26 = Feb 2025 - Jan 2026.

## Success Metrics

- Report covers 100% of closed-won Code Search opps in FY25+FY26 date range
- Every section produces non-empty results (no blank tables)
- Actionable insights for at least 3 campaign strategies (e.g., "Target Director+ DevEx leaders at GitHub-using enterprises via Inbound/PLG channels")
- Sales leadership can identify the top 3 lead sources, top 3 buyer personas, and top 3 competitive displacements from the executive summary alone
- HTML report renders cleanly in Chrome and exports to PDF without layout issues

## Open Questions

- Should the report include a "deals at risk" or "closed-lost comparison" section for contrast, or strictly closed-won only?
- Are there additional data sources (e.g., Triblio ABM scores from leads CSV) worth incorporating for the discovery analysis?
- Should company names appear in the report (for internal consumption) or be anonymized?
- Is there a preferred color palette or branding for the HTML report?
