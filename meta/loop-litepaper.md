# Loop: The Autonomous Product Engine

**By Dorian Collier**
**February 2026 — v2**

---

## The Missing Piece

We have incredible AI coding agents. Claude, Codex, and dozens of alternatives can write code, fix bugs, and ship features autonomously. We also have excellent project management tools — Linear, Jira, GitHub Issues — that organize human work into trackable units.

But there is no system that builds the product.

Today's workflow looks like this:

```
Human has idea  ->  Human writes spec  ->  Agent does work  ->  Ship  ->  ???
```

The "???" is where everything breaks down. After shipping:

- Who checks if the fix actually worked?
- Who notices the new regression?
- Who synthesizes the analytics data, user feedback, and error logs into what to do next?
- Who decides the next priority based on what we just learned?
- Who researches the market and proposes what to build next?
- Who decides whether to pivot or persevere?

The answer is always a human. A human who is context-switching, forgetting, and operating on gut feel rather than systematic analysis. The product strategy lives in their head, and it runs once a week at best — during retros that nobody pays attention to.

**Loop is the engine that closes this gap.** It turns ideas into hypotheses, hypotheses into plans, plans into tasks, and tasks into agent sessions — then monitors the outcomes and feeds them back in. It does this whether the product exists yet or not. Continuously. Automatically. Without a human in the middle.

---

## What Changed from v1

The first version of this litepaper described Loop as an **Autonomous Improvement Engine** — a system that closed the feedback loop for existing products by turning signals (errors, metric drops, user complaints) into hypotheses, tasks, and validated outcomes.

That was half the picture.

v1 assumed a product already existed and was already generating telemetry. The loop started at "signal arrives" and ended at "outcome measured." It was a maintenance engine — powerful, but reactive. It couldn't answer the harder questions: What should we build? Is this the right product? Have we found product-market fit? Should we pivot?

v2 expands Loop from an improvement engine to a **product engine**. The system now covers the full product lifecycle:

| Phase | v1 | v2 |
|-------|----|----|
| Ideation | Not supported | Ideas from humans and agents enter the same backlog |
| Research | Not supported | Research is a first-class issue type with dedicated instruction templates |
| Building from scratch | Not supported | Genesis flow: idea → research → MVP → signal collection |
| Improving existing products | Fully supported | Fully supported |
| PMF measurement | Not supported | PMF framework built into Goals |
| Pivot/persevere decisions | Not supported | Data-driven pivot signals with human approval gates |
| Feature discovery by agents | Not supported | Agents can propose features based on research and data |

The core architecture is unchanged. Everything is still an issue. The issue queue is still the orchestration layer. Loop still has no AI inside it. The pull architecture still works the same way.

What changed is what flows *into* the loop. v1 only accepted reactive signals — something broke, a metric moved, a user complained. v2 accepts *generative* inputs too — an agent's research findings, a human's feature idea, a competitive analysis, a market opportunity. The loop doesn't just fix things anymore. It builds things.

---

## The Core Idea: Everything Is an Issue

The key insight is that a product engine doesn't need a complex orchestration engine, a state machine, or a workflow designer. **Everything is an issue.**

- Someone has an idea (human or agent) — **create an issue**: "Research this idea"
- An agent researches the idea — **create an issue**: "Evaluate this opportunity"
- The opportunity is validated — **create issues**: the MVP tasks
- A signal arrives (user feedback, a metric drop, an error spike) — **create an issue**: "Triage this signal"
- An agent triages the signal — **create an issue**: "Investigate this hypothesis"
- A hypothesis is formed — **create issues**: the implementation tasks
- Tasks are completed by agents — **create an issue**: "Monitor the outcomes"
- Monitoring detects a change — the change is a new signal, and the loop continues

The issue queue IS the orchestration layer. This means:

1. **One unified system** — ideas, research, signals, hypotheses, plans, tasks, and monitors all live in the same place
2. **One priority system** — everything competes in the same backlog, ranked by urgency and strategic alignment
3. **Full auditability** — every decision the system makes is traceable as an issue with a parent chain
4. **Human override at any point** — you can create, modify, prioritize, or cancel any issue at any time

---

## Two Modes: Discover and Improve

Loop operates in two modes. Both use the same architecture, the same issue queue, and the same agent dispatch system. The difference is where the work originates.

### Discovery Mode: Building from Nothing

Discovery mode is for products that don't exist yet — or features that don't exist yet within a product that does. The loop starts with an idea, not a signal.

```
     Idea                  Research              Evaluate
+--------------+       +---------------+       +----------------+
| Human or     |       | Agent         |       | Agent forms    |
| agent        | ----> | investigates  | ----> | hypothesis:    |
| submits      |       | market, users,|       | "Building X    |
| an idea      |       | competitors   |       | will achieve Y"|
+--------------+       +---------------+       +----------------+
                                                      |
+--------------+       +---------------+       +------v---------+
| Outcomes     |       | Agent writes  |       | Agent breaks   |
| feed back in | <---- | code, creates | <---- | hypothesis     |
| as new       |       | PRs, ships    |       | into MVP tasks |
| signals      |       | MVP           |       |                |
+--------------+       +---------------+       +----------------+
    Measure                Execute                  Plan
```

The moment a feature or product ships and starts generating real data, it transitions naturally into improvement mode. The signals start flowing. The loop tightens.

### Improvement Mode: Making It Better

Improvement mode is the v1 loop. The product exists. Users are using it. Signals arrive from the outside world and the system reacts.

```
     Signals                Triage                Hypothesize
+--------------+       +---------------+       +----------------+
| PostHog      |       | Agent picks   |       | Agent forms    |
| User feedback| ----> | up signal,    | ----> | hypothesis     |
| Error logs   |       | accepts or    |       | from signal    |
| Git events   |       | declines      |       | + context      |
+--------------+       +---------------+       +----------------+
                                                      |
+--------------+       +---------------+       +------v---------+
| Outcomes     |       | Agent writes  |       | Agent breaks   |
| feed back in | <---- | code, creates | <---- | hypothesis     |
| as new       |       | PRs, ships    |       | into tasks     |
| signals      |       |               |       |                |
+--------------+       +---------------+       +----------------+
     Monitor                Execute                  Plan
```

There is no switch. No configuration. No mode toggle. A project in discovery mode becomes a project in improvement mode the moment it starts receiving signals. A mature project in improvement mode enters discovery mode whenever someone — human or agent — proposes a new feature. Both modes coexist in the same backlog, competing for priority based on the same scoring system.

---

## The Lean Loop

Loop is the Lean Startup method implemented as infrastructure.

Eric Ries defined the Build-Measure-Learn feedback loop as the core engine of a startup. But in practice, Build-Measure-Learn runs in a founder's head. They build based on intuition, measure by glancing at dashboards, and learn during shower epiphanies. The loop is informal, slow, and lossy.

Loop makes it formal, fast, and auditable.

### Build-Measure-Learn, Automated

**Learn** → An agent researches the problem space: competitors, user behavior, market gaps. Or a signal arrives with data about how the product is actually being used. Either way, learning produces a hypothesis with explicit confidence and validation criteria.

**Build** → The hypothesis is broken into tasks. Agents execute. The smallest thing that could validate or invalidate the hypothesis gets shipped. This is the MVP — not a polished feature, but a test.

**Measure** → A monitoring issue watches the validation criteria. Did the metric move? Did user behavior change? Did the error rate drop? The outcome is recorded and feeds back as a new signal.

This loop runs continuously. Not quarterly. Not in sprints. Every shipped change has validation criteria, and every outcome generates new learning.

### The MVP as Default

In Loop, every hypothesis produces the minimum set of tasks required to validate it. This isn't a philosophical preference — it's how the planning step works. An agent breaks a hypothesis into tasks, and each task must be completable in a single agent session. Naturally, this produces small, shippable increments.

