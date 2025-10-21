---
title: Discovery Call Plan and Talk Track
company: Canva
date: 2025-10-20
authors: [Amp Research Team]
personas: [Brendan Humphreys - CTO, VP Engineering, Engineering Directors]
keywords: [discovery questions, demo storyline, developer productivity, AI coding tools, microservices, developer platform]
confidence: high
sources_count: 13
---

# Discovery Call Plan and Talk Track

## Pre-Call Setup

### Research Validation

**Before the call, verify these assumptions**:
- Brendan Humphreys is still CTO (last confirmed July 2025)
- Engineering headcount ~626 (last reported October 2024)
- Developer platform metrics (1B uses) are current
- Leonardo.Ai and MagicBrief integrations are in progress

**Personalization hooks**:
- Reference Brendan's AWS re:Invent 2024 talk about managing complexity
- Mention his Fortune interview about AI tool competency in hiring
- Acknowledge 1.2M requests/day scaling challenge

### Call Objectives

**Primary**: Understand Canva's current AI coding tool usage and developer productivity challenges

**Secondary**: Secure pilot with Developer Platform or Experimentation Platform team

**Success metrics**:
- Learn current AI tool stack (Copilot? Cursor? Other?)
- Identify 1-2 specific pain points we can address
- Schedule technical deep-dive or pilot planning session

## Opening (5 minutes)

### Introduction

**Talk Track**:

"Brendan, thanks for taking the time. I'm [Name] from Amp, an AI coding assistant built by Sourcegraph. I saw your Fortune interview where you mentioned changing engineering assessments to evaluate how candidates work with AI tools - that really resonated because it's exactly the problem we solve: helping engineers work *intelligently* with AI, not just use autocomplete.

I also caught your AWS re:Invent talk about managing complexity at scale. With 626 engineers handling 1.2 million requests a day across microservices, you're dealing with a level of architectural complexity that most AI coding tools weren't designed for. That's why I wanted to connect.

Before I share what we do, I'd love to understand your current setup better."

### Positioning Statement

**If asked "What does Amp do?"**:

"Amp is an AI coding assistant, but designed for engineering teams at scale. While tools like Copilot focus on code completion, we're built for the complexity you're dealing with - massive codebases, microservices architectures, distributed teams. We can hold up to a million tokens of context in working memory, so we actually understand your full system architecture, not just the file you're editing.

Think of it as having a senior engineer who's read your entire codebase pair programming with you, rather than an autocomplete tool.

But let me pause there - what are you using today for AI coding assistance?"

## Discovery Questions (20-25 minutes)

### Section 1: Current State Assessment

#### **Q1: AI Tool Adoption**

**Question**: "What AI coding tools are your engineers currently using? Are you standardized on anything, or is it more of a 'bring your own tool' situation?"

**Listen for**:
- GitHub Copilot (most likely)
- Cursor, Windsurf, other tools
- Adoption rate (all engineers? subset?)
- Satisfaction level ("it's fine" vs "they love it")

**Follow-up based on response**:

*If using Copilot*: "Got it. What's working well with Copilot? And where do you find engineers still hitting friction?"

*If no standard tool*: "Interesting - what's driving the 'bring your own tool' approach? Is it that nothing has met the bar, or is it more about letting engineers choose their workflow?"

*If using Cursor*: "Cursor's great for smaller projects. How's it handling your microservices complexity - can engineers navigate across services effectively?"

**Trap to avoid**: Don't bash their current tools. Position Amp as complementary or next-generation.

---

#### **Q2: Scale and Complexity Challenges**

**Question**: "You mentioned in your re:Invent talk that you evolved from a monolith to microservices. When engineers need to make changes that span multiple services - like adding a new feature that touches 5-6 services - how do they approach that today?"

**Listen for**:
- Manual context switching between repos/files
- Losing track of dependencies
- Long debugging cycles
- Tribal knowledge ("only Sarah understands how these services talk")

**Follow-up**: "Do your AI tools help with that multi-service navigation, or are engineers basically doing that manually?"

**What this reveals**: Whether their current tools handle their architectural complexity. If they say "mostly manual," that's Amp's 1M token context opportunity.

---

#### **Q3: Developer Platform and API Development**

**Question**: "Your developer platform hit a billion app uses - congrats on that milestone. For the team building those APIs - Content Query, Design Editing, Tables - what does their development workflow look like? What's the bottleneck in getting new endpoints shipped?"

