import streamlit as st
import os
import json
import yaml
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, List

st.set_page_config(page_title="Amp Sales Workbench", layout="wide")

# Modern styling
st.markdown("""
<style>
    .stExpander {
        background-color: #f8f9fa;
        border-radius: 8px;
        border: 1px solid #e1e4e8;
    }
    
    .stButton button {
        border-radius: 6px;
        font-weight: 500;
    }
    
    [data-testid="stMetricValue"] {
        font-size: 1.5rem;
        font-weight: 600;
    }
    
    .block-container {
        padding-top: 2rem;
    }
    
    h1, h2, h3 {
        font-weight: 600;
    }
</style>
""", unsafe_allow_html=True)

DATA_DIR = Path("data/accounts")
ORCHESTRATOR_CMD = ["npx", "tsx", "src/execute-agent.ts"]


def get_accounts() -> List[str]:
    """Get list of account slugs from data directory."""
    if not DATA_DIR.exists():
        return []
    return sorted([d.name for d in DATA_DIR.iterdir() if d.is_dir()])


def detect_capabilities(account_slug: str) -> Dict[str, bool]:
    """Detect which MCP integrations have data for this account."""
    raw_dir = DATA_DIR / account_slug / "raw"
    if not raw_dir.exists():
        return {"gong": False, "salesforce": False, "notion": False}
    
    return {
        "gong": (raw_dir / "gong_calls.json").exists(),
        "salesforce": (raw_dir / "salesforce.json").exists(),
        "notion": (raw_dir / "notion_pages.json").exists()
    }


def load_json_file(file_path: Path) -> Optional[Dict]:
    """Load a JSON file if it exists."""
    if not file_path.exists():
        return None
    try:
        with open(file_path) as f:
            return json.load(f)
    except Exception as e:
        st.error(f"Error loading {file_path}: {e}")
        return None


def load_yaml_file(file_path: Path) -> Optional[Dict]:
    """Load a YAML file if it exists."""
    if not file_path.exists():
        return None
    try:
        with open(file_path) as f:
            return yaml.safe_load(f)
    except Exception as e:
        st.error(f"Error loading {file_path}: {e}")
        return None


def load_markdown_file(file_path: Path) -> Optional[str]:
    """Load a markdown file if it exists."""
    if not file_path.exists():
        return None
    try:
        with open(file_path) as f:
            return f.read()
    except Exception as e:
        st.error(f"Error loading {file_path}: {e}")
        return None


def load_latest_file(directory: Path, pattern: str, loader_func):
    """Load the most recent file matching pattern from directory."""
    if not directory.exists():
        return None
    
    files = sorted(directory.glob(pattern), reverse=True)
    if not files:
        return None
    
    return loader_func(files[0])


def load_all_files(directory: Path, pattern: str, loader_func) -> List:
    """Load all files matching pattern from directory."""
    if not directory.exists():
        return []
    
    results = []
    for file_path in sorted(directory.glob(pattern), reverse=True):
        data = loader_func(file_path)
        if data:
            results.append(data)
    return results


def load_latest_snapshot(account_slug: str) -> Optional[Dict]:
    """Load the most recent consolidated snapshot."""
    snapshots_dir = DATA_DIR / account_slug / "snapshots"
    return load_latest_file(snapshots_dir, "snapshot-*.json", load_json_file)


def load_latest_draft(account_slug: str) -> Optional[Dict]:
    """Load the most recent CRM draft."""
    drafts_dir = DATA_DIR / account_slug / "drafts"
    return load_latest_file(drafts_dir, "crm-draft-*.yaml", load_yaml_file)


def load_latest_applied(account_slug: str) -> Optional[Dict]:
    """Load the most recent applied changes receipt."""
    applied_dir = DATA_DIR / account_slug / "applied"
    return load_latest_file(applied_dir, "apply-*.json", load_json_file)


def load_gong_calls(account_slug: str) -> List[Dict]:
    """Load Gong calls from raw data."""
    gong_file = DATA_DIR / account_slug / "raw" / "gong_calls.json"
    data = load_json_file(gong_file)
    return data.get("calls", []) if data else []


def load_latest_precall_brief(account_slug: str) -> Optional[Dict]:
    """Load the most recent pre-call brief."""
    briefs_dir = DATA_DIR / account_slug / "briefs"
    return load_latest_file(briefs_dir, "precall-*.json", load_json_file)


