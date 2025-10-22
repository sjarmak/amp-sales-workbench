# Insights Tab Implementation

## Files Created/Modified

### Created Files:

1. **web/components/InsightsTab.tsx** (1,150 lines)
   - Complete Insights Tab component with 4 sub-sections
   - Executive Summary section with problem statement, solution fit, metrics, social proof, next steps
   - Deal Review section with health score visualization, risk factors, path to close, coaching tips
   - Qualification section with MEDDIC/BANT scoring, criterion breakdown, evidence/gaps display
   - Closed-Lost Analysis section with loss reasons, root causes, lessons learned, follow-up opportunities
   - Markdown export functionality for all insight types
   - Regenerate buttons that trigger agent execution
   - Visual components: progress bars, health score indicators, severity badges
   - Uses lucide-react icons (FileText, TrendingUp, AlertTriangle, Target, RefreshCw, Download)

### Modified Files:

1. **api-server.ts** (added lines 1778-1862)
   - Added 4 new API endpoints:
     - `GET /api/accounts/:slug/insights/exec-summary` - Returns latest executive summary JSON
     - `GET /api/accounts/:slug/insights/deal-review` - Returns latest deal review JSON
     - `GET /api/accounts/:slug/insights/closed-lost` - Returns latest closed-lost analysis JSON
     - `GET /api/accounts/:slug/insights/qualification` - Returns latest qualification report JSON
   - Each endpoint reads from respective directories (summaries/, reviews/, closed-lost/, qualification/)
   - Returns 404 if no data found (graceful degradation)

2. **web/app/page.tsx** (modified lines 10, 464-477)
   - Imported InsightsTab component
   - Updated Insights tab content to render InsightsTab
   - Fixed capabilities type to include `amp: boolean`
   - Passes accountSlug and accountName props to InsightsTab

## Features Implemented

### 1. Executive Summary Section
- **Display:**
  - Problem Statement card
  - Solution Fit card
  - Success Metrics list
  - Social Proof list
  - Next Steps ordered list
  - Generated timestamp
- **Actions:**
  - Generate/Regenerate button
  - Export to Markdown button

### 2. Deal Review Section
- **Display:**
  - Deal Health Score with visual progress bar (0-100)
  - Color-coded health indicator (green ≥80, yellow ≥60, red <60)
  - Current deal status
  - Strategy description
  - Risk Factors with severity badges (high/medium/low)
  - Mitigation strategies for each risk
  - Path to Close
  - Coaching Tips list
- **Actions:**
  - Regenerate button
  - Export to Markdown button

### 3. Qualification Section (MEDDIC/BANT/SPICED)
- **Display:**
  - Overall qualification score with progress bar
  - Methodology label (MEDDIC, BANT, etc.)
  - Per-criterion breakdown cards:
    - Criterion name
    - Score badge (color-coded: green ≥80, yellow ≥60, red <60)
    - Progress bar
    - Evidence list (✓ green checkmarks)
    - Gaps list (✗ red x marks)
  - Recommendation summary
- **Actions:**
  - Regenerate button
  - Export to Markdown button

### 4. Closed-Lost Analysis Section
- **Display:**
  - Loss Reason description
  - Competitor Won badge (if applicable)
  - Root Causes list
  - Lessons Learned list
  - Follow-up Opportunities list
  - Generated timestamp
- **Actions:**
  - Regenerate button
  - Export to Markdown button
- **Fallback:** Shows "Not applicable" message if no closed-lost data exists

## Technical Details

### Data Flow:
1. **Loading:** On mount and account change, parallel fetch all insight endpoints
2. **Error Handling:** Uses Promise.allSettled to handle missing data gracefully
3. **Regeneration:** Calls agent API (POST /api/agents/{agent-name}) then reloads insights
4. **Export:** Formats data to Markdown and triggers browser download

### Visualization Components:
- **Progress bars:** CSS width percentage with color transitions
- **Health scores:** Large text + progress bar with conditional colors
- **Severity badges:** shadcn/ui Badge with variants (destructive/secondary/default)
- **Icons:** lucide-react for visual clarity
- **Cards:** shadcn/ui Card for sectioned layouts

### State Management:
- Independent state for each insight type (execSummary, dealReview, closedLost, qualification)
- Loading state prevents duplicate requests
- Active tab state for navigation

### Integration with Existing Agents:
- Reads from agent output directories:
  - `data/accounts/{slug}/summaries/exec-summary-{date}.json`
  - `data/accounts/{slug}/reviews/deal-review-{date}.json`
  - `data/accounts/{slug}/closed-lost/closed-lost-{date}.json`
  - `data/accounts/{slug}/qualification/qual-{date}.json`
- Uses existing agent execution API (already implemented in Quick Actions)

## Usage

### To View Insights:
1. Select an account from the header dropdown
2. Click the "Insights" tab
3. Navigate between Executive Summary, Deal Review, Qualification, and Closed Lost sub-tabs
4. If no data exists, click "Generate" button to run the respective agent

### To Regenerate:
1. Click the "Regenerate" button (circular arrow icon) in any section
2. Agent will execute in background via Amp SDK
3. Insights will auto-refresh after completion

### To Export:
1. Click the "Export" button (download icon) in any section
2. Markdown file will download to your browser's default location
3. Filename format: `{accountSlug}-{insight-type}-{date}.md`

## Dependencies
- All shadcn/ui components already installed (card, badge, button, tabs, tooltip)
- lucide-react icons (already in use)
- No new dependencies required

## Testing Checklist
- [ ] Verify API endpoints return correct JSON
- [ ] Test graceful degradation when data missing
- [ ] Test regenerate button triggers agent execution
- [ ] Test export downloads Markdown file
- [ ] Test tab navigation
- [ ] Test visual components render correctly
- [ ] Test with multiple accounts
- [ ] Test responsive layout

## Known Issues
- Pre-existing build warning about non-standard NODE_ENV (unrelated)
- Pre-existing TypeScript errors in other files (unrelated)
- Next.js build error in 500 page (pre-existing, unrelated to Insights tab)

## Future Enhancements
- [ ] Add date range picker for historical insights
- [ ] Add trend analysis (compare current vs previous insights)
- [ ] Add inline editing for insights
- [ ] Add AI-powered recommendations based on insights
- [ ] Add team collaboration features (comments, @mentions)
- [ ] Add scheduled auto-generation
- [ ] Add webhook notifications for insight changes
