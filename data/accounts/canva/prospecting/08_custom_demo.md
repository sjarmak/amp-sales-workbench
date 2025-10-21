---
title: Custom Demo Script - Canva
company: Canva
date: 2025-10-20
authors: [Amp Sales Team]
personas: [CTO, VP Engineering, Engineering Director, Senior Engineers]
keywords: [demo, use cases, ai development, developer platform, microservices]
confidence: high
sources_count: 13
---

# Custom Demo Script: Canva

## Demo Overview

**Duration**: 30-45 minutes  
**Format**: Live demonstration with Canva-specific scenarios  
**Prerequisites**: Access to demo codebase with Python/Django and JavaScript/React components

---

## Demo Flow

1. **AI Feature Development** (10 minutes) - High priority given Leonardo.Ai/MagicBrief acquisitions
2. **API Platform Development** (10 minutes) - Critical for developer platform expansion
3. **Microservices Debugging** (10 minutes) - Key pain point at scale
4. **Q&A & Advanced Features** (10 minutes) - Oracle, MCP integration, AGENTS.md

---

## Use Case 1: AI Feature Development Velocity

### Context

**Canva's need**: 
- Magic Studio used 18B+ times [^1]
- Leonardo.Ai acquisition (July 2024) bringing visual AI capabilities [^2]
- MagicBrief acquisition ($22.5M, June 2025) for creative intelligence [^3]
- Need to rapidly integrate and iterate on AI features

**Amp capability mapping**:
- Large context windows (1M tokens) to understand ML pipelines
- Subagents for parallel AI feature work
- Oracle for architectural review of AI integrations
- AGENTS.md for AI/ML coding standards

### Demo Scenario

**Setup**: "Let's say you're integrating Leonardo.Ai's image generation API into a new Canva feature. This involves:
- Adding a new API client in Python
- Creating frontend components in React/JavaScript
- Implementing error handling and rate limiting
- Writing tests for the integration"

### Steps

**Step 1: Multi-file AI feature implementation (5 minutes)**

```
User: "Implement Leonardo.Ai image generation integration:
- Create Python client in services/leonardo_client.py
- Add React component in components/AiImageGenerator.tsx
- Include rate limiting, error handling, and loading states
- Follow our existing AI service patterns"
```

**Amp actions**:
1. Searches codebase for existing AI service patterns (e.g., Magic Studio integrations)
2. Reads AGENTS.md for Python/Django and React conventions
3. Creates `services/leonardo_client.py` with:
   - API authentication
   - Rate limiting using existing patterns
   - Error handling matching Canva's error taxonomy
   - Logging with structured metadata
4. Creates `components/AiImageGenerator.tsx` with:
   - Loading states matching design system
   - Error boundaries
   - Accessibility compliance
5. Generates unit tests for both files

**Key highlight**: "Notice how Amp found your existing Magic Studio integration patterns and automatically matched the same error handling, logging format, and API client structure. It read your design system docs to use the correct loading component."

**Success metrics**:
- 30-45 minutes of work completed in 3-5 minutes
- Consistent with existing codebase patterns
- No manual pattern hunting or copy-paste errors

**Step 2: Oracle architectural review (3 minutes)**

```
User: "@oracle Review this Leonardo.Ai integration for:
- Performance implications at scale (240M users)
- Security best practices for API key handling
- Error recovery and fallback strategies
- Integration with our experimentation platform"
```

**Oracle analysis** (show example output):
- Identifies potential rate limit issues at Canva's scale
- Suggests connection pooling optimization
- Recommends circuit breaker pattern for API failures
- Notes missing integration with experimentation platform for A/B testing

**Key highlight**: "Oracle uses GPT-5 reasoning to think through complex architectural issues. At your scale of 240M users and 1.2M requests/day [^4], these considerations are critical."

**Step 3: Implement Oracle's recommendations (2 minutes)**

```
User: "Implement Oracle's circuit breaker and experimentation platform integration recommendations"
```

**Amp actions**:
- Adds circuit breaker using existing resilience library
- Integrates with Canva's in-house experimentation platform [^5]
- Updates tests to cover new error scenarios

### Risk Mitigations

