# Demo System Architecture

## Overview

The demo system has been refactored to replace Sourcegraph-internal repositories with the **ADS (NASA/Harvard Astrophysics Data System)** GitHub organization. The system now:

1. **Extracts customer context** from Gong call transcripts
2. **Builds a demo profile** with languages, pain points, tools, and persona
3. **Selects ADS repositories** that match the customer's tech stack
4. **Generates tailored demo flows** using ADS code examples
5. **Frames all features** in the context of academic search platforms

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                          Gong Call Data                          │
│        (Transcript, activities, account metadata)                │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
         ┌───────────────────────────────────────┐
         │  extractDemoProfile()                 │
         │  (demoprofileExtractor.ts)           │
         │                                       │
         │  ✓ Languages (Python, JS, Go, etc)  │
         │  ✓ Pain points (search, scaling)    │
         │  ✓ Tools mentioned (GitHub, K8s)    │
         │  ✓ Use cases (code-exploration)     │
         │  ✓ Persona (dev, manager, devops)   │
         └───────┬───────────────────────────────┘
                 │
                 ▼
        ┌────────────────────────────────┐
        │  DemoProfile                   │
        │  ├─ primaryLanguages           │
        │  ├─ mainPainPoints             │
        │  ├─ useCases                   │
        │  └─ persona                    │
        └────────┬──────────────────────┘
                 │
                 ▼
    ┌────────────────────────────────────────┐
    │   selectAdsDemoRepos()                 │
    │   (adsRepositorySelector.ts)          │
    │                                        │
    │   Scoring algorithm:                  │
    │   ✓ Language matching (0-50 pts)      │
    │   ✓ Architecture patterns (0-30 pts)  │
    │   ✓ Pain point alignment (0-20 pts)   │
    └────────┬──────────────────────────────┘
             │
             ▼
   ┌──────────────────────────────────┐
   │  SelectedDemoRepo[]              │
   │  ├─ adsabs-core                  │
   │  ├─ ADSimport (if needed)        │
   │  └─ Rationales                   │
   └────────┬─────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────┐
│  buildDemoFlowContext()                  │
│  (demoFlowIntegration.ts)               │
│                                          │
│  ✓ Combine repos + profile               │
│  ✓ Select relevant features              │
│  ✓ Build LLM instructions               │
│  ✓ Frame in ADS domain context           │
└───────────┬──────────────────────────────┘
            │
            ▼
    ┌───────────────────────────────┐
    │  DemoFlowContext             │
    │  ├─ Selected repositories     │
    │  ├─ Customer profile         │
    │  ├─ Feature mapping          │
    │  └─ LLM instructions         │
    └───────────┬───────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────┐
│      customizedDemo Agent (LLM)                 │
│                                                  │
│  Receives:                                       │
│  ✓ Account context (standard)                   │
│  ✓ Demo profile (extracted from Gong)          │
│  ✓ Selected repositories (ADS only)            │
│  ✓ LLM instructions (ADS-specific)             │
│                                                  │
│  Generates:                                      │
│  ✓ Demo objective                              │
│  ✓ Scenario recommendations                    │
│  ✓ Demo flow sections (with ADS queries)       │
│  ✓ Feature mapping (with ADS examples)         │
│  ✓ Competitive handling                        │
│  ✓ Closing questions                           │
└─────────────────────┬──────────────────────────┘
                      │
                      ▼
           ┌──────────────────────┐
           │  CustomizedDemoOutput│
           │  (For sales rep UI)  │
           └──────────────────────┘