def load_postcall_summaries(account_slug: str) -> List[Dict]:
    """Load all post-call summaries."""
    postcall_dir = DATA_DIR / account_slug / "postcall"
    return load_all_files(postcall_dir, "postcall-*.json", load_json_file)


def load_email_drafts(account_slug: str) -> List[Dict]:
    """Load all email drafts."""
    emails_dir = DATA_DIR / account_slug / "emails"
    return load_all_files(emails_dir, "email-*.json", load_json_file)


def load_coaching_feedback(account_slug: str) -> List[Dict]:
    """Load all coaching feedback."""
    coaching_dir = DATA_DIR / account_slug / "coaching"
    return load_all_files(coaching_dir, "coaching-*.json", load_json_file)


def load_demo_ideas(account_slug: str) -> Optional[Dict]:
    """Load demo/trial ideas."""
    demos_dir = DATA_DIR / account_slug / "demos"
    return load_latest_file(demos_dir, "demo-ideas-*.json", load_json_file)


def load_qualification_scorecard(account_slug: str) -> Optional[Dict]:
    """Load qualification scorecard."""
    qual_dir = DATA_DIR / account_slug / "qualification"
    return load_latest_file(qual_dir, "meddic-*.json", load_json_file)


def load_executive_summary(account_slug: str) -> Optional[Dict]:
    """Load executive summary."""
    summaries_dir = DATA_DIR / account_slug / "summaries"
    return load_latest_file(summaries_dir, "exec-summary-*.json", load_json_file)


def load_deal_review(account_slug: str) -> Optional[Dict]:
    """Load latest deal review."""
    reviews_dir = DATA_DIR / account_slug / "reviews"
    return load_latest_file(reviews_dir, "deal-review-*.json", load_json_file)


def load_handoff_doc(account_slug: str) -> Optional[str]:
    """Load handoff document."""
    handoffs_dir = DATA_DIR / account_slug / "handoffs"
    return load_latest_file(handoffs_dir, "handoff-*.md", load_markdown_file)


def load_closed_lost_analysis(account_slug: str) -> Optional[Dict]:
    """Load closed-lost analysis."""
    closedlost_dir = DATA_DIR / account_slug / "closedlost"
    return load_latest_file(closedlost_dir, "closedlost-*.json", load_json_file)


def load_backfill_proposals(account_slug: str) -> List[Dict]:
    """Load AI backfill proposals."""
    backfill_dir = DATA_DIR / account_slug / "backfill"
    return load_all_files(backfill_dir, "backfill-*.json", load_json_file)


def run_agent(cmd: List[str], spinner_msg: str) -> Dict[str, any]:
    """Run an agent script and return results."""
    with st.spinner(spinner_msg):
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        return {
            "success": result.returncode == 0,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode
        }


def display_confidence_badge(confidence: str):
    """Display a styled confidence badge."""
    if confidence == "high":
        st.success(confidence.upper())
    elif confidence == "medium":
        st.warning(confidence.upper())
    else:
        st.error(confidence.upper())


st.title("Amp Sales Workbench")

accounts = get_accounts()

with st.sidebar:
    st.header("Account")
    
    if not accounts:
        st.warning("No accounts found in data/accounts/")
        selected_account = None
    else:
        selected_account = st.selectbox(
            "Select Account",
            options=accounts,
            format_func=lambda x: x.replace("-", " ").title()
        )
    
    if selected_account:
        st.markdown("---")
        st.subheader("Capabilities")
        
        caps = detect_capabilities(selected_account)
        
        status_active = '<span class="status-indicator status-active"></span>'
        status_inactive = '<span class="status-indicator status-inactive"></span>'
        
        st.markdown(f"{status_active if caps['salesforce'] else status_inactive} Salesforce", unsafe_allow_html=True)
        st.markdown(f"{status_active if caps['gong'] else status_inactive} Gong", unsafe_allow_html=True)
        st.markdown(f"{status_active if caps['notion'] else status_inactive} Notion", unsafe_allow_html=True)
        
        st.markdown("---")
        st.caption(f"Data: `data/accounts/{selected_account}/`")
        
        if st.button("Refresh Data", use_container_width=True):
            st.rerun()

if not selected_account:
    st.info("Select an account from the sidebar to get started")
    st.stop()

account_name = selected_account.replace("-", " ").title()

tab1, tab2, tab3, tab4, tab5 = st.tabs([
    "Quick Actions",
    "Prep",
    "After Call",
    "CRM Updates",
    "Insights"
])