You don't build a full recommendation engine to test whether users want recommendations. You build a hardcoded "you might also like" section, measure click-through, and iterate from there. The system enforces this by design — large tasks get decomposed until they're small enough for a single session.

### Pivot or Persevere

When a hypothesis is invalidated — the metric didn't move, users didn't engage, the error rate didn't drop — the system doesn't blindly try again. It creates a new issue: "Evaluate failed hypothesis." An agent reviews the evidence, the original research, and the outcome data.

The result is one of three things:

1. **Persevere** — The hypothesis was right but the implementation was wrong. New tasks are created to try a different approach.
2. **Pivot** — The hypothesis was wrong. The agent proposes a new direction based on what was learned, creating a new hypothesis.
3. **Kill** — The opportunity isn't worth pursuing. The project goal is updated or archived.

This decision is surfaced for human review by default. Pivots are high-stakes — they redirect agent effort and may invalidate in-progress work. But the data, analysis, and recommendation are prepared autonomously. The human decides; the system does the homework.

---

## Research and Ideation

v1's loop started with external signals. v2 adds two new entry points: research and ideas.

### Ideas

An idea is the simplest input to Loop. It's a sentence — sometimes less.

- "We should add Slack integration"
- "What if users could share dashboards?"
- "Competitor X just launched Y — should we respond?"

Ideas can come from humans (through the UI, an API call, or a comment on an existing issue) or from agents (as findings during research, triage, or even code review). An idea creates an issue of type `idea` in triage state.

Triage for ideas works differently than triage for signals. An agent evaluating an idea doesn't check if something is broken — it checks if something is *worth building*. It considers:

- Does this align with the project's current goals?
- How many users would this affect?
- Is there existing demand (from signals, feedback, or research)?
- What's the effort-to-impact ratio?
- Does this overlap with something already planned?

The output is either: decline (with a reason), accept and create a research issue, or accept directly as a hypothesis (for ideas that are concrete enough to skip research).

### Research

Research is a first-class issue type in v2. It's how the system fills knowledge gaps before committing to building.

Research issues have dedicated instruction templates that tell agents what to investigate and how to report findings. Examples:

- **Market research**: "Research how competitors handle X. Document their approaches, pricing, and user reception."
- **User research**: "Analyze the last 90 days of user feedback related to X. Identify patterns, frequency, and severity."
- **Technical research**: "Investigate whether technology X is feasible for our use case. Document trade-offs, dependencies, and effort estimates."
- **Opportunity research**: "Given the data from signals A, B, and C, is there an opportunity to build X? What would success look like?"

Research issues produce structured outputs — findings, recommendations, and optionally a proposed hypothesis. This output becomes the evidence base for deciding whether to build.

### The Full Funnel

Ideas and research extend the issue pipeline upstream:

```
Idea → Research → Hypothesis → Plan → Execute → Monitor → Signal → ...
```

An idea enters triage. If accepted, it spawns research. Research produces a hypothesis. The hypothesis enters the standard loop. And when the feature ships, its outcomes generate signals that may spawn new ideas.

The entire funnel — from shower thought to validated feature — is one continuous chain of linked issues.

---

## How It Works: A Concrete Example

### Discovery: Building a New Feature

1. **Idea arrives**: A user posts feedback — "I wish I could get Slack notifications when something important happens." An agent, during routine triage of feedback signals, notices this is the 14th request for Slack integration in 60 days. It creates an idea issue: "Slack integration for notifications."

2. **Research**: An agent picks up the research task. It investigates: How do competitors handle Slack integration? What notification events do users care about most? What's the Slack API surface? It produces a structured report with a recommendation: build it, starting with a webhook-based integration for the top 3 event types.

3. **Hypothesis**: The agent creates a hypothesis — "Adding Slack notifications for issue creation, status changes, and goal completion will increase daily active usage by 15% within 30 days." Confidence: 68%. Validation criteria: DAU increase of >10% within 30 days.