**Listen for**:
- Spec → implementation → testing cycle time
- Code review delays
- Documentation debt
- Consistency challenges ("each engineer writes APIs slightly differently")

**Follow-up**: "How much of that work is genuinely creative versus 'we've done this pattern 50 times, but it's still manual'?"

**What this reveals**: Potential pilot team and use case. If they mention repetitive patterns, that's Amp's strength.

---

#### **Q4: AI Feature Integration (Leonardo.Ai, MagicBrief)**

**Question**: "You acquired Leonardo.Ai and MagicBrief to accelerate AI capabilities. How's the integration work going? What's the engineering challenge there - is it more about understanding their codebases, refactoring to fit your architecture, or something else?"

**Listen for**:
- Onboarding acquired teams' code
- Architectural mismatches
- Technical debt from acquisitions
- Speed of integration ("slower than we'd like")

**Follow-up**: "When you bring in a new codebase like Leonardo's, how long does it take engineers to get productive? Can they navigate it easily or is there a ramp-up period?"

**What this reveals**: Whether Amp's Librarian (cross-repo research) and Oracle (architectural guidance) solve real pain.

---

### Section 2: Engineering Culture and AI Strategy

#### **Q5: AI Tool Competency in Hiring**

**Question**: "In your Fortune interview, you mentioned changing engineering assessments to evaluate how candidates use AI tools. What does 'working intelligently with AI' look like in practice at Canva? What are you testing for?"

**Listen for**:
- Specific skills (e.g., prompt engineering, knowing when NOT to use AI)
- Quality bar ("we want engineers who review AI output critically")
- Strategic vs tactical use of AI

**Follow-up**: "Do your current AI tools support that 'intelligent use' model, or is it more on the engineer to figure out the right workflow?"

**What this reveals**: Whether Canva wants opinionated, intelligent AI tools (Amp with Oracle/AGENTS.md) or just raw code generation.

---

#### **Q6: Code Quality and Standards at Scale**

**Question**: "With 626 engineers across Sydney, Manila, London, Austin, Beijing - how do you maintain code quality and consistency? Are there specific conventions or patterns you want engineers to follow?"

**Listen for**:
- Style guides, linters, code review standards
- Challenges with enforcement ("we have guidelines but they're not always followed")
- Onboarding new engineers to conventions
- Language/framework-specific patterns

**Follow-up**: "When you use AI tools to generate code, does the output match those conventions automatically, or do engineers have to manually adjust it?"

**What this reveals**: AGENTS.md opportunity. If they have conventions but AI tools ignore them, Amp solves that.

---

#### **Q7: Experimentation Platform Roadmap**

**Question**: "I read your engineering blog about building the experimentation platform in-house. You mentioned wanting to reduce data scientist bottlenecks and enable self-service. What's the next phase for that platform?"

**Listen for**:
- New features planned
- Technical debt to address
- Adoption challenges ("teams still ask data scientists for help")
- Platform team size and velocity

**Follow-up**: "What's the constraint on platform development velocity right now - is it ideas, engineering capacity, or something else?"

**What this reveals**: Potential pilot team (experimentation platform). If velocity is constrained by engineering capacity, Amp helps.

---

### Section 3: Pain Point Deep-Dive

#### **Q8: Biggest Developer Productivity Challenge**

**Question**: "If you could wave a magic wand and fix one developer productivity challenge at Canva, what would it be?"

**Listen for**:
- Context switching between services
- Code review cycle times
- Onboarding new engineers
- Technical debt accumulation
- Test writing / maintenance
- Documentation drift

**Follow-up**: "What have you tried so far to address that? What worked, what didn't?"

**What this reveals**: The clearest ROI case for Amp. Focus demo on this pain point.

---

#### **Q9: AI Tool Limitations**

**Question**: "What are the current limitations of the AI coding tools your team uses? Where do engineers hit a wall and have to fall back to manual work?"

**Listen for**:
- Small context windows ("can't see the full picture")
- Hallucinations / buggy code
- Can't navigate complex architectures
- No architectural guidance, just code generation
- Doesn't follow Canva's conventions

**Follow-up**: "If those limitations were solved, what would that unlock for your team?"

**What this reveals**: Direct competitive positioning. Map their limitations to Amp's strengths.

---

### Section 4: Buying Process and Decision Criteria

#### **Q10: Decision Process for Developer Tools**

**Question**: "When you evaluate new developer tools, what's the process? Is it bottom-up (engineers try it and advocate), top-down (you make a strategic call), or something in between?"