```

## Key Components

### 1. Demo Profile Extractor (`src/agents/lib/demoprofileExtractor.ts`)

**Purpose**: Extract structured insights from Gong call context.

**Input**:
- OpportunityContext (transcript, activities, account data)

**Output**:
```typescript
{
  primaryLanguages: ['Python', 'JavaScript'],
  secondaryLanguages: ['TypeScript'],
  mainPainPoints: ['code-search', 'onboarding'],
  toolsMentioned: ['github', 'kubernetes'],
  useCases: ['code-exploration', 'scalability'],
  persona: 'engineering_manager'
}
```

**Algorithm**:
1. Combine all text sources (transcript, titles, industry)
2. Keyword matching against language/pain/tool dictionaries
3. Count mentions and return top N by frequency
4. Infer persona from contact titles and keywords
5. Map pain points to use cases

**Keyword Dictionaries**:
- `LANGUAGE_KEYWORDS`: Maps language names to keywords (e.g., 'python' → ['python', 'py', 'jupyter'])
- `PAIN_KEYWORDS`: Maps pain categories to keywords (e.g., 'code-search' → ['search', 'find code', 'discover'])
- `TOOL_KEYWORDS`: Maps tools to keywords (e.g., 'github' → ['github', 'gh', 'actions'])
- `PERSONA_KEYWORDS`: Maps personas to role keywords (e.g., 'engineering_manager' → ['manager', 'director', 'vp of eng'])

### 2. ADS Repository Selector (`src/agents/lib/adsRepositorySelector.ts`)

**Purpose**: Select 1-3 ADS repositories that match the customer's profile.

**Input**:
- DemoProfile

**Output**:
```typescript
[{
  url: 'https://github.com/adsabs/adsabs-core',
  name: 'adsabs-core',
  description: '...',
  languages: ['Python', 'JavaScript'],
  rationale: 'matches your Python/JavaScript stack and shows microservices patterns',
  alternateUrls: ['https://github.com/adsabs/ADSimport']
}]
```

**Scoring Algorithm** (0-100 points):
1. **Language matching** (0-50 points):
   - 30 points base for any language match
   - +10 points per matching language
2. **Architecture patterns** (0-30 points):
   - 20 points for API service pattern + api-design use case
   - 20 points for microservices + scalability use case
   - 20 points for data-pipeline + data-processing use case
3. **Pain point alignment** (0-20 points):
   - Scale pain + microservices pattern = 10 points
   - Onboarding pain = 5 points

**Curated ADS Repositories**:
- `adsabs-core`: Main search/discovery interface (Python + JS/TS, microservices)
- `ADSimport`: Data ingestion pipeline (Python, ETL patterns)
- `vault`: Citation/collection API (Python, API service)
- `solr_service`: Search infrastructure (Python + Java, search infra)

### 3. Demo Flow Integration (`src/agents/lib/demoFlowIntegration.ts`)

**Purpose**: Build LLM instructions that incorporate profile and repo selection.

**Output**:
```typescript
{
  repos: [SelectedDemoRepo],
  profile: DemoProfile,
  featureMapping: [{ feature, adsContext, relevance, examples }],
  instructions: "## Demo Flow Customization Instructions..."
}
```

**Feature Mapping**:
Maps product features to ADS-specific contexts and examples:
- `code-search` → "Search across multiple research modules, APIs, and microservices"
- `api-discovery` → "Understand how APIs are used across ADS microservices"
- `batch-changes` → "Automate updates across ADS microservices when dependencies change"
- `deep-search` → "Ask natural language questions about ADS search/indexing"
- `code-insights` → "Track tech debt and patterns across ADS research modules"

### 4. Demo Repository Configuration (`src/config/demoRepoConfig.ts`)

**Purpose**: Centralized configuration for demo repo source (switchable).

**Environment Variables**:
```bash
# Use ADS (default)
DEMO_REPO_PROVIDER=ads

# Or switch to custom org
DEMO_REPO_PROVIDER=custom
DEMO_REPO_ORG=kubernetes
DEMO_DEFAULT_REPO=https://github.com/kubernetes/kubernetes
DEMO_LANGUAGE_PREFS=Go,Python,TypeScript
```

**Key Functions**:
- `getActiveDemoConfig()` - Get current config
- `getCuratedDemoRepos()` - Get repo list
- `getDefaultDemoRepo()` - Get fallback repo
- `getDemoRepoOrg()` - Get GitHub org

## Integration Points

### Custom Demo Agent (`src/agents/customizedDemo.ts`)

**Before**:
```typescript
function buildUserMessage(context, body) {
  return `${serializeContext(context)}\n\nCreate a demo plan...`
}
```

**After**:
```typescript
function buildUserMessage(context, body) {
  // Extract profile from Gong
  const profile = extractDemoProfile(context)
  
  // Select ADS repos
  const selectedRepos = selectAdsDemoRepos(profile)
  
  // Build LLM context with repos
  const demoFlowContext = buildDemoFlowContext(selectedRepos, profile)
  const contextWithDemo = serializeDemoFlowContext(demoFlowContext)
  
  return `${serializeContext(context)}

## Demo Profile & Repository Selection

${contextWithDemo}

## Demo Planning Request

Based on the selected repositories above, create a demo plan that:
1. ONLY REFERENCES the selected ADS repositories
2. NEVER suggests Sourcegraph-internal repositories
3. Frames all features in academic search platform context
...`
}
```

### Prompt Template (`prompts/agents/custom_demo_plan.md`)

**Key Changes**:
1. Emphasis on "selected repositories have already been chosen"
2. Explicit prohibition against Sourcegraph repos
3. Instructions to frame in academic search context
4. Requirement to use real ADS repositories

## Data Flow Example

### Input: Gong Call Transcript
```
Customer: "We're a team of 50 engineers using Go, TypeScript, and Python.
We mainly work on web and mobile apps...
Our main challenge is understanding APIs across our microservices when
onboarding new engineers."
```

### Step 1: Extract Demo Profile
```
primaryLanguages: ['Go', 'Python', 'TypeScript']
mainPainPoints: ['api-discovery', 'onboarding']
useCases: ['code-exploration', 'scalability']
persona: 'dev' (or engineering_manager)
```

### Step 2: Select ADS Repositories
```
Scoring:
- adsabs-core: 55 points (Python + JS/TS match, microservices, good for API discovery)
- ADSimport: 35 points (Python only, data pipeline)
- solr_service: 30 points (Python + Java, search infra)

