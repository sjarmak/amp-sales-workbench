---
title: Tech Stack & Engineering Signals
company: Canva
date: 2025-10-20
authors: [Amp Research]
personas: [Brendan Humphreys - CTO, VP Engineering, Engineering Directors]
keywords: [tech stack, microservices, AWS, Python, Django, developer productivity, AI tools, engineering culture]
confidence: high
sources_count: 13
---

# Tech Stack & Engineering Signals

## Technology Infrastructure

### Core Stack

**Backend & Languages**
- Python with Django framework
- JavaScript and Java
- AWS Lambda for serverless functions
- MySQL databases

*Source: [Canva Engineering Blog - Experimentation Platform](https://www.canva.dev/blog/engineering/how-we-build-experiments-in-house/), June 2024*

**AWS Infrastructure**
- Amazon RDS MySQL for relational data
- Amazon DynamoDB for NoSQL workloads
- AWS EC2 (legacy monolith infrastructure)
- Evolved from EC2 monolith to distributed microservices architecture

*Source: [AWS re:Invent 2024 - Brendan Humphreys Keynote](https://www.aboutamazon.com/news/aws/aws-reinvent-2024-keynote-live-news-updates), Dec 2024*

### Scale Metrics

**Platform Performance**
- 1.2 million requests per day
- 450 new designs created every second
- 240 million monthly active users across 190 countries

*Sources: [AWS re:Invent 2024](https://www.aboutamazon.com/news/aws/aws-reinvent-2024-keynote-live-news-updates), [Life at Canva](https://www.lifeatcanva.com/en/teams/engineering/)*

**Engineering Organization**
- 626 engineers (8% of 7,574 total employees)
- Distributed across Sydney, Manila, London, Austin, Beijing
- Founding engineer (now CTO) joined 11+ years ago

*Source: [Getlatka - Canva Metrics](https://getlatka.com/companies/canva), Oct 2024*

## Job-to-be-Done Signals

### 1. Developer Velocity at Scale

**Signal**: Canva built an in-house experimentation platform to democratize A/B testing and reduce data scientist bottlenecks.

**Quote from Source**: "We wanted to enable product teams to run experiments without depending on data scientists for every test setup."

*Source: [Canva Engineering Blog](https://www.canva.dev/blog/engineering/how-we-build-experiments-in-house/), June 2024*

**Implications**: 
- Engineering team is building complex internal platforms
- Need for faster iteration and self-service tools
- Reducing dependencies between teams is a priority

### 2. AI-First Engineering Culture

**Signal**: CTO Brendan Humphreys changed engineering interview assessments to evaluate candidates' ability to work intelligently with AI coding tools.

**Quote from Source**: "We're now assessing how well candidates can leverage AI assistance in their coding workflows, not just raw coding ability."

*Source: [Fortune - Engineering Hiring Evolution](https://fortune.com/2025/07/02/software-engineers-hiring-job-interviews-ai-coding-assistants/), July 2025*

**Implications**:
- Leadership explicitly wants AI-augmented developers
- Engineering culture is shifting toward AI tool proficiency
- Strategic investment in developer tooling expected

### 3. Microservices Complexity Management

**Signal**: Architecture evolved from EC2 monolith to sophisticated microservices handling massive scale.

**Context**: CTO presented at AWS re:Invent 2024 about managing complexity as infrastructure grew from simple monolith to distributed systems serving 240M users.

*Source: [AWS re:Invent 2024](https://www.aboutamazon.com/news/aws/aws-reinvent-2024-keynote-live-news-updates), Dec 2024*

**Implications**:
- Engineers need better tools to navigate complex codebases
- Cross-service debugging and understanding is challenging
- Code quality and consistency across services is critical

### 4. Developer Platform & API Expansion

**Signal**: Developer platform reached 1 billion app uses with 300 apps in marketplace across 122 countries. New APIs launched: Content Query API, Design Editing API, Tables API, Authentication API.

*Source: [BusinessWire - Developer Platform Expansion](https://www.businesswire.com/news/home/20240925330023/en/Canva-Expands-Developer-Platform-As-App-Uses-Surpass-1-Billion), Sept 2024*

**Implications**:
- Extensive API development requires robust tooling
- Both internal and external developers need support
- Documentation and code quality are critical for ecosystem

### 5. AI Feature Development Acceleration

**Signal**: Magic Studio and AI tools used 18+ billion times. Acquisitions of Leonardo.Ai (July 2024) and MagicBrief ($22.5M, June 2025) to accelerate AI capabilities.

*Sources: [BVP Cloud 100 Report](https://www.bvp.com/atlas/the-cloud-100-benchmarks-report), [SmartCompany - Leonardo.Ai](https://www.smartcompany.com.au/finance/canva-snaps-up-leonardo-ai-blockbuster-acquisition/), [Forbes - MagicBrief](https://www.forbes.com.au/news/innovation/canva-to-acquire-australian-ai-platform-magicbrief/)*

**Implications**:
- Heavy AI feature development pipeline
- Integration work from acquisitions
- Need for faster prototyping and experimentation

## Critical Gaps & Pain Points

### Engineering Productivity Gaps

1. **Developer Productivity Tools for 626+ Engineers**
   - Distributed team across 5 global locations
   - Need consistent code quality and conventions
   - Cross-team collaboration at scale

2. **AI-Assisted Development Capabilities**
   - CTO explicitly wants engineers proficient with AI tools
   - Current assessment process tests AI tool competency
   - Gap between aspiration and available enterprise tools

3. **Managing Microservices Complexity**
   - Evolution from monolith created technical debt
   - Understanding cross-service dependencies is challenging
   - Debugging distributed systems requires better tools

4. **Code Quality & Consistency at Scale**
   - 626 engineers need shared standards
   - Multiple languages (Python, JavaScript, Java)
   - Platform code impacts 240M users - high quality bar

5. **Experimentation Platform Evolution**
   - Built in-house solution requires ongoing development
   - Engineering resources spent on internal tooling
   - Could accelerate with better development tools

6. **API Development & Integration**
   - Building extensive public APIs for developer ecosystem
   - Leonardo.Ai and MagicBrief integration work
   - Enterprise Connect APIs for Fortune 500 customers

7. **Technical Debt Across Growing Codebase**
   - Legacy monolith code alongside new microservices
   - Refactoring at scale is time-intensive
   - Need tools to manage large-scale code changes

## So What for the Demo?

### Perfect Amp Use Cases at Canva

**1. Microservices Navigation with Large Context**

Show how Amp's 1M token context window helps engineers understand cross-service dependencies:
- "Show me everywhere the PaymentProcessor service is called across our microservices"
- Oracle can analyze architectural patterns across multiple services
- Finder searches distributed codebases efficiently

**Demo Angle**: "Your CTO talked at re:Invent about managing microservices complexity. Amp's large context windows let your engineers see the full picture across services, not just one file at a time."

**2. AGENTS.md for Consistent Code Quality**

With 626 engineers across 5 locations, code consistency is critical:
- Define Canva coding conventions in AGENTS.md
- Amp generates code following your Python/Django patterns
- Automatically run your test/lint commands after changes

**Demo Angle**: "Distributed teams need consistent standards. AGENTS.md teaches Amp your conventions so every engineer gets code that matches your style, whether they're in Sydney or Austin."

**3. AI-Augmented Engineering (CTO's Vision)**

Brendan explicitly wants engineers who use AI tools intelligently:
- Show multi-file refactoring with Amp subagents
- Oracle for complex debugging and architecture review
- IDE integration for seamless workflow

**Demo Angle**: "Your CTO changed interview assessments to test AI tool competency. Amp is exactly the type of enterprise AI coding assistant that makes engineers 3-5x more productive - the competency you're hiring for."

**4. API Development Acceleration**

Canva is building extensive APIs (Content Query, Design Editing, Tables, Auth):
- Generate API endpoint implementations
- Auto-generate OpenAPI/Swagger documentation
- Write comprehensive API tests

**Demo Angle**: "With 300 apps in your marketplace and 1B app uses, your API quality matters. Amp can generate API implementations, tests, and docs in minutes, not hours."

**5. Acquisition Integration Work**

Leonardo.Ai and MagicBrief acquisitions require code integration:
- Understand unfamiliar codebases quickly with Finder
- Refactor acquired code to match Canva patterns
- Build integration layers between systems

**Demo Angle**: "You just acquired two AI companies. Amp's Finder can map unfamiliar codebases in seconds, and generate integration code that matches your existing patterns."

**6. Experimentation Platform Development**

Canva built internal A/B testing platform - ongoing development needed:
- Accelerate feature development with AI assistance
- Better debugging with Oracle for complex issues
- Faster iteration on internal tools

**Demo Angle**: "You built an experimentation platform in-house. Amp can accelerate internal tool development so your engineers spend less time on tooling and more time on product features."

### Key Differentiators vs. GitHub Copilot/Cursor

1. **Enterprise-Grade Context**: 1M tokens handles Canva's microservices complexity
2. **MCP Integration**: Connect to Canva's internal tools and APIs
3. **Oracle Reasoning**: GPT-5 powered analysis for architectural decisions
4. **Subagents**: Parallel work across multiple services/components
5. **AGENTS.md Guidance**: Codify Canva conventions for consistent output
6. **Zero Data Retention**: Enterprise privacy for 240M user platform

### Proof Points to Mention

- "Used in production by other $1B+ revenue companies"
- "432K+ token context demonstrated in real migrations"
- "JetBrains support for your Java components"
- "TypeScript SDK for custom automation - like your experimentation platform"
- "SSO integration for enterprise teams like yours"

### Risk Mitigation

**Concern**: "We already have GitHub Copilot"

**Response**: "Copilot is great for line-level completions. Amp handles the architecture-level work your CTO described at re:Invent - understanding dependencies across microservices, refactoring entire systems, debugging complex distributed issues. They complement each other."

**Concern**: "Our engineers are already productive"

**Response**: "Absolutely. And your CTO is explicitly hiring for engineers who can use AI tools intelligently. Amp is the enterprise tool that makes your already-great engineers 3-5x more productive on complex tasks - exactly what you're assessing for in interviews now."

**Concern**: "We built our own internal tools"

**Response**: "That's impressive - like your experimentation platform. Amp can actually accelerate building more internal tools, plus integrate with them via MCP. The teams who built your experimentation platform could build the next one 3x faster with Amp."