4. **Plan**: The agent breaks it into MVP tasks: create a Slack webhook endpoint, add notification preferences UI, send notifications for issue creation events only (the minimum test), create a monitoring task.

5. **Execute**: Agents pick up each task, write code, create pull requests, and ship the MVP.

6. **Measure**: The monitoring task watches DAU for 30 days. DAU increases 8% — below the 10% threshold. The hypothesis is partially validated.

7. **Iterate**: The system creates a new issue: "Evaluate Slack integration results." The agent reviews the data, notices that users who enabled Slack notifications have 3x higher engagement. It forms a new hypothesis: "Expanding notifications to status changes and adding @-mentions will push DAU past the 10% threshold." New tasks are created. The loop continues.

### Improvement: Fixing a Regression

1. **Signal arrives**: PostHog detects that sign-up conversion dropped 12% in the last 24 hours. A webhook sends this data to Loop.

2. **Triage**: Loop creates an issue — "PostHog: sign-up conversion -12% (24h)." An AI agent picks it up, reads the PostHog data, checks recent deployments, reviews the git log and error rates, and decides: this is a real problem, not noise.

3. **Hypothesis**: The agent creates a hypothesis — "The OAuth redirect change in PR #847, merged 26 hours ago, adds 1.5-3 seconds of blank white screen, causing users to abandon sign-up." Confidence: 82%. Validation criteria: conversion returns to above 3.4% within 48 hours of a fix.

4. **Plan**: The agent breaks the hypothesis into concrete tasks: add a loading spinner to the redirect page, add latency tracking, and create a monitoring task to verify recovery.

5. **Execute**: Agents pick up each task, write code, create pull requests, and ship.

6. **Monitor**: A monitoring task watches the conversion metric for the next 48 hours. Conversion recovers. The hypothesis is validated. The loop closes.

Both examples use the same system, the same issue queue, the same dispatch mechanism, and the same instruction layer. The only difference is where the loop started: an idea versus a signal.

---

## Loop Has No AI

This is the part that surprises people.

Loop is not an AI product. It is a **fully deterministic data system with a prompt layer.** There are zero LLM calls inside Loop. No embeddings. No inference. No token costs. No model dependencies.

Loop is a web application with a database, an API, and a set of human-authored prompt templates. When an agent asks "what should I work on next?", Loop returns the highest-priority unblocked issue along with detailed instructions that tell the agent exactly what to do. The agent executes. Reports back. And the cycle continues.

**This is the key insight: Loop automatically improves every time a better AI model is released — without changing a single line of code.**

The quality of Loop's output depends on two things:

1. **The instructions** — human-authored, stored in Loop, continuously improved by feedback
2. **The model reading them** — owned and operated by you, outside of Loop

When a better model ships, every Loop installation worldwide gets better overnight. When you switch from a smaller model to a larger one, your loop quality improves instantly. Loop doesn't care which model reads its instructions. It doesn't care which agent platform executes the work. It's a protocol, not a runtime.

**Think of it this way:** Loop is a gym. It doesn't do the lifting — it organizes the workout, tracks progress, and tells you what exercise to do next. As the athletes (AI models) get stronger, the results improve without the gym changing. And the workout plans (instructions) can be refined independently of both the gym and the athletes.

This matters even more in v2. Research quality depends entirely on the model doing the research. Ideation quality depends on the model generating ideas. As models get better at reasoning, analysis, and creative thinking, Loop's discovery mode gets better automatically — without changing a single instruction template. The system scales with intelligence itself.

### Why This Matters

**No vendor lock-in.** Any AI agent that can make HTTP calls works with Loop. Swap agents without touching Loop. Swap models without touching Loop. Your only costs are the models you already pay for.

**Fully on-premises.** Run Loop on your own infrastructure with any model you choose — local LLMs, Claude, GPT, Gemini. No data leaves your environment for AI processing.