with tab1:
    st.header("Quick Actions")
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.subheader("Pre-Call")
        
        if st.button("Pre-Call Brief", use_container_width=True, type="primary"):
            result = run_agent(
                ["npx", "tsx", "scripts/test-precall-brief.ts", account_name],
                f"Generating pre-call brief..."
            )
            if result["success"]:
                st.success("Brief generated")
                st.rerun()
            else:
                st.error(f"Error: {result['stderr'][:200]}")
        
        if st.button("Demo Ideas", use_container_width=True):
            result = run_agent(
                ["npx", "tsx", "scripts/test-demo-ideas.ts", account_name],
                "Generating demo ideas..."
            )
            if result["success"]:
                st.success("Demo ideas generated")
                st.rerun()
            else:
                st.error(f"Error: {result['stderr'][:200]}")
        
        if st.button("Qualification", use_container_width=True):
            result = run_agent(
                ["npx", "tsx", "scripts/test-qualification.ts", account_name],
                "Running MEDDIC qualification..."
            )
            if result["success"]:
                st.success("Scorecard generated")
                st.rerun()
            else:
                st.error(f"Error: {result['stderr'][:200]}")
    
    with col2:
        st.subheader("Post-Call")
        
        if st.button("Post-Call Update", use_container_width=True, type="primary"):
            result = run_agent(
                ["npx", "tsx", "scripts/test-postcall.ts", account_name],
                "Processing latest call..."
            )
            if result["success"]:
                st.success("Post-call update generated")
                st.rerun()
            else:
                st.error(f"Error: {result['stderr'][:200]}")
        
        if st.button("Follow-Up Email", use_container_width=True):
            result = run_agent(
                ["npx", "tsx", "scripts/test-email.ts", account_name],
                "Drafting follow-up email..."
            )
            if result["success"]:
                st.success("Email drafted")
                st.rerun()
            else:
                st.error(f"Error: {result['stderr'][:200]}")
        
        if st.button("Coaching", use_container_width=True):
            result = run_agent(
                ["npx", "tsx", "scripts/test-coaching.ts", account_name],
                "Generating coaching feedback..."
            )
            if result["success"]:
                st.success("Coaching generated")
                st.rerun()
            else:
                st.error(f"Error: {result['stderr'][:200]}")
    
    with col3:
        st.subheader("Analysis")
        
        if st.button("Exec Summary", use_container_width=True):
            result = run_agent(
                ["npx", "tsx", "scripts/test-exec-summary.ts", account_name],
                "Generating executive summary..."
            )
            if result["success"]:
                st.success("Summary generated")
                st.rerun()
            else:
                st.error(f"Error: {result['stderr'][:200]}")
        
        if st.button("Deal Review", use_container_width=True):
            result = run_agent(
                ["npx", "tsx", "scripts/test-deal-review.ts", account_name],
                "Running deal review..."
            )
            if result["success"]:
                st.success("Review complete")
                st.rerun()
            else:
                st.error(f"Error: {result['stderr'][:200]}")
        
        if st.button("Closed-Lost", use_container_width=True):
            result = run_agent(
                ["npx", "tsx", "scripts/test-closedlost.ts", account_name],
                "Analyzing closed-lost..."
            )
            if result["success"]:
                st.success("Analysis complete")
                st.rerun()
            else:
                st.error(f"Error: {result['stderr'][:200]}")
    
    with col4:
        st.subheader("CRM")
        
        if st.button("AI Backfill", use_container_width=True):
            result = run_agent(
                ["npx", "tsx", "scripts/test-backfill.ts", account_name],
                "Running AI backfill..."
            )
            if result["success"]:
                st.success("Backfill complete")
                st.rerun()
            else:
                st.error(f"Error: {result['stderr'][:200]}")
        
        if st.button("Handoff Doc", use_container_width=True):
            result = run_agent(
                ["npx", "tsx", "scripts/test-handoff.ts", account_name],
                "Creating handoff doc..."
            )
            if result["success"]:
                st.success("Handoff created")
                st.rerun()
            else:
                st.error(f"Error: {result['stderr'][:200]}")
        
        if st.button("Full Refresh", use_container_width=True, type="primary"):
            result = run_agent(
                ORCHESTRATOR_CMD + [account_name],
                f"Running full refresh..."
            )
            if result["success"]:
                st.success("Refresh complete")
                st.rerun()
            else:
                st.error(f"Error: {result['stderr'][:200]}")