Selected: [adsabs-core]
Rationale: "Matches your Go/Python/TypeScript stack and shows microservices patterns"
```

### Step 3: Build Demo Flow Context
```
{
  repos: [{url: 'github.com/adsabs/adsabs-core', rationale: '...'}],
  profile: {primaryLanguages: ['Go', 'Python', 'TypeScript'], ...},
  featureMapping: [
    {feature: 'API Discovery', adsContext: 'How ADS microservices integrate', relevance: '...'},
    {feature: 'Deep Search', adsContext: 'Query ADS search/indexing logic', relevance: '...'},
    ...
  ],
  instructions: "## Demo Flow Customization Instructions\n\n..."
}
```

### Step 4: LLM Generates Demo Plan

**Only references ADS repos**:
```
"selectedRepository": {
  "repo": "github.com/adsabs/adsabs-core",
  "rationale": "This is a real production codebase with Go, Python, and TypeScript components...",
}

"demoFlow": [{
  "section": "API Discovery Across Microservices",
  "specificDemo": {
    "repository": "github.com/adsabs/adsabs-core",
    "steps": [{
      "query": "repo:^github\\.com/adsabs/adsabs-core$ class:symbol API",
      "expectation": "All API classes and functions across services"
    }]
  }
}]
```

## Testing

### Unit Tests

Located in `src/agents/lib/__tests__/`:

1. **demoProfileExtractor.test.ts**:
   - Language extraction from transcript
   - Pain point extraction
   - Tool mention detection
   - Persona inference
   - Validation and defaults

2. **adsRepositorySelector.test.ts**:
   - Repository selection by language
   - Scoring algorithm
   - URL validation
   - Query generation
   - Non-empty results

### Running Tests

```bash
npm test -- src/agents/lib/__tests__/

# Or specific test
npm test -- demoProfileExtractor.test.ts
```

### Coverage Goals

- **demoprofileExtractor.ts**: 80%+ (keyword extraction is critical)
- **adsRepositorySelector.ts**: 75%+ (scoring algorithm needs validation)
- **demoFlowIntegration.ts**: 70%+ (context building is straightforward)

## Constraint Compliance

### No Sourcegraph-Internal References

✅ **Configuration**:
- Default provider is 'ads' (not 'sourcegraph')
- Curated repos only include ADS organization

✅ **Repository Selection**:
- `selectAdsDemoRepos()` only returns ADS repos
- Fallback repo is 'adsabs-core', not 'sourcegraph/sourcegraph'

✅ **LLM Instructions**:
- Explicit: "NEVER suggest Sourcegraph-internal repositories"
- Prompt emphasizes: "ONLY REFERENCES the selected ADS repositories"

✅ **Feature Framing**:
- All features explained in academic search platform context
- Examples use ADS domain language

### Backward Compatibility

✅ **Agent Interface**:
- `executeCustomizedDemo()` signature unchanged
- `CustomizedDemoOutput` format unchanged
- Existing demo state shapes supported

✅ **Data Structures**:
- OpportunityContext unchanged
- AgentOutput wrapper compatible

### Switchability (Future)

To switch to a different organization:

```bash
# Switch to Kubernetes repos
export DEMO_REPO_PROVIDER=custom
export DEMO_REPO_ORG=kubernetes
export DEMO_DEFAULT_REPO=https://github.com/kubernetes/kubernetes
export DEMO_LANGUAGE_PREFS=Go,Python

# Agent automatically uses new repos
npm run manage "Company Name"
```

## Error Handling & Fallbacks

### When Gong Data is Sparse

```typescript
// Detected invalid/missing profile
if (!isValidDemoProfile(profile)) {
  profile = getDefaultDemoProfile()
  // Primary: Python, JavaScript
  // Pain points: code-search, onboarding
}
```

### When Repository Selection Fails

```typescript
// No curated repos returned
if (selectedRepos.length === 0) {
  // Fallback to adsabs-core
  return [createDefaultRepo()]
}
```

### When Context Building Fails

```typescript
// Fall back to minimal context
if (!isValidDemoFlowContext(context)) {
  return getFallbackDemoFlowContext(profile)
}
```

## Performance Considerations

### Caching

- Demo repos cached for 24 hours (configurable via `getDemoCacheTTL()`)
- Profile extraction runs on demand (lightweight NLP)
- Repository selection is deterministic (same profile → same repos)

### Optimization Opportunities

1. **Cache demo profiles** per account (if patterns repeat)
2. **Pre-score** curated repos on startup
3. **Index** Gong transcripts for faster extraction
4. **Batch** repository info lookups (if using GitHub API)

## Future Enhancements

1. **GitHub Integration**: Use GitHub API to discover more ADS repos dynamically
2. **Learning**: Track which demos lead to wins and adjust repo selection
3. **Multi-Org Support**: Allow customers to swap in their own repos
4. **Analytics**: Track which pain points map to which demos
5. **A/B Testing**: Compare ADS vs custom repo effectiveness

## References

- ADS GitHub Org: https://github.com/adsabs
- ADS Product: https://ui.adsabs.harvard.edu/
- Demo Config: `src/config/demoRepoConfig.ts`
- Custom Demo Agent: `src/agents/customizedDemo.ts`
- Prompt: `prompts/agents/custom_demo_plan.md`
