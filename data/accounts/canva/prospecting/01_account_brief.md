---
title: Account Brief - Canva
company: Canva
date: 2025-10-20
authors: [Amp Prospect Research]
personas: [CTO, VP Engineering, Engineering Director]
keywords: [AI coding assistant, developer productivity, microservices, Python, Django, AWS, developer platform, enterprise]
confidence: high
sources_count: 13
---

# Account Brief: Canva

## Company Overview

Canva is a global visual communications platform with **240 million monthly active users across 190 countries** and **$2.7B in annual revenue** as of October 2024 ([Getlatka](https://getlatka.com/companies/canva), [Life at Canva](https://www.lifeatcanva.com/en/teams/engineering/)). The company has achieved **95% Fortune 500 adoption** ([BusinessWire, 2024-09-25](https://www.businesswire.com/news/home/20240925330023/en/Canva-Expands-Developer-Platform-As-App-Uses-Surpass-1-Billion)) and operates at massive scale: **1.2 million requests per day with 450 new designs created every second** ([AWS re:Invent 2024](https://www.aboutamazon.com/news/aws/aws-reinvent-2024-keynote-live-news-updates)).

Canva employs **7,574 people with 626 engineers (8% of workforce)** ([Getlatka](https://getlatka.com/companies/canva)) distributed across Sydney, Manila, London, Austin, and Beijing. The company has raised **$2.4B in total funding** and continues aggressive growth through strategic acquisitions.

## Business Model & Product Strategy

**Core Platform**: Visual design and communication tools serving both consumer and enterprise markets.

**AI-First Evolution**: Canva has aggressively integrated AI, with **Magic Studio and AI tools used over 18 billion times since launch** ([BVP Cloud 100 Report, 2025-03-09](https://www.bvp.com/atlas/the-cloud-100-benchmarks-report)). Recent acquisitions reinforce this:
- **Leonardo.Ai** (July 2024): Visual AI capabilities, 1.8M Discord members ([SmartCompany, 2024-07-30](https://www.smartcompany.com.au/finance/canva-snaps-up-leonardo-ai-blockbuster-acquisition/))
- **MagicBrief** ($22.5M, June 2025): Creative intelligence, analyzed $6B in ad spend ([Forbes Australia, 2025-06-18](https://www.forbes.com.au/news/innovation/canva-to-acquire-australian-ai-platform-magicbrief/))

**Developer Platform Expansion**: **1 billion app uses with 75 million monthly uses** across **300 apps in marketplace spanning 122 countries** ([BusinessWire, 2024-09-25](https://www.businesswire.com/news/home/20240925330023/en/Canva-Expands-Developer-Platform-As-App-Uses-Surpass-1-Billion)). New APIs launched September 2024: Content Query API, Design Editing API, Tables API, Authentication API.

**Enterprise Growth**: Launched Canva Connect APIs and Premium Apps Program in May 2024 to serve enterprise customers at scale.

## Technical Architecture & Stack

**Technology Evolution**: Canva evolved from **monolith on EC2 to sophisticated microservices using Amazon RDS MySQL and DynamoDB** ([AWS re:Invent 2024](https://www.aboutamazon.com/news/aws/aws-reinvent-2024-keynote-live-news-updates)).

**Core Stack** ([Canva Engineering Blog, 2024-06-27](https://www.canva.dev/blog/engineering/how-we-build-experiments-in-house/)):
- **Languages**: Python, Django, JavaScript, Java
- **Infrastructure**: AWS Lambda, MySQL, Amazon RDS, DynamoDB, EC2
- **Architecture**: Microservices at scale

**Engineering Philosophy**: CTO Brendan Humphreys **changed engineering assessments to evaluate candidates' ability to work with AI tools intelligently** ([Fortune, 2025-07-02](https://fortune.com/2025/07/02/software-engineers-hiring-job-interviews-ai-coding-assistants/)), signaling organizational commitment to AI-augmented development.

## Strategic Initiatives & Technical Challenges

### 1. Developer Platform Expansion (High Priority)
**Trigger**: 1B app uses, need to scale developer ecosystem  
**Technical Needs**: Building multiple new APIs (Content Query, Design Editing, Tables, Authentication) requires robust development tooling, code quality standards, and rapid iteration for both internal teams and external developers.

### 2. AI Integration Acceleration (Critical)
**Trigger**: Leonardo.Ai and MagicBrief acquisitions, 18B+ AI tool uses  
**Technical Needs**: Massive AI feature development pipeline requires faster iteration, better code review, improved developer productivity, and cross-team consistency.

### 3. Microservices Architecture Scaling
**Trigger**: Evolution from EC2 monolith to distributed systems handling 1.2M requests/day  
**Technical Needs**: Managing complex distributed systems requires excellent code quality, debugging capabilities, and cross-service understanding. Navigating large codebases becomes increasingly challenging.

### 4. Engineering Culture Evolution for AI Development
**Trigger**: CTO explicitly changed hiring to evaluate AI tool competency  
**Technical Needs**: Canva wants engineers who can work intelligently with AI coding tools. They're preparing the organization for AI-augmented development practices.

### 5. Experimentation Platform Democratization
**Trigger**: Need to reduce data scientist bottlenecks and enable self-service ([Canva Engineering Blog, 2024-06-27](https://www.canva.dev/blog/engineering/how-we-build-experiments-in-house/))  
**Technical Needs**: Building internal platforms requires significant engineering effort, code generation, and maintenance.

### 6. Global Engineering Team Growth
**Trigger**: 626 engineers across 5 locations  
**Technical Needs**: Distributed teams need consistent code quality, shared conventions, better collaboration tools, and standardized development practices.

## So What for the Demo?

### Primary Value Proposition
**Canva is explicitly seeking engineers who can work intelligently with AI tools** - Amp is precisely the type of AI coding assistant they're preparing their engineering organization to adopt. CTO Brendan Humphreys has already changed the interview process to evaluate this competency.

### Key Demo Focus Areas

**1. Large-Scale Codebase Navigation (High Impact)**
- **Context**: Canva manages microservices architecture with 626 engineers contributing across multiple services
- **Demo**: Show Amp's **large context windows (1M tokens)** and **Librarian** navigating a complex multi-service repository, understanding dependencies, and making cross-service changes
- **Amp Capability**: Large context windows, codebase search, Librarian for cross-repo research
- **Talking Point**: "Your CTO mentioned managing complexity as you scale - Amp handles up to 1 million tokens to understand your entire service architecture at once"

**2. API Development Acceleration (Critical Need)**
- **Context**: Canva just launched 4 new APIs (Content Query, Design Editing, Tables, Authentication) and expanding developer platform
- **Demo**: Show Amp **generating API endpoint code with tests and documentation** based on AGENTS.md guidance, using **Oracle for architectural review**, and **subagents for parallel test generation**
- **Amp Capability**: Subagents, Oracle reasoning, AGENTS.md for consistency, TypeScript SDK for automation
- **Talking Point**: "You're scaling your developer platform to 300+ apps - Amp can generate consistent API code, tests, and docs in parallel while maintaining your standards"

**3. AI Feature Development Velocity (Strategic Priority)**
- **Context**: 18B AI tool uses, Leonardo.Ai and MagicBrief integrations, massive AI feature pipeline
- **Demo**: Show Amp **integrating a new AI service** into existing Python/Django codebase, handling error cases, writing comprehensive tests, and generating integration docs
- **Amp Capability**: Multi-file edits, IDE integration (VS Code/JetBrains for Java), Amp Tab completions
- **Talking Point**: "With Leonardo.Ai and MagicBrief acquisitions, you're building AI features rapidly - Amp accelerates integration work with context-aware completions and multi-file refactoring"

**4. Code Quality & Consistency Across Teams (Operational Need)**
- **Context**: 626 engineers across Sydney, Manila, London, Austin, Beijing need consistent standards
- **Demo**: Show **AGENTS.md guidance system** enforcing Canva's Python/Django conventions, automatic lint/test execution, and **tool-level permissions** for controlled deployments
- **Amp Capability**: AGENTS.md, tool permissions, streaming JSON CLI for CI/CD integration
- **Talking Point**: "Your distributed team needs consistent code quality - AGENTS.md teaches Amp your conventions, ensuring every engineer generates code that matches your standards"

**5. Internal Platform Engineering (Active Investment)**
- **Context**: Building in-house experimentation platform to democratize A/B testing ([Engineering Blog](https://www.canva.dev/blog/engineering/how-we-build-experiments-in-house/))
- **Demo**: Show Amp **building internal tooling** using TypeScript SDK, creating custom MCP integration, and generating documentation
- **Amp Capability**: MCP integration, Toolboxes, TypeScript SDK for custom agents
- **Talking Point**: "You're building internal platforms like experimentation tools - Amp's SDK and MCP integration let you automate platform development and integrate with your internal APIs"

### Competitive Positioning

**vs. GitHub Copilot**: Emphasize **large context windows** (1M vs. Copilot's limited context), **Oracle reasoning** for architectural decisions, and **subagents** for parallel complex tasks.

**vs. Cursor/Windsurf**: Highlight **enterprise features** (SSO, zero data retention, team workspaces), **MCP integration** for custom tools, and **TypeScript SDK** for building custom automation.

### Enterprise Discussion Points

- **Zero Data Retention**: Critical for IP protection with proprietary visual AI algorithms
- **SSO Integration**: Required for 7,574 employee organization
- **Team Workspaces**: Manage 626 engineers with pooled billing and org-wide settings
- **JetBrains Support**: Important for Java developers in microservices architecture

### Risk Mitigation

**Potential Objection**: "We're already using AI tools in our hiring process - might have existing tooling"  
**Response**: "That's exactly why Brendan changed your interview process - to find engineers who use AI tools *intelligently*. Amp is designed for that: large context for architectural understanding, Oracle for complex decisions, and AGENTS.md to encode your team's expertise. It's the tool your new hires will want to use."

### Success Metrics to Discuss

- **API Development Velocity**: Time to ship new endpoints with tests and docs
- **Code Review Cycle Time**: Reduction in back-and-forth for consistency issues
- **Onboarding Time**: How quickly new engineers across 5 locations become productive
- **Platform Engineering ROI**: Internal tool development acceleration (like experimentation platform)

### Key Quote for Outreach

> "Canva's CTO has explicitly changed engineering assessments to evaluate how well candidates work with AI tools. Amp is the AI coding assistant built for engineers who want to work intelligently with AI - offering 1M token context windows, architectural reasoning with Oracle, and the ability to encode your team's expertise in AGENTS.md."