---
title: Discovery Framework - Canva
company: Canva
date: 2025-10-20
authors: [Amp Sales Team]
personas: [CTO, VP Engineering, Engineering Director]
keywords: [discovery, conversation framework, ai development, developer productivity]
confidence: high
sources_count: 13
---

# Discovery Framework: Canva

## Meeting Structure

**Duration**: 45-60 minutes  
**Format**: Demographics (10m) → Culture & Process (25m) → Wrap-up (10m)

---

## Phase 1: Demographics & Context (10 minutes)

### Engineering Organization

**Confirm basic metrics:**
- "I understand you have 626 engineers across 7,574 total employees - is that still current?" [^1]
- "What's the breakdown across your Sydney, Manila, London, Austin, and Beijing offices?" [^2]
- "How is engineering organized - by product area, platform teams, or functional groups?"

**Growth trajectory:**
- "You're scaling rapidly to support 240M monthly active users and $2.7B revenue [^1][^3] - what's your engineering hiring plan for the next 12 months?"
- "What challenges are you facing as you scale the engineering org?"

### Technology Landscape

**Current stack validation:**
- "I see you're using Python, Django, AWS Lambda, JavaScript, Java, and MySQL [^4] - are there other major languages or frameworks I should know about?"
- "You've evolved from a monolith on EC2 to microservices with RDS MySQL and DynamoDB [^5] - where are you in that journey?"
- "Handling 1.2M requests per day with 450 designs created every second [^5] - what are your biggest infrastructure pain points?"

**Developer tooling baseline:**
- "What AI coding tools, if any, are your engineers currently using?"
- "Brendan mentioned changing your interview process to evaluate AI tool competency [^6] - what prompted that shift?"
- "What does 'working intelligently with AI tools' mean for Canva engineering?"

---

## Phase 2: Culture & Process (25 minutes)

### AI Integration & Development Velocity

**Context**: Canva's Magic Studio has been used 18B+ times [^7], Leonardo.Ai acquisition (July 2024) [^8], MagicBrief acquisition ($22.5M, June 2025) [^9]

**Discovery questions:**
- "With 18 billion AI feature uses and two major AI acquisitions, how are you managing the pace of AI feature development?"
- "What percentage of your engineering cycles are dedicated to AI/ML feature work right now?"
- "Where are the bottlenecks in getting AI features from prototype to production?"
- "How do you maintain code quality when moving at AI startup speed?"

**Talking points:**
- Engineers need to iterate faster on AI features while maintaining quality
- Amp's Oracle can review AI integration code for best practices and architectural issues
- Large context windows help understand complex ML pipelines across multiple services

### Developer Platform & API Development

**Context**: Developer platform hit 1B app uses, 300 apps in marketplace, 122 countries [^10]

**Discovery questions:**
- "You launched Content Query API, Design Editing API, Tables API, and Premium Apps Program [^10] - how many engineers are dedicated to platform/API work?"
- "What's your process for designing and documenting new APIs?"
- "How do you ensure consistency across APIs as the platform grows?"
- "95% of Fortune 500 companies use Canva [^11] - what are enterprise customers asking for in terms of API capabilities?"

**Talking points:**
- API development requires rigorous documentation, testing, and backward compatibility
- Amp's AGENTS.md can codify API design standards and auto-generate consistent patterns
- Subagents can parallelize API endpoint development across teams

### Experimentation & Internal Platforms

**Context**: Built in-house experimentation platform to reduce data scientist bottlenecks [^12]

**Discovery questions:**
- "You built your experimentation platform in-house to democratize A/B testing [^12] - how's adoption going?"
- "What other internal platforms or tools are you building to scale engineering productivity?"
- "Who maintains these platforms as they grow in complexity?"
- "How do you balance building internal tools vs. buying external solutions?"

**Talking points:**
- Building internal platforms is heavy engineering lift
- Amp's TypeScript SDK can accelerate custom tool development
- Oracle can review platform architecture for scalability issues

### Microservices & System Complexity

**Context**: Evolved from EC2 monolith to microservices architecture [^5]

**Discovery questions:**
- "As you've moved to microservices, how do engineers navigate the codebase?"
- "What's your biggest challenge with cross-service debugging?"
- "How do you onboard new engineers to understand the system architecture?"
- "Do you have service ownership models or shared responsibility?"

**Talking points:**
- Amp's Librarian can search across repositories to understand service dependencies
- Oracle helps debug complex multi-service issues with deep reasoning
- Large context windows let engineers understand entire service interactions

### Code Quality & Standards

**Discovery questions:**
- "With 626 engineers across 5+ locations, how do you maintain code consistency?"
- "What's your code review process? Average turnaround time?"
- "Do you have different quality standards for internal tools vs. customer-facing code?"
- "What technical debt are you most concerned about?"

**Talking points:**
- Distributed teams struggle with consistent conventions
- Amp's AGENTS.md enforces standards automatically in generated code
- AI code review can catch issues before human reviewers see them

### Engineering Culture Evolution

**Context**: CTO changed hiring assessments to evaluate AI tool competency [^6]

**Discovery questions:**
- "Brendan mentioned evaluating candidates on AI tool usage [^6] - what does a good example look like?"
- "How are you upskilling current engineers on AI-assisted development?"
- "What's the internal sentiment about AI coding tools?"
- "Are there concerns about over-reliance on AI or code quality degradation?"

