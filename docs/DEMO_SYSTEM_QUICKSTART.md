# Demo System Quick Start

## What Changed?

The custom demo system now:
- ✅ Extracts customer profiles from Gong call transcripts
- ✅ Selects repositories from **ADS GitHub organization only**
- ✅ Never references Sourcegraph-internal repositories
- ✅ Frames all demo features in academic search platform context

## Configuration

### Default (ADS)

No configuration needed. By default, the system uses ADS repositories:

```bash
# Just run the demo agent
npm run manage "Customer Name" -- --custom-demo-plan

# Or via API
curl -X POST http://localhost:3001/api/agents/custom-demo-plan \
  -d '{"accountName":"Customer Name"}'
```

### Switch to Custom Organization

To use a different GitHub organization for demos:

```bash
export DEMO_REPO_PROVIDER=custom
export DEMO_REPO_ORG=kubernetes
export DEMO_DEFAULT_REPO=https://github.com/kubernetes/kubernetes
export DEMO_LANGUAGE_PREFS=Go,Python

npm run manage "Company"
```

### Back to ADS

```bash
unset DEMO_REPO_PROVIDER
unset DEMO_REPO_ORG

npm run manage "Company"
```

## How It Works

### 1. Profile Extraction

When you run the custom demo agent, it automatically:

```typescript
// Reads the Gong call transcript
const profile = extractDemoProfile(context)

// Extracts:
// - Primary languages (Python, Go, TypeScript, etc.)
// - Pain points (code-search, onboarding, debugging)
// - Tools mentioned (GitHub, Kubernetes, Docker)
// - Use cases (code-exploration, scalability)
// - Persona (dev, manager, devops, security)
```

**Example extracted profile**:
```
Languages: Python, JavaScript
Pain Points: code-search, onboarding
Tools: GitHub, Kubernetes
Use Cases: code-exploration, scalability
Persona: engineering_manager
```

### 2. Repository Selection

Based on the profile, the system selects 1-3 ADS repositories:

```typescript
const selectedRepos = selectAdsDemoRepos(profile)
// Returns repos that match the customer's stack
```

**Scoring** (matches language + architecture + use cases):
- `adsabs-core`: Good fit (Python, JS/TS, microservices)
- `ADSimport`: Data pipeline examples (Python, ETL)
- `vault`: API patterns (Python, API service)
- `solr_service`: Search infrastructure (Python, Java, search)

### 3. Demo Generation

The LLM receives:
- The customer's extracted profile
- Selected repositories with rationales
- Instructions to ONLY use those repos
- ADS-specific feature mappings

**LLM generates**:
- Demo objective customized to pain points
- Scenarios aligned with selected repos
- Search queries from selected repos
- Feature descriptions in ADS domain context

## Testing the System

### Run a Demo for a Test Account

```bash
# Generate a custom demo for "Test Company"
npm run manage "Test Company" -- --custom-demo-plan

# With debug output
DEBUG=1 npm run manage "Test Company" -- --custom-demo-plan
```

### Check Generated Demo Output

```bash
# View the generated demo (saved to account directory)
cat data/accounts/test-company/agent-runs/custom_demo_plan/*.json

# Or check via API
curl http://localhost:3001/api/accounts/test-company/runs \
  -H "Content-Type: application/json" | jq '.[] | select(.agentId == "custom_demo_plan")'
```

### Verify No Sourcegraph References

```bash
# Check that output contains ONLY ADS repos
cat data/accounts/test-company/agent-runs/custom_demo_plan/*.json | \
  grep -i "github.com" | grep -v "adsabs"

# Should return nothing (no non-ADS repos)
```

## Common Scenarios

### Scenario 1: Python/Django Shop

**Gong Transcript**:
> "We're 30 engineers using Django and React. Main issue is finding code across services during onboarding."

**Expected Profile**:
- Languages: Python, JavaScript
- Pain Points: code-search, onboarding
- Selected Repos: adsabs-core (has Python + React)

**Demo Emphasizes**:
- API discovery across microservices
- Code search and navigation
- Onboarding efficiency

---

### Scenario 2: Go Microservices Platform Team

**Gong Transcript**:
> "We run Kubernetes with Go backend and TypeScript frontend. Scaling to 100+ services, need better visibility."

**Expected Profile**:
- Languages: Go, TypeScript
- Pain Points: scale, monitoring
- Tools: Kubernetes, Docker
- Selected Repos: adsabs-core (microservices patterns)

**Demo Emphasizes**:
- Distributed code understanding
- Scalability patterns
- Cross-service visibility

---

### Scenario 3: Sparse Gong Data

**Gong Transcript**: Only email address, no call recording

**Expected Behavior**:
```typescript
profile = getDefaultDemoProfile()
// Returns: Python, code-search, onboarding, 'other' persona

selectedRepos = [getDefaultDemoRepo()]
// Returns: adsabs-core
```