**Concern**: "Will Amp know our internal AI/ML patterns?"  
**Solution**: AGENTS.md documents your patterns; Amp learns from existing code

**Concern**: "API keys in code?"  
**Solution**: Amp follows existing secrets management patterns; never hardcodes keys

**Concern**: "Code quality at speed?"  
**Solution**: Oracle review catches issues; maintains consistency with codebase

---

## Use Case 2: API Platform Development

### Context

**Canva's need**:
- Developer platform hit 1B app uses, 300 apps in marketplace [^6]
- Launched Content Query API, Design Editing API, Tables API [^6]
- 95% of Fortune 500 use Canva [^7] - enterprise API requirements
- Need consistent, well-documented APIs at scale

**Amp capability mapping**:
- AGENTS.md for API design standards
- Large context for understanding related endpoints
- Automatic documentation generation
- Subagents for parallel endpoint development

### Demo Scenario

**Setup**: "You're building a new 'Brand Assets API' for enterprise customers to programmatically manage logos, color palettes, and fonts. This needs to follow your existing API conventions."

### Steps

**Step 1: API endpoint generation (4 minutes)**

```
User: "Create Brand Assets API with endpoints:
- GET /v1/brand-assets - List all brand assets
- POST /v1/brand-assets - Create new asset
- GET /v1/brand-assets/{id} - Get specific asset
- PUT /v1/brand-assets/{id} - Update asset
- DELETE /v1/brand-assets/{id} - Delete asset

Follow our API patterns: Django REST framework, authentication, pagination, rate limiting, OpenAPI docs"
```

**Amp actions**:
1. Searches for existing API patterns (e.g., Design Editing API)
2. Creates Django views/serializers matching conventions:
   - Same authentication decorators
   - Consistent error response format
   - Standard pagination (100 items default)
   - Rate limiting annotations
3. Generates OpenAPI/Swagger documentation
4. Creates comprehensive tests

**Key highlight**: "Amp found your Design Editing API and Content Query API patterns and replicated the exact same structure - authentication, pagination, error handling, even the response envelope format."

**Step 2: Parallel test development with subagents (3 minutes)**

```
User: "@task Write integration tests for all Brand Assets API endpoints"
User: "@task Write unit tests for serializers and business logic"
User: "@task Generate Postman collection for manual testing"
```

**Amp actions**:
- Launches 3 subagents working in parallel
- Agent 1: Integration tests with fixtures
- Agent 2: Unit tests covering edge cases
- Agent 3: Postman collection with example requests

**Key highlight**: "With 626 engineers and a growing developer platform [^8], parallelizing work like this means faster delivery without sacrificing quality. Each subagent works independently."

**Step 3: Documentation generation (2 minutes)**

```
User: "Generate developer documentation for Brand Assets API including:
- Getting started guide
- Authentication setup
- Code examples in Python, JavaScript, and cURL
- Rate limits and best practices"
```

**Amp actions**:
- Reads existing API docs for style/format
- Generates markdown documentation
- Creates code examples in multiple languages
- Includes rate limiting guidance based on existing patterns

**Success metrics**:
- Complete CRUD API with tests and docs in ~10 minutes
- 100% consistent with existing API patterns
- Ready for developer platform marketplace

### Risk Mitigations

**Concern**: "Breaking changes to existing APIs?"  
**Solution**: Amp only creates new code; doesn't modify existing endpoints without explicit instruction

**Concern**: "OpenAPI spec accuracy?"  
**Solution**: Generated from actual code, not aspirational; stays in sync

**Concern**: "Enterprise security requirements?"  
**Solution**: Follows existing auth patterns; can integrate with Canva's security review process

---

## Use Case 3: Microservices Debugging & Cross-Service Understanding

### Context

**Canva's need**:
- Evolved from EC2 monolith to microservices architecture [^4]
- Handles 1.2M requests/day, 450 designs/second [^4]
- Complex distributed systems with service dependencies
- Engineers need to understand cross-service flows

**Amp capability mapping**:
- Librarian for cross-repository search
- Large context to understand service interactions
- Oracle for debugging complex multi-service issues
- Grep/search across multiple codebases

### Demo Scenario

