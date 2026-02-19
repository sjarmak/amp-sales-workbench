# Sales Agents

Specialized agents for specific sales workflows.

## Post-Call Update Agent

**File**: `postCallUpdate.ts`

Analyzes call transcripts and generates CRM updates, tasks, and follow-up communications.

### Usage

```typescript
import { generatePostCallUpdate } from './agents/postCallUpdate.js'

// With specific call ID
const update = await generatePostCallUpdate(
  { name: 'Acme Corp', salesforceId: '001...' },
  'gong-call-id-123'
)

// With most recent call from raw data
const update = await generatePostCallUpdate(
  { name: 'Acme Corp', salesforceId: '001...' }
)
```

### Inputs

- `accountKey: AccountKey` - Account identifier
- `callId?: string` - Optional Gong call ID. If omitted, uses most recent call from `raw/gong.json`
- `accountDataDir?: string` - Optional data directory path

### Outputs

Generates three files in `data/accounts/<slug>/postcall/`:

1. **`postcall-<timestamp>.json`** - Full structured output
2. **`postcall-<timestamp>.yaml`** - CRM patch proposal (editable)
3. **`postcall-<timestamp>.md`** - Human-readable summary

### Analysis Includes

- **Next Steps** - Specific, time-bound action items with owners
- **Blockers/Risks** - Identified obstacles and risks
- **Stage Progression** - Signals for opportunity stage changes
- **Success Criteria** - Customer-stated success metrics
- **Feature Requests** - Specific capabilities mentioned
- **Stakeholder Sentiment** - Overall and per-person sentiment analysis
- **Suggested Close Date** - Timeline-based close date recommendation

### Tasks Generated

- Auto-assigned to AE, internal teams, or customer
- Default due date: 2 days or before next meeting
- Priority-sorted (high/medium/low)

### Follow-up Email

- Professional template with action items
- Pre-populated recipients from call participants
- Editable before sending

### Integration

Can be run:
- Standalone via CLI
- Triggered by webhook (future)
- As part of orchestrated workflow
- Integrated with calendar events (future)

## Pre-Call Brief Agent

**File**: `preCallBrief.ts`

Generates comprehensive briefs before customer calls.

See file for details.

## Follow-Up Email Agent

**File**: `followUpEmail.ts`

Generates personalized follow-up emails after customer calls.

### Usage

```bash
npx tsx scripts/test-followup-email.ts "Company Name" [callId]
```

### Outputs

Generates three files in `data/accounts/<slug>/emails/`:

1. **`followup-<timestamp>.json`** - Full structured output
2. **`followup-<timestamp>.md`** - Markdown summary with email preview
3. **`followup-<timestamp>.txt`** - Plain text email ready for copy-paste

### Features

- Personalized email body based on call discussion
- Meeting recap with key points
- Action items with clear ownership
- Suggested next meeting time/date
- Relevant resources and documentation links
- Professional, concise, technical tone when appropriate

## Demo/Trial Idea Agent

**File**: `demoIdea.ts`

Generates custom demo scripts, trial plans, and POC scopes.

### Usage

```bash
npx tsx scripts/test-demo-idea.ts "Company Name"
```

### Outputs

Generates two files in `data/accounts/<slug>/demos/`:

1. **`demo-idea-<timestamp>.json`** - Full structured output
2. **`demo-idea-<timestamp>.md`** - Formatted demo script and plan

### Includes

- **Demo Script** - Step-by-step flow with talking points aligned to pain points
- **Trial Plan** - 2-week trial scope with setup steps and success metrics
- **POC Scope** - Technical requirements, integration points, timeline, deliverables
- **Customization Notes** - Specific insights from research and calls

## Coaching Agent

**File**: `coaching.ts`

Generates coaching feedback from call analysis (internal use only - NOT saved to Salesforce).

### Usage

```bash
npx tsx scripts/test-coaching.ts "Company Name" <callId>
```

### Outputs

Generates two files in `data/accounts/<slug>/coaching/`:

1. **`coaching-<timestamp>.json`** - Full structured analysis
2. **`coaching-<timestamp>.md`** - Human-readable coaching feedback

### Analysis Includes

- **Talk Ratio** - Rep vs customer speaking time
- **Technical Depth** - Product knowledge assessment
- **Objection Handling** - How objections were addressed
- **Discovery Quality** - Question asking and listening
- **Next Step Clarity** - How clear were next steps
- **MEDDIC Assessment** - Qualification methodology scoring

### Features

- Specific examples from transcript with timestamps
- What went well / areas to improve
- Recommended actions with priority
- Coaching tips for skill development
- Internal use only - helps managers coach reps