**Result**: Generic but valid demo using adsabs-core

## Debugging

### Enable Debug Logging

```bash
DEBUG=1 npm run manage "Company Name" -- --custom-demo-plan
```

**Output**:
```
[customizedDemo] Extracted profile:
Demo Profile:
  Languages: python, javascript
  Pain Points: code-search, onboarding
  Tools: github
  Use Cases: code-exploration, onboarding
  Persona: other
  Company: medium, Technology

[customizedDemo] Selected repos: ['adsabs-core']
```

### Check Profile Extraction

```typescript
// In a test script:
import { extractDemoProfile } from './src/agents/lib/demoprofileExtractor.js'

const profile = extractDemoProfile(context)
console.log(profile)
// {
//   primaryLanguages: ['Python'],
//   mainPainPoints: ['code-search'],
//   ...
// }
```

### Check Repository Selection

```typescript
// In a test script:
import { selectAdsDemoRepos } from './src/agents/lib/adsRepositorySelector.js'

const repos = selectAdsDemoRepos(profile)
console.log(repos)
// [{
//   url: 'https://github.com/adsabs/adsabs-core',
//   name: 'adsabs-core',
//   rationale: 'matches your Python/JavaScript stack and shows microservices patterns'
// }]
```

## Implementation Files

### New Files Created

1. **Configuration**:
   - `src/config/demoRepoConfig.ts` - Demo repo source configuration

2. **Profile Extraction**:
   - `src/agents/lib/demoprofileExtractor.ts` - Extract profile from Gong context

3. **Repository Selection**:
   - `src/agents/lib/adsRepositorySelector.ts` - Select ADS repos by profile

4. **Integration**:
   - `src/agents/lib/demoFlowIntegration.ts` - Build LLM context

5. **Tests**:
   - `src/agents/lib/__tests__/demoProfileExtractor.test.ts`
   - `src/agents/lib/__tests__/adsRepositorySelector.test.ts`

6. **Documentation**:
   - `docs/DEMO_SYSTEM_ARCHITECTURE.md` - Full architecture details
   - `docs/DEMO_SYSTEM_QUICKSTART.md` - This file

### Modified Files

1. **Agent Implementation**:
   - `src/agents/customizedDemo.ts` - Integrated profile extraction and repo selection

2. **Prompt Template**:
   - `prompts/agents/custom_demo_plan.md` - Updated for ADS context

## Running Tests

```bash
# Run all demo-related tests
npm test -- src/agents/lib/__tests__/

# Run specific test file
npm test -- demoProfileExtractor.test.ts

# With coverage
npm test -- --coverage src/agents/lib/
```

**Expected**: All tests pass (80%+ coverage on core modules)

## Common Issues

### Issue: "No repositories selected"

**Symptom**: Demo agent warns "No repositories selected, will use defaults"

**Cause**: Demo profile extraction failed (too little Gong data)

**Fix**: 
1. Check that Gong transcript has enough content
2. Verify demo profile has at least one language, pain point, or use case
3. Check debug logs: `DEBUG=1 npm run manage "Company"`

---

### Issue: Demo references wrong repos

**Symptom**: Output mentions "github.com/sourcegraph/..." instead of "github.com/adsabs/..."

**Cause**: LLM overrode instructions

**Fix**:
1. Check that repo selection returned ADS repos
2. Check LLM instructions in prompt were passed
3. Try with simpler profile (less confusing context)
4. Consider increasing temperature/resampling if using in Amp

---

### Issue: Demo doesn't match customer profile

**Symptom**: Generated demo is generic despite extracted profile

**Cause**: LLM has difficulty with very niche combinations

**Fix**:
1. Verify profile extraction is correct: `DEBUG=1`
2. Check that selected repos actually match profile
3. Simplify pain points in profile to top 2-3
4. Run again (may be variance in LLM output)

## Next Steps

### For Sales Reps

1. Run custom demo for any account
2. System automatically extracts Gong context
3. Review the generated demo
4. Edit for final polish if needed
5. Use in demo

### For Product Team

1. Monitor which demo flows lead to wins (analytics)
2. Gather feedback on ADS repo selections
3. Add more repos as needed to curated list
4. Tune language/pain/tool keyword dictionaries

### For Engineering

1. Run tests: `npm test -- src/agents/lib/__tests__/`
2. Monitor demo generation logs in production
3. Add alerts if repos stop returning results
4. Consider GitHub API integration for dynamic discovery

## Support

- **Documentation**: `docs/DEMO_SYSTEM_ARCHITECTURE.md`
- **Configuration**: `src/config/demoRepoConfig.ts`
- **Tests**: `src/agents/lib/__tests__/*.test.ts`
- **Agent Code**: `src/agents/customizedDemo.ts`