**Setup**: "A customer reports slow design exports. The export flow touches 5 services: API Gateway → Export Service → Storage Service → Render Service → Notification Service. Let's debug this."

### Steps

**Step 1: Cross-service investigation (3 minutes)**

```
User: "Find all code related to design export flow across our services. Start with the API endpoint and trace through to notification."
```

**Amp actions**:
1. Searches API Gateway for `/export` endpoints
2. Traces calls to Export Service
3. Follows Storage Service integration
4. Maps Render Service dependencies
5. Identifies Notification Service triggers
6. Presents flow diagram with file locations

**Key highlight**: "With microservices, understanding the full flow is critical. Amp's Librarian searched across all your repositories (public and private GitHub repos you've granted access to) to map this end-to-end."

**Step 2: Oracle debugging session (4 minutes)**

```
User: "@oracle Debug this export performance issue. Symptoms:
- 95th percentile latency increased from 2s to 8s
- Only affects exports >50MB
- Started after last week's deploy

Analyze the export flow code and identify likely causes."
```

**Oracle analysis** (show example):
- Reviews code across all 5 services
- Identifies synchronous S3 upload added in last deploy
- Notes missing streaming for large files
- Recommends async upload with progress callbacks
- Suggests adding timeout configurations

**Key highlight**: "Oracle reasoned through the entire distributed system, found the recent change that introduced synchronous blocking, and recommended the fix. This would take a senior engineer 30-60 minutes of investigation."

**Step 3: Implement fix (3 minutes)**

```
User: "Implement Oracle's recommendation: convert to async streaming upload for files >50MB with progress callbacks"
```

**Amp actions**:
- Modifies Export Service to use streaming upload
- Adds progress callback to Notification Service
- Updates timeout configs
- Generates tests for large file scenarios

**Success metrics**:
- Complex multi-service bug diagnosed in <10 minutes
- Fix implemented with confidence
- Reduced MTTR (Mean Time To Resolution)

### Risk Mitigations

**Concern**: "Will Amp understand our specific microservices architecture?"  
**Solution**: Large context windows (1M tokens) can load multiple services; learns from codebase structure

**Concern**: "Confidential service logic?"  
**Solution**: Zero data retention option; data never used for training

**Concern**: "Breaking changes across services?"  
**Solution**: Amp can run tests across services; integrates with CI/CD for validation

---

## Use Case 4 (Bonus): Internal Platform Development

### Context

**Canva's need**:
- Built in-house experimentation platform to democratize A/B testing [^5]
- Need to build more internal tools to scale 626 engineers [^8]
- Reduce bottlenecks (e.g., data scientists for experiments)

**Amp capability mapping**:
- TypeScript SDK for custom agent development
- MCP integration for internal tools
- Toolboxes for custom scripts

### Demo Scenario (if time permits)

**Setup**: "Let's build a custom Amp agent that automates experiment setup in your platform."

```typescript
import { execute } from '@sourcegraph/amp';

// Custom agent using Amp SDK
const result = await execute({
  prompt: `Create A/B test in Canva experimentation platform:
    - Experiment: New AI image gen button placement
    - Variants: Control (right panel), Treatment (top toolbar)
    - Metrics: Click-through rate, time-to-first-use
    - Rollout: 5% traffic, Australia only
    - Duration: 2 weeks`,
  context: {
    experimentPlatformDocs: './docs/experimentation-platform.md',
    configTemplate: './templates/experiment-config.yaml'
  }
});
```

**Key highlight**: "Amp's TypeScript SDK lets you build custom automation for your internal platforms. This experimentation agent could be triggered from Slack, JIRA, or your planning tools."

---

## Advanced Features Deep Dive (Q&A)

### AGENTS.md Convention System

**Show example AGENTS.md for Canva**:

```markdown
# Canva Engineering Conventions

## Languages & Frameworks
- **Python/Django**: Use for backend services
- **JavaScript/React**: Use for frontend components
- **Java**: Use for performance-critical services

## Commands
- **Test**: `pytest` for Python, `jest` for JavaScript
- **Lint**: `pylint`, `eslint`
- **Typecheck**: `mypy`, `tsc`

## API Design
- All APIs must follow REST conventions
- Use Django REST Framework serializers
- Authentication: Token-based (see auth/middleware.py)
- Rate limiting: 100 req/min for standard, 1000 for premium
- Pagination: Default 100 items, max 500

## AI/ML Code
- Store model configs in `ml_configs/`
- Use our ModelRegistry for version control
- All AI endpoints must have fallbacks
- Integrate with experimentation platform for A/B tests

## Error Handling
- Use structured logging (see logging/config.py)
- Error codes: 4-digit format (e.g., ERR-1234)
- User-facing errors must be friendly
```

