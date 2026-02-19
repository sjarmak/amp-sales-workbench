# Add to Notion Buttons Implementation

## Overview
Added "Add to Notion" buttons throughout the web UI that allow users to push account data to Notion after running agents.

## Files Modified

### 1. New Components Created

#### `/web/components/AddToNotionButton.tsx` (NEW)
- **Purpose**: Reusable button component for adding content to Notion
- **Features**:
  - Loading state with spinner animation
  - Success state with green styling and "Open in Notion" link
  - Error handling with retry capability
  - Tooltip with contextual help
  - Configurable variant and size props
- **States**:
  - Default: "Add to Notion" button
  - Loading: "Adding..." with spinner
  - Success: "Added to Notion" with external link icon (5s auto-dismiss)
  - Error: "Retry Add to Notion" with error tooltip

#### `/web/components/AgentResultCard.tsx` (NEW)
- **Purpose**: Wrapper component for agent results with optional Notion button
- **Features**:
  - Consistent card layout for agent outputs
  - Optional "Add to Notion" button in header
  - Used in After Call and CRM tabs as placeholders

### 2. API Server Changes

#### `/api-server.ts`
- **Added**: `POST /api/accounts/:slug/notion/mirror` (lines 1433-1497)
  - Proxy endpoint that wraps the main `/api/notion/mirror` endpoint
  - Automatically loads account metadata and latest snapshot data
  - Extracts relevant fields (contacts, opportunities, callSummary, nextActions)
  - Passes data to `mirrorToNotion()` function from syncNotion.js
  - Returns success response with Notion page URL

### 3. Web UI Integration

#### `/web/app/page.tsx`
**Imports** (line 15):
- Added `AddToNotionButton` and `AgentResultCard` imports

**State Management** (lines 40-41):
- Added `showNotionButton` state to control banner visibility
- Added `lastSuccessfulAgent` to track which agent completed

**Agent Execution Logic** (lines 132-142):
- After successful agent run, show Notion button for content-generating agents:
  - `precall-brief`, `postcall`, `exec-summary`, `deal-review`
  - `qualification`, `handoff`, `email`, `coaching`, `demo-ideas`

**Success Banner** (lines 209-241):
- Green-themed card appears after agent success
- Shows agent name and "Save to Notion" prompt
- Includes "Add to Notion" button and "Dismiss" button
- Auto-positioned above tabs for visibility

**After Call Tab** (lines 444-470):
- Replaced placeholder with `AgentResultCard` components
- Shows preview cards for "Post-Call Summary" and "Follow-Up Email Draft"
- Each card has "Add to Notion" button in header

**CRM Tab** (lines 472-502):
- Replaced placeholder with `AgentResultCard` components
- Shows preview cards for "AI Backfill Results" and "Deal Review Analysis"
- Each card has "Add to Notion" button in header

#### `/web/components/PreCallPrepTab.tsx`
**Import** (line 7):
- Added `AddToNotionButton` import

**Button Placement** (lines 192-203):
- Added "Add to Notion" button after brief is loaded
- Positioned at top-right before Call Context card
- Uses default (prominent) variant for visibility
- Only shows when both `accountSlug` and `accountName` are available

## User Flow

1. **Agent Execution**: User clicks an agent button (e.g., "Create Pre-Call Brief")
2. **Success Banner**: After completion, green banner appears with "Add to Notion" button
3. **Button Click**: User clicks "Add to Notion"
4. **Loading State**: Button shows spinner and "Adding..." text
5. **API Call**: POST to `/api/accounts/:slug/notion/mirror`
   - Loads account metadata and snapshot data
   - Calls `mirrorToNotion()` to create/update Notion page
6. **Success State**: 
   - Button turns green with checkmark
   - Text changes to "Added to Notion" with external link icon
   - Click opens Notion page in new tab
   - Auto-dismisses after 5 seconds
7. **Error State**: If failed, button shows "Retry Add to Notion" with error tooltip

## Button Locations

### Always Visible
- **Pre-Call Brief Tab**: Top-right of brief display (after generation)
- **After Call Tab**: Header of result cards (placeholder)
- **CRM Tab**: Header of result cards (placeholder)

### Contextual (After Agent Success)
- **Success Banner**: Appears above tabs after content-generating agents complete
- **Dismissible**: User can click "Dismiss" to hide banner

## Technical Details

### API Endpoint
```typescript
POST /api/accounts/:slug/notion/mirror
Body: { accountName: string }
Response: {
  success: boolean
  notionPageUrl?: string
  error?: string
}
```

### Data Flow
1. Frontend calls account-specific endpoint with slug
2. Backend loads metadata and latest snapshot from filesystem
3. Backend extracts relevant fields (contacts, opportunities, etc.)
4. Backend calls `mirrorToNotion()` from syncNotion.js
5. Notion MCP creates/updates page in Notion workspace
6. Returns success + Notion page URL to frontend

### Styling
- Uses shadcn/ui components (Button, Tooltip, Card)
- Success state: `border-green-500 text-green-600 hover:bg-green-50`
- Loading: Lucide `Loader2` icon with `animate-spin`
- Icons: `FileText` (default), `CheckCircle` (success), `ExternalLink` (open)

## Future Enhancements
- [ ] Add batch "Add to Notion" for multiple results
- [ ] Show preview of what will be sent before confirmation
- [ ] Add Notion workspace/page selector
- [ ] Persist "last added" state across sessions
- [ ] Add "Copy link" button next to success state
- [ ] Stream real-time progress for large data syncs
