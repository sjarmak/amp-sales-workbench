# CRM Updates Tab Implementation Summary

## Files Created/Modified

### New Files
1. **web/components/CrmUpdatesTab.tsx** - Main CRM Updates tab component

### Modified Files
1. **api-server.ts** - Added 3 new API endpoints for CRM operations
2. **web/app/page.tsx** - Integrated CrmUpdatesTab into main application

## API Endpoints Added

### 1. GET `/api/accounts/:slug/crm/drafts`
- Returns pending CRM patches from latest draft YAML file
- Parses Account, Contact, and Opportunity changes
- Includes confidence scores, source attribution, and reasoning
- Response format:
  ```json
  {
    "drafts": [
      {
        "id": "opportunity-{id}-{field}",
        "objectType": "Opportunity",
        "objectId": "006UV...",
        "objectName": "Canva - SCM Team...",
        "field": "Next_Step__c",
        "before": "",
        "after": "Schedule renewal discussion...",
        "confidence": "high",
        "source": ["analysis"],
        "reasoning": "Large renewal approaching...",
        "status": "pending"
      }
    ],
    "latest": {
      "file": "crm-draft-20251021.yaml",
      "generatedAt": "2025-10-21T01:51:27.507Z",
      "approved": false
    }
  }
  ```

### 2. GET `/api/accounts/:slug/crm/history`
- Returns history of applied changes from `applied/` directory
- Shows success/failure status per change
- Includes error messages and fields updated
- Response format:
  ```json
  {
    "history": [
      {
        "appliedAt": "2025-10-21T10:30:00Z",
        "changes": [
          {
            "objectType": "Opportunity",
            "objectId": "006UV...",
            "success": true,
            "fieldsUpdated": ["Next_Step__c"],
            "error": null
          }
        ],
        "errors": []
      }
    ]
  }
  ```

### 3. POST `/api/accounts/:slug/crm/apply`
- Applies pending patches to Salesforce
- Marks draft as approved
- Executes syncSalesforce agent
- Body: `{ patchIds?: string[] }` (optional: apply specific patches only)
- Response:
  ```json
  {
    "success": true,
    "result": { ... }
  }
  ```

## UI Features Implemented

### Draft Patches Section
- ✅ List of proposed field changes with before → after diff view
- ✅ Confidence badges (high/medium/low) with color coding
- ✅ Source attribution showing which data source generated the change
- ✅ Expandable reasoning section for each patch
- ✅ Checkbox selection for individual patches
- ✅ Select All / Deselect All buttons
- ✅ Bulk apply button with confirmation dialog
- ✅ Visual diff display (red for before, green for after)

### Filters
- ✅ Filter by object type (Account, Contact, Opportunity)
- ✅ Filter by status (pending, applied, rejected)
- ✅ Filter by confidence level (high, medium, low)
- ✅ Real-time filter application

### Apply Status Section
- ✅ Visual indicators for draft status (approved/pending)
- ✅ Timestamp of last generation (relative time format)
- ✅ Loading states during apply operation
- ✅ Confirmation modal with warning message

### Change History
- ✅ Timeline of past changes
- ✅ Success/failure indicators per change
- ✅ Object type and ID for each change
- ✅ Fields updated list
- ✅ Error messages display
- ✅ Relative timestamps (e.g., "2h ago", "3d ago")
- ✅ Grouped by apply operation

### Additional Features
- ✅ Empty states with helpful messages
- ✅ Loading spinner during data fetch
- ✅ Responsive grid layout
- ✅ shadcn/ui components throughout
- ✅ Color-coded badges and indicators
- ✅ Hover states and transitions
- ✅ Expandable/collapsible sections

## Component Structure

```
CrmUpdatesTab
├── Header (title, description, draft status)
├── Filters Card
│   ├── Object Type Filter
│   ├── Status Filter
│   └── Confidence Filter
├── Draft Patches Card
│   ├── Bulk Actions (Select All, Apply)
│   └── Patch List
│       └── Patch Item
│           ├── Checkbox
│           ├── Badges (Type, Confidence)
│           ├── Field Name
│           ├── Before/After Diff
│           └── Expandable Reasoning
├── Change History Card
│   └── History Entry
│       ├── Timestamp
│       ├── Change List
│       │   └── Change Item (with success/error icons)
│       └── Error Messages (if any)
└── Confirmation Dialog
    ├── Warning Message
    └── Apply/Cancel Buttons
```

## Data Flow

1. **Load Drafts**: Component fetches from `/api/accounts/:slug/crm/drafts`
2. **Load History**: Component fetches from `/api/accounts/:slug/crm/history`
3. **Filter**: Client-side filtering of drafts based on selected criteria
4. **Select Patches**: User selects individual or all patches
5. **Confirm Apply**: User clicks apply, sees confirmation dialog
6. **Apply Changes**: POST to `/api/accounts/:slug/crm/apply`
7. **Backend Process**:
   - Reads latest draft YAML
   - Marks as approved
   - Executes syncSalesforce agent
   - Creates apply receipt in `applied/` directory
8. **Reload Data**: UI refreshes to show updated status

## Technical Details

### Dependencies
- React hooks: `useState`, `useEffect`
- shadcn/ui components: Card, Badge, Button, Select, Dialog
- lucide-react icons
- TypeScript for type safety

### Styling
- Tailwind CSS classes
- Color-coded states:
  - Green: Success, high confidence, approved
  - Yellow: Pending, medium confidence
  - Orange: Low confidence
  - Red: Errors, removed values
  - Blue: Information

### Error Handling
- Try-catch blocks for API calls
- User-friendly error messages
- Empty state handling
- Loading state management

## Integration Points

### With Existing Agents
- **Draft Agent**: Generates YAML files that this tab reads
- **Sync Agent**: Applied by this tab to push changes to Salesforce
- **Backfill Agent**: Generates proposals visible here
- **Deal Review Agent**: Can trigger draft generation

### With MCP Servers
- **Salesforce MCP**: Target for applied changes
- **Gong MCP**: Source of call insights that inform patches
- **Notion MCP**: Can mirror applied changes

## Future Enhancements

Potential improvements not yet implemented:
- Individual patch apply/reject (currently bulk only)
- Edit patch values before applying
- Roll back applied changes
- Diff view for complex objects (arrays, JSON)
- Export history to CSV
- Patch comments and annotations
- Approval workflow with multiple reviewers
- Scheduled apply operations
- Real-time notifications when drafts are ready
- Integration with Slack for approvals

## Testing

To test the implementation:

1. **Generate Draft**: Run an agent that creates drafts (e.g., backfill, deal-review)
   ```bash
   npm run manage "Acme Corp"
   ```

2. **View Drafts**: Navigate to CRM Updates tab in web UI
   - Verify patches appear with correct data
   - Test filters
   - Test selection

3. **Apply Changes**: Select patches and click Apply
   - Confirm dialog appears
   - Changes are applied to Salesforce
   - History updates

4. **View History**: Check Change History section
   - Past applications appear
   - Success/failure status shown
   - Timestamps are correct

## Notes

- Draft files must be in YAML format following the CrmPatchProposal schema
- Applied receipts are JSON format following the ApplyReceipt schema
- The component polls data on mount but doesn't auto-refresh (requires manual reload)
- Patch IDs are generated client-side for UI purposes only
- The actual apply operation uses the full draft file, not individual patch IDs (future enhancement needed for partial applies)