**Benefit**: "Every AI-generated code follows these rules automatically. No more 'this doesn't match our style' in code reviews."

### MCP Integration for Internal Tools

**Explain**: "Canva has a developer platform with MCP server support [^6]. Amp can connect to your internal MCP servers - deployment tools, monitoring, feature flags, experimentation platform - giving it contextual awareness of your infrastructure."

**Example use case**:
```
User: "Deploy Brand Assets API to staging and run smoke tests"
```

Amp (via MCP):
1. Connects to Canva's deployment MCP server
2. Triggers staging deploy
3. Waits for health check
4. Runs smoke tests
5. Reports results

### Enterprise Features

**Address Canva's scale (626 engineers, 5 locations)**:

1. **SSO Integration**: Single sign-on for seamless access
2. **Zero Data Retention**: Code never stored or used for training
3. **Team Workspaces**: Shared context across engineering teams
4. **Tool Permissions**: Granular control (e.g., read-only for contractors)
5. **Pooled Billing**: Simplified billing for entire org

**Pricing context**: "For organizations at your scale, we offer enterprise plans with volume discounts. Let's discuss your specific needs."

---

## Demo Success Criteria

### Attendee Engagement Signals
- Asking detailed technical questions
- Sharing specific pain points or use cases
- Discussing pilot program logistics
- Requesting access for their team

### Clear Next Steps
1. **Pilot program**: 10-20 engineers, 2-4 weeks, specific use case
2. **Technical deep dive**: Security review, architecture session
3. **ROI analysis**: Measure productivity gains with metrics

---

## Common Objections & Responses

### "We already use GitHub Copilot"

**Response**: "Copilot excels at line-level completions. Amp is designed for different challenges:
- **Multi-file changes**: Copilot suggests one file at a time; Amp coordinates changes across services
- **Large context**: Copilot sees ~10KB; Amp handles 1M tokens (entire microservices)
- **Reasoning**: Oracle uses GPT-5 for architectural analysis, not just code generation
- **Customization**: AGENTS.md, MCP integration, toolboxes for your specific needs

Many teams use both - Copilot for fast typing, Amp for complex tasks."

### "How is this different from Cursor or Windsurf?"

**Response**: "Great question. Key differentiators:
- **Context scale**: 1M token windows vs. typical 200K
- **Oracle reasoning**: GPT-5 for deep analysis and planning
- **Subagents**: Parallel task execution for complex workflows
- **MCP ecosystem**: Deep integration with internal tools
- **Enterprise focus**: SSO, zero retention, permissions at scale
- **TypeScript SDK**: Build custom agents for your workflows

Cursor/Windsurf are excellent IDEs. Amp is a reasoning engine that happens to write code."

### "What about security and data privacy?"

**Response**: "Critical for Canva given your Fortune 500 customer base [^7]:
- **Zero data retention**: Your code never stored; not used for training
- **SOC 2 compliance**: [Check current status]
- **SSO integration**: Leverage your existing identity provider
- **On-prem option**: [If available] For highest security requirements
- **Tool permissions**: Control what Amp can access/modify
- **Audit logs**: Track all Amp actions for compliance

We can do a full security review with your team before pilot."

### "How do we measure ROI?"

**Response**: "Let's define success metrics for your pilot:

**Quantitative**:
- Time savings per engineer per day (target: 30-60 minutes)
- Reduction in PR cycle time (target: 20-30% faster)
- Increase in code commits/week (target: 15-25% more output)
- Reduction in bug escape rate (target: maintain or improve)

**Qualitative**:
- Engineer satisfaction scores
- Time spent on "boring" vs. creative work
- Onboarding speed for new engineers