**Listen for**:
- Pilot approach ("we usually pilot with one team")
- Key stakeholders (CTO, VP Eng, Engineering Directors)
- Timeline ("we can move fast" vs "we have a yearly planning cycle")
- Budget authority

**Follow-up**: "If we were to run a pilot, which team would be the best fit? Developer Platform, AI Integration, Infrastructure?"

**What this reveals**: How to structure the pilot proposal and who needs to be involved.

---

#### **Q11: Success Criteria**

**Question**: "If we ran a 4-week pilot with one of your teams, what would success look like? What metrics would you want to see?"

**Listen for**:
- Velocity (PRs shipped, features completed)
- Quality (code review feedback, bug rates)
- Developer satisfaction ("engineers want to keep using it")
- Time savings ("30% faster" or specific tasks)

**Follow-up**: "What would make you say 'this is worth rolling out to all 626 engineers'?"

**What this reveals**: How to design the pilot and measure success.

---

## Demo Storyline (15-20 minutes)

### Demo Structure

**Don't do a feature tour.** Show solutions to THEIR pain points discovered in Q8-Q9.

**Structure**:
1. Quick context: "Based on what you shared, I want to show you how Amp handles [specific pain point]."
2. Live demo: Real coding scenario matching their architecture
3. Contrast: "Here's how you'd do this with Copilot/Cursor" vs "Here's Amp"
4. Impact: "This would save your engineers X hours per week"

### Demo Scenario A: Microservices Debugging

**Use when**: They mentioned challenges navigating across services

**Setup**:
"You mentioned engineers struggle when debugging issues that span multiple services. Let me show you how Amp handles that.

I'm going to simulate a bug in a payment processing flow that touches your API gateway, payment service, and notification service. Watch how Amp keeps all three services in context simultaneously."

**Steps**:
1. **Librarian**: Search across 3 service repos to find related code
2. **Context loading**: Load 10+ files (40K+ lines) into Amp's context
3. **Oracle**: Ask "Why would a payment succeed but no notification send?" - Oracle analyzes all services and identifies race condition
4. **Multi-service fix**: Edit 3 files across 2 services in one operation
5. **Tests**: Generate integration tests that cover the cross-service scenario

**Contrast**:
"With Copilot, you'd be context-switching between repos, manually connecting the dots, losing your mental model. Copilot can suggest the next line, but it can't see the race condition across services. Amp holds the full architecture in memory."

**Impact**:
"Your engineers told me debugging cross-service issues takes hours. This took 4 minutes. Multiply that across 626 engineers and hundreds of services."

---

### Demo Scenario B: API Development (Developer Platform)

**Use when**: They mentioned repetitive API work or developer platform challenges

**Setup**:
"Your Content Query API team ships new endpoints regularly. Let me show you how Amp accelerates that workflow while maintaining your conventions."

**Steps**:
1. **AGENTS.md setup**: Show Canva's API conventions encoded (auth patterns, error handling, validation)
2. **Generate endpoint**: "Add a /designs/search endpoint with filters for tags, date range, author"
3. **Watch Amp**:
   - Read existing API patterns from codebase
   - Generate endpoint following exact conventions
   - Write OpenAPI spec
   - Add validation logic
   - Generate tests matching existing test patterns
   - Update documentation
4. **Run checks**: `npm run lint && npm run typecheck` - everything passes

**Contrast**:
"With Copilot, you get code suggestions, but YOU wire up the tests, docs, validation manually. And Copilot doesn't know your conventions - you're fixing style issues in code review. Amp generates everything, following your standards automatically."

**Impact**:
"Your Developer Platform team told me new endpoints take 2-3 days from spec to reviewed code. Amp gets you to reviewable code in 15 minutes. That's 10x faster API development."

---

### Demo Scenario C: AI Feature Integration

**Use when**: They mentioned Leonardo.Ai or MagicBrief integration challenges

**Setup**:
"Integrating Leonardo.Ai means connecting their image generation models to your existing design pipeline. Let me show you how Amp helps navigate unfamiliar codebases."

**Steps**:
1. **Librarian**: Search Leonardo.Ai's GitHub repos (or simulated internal repos) to understand their API patterns
2. **Read patterns**: Amp reads their authentication, rate limiting, error handling
3. **Parallel subagents**:
   - Agent 1: Build API client for Leonardo's endpoints
   - Agent 2: Add TypeScript types for their models
   - Agent 3: Write integration tests with mocked responses
   - Agent 4: Update documentation