**Deterministic and testable.** The entire system can be validated with standard unit tests. No probabilistic behavior. No prompt engineering regressions from API changes. No AI-specific infrastructure.

**Automatically improves.** Every advance in AI capability — from any provider — makes Loop better without any action on your part. The product gets better by standing still.

---

## The Instruction Layer

Loop's real value isn't just organizing work. It's knowing exactly what to tell an agent to do, given the current state of the system.

### Smart Selection

Loop stores a library of instruction templates, each tagged with conditions describing when it should be used. When an issue is ready for dispatch, Loop finds the most specific matching template.

A generic "triage this signal" template might handle most signals. But if the signal came from PostHog, a more specific "triage this PostHog metric change" template takes priority — one that knows to check recent deployments, compare against historical baselines, and look for correlated error spikes. Similarly, a generic "research this idea" template works for most ideas, but a "research this competitive response" template provides more specific guidance when the idea was triggered by a competitor's move.

This is pattern matching, not AI. The most specific match wins, every time, deterministically.

### Rich Context

The selected template is then filled in with everything the agent needs to know: the issue details, the parent issue chain, sibling tasks, the project goal, any previous failed attempts, and which other issues are waiting on this one to finish.

An agent working on research doesn't just get "research Slack integration." It gets the original idea, the user feedback that inspired it, the project it belongs to, the goal it's working toward, what competitors have been analyzed before, and what format the findings should be delivered in.

An agent working on a bug fix doesn't just get "fix this bug." It gets the signal that triggered it, the hypothesis behind it, the project it belongs to, the goal it's working toward, what was tried before and why it failed, and which downstream tasks are blocked until this one completes.

### Self-Improving Instructions

After completing work, agents rate the instructions they were given. Was the prompt clear? Was enough context provided? Did the instructions match the actual work needed?

This feedback accumulates. When instruction quality drops below a threshold, Loop creates an issue — "Improve these instructions" — which enters the same dispatch queue as everything else. An agent picks it up, reads the accumulated feedback, drafts better instructions, and submits them for human review.

The instructions improve through the same loop as the product itself. No special infrastructure. No AI in Loop. Just issues, data, and agents improving each other's work.

---

## Principles

Loop adopts the Lean Startup methodology and extends ideas from the Linear Method — adapted for autonomous agent execution.

### Validate, Don't Assume

Every feature starts as a hypothesis with explicit validation criteria. "Users want X" is an assumption. "Adding X will increase metric Y by Z% within N days" is a hypothesis. The system requires the latter. This is the Lean Startup's core discipline: treat every product decision as a scientific experiment.

### Build for the Loop, Not the Sprint

The system doesn't operate in artificial time-boxes imposed by humans. It runs continuously. Cycles can exist as observation windows for measuring progress, but the work never stops to wait for a planning meeting.

### Ship the Minimum Test

Every hypothesis produces the smallest set of tasks that could validate or invalidate it. Not the smallest *useful* feature — the smallest *testable* feature. If you can validate the hypothesis with a hardcoded prototype, do that before building the real thing. The planning step enforces this by decomposing work into single-session tasks.

### Write Issues, Not User Stories

Issues should be concrete and actionable. "As a user, I want..." templates obscure the actual work. Loop issues describe the problem or action directly:

- Good: "Fix OAuth redirect showing blank page for 1.5-3s"
- Bad: "As a user, I want a faster sign-in experience so that I don't abandon the flow"

### Scope Issues Small

Every issue should be completable in a single agent session. If an agent can't finish an issue in one pass, the issue was too big. The planning step breaks hypotheses into sub-issues that are each independently shippable.

### Triage Everything

Every input — whether a signal, an idea, or a research finding — enters triage before creating work. An agent evaluates: Is this real? Is this worth pursuing? Does this duplicate existing work? Triage is the immune system that prevents the backlog from filling with noise.

### Say No to Most Things

