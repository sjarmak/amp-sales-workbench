# Contributing to Amp Sales Workbench

Guidelines for extending the workbench with new agents, prompts, and integrations.

## Table of Contents

1. [Adding New Agents](#adding-new-agents)
2. [Prompt Engineering](#prompt-engineering)
3. [Testing Conventions](#testing-conventions)
4. [Code Style](#code-style)
5. [Data Schema](#data-schema)
6. [MCP Integration](#mcp-integration)
7. [Pull Request Process](#pull-request-process)

---

## Adding New Agents

### Agent Template

Create a new agent in `src/agents/<agentName>.ts`:

```typescript
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { execute, type AmpOptions } from '@sourcegraph/amp-sdk'
import type { AccountKey, MyAgentOutput } from '../types.js'

const ampOptions: AmpOptions = {
	dangerouslyAllowAll: true,
}

/**
 * My New Agent
 * 
 * Purpose: [Describe what this agent does]
 * 
 * @param accountKey - Account identifier
 * @param accountDataDir - Path to account data directory
 * @param customParam - [Any custom parameters]
 * @returns Promise<MyAgentOutput>
 */
export async function runMyAgent(
	accountKey: AccountKey,
	accountDataDir: string,
	customParam?: string
): Promise<MyAgentOutput> {
	console.log('   Generating [agent output]...')

	// Step 1: Load data sources
	const snapshot = await loadLatestSnapshot(accountDataDir)
	const rawData = await loadRawData(accountDataDir)

	// Step 2: Load prompt template
	const promptPath = join(process.cwd(), 'prompts/my-agent.md')
	const promptTemplate = await readFile(promptPath, 'utf-8')

	// Step 3: Build context for AI
	const context = buildContext(snapshot, rawData, customParam)

	// Step 4: Execute with Amp SDK
	const result = await executeAgent(promptTemplate, context, accountKey)

	// Step 5: Save outputs
	const outputDir = join(accountDataDir, 'my-agent-outputs')
	await mkdir(outputDir, { recursive: true })

	const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '')

	// Save JSON
	const jsonPath = join(outputDir, `output-${timestamp}.json`)
	await writeFile(jsonPath, JSON.stringify(result, null, 2), 'utf-8')

	// Save Markdown (if applicable)
	const mdContent = formatAsMarkdown(result)
	const mdPath = join(outputDir, `output-${timestamp}.md`)
	await writeFile(mdPath, mdContent, 'utf-8')

	console.log(`   Saved output: ${jsonPath}`)
	return result
}

async function loadLatestSnapshot(accountDataDir: string) {
	// Implementation
}

function buildContext(snapshot: any, rawData: any, customParam?: string): string {
	// Build context string for AI prompt
	return `
# Account Context
Name: ${snapshot.accountProfile.name}
...

# Raw Data
${JSON.stringify(rawData, null, 2)}

# Custom Parameters
${customParam || 'None'}
`
}

async function executeAgent(
	promptTemplate: string,
	context: string,
	accountKey: AccountKey
): Promise<MyAgentOutput> {
	// Replace template variables
	const prompt = promptTemplate
		.replace('{{CONTEXT}}', context)
		.replace('{{ACCOUNT_NAME}}', accountKey.name)

	// Execute with Amp SDK
	const stream = execute({
		prompt,
		options: ampOptions,
	})

	let result = ''
	for await (const message of stream) {
		if (message.type === 'result' && !message.is_error) {
			result = message.result
		}
		if (message.type === 'result' && message.is_error) {
			throw new Error(`Agent execution failed: ${message.result}`)
		}
	}

	// Parse result (adjust based on prompt instructions)
	return JSON.parse(result) as MyAgentOutput
}

function formatAsMarkdown(result: MyAgentOutput): string {
	// Convert result to readable markdown
	return `# My Agent Output\n\n${JSON.stringify(result, null, 2)}`
}
```

### Agent Checklist

- [ ] Create agent file in `src/agents/<name>.ts`
- [ ] Create prompt template in `prompts/<name>.md`
- [ ] Add type definitions to `src/types.ts`
- [ ] Create CLI script in `scripts/test-<name>.ts`
- [ ] Add to agent index: `src/agents/index.ts`
- [ ] Document in `docs/AGENTS_GUIDE.md`
- [ ] Add Streamlit button in `streamlit_app.py` (if applicable)
- [ ] Test with real data
- [ ] Add example output to documentation

### Integration Points

**With Orchestrator**:
```typescript
// src/orchestrator.ts
import { runMyAgent } from './agents/myAgent.js'

// Add to orchestration flow if needed
const myAgentResult = await runMyAgent(accountKey, accountDataDir)
```

**With Streamlit UI**:
```python
# streamlit_app.py
if st.button("Run My Agent", use_container_width=True):
    result = run_agent(
        ["npx", "tsx", "scripts/test-my-agent.ts", account_name],
        "Running my agent..."
    )
    if result["success"]:
        st.success("✅ My agent completed")
        st.rerun()
```

---

## Prompt Engineering

### Prompt Template Structure

Create prompts in `prompts/<agent-name>.md`:

```markdown
# My Agent Prompt

You are an expert sales analyst helping to [specific task].

## Task
[Clear, specific instructions for what the AI should do]

## Context
{{CONTEXT}}

## Input Data
- Account Name: {{ACCOUNT_NAME}}
- [Other variables]

## Output Format
Return ONLY valid JSON with the following structure:

\```json
{
  "field1": "value",
  "field2": ["list", "of", "items"],
  "field3": {
    "nested": "object"
  }
}
\```

## Guidelines
- Be specific and data-driven
- Include confidence levels (high/medium/low)
- Cite sources (e.g., "Gong Call 2025-10-20")
- Flag uncertainties
- [Agent-specific guidelines]

## Example Output
\```json
{
  "example": "Goes here"
}
\```
```

### Best Practices

1. **Clear Instructions**: Be explicit about what to include/exclude
2. **Structured Output**: Request JSON for easy parsing
3. **Examples**: Include 1-2 examples of ideal output
4. **Context Variables**: Use `{{VARIABLE}}` for replacements
5. **Error Handling**: Include instructions for edge cases
6. **Confidence Scoring**: Always request confidence levels
7. **Source Attribution**: Request citations to source data

### Example: Good vs Bad Prompts

❌ **Bad**:
```
Analyze this account and tell me about it.

{{CONTEXT}}
```

✅ **Good**:
```markdown
# Account Analysis Task

Analyze the provided account data and generate a health score.

## Instructions
1. Review all calls, opportunities, and contacts
2. Score health across 5 dimensions (0-100 each)
3. Identify top 3 risks
4. Recommend 3 specific actions

## Context
{{CONTEXT}}

## Output Format
\```json
{
  "overallHealth": 75,
  "dimensions": {
    "engagement": 80,
    "sentiment": 70,
    "technical": 90,
    "economic": 60,
    "timeline": 75
  },
  "risks": [
    {
      "risk": "Economic buyer not engaged",
      "severity": "high",
      "evidence": "No meetings with CFO in 6 weeks"
    }
  ],
  "recommendations": [
    {
      "action": "Schedule meeting with CFO",
      "priority": "urgent",
      "reasoning": "Deal >$100K requires CFO approval"
    }
  ]
}
\```

## Guidelines
- Health scores should be evidence-based, not subjective
- Risks must include severity: "high", "medium", or "low"
- Recommendations must be actionable (not "monitor situation")
- Include "evidence" field with specific data points
```

### Testing Prompts

```bash
# Test prompt in isolation
cat prompts/my-agent.md | \
  sed 's/{{ACCOUNT_NAME}}/Test Corp/g' | \
  sed 's/{{CONTEXT}}/Sample context/g' > /tmp/test-prompt.txt

# Run with Amp SDK
npx tsx -e "
import { execute } from '@sourcegraph/amp-sdk';
import { readFileSync } from 'fs';
const prompt = readFileSync('/tmp/test-prompt.txt', 'utf-8');
const stream = execute({ prompt, options: { dangerouslyAllowAll: true } });
for await (const msg of stream) {
  if (msg.type === 'result') console.log(msg.result);
}
"
```

---

## Testing Conventions

### Unit Testing (Future)

Currently no formal test framework. Planned:

```typescript
// tests/agents/myAgent.test.ts
import { describe, it, expect } from 'vitest'
import { runMyAgent } from '../../src/agents/myAgent.js'

describe('MyAgent', () => {
	it('generates valid output', async () => {
		const result = await runMyAgent(
			{ name: 'Test Corp', salesforceId: '001xx' },
			'test/fixtures/acme-corp',
			'customParam'
		)
		
		expect(result).toHaveProperty('field1')
		expect(result.field2).toBeInstanceOf(Array)
	})
	
	it('handles missing data gracefully', async () => {
		// Test degraded mode
	})
})
```

### Integration Testing

Test with real accounts:

```bash
# Create test script: scripts/test-my-agent.ts
import { runMyAgent } from '../src/agents/myAgent.js'

const accountKey = {
	name: process.argv[2] || 'Acme Corp',
	salesforceId: '001xx000003D8eQAAS',
}

const accountDataDir = `data/accounts/${accountKey.name.toLowerCase().replace(/\s+/g, '-')}`

const result = await runMyAgent(accountKey, accountDataDir)
console.log(JSON.stringify(result, null, 2))
```

**Run**:
```bash
npx tsx scripts/test-my-agent.ts "Acme Corp"
```

### Manual Test Checklist

For each new agent:

- [ ] Test with account that has full data (Gong + SF + Notion)
- [ ] Test with account missing Gong data
- [ ] Test with account missing Notion data
- [ ] Test with account missing Salesforce data (if applicable)
- [ ] Test with brand new account (minimal data)
- [ ] Test with stale data (>30 days old)
- [ ] Verify output files are created correctly
- [ ] Verify JSON is valid and parseable
- [ ] Verify Markdown is readable
- [ ] Test error handling (invalid input, API failures)

---

## Code Style

### TypeScript Conventions

```typescript
// ✅ Good
export async function generateReport(
	accountKey: AccountKey,
	options: ReportOptions
): Promise<Report> {
	const data = await loadData(accountKey)
	return processData(data, options)
}

// ❌ Bad
export async function generateReport(accountKey, options) {
	const data = await loadData(accountKey)
	return processData(data, options)
}
```

### Naming

- **Functions**: `camelCase`, verb-noun (e.g., `generateBrief`, `loadSnapshot`)
- **Types**: `PascalCase`, noun (e.g., `AccountKey`, `ConsolidatedSnapshot`)
- **Constants**: `SCREAMING_SNAKE_CASE` (e.g., `MAX_CALLS`, `CACHE_TTL`)
- **Files**: `camelCase` for code, `kebab-case` for prompts

### Imports

```typescript
// Node built-ins first
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

// External dependencies second
import { execute } from '@sourcegraph/amp-sdk'

// Internal imports last
import type { AccountKey } from '../types.js'
import { loadSnapshot } from '../utils/data.js'

// Always use .js extension (required for ESM)
import { helper } from './helper.js'
```

### Error Handling

```typescript
// ✅ Good: Descriptive errors with context
if (!snapshot) {
	throw new Error(
		`No snapshot found for account ${accountKey.name}. ` +
		`Run enrichment first: npm run manage "${accountKey.name}"`
	)
}

// ❌ Bad: Generic errors
if (!snapshot) {
	throw new Error('Snapshot not found')
}
```

### Logging

```typescript
// Console logs for user-facing progress
console.log('   Generating brief...')
console.log('   Saved output: briefs/precall-20251020.json')

// Debug logs (optional, controlled by DEBUG env var)
if (process.env.DEBUG) {
	console.debug('   Context length:', context.length)
	console.debug('   Prompt variables:', variables)
}

// Errors
console.error('✗ Failed to load snapshot:', error.message)
```

### Async/Await

```typescript
// ✅ Good: async/await
async function processAccount() {
	const snapshot = await loadSnapshot()
	const enriched = await enrichData(snapshot)
	return enriched
}

// ❌ Bad: Promise chains
function processAccount() {
	return loadSnapshot()
		.then(snapshot => enrichData(snapshot))
		.then(enriched => enriched)
}
```

---

## Data Schema

### Type Definitions

Add new types to `src/types.ts`:

```typescript
export interface MyAgentOutput {
	generatedAt: string
	accountName: string
	field1: string
	field2: string[]
	field3: {
		nested: Record<string, any>
	}
}
```

### File Naming Conventions

```
data/accounts/<account-slug>/
├── raw/
│   ├── salesforce.json         # Raw Salesforce data
│   ├── gong_calls.json          # Raw Gong calls
│   └── notion_pages.json        # Raw Notion pages
├── snapshots/
│   └── snapshot-YYYYMMDD.json   # Consolidated snapshots
├── drafts/
│   ├── crm-draft-YYYYMMDD.yaml  # CRM patches
│   └── summary-YYYYMMDD.md      # Summary
├── briefs/
│   ├── precall-YYYYMMDD.json    # Pre-call briefs
│   └── precall-YYYYMMDD.md
├── postcall/
│   ├── postcall-<callId>.json   # Post-call summaries
│   └── postcall-<callId>.md
├── my-agent/                    # New agent outputs
│   ├── output-YYYYMMDD.json
│   └── output-YYYYMMDD.md
└── applied/
    └── apply-YYYYMMDD.json      # Sync receipts
```

### JSON Schema Validation (Future)

Plan to add JSON Schema validation:

```typescript
import Ajv from 'ajv'

const schema = {
	type: 'object',
	properties: {
		field1: { type: 'string' },
		field2: { type: 'array', items: { type: 'string' } },
	},
	required: ['field1', 'field2'],
}

const ajv = new Ajv()
const validate = ajv.compile(schema)

if (!validate(result)) {
	throw new Error(`Invalid output: ${JSON.stringify(validate.errors)}`)
}
```

---

## MCP Integration

### Adding New MCP Server

1. **Configure in Amp Settings**: Add MCP server to Amp configuration
2. **Add Capability Detection**: Update `src/capabilities/detect.ts`
3. **Create Enrichment Agent**: Add `src/phases/ingest/<mcp-name>.ts`
4. **Update Types**: Add to `Capabilities` and `IngestedData` types
5. **Test Integration**: Run capability detection

### Example: Adding Slack MCP

```typescript
// src/capabilities/detect.ts
async function testSlack(): Promise<boolean> {
	try {
		const result = await withTimeout(
			testMcpTool('Test Slack MCP: Use mcp__slack__list_channels. Return "SUCCESS" if it works.'),
			TEST_TIMEOUT_MS
		)
		return result.toLowerCase().includes('success')
	} catch (error) {
		return false
	}
}

// Add to detectCapabilities()
const [gong, salesforce, notion, slack] = await Promise.all([
	testGong(),
	testSalesforce(),
	testNotion(),
	testSlack(),
])

const capabilities: Capabilities = {
	gong,
	salesforce,
	notion,
	slack,  // New
	detectedAt: new Date().toISOString(),
}
```

```typescript
// src/phases/ingest/slack.ts
export async function enrichFromSlack(
	accountKey: AccountKey,
	accountDataDir: string
): Promise<SlackData> {
	console.log('   Enriching from Slack...')

	const prompt = `
Use mcp__slack__search_messages to find messages mentioning "${accountKey.name}".
Return the 10 most recent relevant messages as JSON.
`

	const stream = execute({ prompt, options: ampOptions })

	let result = ''
	for await (const message of stream) {
		if (message.type === 'result' && !message.is_error) {
			result = message.result
		}
	}

	const slackData = JSON.parse(result) as SlackData

	// Save raw data
	const rawPath = join(accountDataDir, 'raw', 'slack_messages.json')
	await writeFile(rawPath, JSON.stringify(slackData, null, 2), 'utf-8')

	return slackData
}
```

---

## Pull Request Process

### Before Submitting

1. **Run typecheck**: `npm run typecheck`
2. **Test manually**: Verify with real account data
3. **Update documentation**: Add to relevant docs
4. **Follow code style**: Run prettier/eslint
5. **Update AGENTS.md**: Add command if new agent

### PR Template

```markdown
## Description
[Brief description of changes]

## Type of Change
- [ ] New agent
- [ ] Bug fix
- [ ] Enhancement
- [ ] Documentation
- [ ] Refactor

## Testing
- [ ] Tested with full capability (all MCPs)
- [ ] Tested with partial capability
- [ ] Tested with minimal/missing data
- [ ] Updated tests (if applicable)

## Documentation
- [ ] Updated AGENTS_GUIDE.md
- [ ] Updated README.md
- [ ] Updated AGENTS.md
- [ ] Added prompt template
- [ ] Added example output

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Commented complex logic
- [ ] No secrets/PII in code
- [ ] Types are explicit
```

### Review Criteria

- **Functionality**: Does it work as intended?
- **Code Quality**: Clean, readable, maintainable?
- **Performance**: Reasonable execution time?
- **Error Handling**: Graceful degradation?
- **Documentation**: Adequately documented?
- **Testing**: Manually tested with real data?

---

## Resources

- **Amp SDK Docs**: [https://ampcode.com/manual](https://ampcode.com/manual)
- **TypeScript Handbook**: [https://www.typescriptlang.org/docs/](https://www.typescriptlang.org/docs/)
- **Beads (Task Tracking)**: Run `bd quickstart`
- **Project Docs**: [docs/](./docs/)

## Questions?

Open an issue or reach out to the maintainers.

Happy contributing! 🚀