4. **Oracle review**: "Review this integration for security issues, rate limit handling, and error cases"
5. **Oracle response**: Identifies missing retry logic, suggests circuit breaker pattern
6. **Apply fixes**: Amp implements Oracle's recommendations

**Contrast**:
"Manual approach: Engineers spend days reading Leonardo's docs, trial-and-error API calls, back-and-forth with their team. Copilot can't help because it doesn't know Leonardo's codebase. Amp's Librarian reads their code, understands their patterns, generates correct integration code first try."

**Impact**:
"You acquired MagicBrief for $22.5M to accelerate creative intelligence. Every week spent on integration is delayed ROI. Amp collapses weeks of integration work into days."

---

### Demo Scenario D: Experimentation Platform Feature

**Use when**: They mentioned experimentation platform as a priority

**Setup**:
"Your blog post mentioned wanting to reduce data scientist bottlenecks. Let's add a self-service feature: a UI for non-technical users to create A/B tests without writing Python."

**Steps**:
1. **Read existing platform code**: Django models, experiment configs
2. **Generate feature**:
   - Frontend: React form for experiment setup
   - Backend: Django API endpoint to validate and create experiment
   - Validation: Business logic to prevent invalid configs
   - Tests: Unit and integration tests
3. **Oracle architectural review**: "Is this approach scalable? Any edge cases?"
4. **Oracle feedback**: Suggests adding experiment preview mode, rate limiting for API
5. **Implement suggestions**: Amp adds preview mode and rate limiting

**Contrast**:
"This feature would normally take a sprint: frontend engineer builds UI, backend engineer builds API, data scientist validates logic, tests written separately. Amp delivers the complete feature in one sitting."

**Impact**:
"Your goal is democratizing experiments. Amp democratizes platform development - your small platform team can ship features as fast as your product teams need them."

---

## Handling Objections

### Objection 1: "We're happy with GitHub Copilot"

**Response**:
"That's great - Copilot is excellent at line-level completions. Here's the question: when your engineers debug issues across microservices, or integrate acquired codebases like Leonardo.Ai, does Copilot give them the full architectural picture, or are they manually connecting the dots?

Amp and Copilot solve different problems. Copilot autocompletes the next line. Amp understands your entire system architecture. Many of our customers use both - Copilot for quick completions, Amp for complex multi-file work.

If you're open to it, we could run a small pilot with your Developer Platform team for 2 weeks. If it's not meaningfully better than Copilot for their workflow, you lose nothing. But if it 2x's their API development velocity, that's worth knowing."

---

### Objection 2: "AI tools hallucinate and create buggy code"

**Response**:
"Absolutely valid concern. That's why Amp has guardrails:

1. **AGENTS.md**: You encode your conventions - linting rules, test patterns, security requirements. Amp follows them automatically.
2. **Oracle review mode**: Before code ships, Oracle (GPT-5) reviews it for bugs, security issues, edge cases. It's like having a senior engineer peer review every AI suggestion.
3. **Tool permissions**: You control exactly what Amp can execute - block bash commands, require approval for certain operations.
4. **Integration with your checks**: Amp runs your existing linters, type checkers, tests. If something fails, Amp sees the error and fixes it.

In your Fortune interview, you said you want engineers who work 'intelligently' with AI. These guardrails ARE that intelligence - they prevent the hallucination problem you're worried about.

Would you be open to seeing how AGENTS.md works for Canva's specific conventions?"

---

### Objection 3: "We're not ready to evaluate new tools right now"

**Response**:
"I totally understand - timing matters. Two questions:

1. When would be the right time to revisit this? Q1 planning? After your next release?
2. Is there a specific trigger that would make this a priority - like a new initiative, team scaling, or a productivity challenge that becomes urgent?

The reason I ask: you mentioned in your re:Invent talk that managing complexity at scale is a key focus. If that challenge gets worse before we talk again, I'd hate for your team to struggle when there's a solution available.

How about this: I'll send over a one-pager specific to Canva - your architecture, your pain points, exactly how Amp would help. You keep it on file, and when timing is right, you have the context ready. Does that work?"

---

### Objection 4: "What about security and IP protection?"

**Response**:
"Critical question for a company like Canva with proprietary design algorithms and AI models. Amp Enterprise has zero data retention - your code never leaves your control, we don't train models on it, nothing is stored.

You also get:
- **SSO integration** for access control
- **Audit logs** for compliance
- **On-premise deployment options** if you want Amp running in your VPC
- **Tool permissions** to block any operations you consider risky