with tab2:
    st.header("Pre-Call Prep")
    
    col1, col2 = st.columns([2, 1])
    
    with col1:
        st.subheader("Pre-Call Brief")
        brief = load_latest_precall_brief(selected_account)
        
        if brief:
            col_a, col_b, col_c = st.columns(3)
            with col_a:
                st.metric("Generated", datetime.fromisoformat(brief["generatedAt"].replace("Z", "+00:00")).strftime("%Y-%m-%d %H:%M"))
            with col_b:
                st.metric("Account", brief.get("accountName", "N/A"))
            with col_c:
                if brief.get("meetingDate"):
                    st.metric("Meeting", brief["meetingDate"])
            
            if brief.get("sections", {}).get("whosWho"):
                with st.expander("Who's Who", expanded=True):
                    for person in brief["sections"]["whosWho"]:
                        st.markdown(f"**{person['name']}** - {person.get('title', 'N/A')}")
                        if person.get("background"):
                            st.write(person["background"])
                        if person.get("recentActivity"):
                            st.caption(f"Recent: {person['recentActivity']}")
                        st.markdown("---")
            
            if brief.get("sections", {}).get("predictedAgenda"):
                with st.expander("Predicted Agenda", expanded=True):
                    for item in brief["sections"]["predictedAgenda"]:
                        if isinstance(item, dict):
                            st.markdown(f"**{item['topic']}**")
                            st.write(item["details"])
                        else:
                            st.markdown(f"- {item}")
            
            if brief.get("sections", {}).get("demoFocusAreas"):
                with st.expander("Demo Focus", expanded=False):
                    for area in brief["sections"]["demoFocusAreas"]:
                        st.markdown(f"**{area['feature']}**")
                        st.write(area.get("reason") or area.get("why", ""))
                        if area.get("painPoints"):
                            for point in area["painPoints"]:
                                st.markdown(f"- {point}")
                        elif area.get("talkingPoints"):
                            for point in area["talkingPoints"]:
                                st.markdown(f"- {point}")
        else:
            st.info("No pre-call brief available.")
    
    with col2:
        st.subheader("Demo/Trial Ideas")
        demos = load_demo_ideas(selected_account)
        
        if demos:
            for idea in demos.get("ideas", [])[:5]:
                with st.expander(idea.get("title", "Idea"), expanded=False):
                    st.write(idea.get("description", ""))
                    if idea.get("confidence"):
                        display_confidence_badge(idea["confidence"])
        else:
            st.info("No demo ideas yet.")
        
        st.markdown("---")
        st.subheader("Qualification")
        scorecard = load_qualification_scorecard(selected_account)
        
        if scorecard:
            meddic = scorecard.get("meddic", {})
            for key, data in meddic.items():
                score = data.get("score", 0)
                status = data.get("status", "unknown")
                
                color = "normal"
                if status == "strong":
                    color = "normal"
                elif status == "weak":
                    color = "inverse"
                
                st.metric(key.upper(), f"{score}/10", delta=status)
            
            gaps = scorecard.get("gaps", [])
            if gaps:
                with st.expander("Gaps", expanded=False):
                    for gap in gaps:
                        st.markdown(f"- {gap}")
        else:
            st.info("No scorecard yet.")