**Talking points:**
- Canva is ahead of the curve in embracing AI development tools
- Amp is designed for engineers who think critically, not just copy-paste
- Tool-level permissions let you control what Amp can do (e.g., read-only for junior engineers)

---

## Phase 3: Wrap-up & Next Steps (10 minutes)

### Pain Point Prioritization

**Ask:**
- "Of everything we discussed - AI feature velocity, API development, microservices complexity, code quality, internal tooling - which is the most pressing pain point right now?"
- "If you could wave a magic wand and improve one aspect of developer productivity, what would it be?"

### Buying Process & Timeline

**Explore:**
- "What does the evaluation process look like for developer tools at Canva?"
- "Who needs to be involved in this decision? Engineering leaders, security, procurement?"
- "Do you have budget allocated for developer productivity tools this quarter/year?"
- "What would success look like in 3 months? 6 months?"

### Next Steps

**Propose:**
1. **Custom demo** tailored to top 2-3 pain points (30 minutes)
2. **Pilot program** with 10-20 engineers on specific use case (2-4 weeks)
3. **Architecture review session** with Amp Oracle on actual codebase challenge (if applicable)

**Leave behind:**
- Link to Canva-specific demo script (see 08_custom_demo.md)
- Amp manual for technical evaluation: https://ampcode.com/manual
- Case study from similar high-growth B2B platform company (if available)

---

## Key Themes to Listen For

### Strong Buy Signals
- Frustration with current development velocity
- Multiple mentions of "moving faster" or "bottlenecks"
- Concrete examples of missed deadlines or slow feature releases
- Active evaluation of other AI coding tools
- Budget already allocated for productivity tools

### Concerns to Address
- "We already use GitHub Copilot" → Explain Amp's differentiation (Oracle, MCP, large context, subagents)
- "Security/data privacy concerns" → Zero data retention option, enterprise SSO
- "Worried about code quality" → Show how Amp maintains conventions via AGENTS.md
- "Need to see ROI" → Discuss pilot metrics and success criteria

### Red Flags
- No clear pain points or satisfied with status quo
- No budget or decision authority on call
- Long procurement cycles (6+ months) without urgency
- Strong preference for existing vendor relationships

---

## Canva-Specific Objection Handling

**"We're building our own internal AI tools"**
- "That's great - Amp's MCP integration and TypeScript SDK can actually accelerate your internal tool development. We're not replacing your custom tools, we're making your engineers more productive building them."

**"Copilot is good enough"**
- "Copilot is excellent for line-level completions. Amp excels at multi-file changes, complex refactors, and deep codebase understanding with 1M token context windows. They're complementary - many teams use both."

**"We need engineers who can code, not rely on AI"**
- "Agreed - and Brendan's point about evaluating AI tool competency [^6] is about intelligent use, not dependence. Amp is designed for senior engineers who use AI strategically, not as a crutch."

**"Too expensive for 626 engineers"**
- "Let's talk about ROI - if Amp saves each engineer 30 minutes per day (conservative estimate), that's 313 hours daily or 1.95 FTE worth of capacity. At your scale, even small productivity gains have massive impact."

---

## Citations

[^1]: Getlatka, "How Canva hit $2.7B revenue and 150M customers in 2024", 2024-10-01, https://getlatka.com/companies/canva
[^2]: Life at Canva, "Canva Careers: Join our mission", 2025-10-20, https://www.lifeatcanva.com/en/
[^3]: Life at Canva, "Engineering Team", 2025-10-20, https://www.lifeatcanva.com/en/teams/engineering/
[^4]: Canva Engineering Blog, "How we build experiments in-house", 2024-06-27, https://www.canva.dev/blog/engineering/how-we-build-experiments-in-house/
[^5]: Amazon/AWS, "AWS re:Invent 2024 announcements and keynote updates", 2024-12-06, https://www.aboutamazon.com/news/aws/aws-reinvent-2024-keynote-live-news-updates
[^6]: Fortune, "How companies are rethinking their vetting of engineering candidates", 2025-07-02, https://fortune.com/2025/07/02/software-engineers-hiring-job-interviews-ai-coding-assistants/
[^7]: Bessemer Venture Partners, "The Cloud 100 Benchmarks Report 2025", 2025-03-09, https://www.bvp.com/atlas/the-cloud-100-benchmarks-report
[^8]: SmartCompany, "Canva snaps up Leonardo.AI in blockbuster acquisition", 2024-07-30, https://www.smartcompany.com.au/finance/canva-snaps-up-leonardo-ai-blockbuster-acquisition/
[^9]: Forbes Australia, "Canva to acquire Australian AI platform MagicBrief", 2025-06-18, https://www.forbes.com.au/news/innovation/canva-to-acquire-australian-ai-platform-magicbrief/
[^10]: BusinessWire, "Canva Expands Developer Platform As App Uses Surpass 1 Billion", 2024-09-25, https://www.businesswire.com/news/home/20240925330023/en/Canva-Expands-Developer-Platform-As-App-Uses-Surpass-1-Billion
[^11]: BusinessWire, "Canva Expands Developer Platform As App Uses Surpass 1 Billion", 2024-09-25, https://www.businesswire.com/news/home/20240925330023/en/Canva-Expands-Developer-Platform-As-App-Uses-Surpass-1-Billion
[^12]: Canva Engineering Blog, "How we build experiments in-house", 2024-06-27, https://www.canva.dev/blog/engineering/how-we-build-experiments-in-house/