Given your AWS partnership and the sensitivity of Leonardo.Ai's models, I'd recommend we do a security review session with your infosec team before any pilot. Would that address your concerns?"

---

## Closing (5 minutes)

### Summary

**Talk Track**:
"Brendan, here's what I heard:

1. [Pain point 1 from Q8] - which is costing your team [estimated impact]
2. [Pain point 2 from Q9] - where your current tools hit limitations
3. You're explicitly looking for engineers who work intelligently with AI tools - which is exactly what Amp is designed for

Based on that, I think there's a strong fit, specifically for [Developer Platform team / Experimentation Platform team / other]. 

Here's what I'd propose..."

---

### Proposed Next Steps

**Option A: Fast-Track Pilot (if high interest)**

"Let's run a 2-week pilot with your [specific team]. I'll work with [team lead name if mentioned] to:

1. Set up AGENTS.md with your conventions (1-hour workshop)
2. Onboard 3-5 engineers (they keep using their current tools in parallel)
3. Track velocity metrics you care about: [specific metrics from Q11]
4. Week 2 review: If it's not a clear win, you're out nothing but 2 weeks. If it is, we discuss rolling out to more teams.

I can get you set up by [next week]. Does that timeline work?"

---

**Option B: Technical Deep-Dive (if needs more info)**

"I'd love to do a deeper technical session with you and [VP Engineering / Engineering Directors] to show:

1. How Amp would handle [specific pain point]
2. AGENTS.md setup for Canva's conventions
3. Oracle in action for architectural guidance
4. Answer any technical questions your team has

30-45 minutes, and we'll leave time for Q&A. Would [specific date/time] work?"

---

**Option C: Async Evaluation (if timing is off)**

"I'll put together a Canva-specific evaluation guide:

1. Your architecture (microservices, developer platform, AI integrations)
2. Specific pain points we discussed
3. How Amp solves each one (with demo videos)
4. Proposed pilot plan when you're ready

You can share it internally with your team, and when timing is right, we'll reconnect. I'll send that over by [this week]. Sound good?"

---

### Calendar Hold

**Talk Track**:
"Let me send a calendar invite for [next step] while we're on the call. What email should I use?"

**Action**: Send invite DURING the call if possible. Conversion drops 50% if you wait.

---

## Post-Call Follow-Up

### Email Template (within 2 hours)

**Subject**: "Canva + Amp: [Pain Point] Solution | Next Steps"

**Body**:

---

Brendan,

Great talking today. You mentioned [specific pain point] is a key challenge, especially with [context from call].

Based on our conversation, here's how Amp specifically helps Canva:

**1. [Pain Point 1]**  
→ Amp's [capability] solves this by [specific solution]  
→ Impact: [estimated time/cost savings]

**2. [Pain Point 2]**  
→ Amp's [capability] addresses this through [specific solution]  
→ Impact: [estimated productivity gain]

**3. [Pain Point 3]**  
→ Amp's [capability] handles this via [specific solution]  
→ Impact: [specific outcome]

**Proposed Pilot**: 2-week trial with [specific team]  
- **Objectives**: [success metrics from Q11]  
- **Participants**: 3-5 engineers  
- **Timeline**: Start [date], review [date]  
- **Investment**: [pilot pricing]

I've attached:
- Demo recording (the microservices debugging scenario)
- Canva-specific pilot plan (one-pager)
- AGENTS.md template for your conventions

Let me know if [proposed next meeting time] works for the technical deep-dive, or if you'd prefer to move straight to pilot kickoff.

[Your name]

---

### If No Response After 3 Days

**Subject**: "Quick question on [pain point]"

**Body**:

---

Brendan,

Following up on our call - you mentioned [specific pain point] was a priority.

Quick question: Is this something you'd want to solve in the next 30 days, or is it more of a Q1/Q2 planning item?

Happy to adjust timing based on what works for you.

[Your name]

---

## Success Criteria for This Call

**Must achieve**:
- [ ] Learned current AI tool stack
- [ ] Identified 1-2 specific pain points
- [ ] Scheduled next meeting (technical deep-dive or pilot kickoff)

**Bonus**:
- [ ] Got commitment to pilot with specific team
- [ ] Identified key stakeholders beyond Brendan
- [ ] Learned success metrics for evaluation

---

**Key Insight**: Canva is actively evolving their engineering culture for AI tools (Fortune interview). They're not evaluating whether to use AI coding assistants - they're evaluating WHICH ONE. This is a timing opportunity. The team that demonstrates the most sophisticated AI partnership wins.