Not every signal deserves a hypothesis. Not every idea deserves research. Not every hypothesis deserves a plan. The system actively prunes: declining noisy signals, archiving low-confidence hypotheses, shelving ideas that don't align with current goals, and keeping backlogs manageable. Agents are cheap, but context pollution degrades their output quality.

### Decide and Move On

Agents form hypotheses at 0.6-0.8 confidence, ship small tests, and measure outcomes. The system learns from results rather than trying to be right upfront. This is the scientific method applied to software: hypothesize, test, measure, iterate.

### Build in Public

Every agent action is logged. Every hypothesis is traceable to its origin — whether that's a signal, an idea, or a research finding. Every outcome is measured. The system can generate changelogs that explain not just _what_ changed but _why_ — tracing back to the original insight that triggered the work.

---

## The Data Model

Loop's data model is intentionally simple. At its core, there are a handful of concepts:

**Issues** are the atomic unit. Everything — ideas, research, signals, hypotheses, plans, tasks, monitors — is an issue with a type. Issues can have one parent (but only one level deep), belong to a project, carry labels, and link to each other with blocking relationships.

**Projects** group issues toward a shared objective. A project can represent an entire product ("Launch Acme MVP") or a strategic initiative within one ("Improve onboarding"). Projects have a lifecycle: they begin in discovery mode and shift toward improvement as the product matures and signals accumulate.

**Goals** are measurable success indicators attached to projects. "Increase sign-up conversion to 4%" gives the system — and the agents — strategic direction. Without goals, the loop optimizes locally (fix the latest bug, build the latest idea). With goals, agents have context for prioritization and can evaluate whether to pivot or persevere.

Goals in v2 can include PMF indicators: retention rates, engagement frequency, NPS scores, revenue metrics. When a goal represents a PMF threshold ("achieve 40% week-2 retention"), the entire project's discovery and improvement loops orient around reaching it.

**Signals** are raw incoming data from the outside world: analytics webhooks, error tracking alerts, user feedback, git events. Every signal creates an issue for triage.

**Labels** categorize issues — bugs, features, infrastructure, research, idea, auto-generated. Some labels are system-managed to mark work that was created or completed by agents.

**Issue Relations** express dependencies. "Task A blocks Task B" means Task B won't be dispatched until Task A is complete. This is how the system handles execution ordering without a workflow engine.

**Comments** are how agents and humans communicate on issues. Agents report progress, document findings, and ask questions. Humans provide guidance and overrides.

---

## The Pull Architecture

Loop doesn't push work to agents. Agents pull work from Loop.

On a configurable schedule, an agent asks Loop: "What should I work on next?" Loop evaluates the entire backlog — filtering out blocked issues, scoring by priority, goal alignment, and age — and returns the single highest-priority item along with fully prepared instructions.

The agent executes. Reports results back to Loop's API. And on the next poll, gets the next item.

This applies equally to research tasks, idea evaluation, bug fixes, and feature implementation. A research task competes in the same queue as a critical bug fix. Priority scoring ensures urgent signals outrank speculative research — unless the project is in early discovery, where research *is* the most important work.

This design is deliberately simple. Loop never needs to know how to connect to your agent platform. Your agent platform never needs to expose an endpoint. The integration is a single scheduled poll. Any agent that can make HTTP calls works with Loop.

---

## What Loop Tracks

Loop isn't just a to-do list. It tracks the health of both the product and the improvement loop itself.

### Loop Health

**Loop velocity** — how fast does the system go from signal (or idea) to validated outcome? This is the equivalent of "cycle time" for the entire feedback loop.

**Hypothesis hit rate** — what percentage of hypotheses are validated versus invalidated? Over time, the system learns which signal patterns and research findings produce accurate hypotheses.

**Prompt health** — are the instructions getting better or worse? Which templates have low completion rates? Which ones get poor feedback from agents?

### Product Health

**Goal progress** — are the measurable outcomes actually improving? Conversion rates, error rates, response times — whatever you're tracking.