with tab3:
    st.header("After Call Actions")
    
    col1, col2 = st.columns([1, 2])
    
    with col1:
        st.subheader("Recent Calls")
        
        calls = load_gong_calls(selected_account)
        
        if calls:
            for call in calls[:10]:
                call_id = call.get("id", "unknown")
                title = call.get("title", "Untitled Call")
                date = call.get("scheduled", "Unknown")
                
                with st.container():
                    st.markdown(f"**{title}**")
                    st.caption(f"{date}")
                    
                    if st.button("Process", key=f"process_{call_id}", use_container_width=True):
                        result = run_agent(
                            ["npx", "tsx", "scripts/test-postcall.ts", account_name, call_id],
                            f"Processing call..."
                        )
                        if result["success"]:
                            st.success("Processed")
                            st.rerun()
                        else:
                            st.error(f"Error: {result['stderr'][:100]}")
                    
                    st.markdown("---")
        else:
            st.info("No Gong calls found")
    
    with col2:
        st.subheader("Post-Call Summaries")
        
        summaries = load_postcall_summaries(selected_account)
        
        if summaries:
            for summary in summaries[:5]:
                call_title = summary.get("callMetadata", {}).get("title", "Unknown Call")
                with st.expander(f"{call_title}", expanded=False):
                    metadata = summary.get("callMetadata", {})
                    analysis = summary.get("analysis", {})
                    
                    col_a, col_b, col_c = st.columns(3)
                    with col_a:
                        st.metric("Date", metadata.get("date", "N/A"))
                    with col_b:
                        st.metric("Participants", len(metadata.get("participants", [])))
                    with col_c:
                        sentiment = analysis.get("stakeholderSentiment", {}).get("overall", "N/A")
                        st.metric("Sentiment", sentiment)
                    
                    if analysis.get("keyTakeaways"):
                        st.markdown("**Key Takeaways**")
                        for takeaway in analysis["keyTakeaways"]:
                            st.markdown(f"- {takeaway}")
                    
                    if analysis.get("nextSteps"):
                        st.markdown("**Next Steps**")
                        for step in analysis["nextSteps"]:
                            st.markdown(f"- {step}")
        else:
            st.info("No post-call summaries yet.")
        
        st.markdown("---")
        st.subheader("Follow-Up Emails")
        
        emails = load_email_drafts(selected_account)
        
        if emails:
            for email in emails[:3]:
                with st.expander(f"Email - {email.get('subject', 'No subject')}", expanded=False):
                    st.text_area("Draft", value=email.get("body", ""), height=200, key=f"email_{email.get('id')}")
                    if st.button("Copy", key=f"copy_email_{email.get('id')}"):
                        st.info("Use Ctrl+C to copy")
        else:
            st.info("No email drafts yet.")
        
        st.markdown("---")
        
        coaching = load_coaching_feedback(selected_account)
        
        if coaching:
            with st.expander("Coaching Feedback", expanded=False):
                for feedback in coaching[:3]:
                    st.markdown(f"**Call:** {feedback.get('callTitle', 'Unknown')}")
                    if feedback.get("strengths"):
                        st.markdown(f"**Strengths:** {', '.join(feedback['strengths'])}")
                    if feedback.get("improvements"):
                        st.markdown(f"**Improvements:** {', '.join(feedback['improvements'])}")
                    st.markdown("---")

with tab4:
    st.header("CRM Updates")
    
    st.subheader("Proposed Patches")
    
    draft = load_latest_draft(selected_account)
    
    if draft:
        st.caption(f"Generated: {draft.get('generatedAt', 'Unknown')}")
        
        patches = draft.get("patches", [])
        st.metric("Proposed Changes", len(patches))
        
        st.markdown("---")
        
        patches_by_object = {}
        for patch in patches:
            obj_type = patch.get("objectType", "Unknown")
            if obj_type not in patches_by_object:
                patches_by_object[obj_type] = []
            patches_by_object[obj_type].append(patch)
        
        approved_patches = []
        
        for obj_type, obj_patches in patches_by_object.items():
            st.subheader(f"{obj_type} Updates")
            
            for i, patch in enumerate(obj_patches):
                field = patch.get("fieldName", "Unknown")
                confidence = patch.get("confidence", "low")
                
                col1, col2 = st.columns([3, 1])
                
                with col1:
                    st.markdown(f"**{field}**")
                    
                    before_col, arrow_col, after_col = st.columns([2, 1, 2])
                    with before_col:
                        st.caption("Before")
                        st.code(patch.get("before", "N/A"))
                    with arrow_col:
                        st.markdown("### →")
                    with after_col:
                        st.caption("After")
                        st.code(patch.get("after", "N/A"))
                    
                    if patch.get("reasoning"):
                        st.caption(f"Reason: {patch['reasoning']}")
                    
                    if patch.get("source"):
                        st.caption(f"Source: {patch['source']}")
                
                with col2:
                    if confidence == "high":
                        st.success("HIGH")
                    elif confidence == "medium":
                        st.warning("MEDIUM")
                    else:
                        st.error("LOW")
                    
                    is_approved = st.checkbox(
                        "Approve",
                        value=(confidence == "high"),
                        key=f"approve_{obj_type}_{field}_{i}"
                    )
                    
                    if is_approved:
                        approved_patches.append(patch)
                
                st.markdown("---")
        
        if approved_patches:
            st.info(f"{len(approved_patches)} changes approved")
            
            if st.button("Apply to Salesforce", type="primary", use_container_width=True):
                result = run_agent(
                    ORCHESTRATOR_CMD + [account_name, "--apply"],
                    "Applying to Salesforce..."
                )
                if result["success"]:
                    st.success("Applied successfully")
                    st.rerun()
                else:
                    st.error(f"Error: {result['stderr'][:200]}")
    else:
        st.info("No CRM draft available.")
    
    st.markdown("---")
    st.subheader("AI Backfill Proposals")
    
    backfills = load_backfill_proposals(selected_account)
    
    if backfills:
        for backfill in backfills[:5]:
            proposals = backfill.get("proposals", [])
            
            with st.expander(f"Backfill - {len(proposals)} proposals", expanded=False):
                for prop in proposals:
                    field = prop.get("field", "Unknown")
                    confidence = prop.get("confidence", "low")
                    
                    col1, col2 = st.columns([3, 1])
                    with col1:
                        st.markdown(f"**{field}**: {prop.get('value', 'N/A')}")
                        st.caption(prop.get("reasoning", ""))
                    with col2:
                        display_confidence_badge(confidence)
                    st.markdown("---")
    else:
        st.info("No backfill proposals yet.")