**At Canva's scale** (626 engineers [^8]):
- 30 min/day savings = 313 hours daily = ~1.95 FTE
- At $150K avg salary = ~$293K annual value from time savings alone
- Not including quality improvements, faster feature delivery, reduced oncall burden

We'll track these during your pilot."

---

## Post-Demo Follow-Up

### Immediately After Demo

**Send**:
1. Recording link (if permitted)
2. This demo script for reference
3. Amp manual: https://ampcode.com/manual
4. Amp news (recent updates): https://ampcode.com/news

### Within 24 Hours

**Action items**:
1. Draft pilot program proposal with:
   - Specific use case(s) from demo
   - Success metrics
   - Timeline (2-4 weeks)
   - Participant selection (10-20 engineers)
2. Schedule technical deep dive (if needed)
3. Connect with Canva's security team (if required)

### Within 1 Week

**Goal**: Signed pilot agreement or clear next steps

---

## Canva-Specific Talking Points Summary

### Why Amp for Canva?

1. **AI development velocity**: Integrate Leonardo.Ai and MagicBrief faster with AI-assisted development [^2][^3]
2. **Developer platform scale**: Build consistent APIs for 1B+ app uses with AGENTS.md conventions [^6]
3. **Microservices complexity**: Navigate distributed systems with Librarian and large context [^4]
4. **Engineering culture**: Brendan's vision of engineers using AI tools intelligently - Amp is that tool [^9]
5. **Global team alignment**: 626 engineers across 5 locations need consistent standards [^8]
6. **Experimentation platform**: Accelerate internal tool development with TypeScript SDK [^5]
7. **Enterprise requirements**: SSO, zero retention, permissions for Fortune 500 customers [^7]

### Competitor Positioning

**vs. GitHub Copilot**: Multi-file changes, reasoning, large context  
**vs. Cursor/Windsurf**: Oracle reasoning, MCP integration, enterprise features, SDK  
**vs. Building in-house**: Faster time-to-value, maintained by Sourcegraph, immediate features

### Key Proof Points

- **Context**: 1M tokens = entire microservices architecture
- **Speed**: 30-60 min daily savings per engineer
- **Quality**: Maintains conventions via AGENTS.md
- **Scale**: Enterprise features for 626-engineer teams [^8]
- **Reasoning**: GPT-5 Oracle for complex debugging

---

## Citations

[^1]: Bessemer Venture Partners, "The Cloud 100 Benchmarks Report 2025", 2025-03-09, https://www.bvp.com/atlas/the-cloud-100-benchmarks-report
[^2]: SmartCompany, "Canva snaps up Leonardo.AI in blockbuster acquisition", 2024-07-30, https://www.smartcompany.com.au/finance/canva-snaps-up-leonardo-ai-blockbuster-acquisition/
[^3]: Forbes Australia, "Canva to acquire Australian AI platform MagicBrief", 2025-06-18, https://www.forbes.com.au/news/innovation/canva-to-acquire-australian-ai-platform-magicbrief/
[^4]: Amazon/AWS, "AWS re:Invent 2024 announcements and keynote updates", 2024-12-06, https://www.aboutamazon.com/news/aws/aws-reinvent-2024-keynote-live-news-updates
[^5]: Canva Engineering Blog, "How we build experiments in-house", 2024-06-27, https://www.canva.dev/blog/engineering/how-we-build-experiments-in-house/
[^6]: BusinessWire, "Canva Expands Developer Platform As App Uses Surpass 1 Billion", 2024-09-25, https://www.businesswire.com/news/home/20240925330023/en/Canva-Expands-Developer-Platform-As-App-Uses-Surpass-1-Billion
[^7]: BusinessWire, "Canva Expands Developer Platform As App Uses Surpass 1 Billion", 2024-09-25, https://www.businesswire.com/news/home/20240925330023/en/Canva-Expands-Developer-Platform-As-App-Uses-Surpass-1-Billion
[^8]: Getlatka, "How Canva hit $2.7B revenue and 150M customers in 2024", 2024-10-01, https://getlatka.com/companies/canva
[^9]: Fortune, "How companies are rethinking their vetting of engineering candidates", 2025-07-02, https://fortune.com/2025/07/02/software-engineers-hiring-job-interviews-ai-coding-assistants/