**PMF indicators** — for products in discovery mode: retention curves, engagement frequency, user growth rate, NPS or satisfaction scores. These are the metrics that tell you whether the product is on a path to product-market fit or needs a pivot.

**Discovery efficiency** — what percentage of researched ideas become validated hypotheses? What percentage of shipped MVPs produce positive outcomes? This tells you how well the system is at identifying opportunities worth pursuing.

**Pivot history** — how many pivots has this project made, and what triggered each one? This is the institutional memory that prevents the system from circling back to ideas it already tried and invalidated.

These metrics are displayed in a dashboard that shows the loop working in real time: ideas arriving, research completing, hypotheses forming, tasks executing, outcomes being measured, and the product moving toward its goals.

---

## Open Source and Agent-Agnostic

Loop is fully open source. MIT licensed. No vendor lock-in.

Any agent can use Loop — not just DorkOS. Any tool that can make HTTP calls can poll Loop's dispatch endpoint. Swap agents without changing Loop. Swap models without changing Loop.

The instruction templates are community-improvable. Better templates mean better results for everyone. A PostHog-specific triage template that one team develops benefits every Loop installation that receives PostHog signals. A market research template refined by one startup benefits every Loop user doing discovery.

Because Loop has no AI built in, there are no AI costs from Loop itself. Hosting costs are minimal — it's a standard web application with a database. All AI costs live on the agent side, where you already control them.

---

## Part of the DorkOS Suite

Loop is built by Dork Labs, the team behind DorkOS — the open-source web interface and API for Claude Code. Loop is designed as a companion product: DorkOS provides the agent execution environment, Loop provides the autonomous work management layer on top.

Together, they form a complete autonomous development system:

- **DorkOS** is the hands. It runs AI agent sessions, manages tool approvals, and provides the chat interface for human-agent collaboration.
- **Loop** is the brain. It collects signals, generates ideas, conducts research, decides what to work on, prepares instructions, and tracks outcomes.

DorkOS's built-in scheduler (Pulse) polls Loop on a regular cadence. Loop returns the next priority item with instructions. DorkOS executes. The agent reports back. The loop runs itself.

But Loop works with any agent platform. DorkOS is the first integration, not the only one.

---

## Why Now

Four things converged to make this possible:

**Agent capability has crossed the threshold.** AI coding agents can now reliably write, test, and ship code autonomously. But they can also *think* — analyze markets, evaluate trade-offs, synthesize research, and form hypotheses. They're good enough to not just execute tasks, but to help decide which tasks are worth executing. Loop gives that capability structure.

**The protocol layer exists.** REST APIs, webhooks, and emerging standards like the Model Context Protocol mean that tools can expose capabilities to any agent. Loop's dispatch endpoint is a simple HTTP call. Any agent, any platform, any model.

**Lean Startup needs automation.** The Build-Measure-Learn loop has been the gold standard for product development for over a decade, but it still runs manually. Founders track metrics in spreadsheets, discuss pivots in meetings, and lose institutional memory when team members leave. Loop makes the methodology executable, continuous, and auditable.

**The market gap is real.** Height attempted autonomous project management and shut down in September 2025. Linear has positioned itself as the PM layer that accepts AI agents but doesn't close the loop. Factory.ai builds agent fleets but has no PM layer. No existing product sits at the intersection of issue tracking, autonomous execution, product discovery, and closed feedback loops.

---

## The Vision

The question isn't whether AI agents will manage their own work. It's whether the system that guides them will be built intentionally — with hypotheses, validation, and scientific rigor — or whether it'll be a mess of cron jobs, Slack notifications, and human intuition.

Loop is the intentional version. It's the Lean Startup on autopilot — a system that can take a napkin idea and autonomously research it, build an MVP, measure outcomes, learn from the results, and iterate until it finds product-market fit. Or discover that it won't, and pivot to something that will.

The human sets the direction. The system does the rest.

Learn. Build. Ship. Loop.
