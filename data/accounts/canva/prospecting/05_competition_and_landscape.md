---
title: Competition and Landscape Analysis
company: Canva
date: 2025-10-20
authors: [Amp Research Team]
personas: [Brendan Humphreys - CTO, VP Engineering, Engineering Directors]
keywords: [AI coding tools, developer productivity, GitHub Copilot, Cursor, microservices, developer platform, AI integration]
confidence: high
sources_count: 13
---

# Competition and Landscape Analysis

## Competitive Environment

### Incumbent AI Coding Tools

Canva's engineering team is likely evaluating or already using:

- **GitHub Copilot**: Most widely adopted AI coding assistant, strong IDE integration
- **Cursor**: Popular AI-first code editor with strong chat capabilities
- **Windsurf**: Emerging competitor in AI coding space
- **Other AI assistants**: Various tools in rapid market expansion

**Source**: Research bundle competitive analysis

### Canva's Current Technology Partners

Canva has established partnerships with:

- **AWS**: Primary cloud infrastructure provider, featured at re:Invent 2024 ([AWS re:Invent 2024](https://www.aboutamazon.com/news/aws/aws-reinvent-2024-keynote-live-news-updates), 2024-12-06)
- **Google**: Veo 3 integration for video capabilities
- **Integration platforms**: Workato, Zapier, Make for enterprise workflows
- **Salesforce**: CRM and enterprise integrations

### Canva's Developer Ecosystem

Canva operates its own developer platform:

- **1 billion app uses** reached, 75M monthly active uses ([BusinessWire](https://www.businesswire.com/news/home/20240925330023/en/Canva-Expands-Developer-Platform-As-App-Uses-Surpass-1-Billion), 2024-09-25)
- **300 apps** in marketplace across **122 countries**
- **MCP server availability**: Canva has published an MCP server, indicating openness to AI agent integrations

## Market Positioning: Why Amp vs. Alternatives

### Amp's Differentiated Strengths for Canva

#### 1. **Extreme Scale Context Handling**

**Canva's Challenge**: Managing complexity across microservices architecture handling 1.2M requests/day with 450 designs/second ([AWS re:Invent](https://www.aboutamazon.com/news/aws/aws-reinvent-2024-keynote-live-news-updates), 2024-12-06)

**Amp's Edge**:
- **1 million token context windows** for understanding large codebases ([Amp Manual](https://ampcode.com/manual))
- **432,000+ token processing** for complex multi-file changes ([Amp News](https://ampcode.com/news))
- **Librarian tool** for cross-repository research in public/private GitHub repos

**Competitive Gap**: GitHub Copilot and Cursor have significantly smaller context windows, limiting their ability to understand Canva's complex distributed systems.

#### 2. **Oracle for Architectural Decisions**

**Canva's Challenge**: Scaling from monolith to microservices, integrating AI acquisitions (Leonardo.Ai, MagicBrief)

**Amp's Edge**:
- **GPT-5-powered Oracle** for deep code review and architectural analysis ([Amp Manual](https://ampcode.com/manual#oracle))
- Complex debugging assistance across multi-service issues
- Strategic planning for large refactoring efforts

**Competitive Gap**: Most AI coding tools focus on code completion, not strategic architectural guidance. CTO Brendan Humphreys explicitly wants engineers who work "intelligently" with AI tools ([Fortune](https://fortune.com/2025/07/02/software-engineers-hiring-job-interviews-ai-coding-assistants/), 2025-07-02) - Oracle provides this intelligence layer.

#### 3. **MCP Integration for Custom Tooling**

**Canva's Challenge**: Building internal experimentation platforms, managing custom workflows across 626 engineers

**Amp's Edge**:
- **Model Context Protocol integration** to connect internal tools ([Amp Manual](https://ampcode.com/manual#mcp-integration))
- **Canva already publishes MCP server** - natural integration point
- Connect to playwright, semgrep, linear, custom APIs

**Competitive Gap**: Amp's MCP support enables Canva to extend AI assistance to their proprietary internal tools and workflows, while other tools remain limited to general-purpose coding.

#### 4. **Subagents for Parallel Development**

**Canva's Challenge**: 626 engineers across Sydney, Manila, London, Austin, Beijing working on massive codebase

**Amp's Edge**:
- **Parallel subagents** for independent tasks ([Amp Manual](https://ampcode.com/manual#subagents))
- Convert CSS to Tailwind across multiple components simultaneously
- Handle complex migrations with isolated agents

**Competitive Gap**: Other tools process serially; Amp can parallelize work to match Canva's scale.

#### 5. **AGENTS.md for Engineering Standards**

**Canva's Challenge**: Maintaining code quality and consistency across distributed global teams

**Amp's Edge**:
- **AGENTS.md guidance system** for codebase conventions ([Amp Manual](https://ampcode.com/manual#agents-md))
- Specify build, test, lint commands once
- Language-specific rules with glob patterns

**Competitive Gap**: Canva can encode their engineering standards once, ensuring all AI-generated code follows their conventions - critical for their scale.

#### 6. **JetBrains Support for Java Development**

**Canva's Tech Stack**: Java is in their stack ([Canva Engineering Blog](https://www.canva.dev/blog/engineering/how-we-build-experiments-in-house/), 2024-06-27)

**Amp's Edge**:
- **JetBrains IDE integration** for Java, Kotlin, Scala ([Amp News](https://ampcode.com/news))
- Native support for IntelliJ-based workflows

**Competitive Gap**: Better Java development experience than Cursor (VS Code-based).

## "So What for the Demo?"

### What to Show Canva's CTO and Engineering Leaders

#### **Demo Scenario 1: Navigating Microservices Complexity**

**Setup**: "You mentioned evolving from a monolith to microservices handling 1.2M requests/day. Let's say you need to trace a bug across multiple services."

**Show**:
1. **Librarian** searching across multiple repositories to find service dependencies
2. **1M token context** loading 10+ service files simultaneously
3. **Oracle** analyzing the architectural flow and identifying the root cause
4. **Multi-file edits** fixing the issue across 3 services in one operation

**Impact**: "Traditional AI coding tools can't hold this much context. You'd be switching between tools, losing context, manually connecting the dots. Amp keeps everything in working memory."

#### **Demo Scenario 2: AI Feature Development (Leonardo.Ai/MagicBrief Integration)**

**Setup**: "With Leonardo.Ai and MagicBrief acquisitions, you're integrating new AI capabilities rapidly. Let's integrate a new AI model endpoint."

**Show**:
1. **Subagents** working in parallel: one updates API client, another adds TypeScript types, third writes tests
2. **AGENTS.md** enforcing Canva's coding standards automatically
3. **Amp Tab completions** suggesting next implementation steps based on diagnostics
4. **Oracle** reviewing the integration for security, performance, error handling

**Impact**: "You told Fortune you're hiring engineers who work intelligently with AI. This is that workflow. Engineers stay in strategic mode while Amp handles the implementation details - exactly what you're looking for."

#### **Demo Scenario 3: Developer Platform API Development**

**Setup**: "Your developer platform hit 1 billion uses. Let's add a new API endpoint to your Content Query API."

**Show**:
1. **Read existing API patterns** from codebase using Grep/finder
2. **Generate new endpoint** matching Canva's conventions via AGENTS.md
3. **Write OpenAPI spec** and implementation simultaneously
4. **Add tests** that follow existing test patterns
5. **Run build/check commands** to verify everything works

**Impact**: "This took 3 minutes. With Copilot, you'd get code suggestions but still manually wire up tests, docs, validation. Amp understands your entire development workflow."

## Pilot Options

### **Pilot Option 1: Developer Platform Team (2-4 weeks)**

**Target Team**: API development team building Content Query, Design Editing, Tables APIs

**Objectives**:
- Accelerate API endpoint development by 30%+
- Reduce time from API design to tested implementation
- Improve API documentation consistency

**Success Metrics**:
- API endpoints shipped per sprint
- Time to implement new endpoint (design → tested code)
- Developer satisfaction scores
- Code review cycle time reduction

**Rollout**:
1. **Week 1**: Onboard 3-5 senior engineers with AGENTS.md setup
2. **Week 2**: Expand to 10 engineers, measure baseline metrics
3. **Week 3-4**: Full team usage, collect feedback, iterate on AGENTS.md conventions

**Why This Team**:
- High-impact work: developer platform affects 300+ external apps
- Clear metrics: API development has measurable velocity
- Pattern-heavy work: APIs follow conventions - perfect for AI code generation
- Brendan Humphreys (CTO) closely involved with platform strategy

**Integration Points**:
- Connect Amp to Canva's MCP server for internal tool access
- Configure AGENTS.md with API development standards
- Set up JetBrains/VS Code integrations for team's preferred IDEs

### **Pilot Option 2: Experimentation Platform Team (2-4 weeks)**

**Target Team**: Team maintaining in-house experimentation platform

**Objectives**:
- Accelerate platform feature development
- Improve code quality for self-service features
- Reduce technical debt accumulation

**Success Metrics**:
- Feature delivery velocity (self-service capabilities shipped)
- Reduction in data scientist support requests
- Code review approval time
- Test coverage improvements

**Rollout**:
1. **Week 1**: Onboard 2-3 platform engineers
2. **Week 2**: Use Amp for one complete feature (e.g., new experiment type)
3. **Week 3-4**: Expand to broader team, tackle technical debt backlog

**Why This Team**:
- Strategic priority: democratizing experimentation is a stated goal ([Canva Engineering Blog](https://www.canva.dev/blog/engineering/how-we-build-experiments-in-house/), 2024-06-27)
- Complex internal tooling: perfect use case for Oracle's architectural guidance
- Python/Django stack: Amp excels with Python
- Clear "before/after": currently bottlenecked by data scientists

**Integration Points**:
- Configure Python/Django specific AGENTS.md rules
- Set up Oracle for architectural reviews of new platform features
- Use subagents for parallel work on frontend/backend/data layer

## Recommended Approach

**Start with Pilot Option 1 (Developer Platform Team)** because:

1. **CTO visibility**: Platform work is strategic, Brendan Humphreys will see impact directly
2. **External multiplier**: Improvements affect 300 apps, 122 countries of developers
3. **Measurable impact**: API velocity is quantifiable
4. **Proof point for rollout**: Success here justifies expanding to all 626 engineers

**Expansion path after pilot**:
1. Developer Platform Team (pilot) → 3-5 engineers
2. Experimentation Platform Team → 5-10 engineers  
3. AI Integration Teams (Leonardo.Ai, MagicBrief) → 20-30 engineers
4. Microservices Infrastructure Teams → 50-100 engineers
5. Full Engineering Organization → 626 engineers

## Key Objections and Responses

### "We already use GitHub Copilot across the team"

**Response**: "Copilot is great for line-level completions. But you're working at a different scale now - 1.2M requests/day across microservices, integrating AI acquisitions, managing a developer platform with 1B uses. You need a tool that understands your entire architecture, not just the next line. That's what Amp's 1M token context and Oracle provide. Think of Amp as your senior engineer pair programming, while Copilot is autocomplete."

### "How is this different from Cursor?"

**Response**: "Three critical differences for Canva:
1. **Scale**: Amp's context windows are 5-10x larger - essential for your microservices complexity
2. **Reasoning**: Oracle gives you GPT-5 architectural guidance, not just code generation
3. **Extensibility**: MCP integration means Amp works with your internal tools - you already publish an MCP server, so this is a natural fit

Cursor is excellent for smaller codebases. At 626 engineers and your architectural complexity, you need Amp's capabilities."

### "AI tools hallucinate and produce buggy code"

**Response**: "Valid concern. That's why Amp has:
1. **AGENTS.md**: Your conventions become enforceable rules, not suggestions
2. **Oracle review mode**: GPT-5 reviews code before it goes out
3. **Lint/test integration**: Amp runs your existing quality checks automatically
4. **Tool permissions**: You control exactly what Amp can do

You told Fortune you want engineers who use AI 'intelligently' - Amp's design embodies that intelligence through guardrails and oversight."

### "This will replace our engineers"

**Response**: "Brendan said it perfectly in his Fortune interview - you're looking for engineers who work intelligently WITH AI tools. Amp makes your 626 engineers more effective, not redundant. They spend time on architecture, product decisions, complex debugging - the high-value work. Amp handles the mechanical coding. You're shipping more features with the same team, not fewer features with fewer people."

## Pricing Context

**Canva's Scale**: 626 engineers

**Amp Enterprise Pricing** ([Amp Manual](https://ampcode.com/manual#pricing)):
- SSO integration
- Zero data retention option (critical for Canva's IP)
- Managed org-wide settings
- Pooled billing
- Team workspaces

**Estimated Investment**: ~$50-60/engineer/month for 626 seats = ~$375K-450K annually

**ROI Calculation**:
- **30% productivity gain** (conservative) × 626 engineers = 188 engineer-equivalents
- At $150K loaded cost/engineer = **$28M annual value**
- **ROI: 62-75x**

**Comparable Investments**: Canva spent $22.5M on MagicBrief acquisition ([Forbes Australia](https://www.forbes.com.au/news/innovation/canva-to-acquire-australian-ai-platform-magicbrief/), 2025-06-18). Amp delivers similar strategic value for 2% of that cost.

## Next Steps

1. **Technical deep-dive**: Brendan Humphreys + VP Engineering (30 min)
2. **Pilot planning**: Identify Developer Platform team lead, scope first sprint
3. **AGENTS.md workshop**: Work with team to encode Canva's conventions (1 hour)
4. **Pilot kickoff**: Onboard 3-5 engineers, begin metrics collection
5. **Week 2 check-in**: Review metrics, adjust approach
6. **Week 4 results review**: Present data to leadership, plan rollout

---

**Key Insight**: Canva is explicitly preparing for an AI-augmented engineering culture (Fortune interview). They're evaluating tools NOW. First mover advantage goes to the vendor who demonstrates the most sophisticated AI partnership - that's Amp's Oracle + context + extensibility story.