with tab5:
    st.header("Account Insights")
    
    col1, col2 = st.columns([2, 1])
    
    with col1:
        st.subheader("Executive Summary")
        exec_summary = load_executive_summary(selected_account)
        
        if exec_summary:
            st.markdown(exec_summary.get("summary", ""))
            
            if exec_summary.get("keyPoints"):
                with st.expander("Key Points", expanded=True):
                    for point in exec_summary["keyPoints"]:
                        st.markdown(f"- {point}")
        else:
            st.info("No executive summary yet.")
        
        st.markdown("---")
        st.subheader("Deal Review")
        deal_review = load_deal_review(selected_account)
        
        if deal_review:
            health_score = deal_review.get("healthScore", 0)
            
            if health_score >= 7:
                st.success(f"Health Score: {health_score}/10")
            elif health_score >= 4:
                st.warning(f"Health Score: {health_score}/10")
            else:
                st.error(f"Health Score: {health_score}/10")
            
            if deal_review.get("strengths"):
                with st.expander("Strengths", expanded=False):
                    for strength in deal_review["strengths"]:
                        st.markdown(f"- {strength}")
            
            if deal_review.get("risks"):
                with st.expander("Risks", expanded=True):
                    for risk in deal_review["risks"]:
                        st.markdown(f"- {risk}")
            
            if deal_review.get("recommendations"):
                with st.expander("Recommendations", expanded=True):
                    for rec in deal_review["recommendations"]:
                        st.markdown(f"- {rec}")
        else:
            st.info("No deal review yet.")
    
    with col2:
        st.subheader("Qualification")
        scorecard = load_qualification_scorecard(selected_account)
        
        if scorecard:
            meddic = scorecard.get("meddic", {})
            
            for key, data in meddic.items():
                score = data.get("score", 0)
                status = data.get("status", "unknown")
                
                if status == "strong":
                    st.success(f"**{key.upper()}**: {score}/10")
                elif status == "weak":
                    st.error(f"**{key.upper()}**: {score}/10")
                else:
                    st.info(f"**{key.upper()}**: {score}/10")
            
            gaps = scorecard.get("gaps", [])
            if gaps:
                with st.expander("Gaps Highlighted", expanded=True):
                    for gap in gaps:
                        st.error(f"- {gap}")
        else:
            st.info("No scorecard yet.")
        
        st.markdown("---")
        st.subheader("Handoff Doc")
        handoff = load_handoff_doc(selected_account)
        
        if handoff:
            with st.expander("View Handoff", expanded=False):
                st.markdown(handoff)
        else:
            st.info("No handoff doc yet.")
        
        st.markdown("---")
        st.subheader("Closed-Lost")
        closedlost = load_closed_lost_analysis(selected_account)
        
        if closedlost:
            with st.expander("View Analysis", expanded=False):
                st.markdown(f"**Reason:** {closedlost.get('reason', 'Unknown')}")
                if closedlost.get("lessons"):
                    st.markdown("**Lessons:**")
                    for lesson in closedlost["lessons"]:
                        st.markdown(f"- {lesson}")
        else:
            st.info("No closed-lost analysis.")

st.sidebar.markdown("---")
st.sidebar.caption(f"Last updated: {datetime.now().strftime('%H:%M:%S')}")
