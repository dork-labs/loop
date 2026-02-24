# Loop ICP — AI-Native Early-Stage Startup

---

## Company Profile

- **Stage:** Pre-seed to Series A
- **Size:** 1-15 people total, 1-8 engineers
- **Revenue:** Pre-revenue to $1M ARR
- **Industry:** B2B SaaS, developer tools, or any software product where shipping velocity matters more than compliance

---

## Technical Signals (Observable Before Outreach)

These are things you can see from the outside that indicate fit:

| Signal | Why It Matters |
|--------|---------------|
| Uses AI coding agents (Claude Code, Cursor, Devin, Codex) | Loop has zero value without agents in the workflow |
| GitHub-based development | Loop's GitHub webhook and PR-based agent workflow require GitHub |
| Has PostHog, Sentry, or similar observability | Means they generate signals Loop can ingest — immediate value |
| Ships frequently (multiple PRs per day or week) | High shipping velocity amplifies the "no feedback loop" pain |
| Open-source or developer-focused product | More likely to adopt open-source tooling; more likely to value DX |
| Founder is technical and builds-in-public | Correlates with AI agent adoption and willingness to try new tools |

---

## Behavioral Signals (Observable After First Contact)

| Signal | Why It Matters |
|--------|---------------|
| Has tried automating agent dispatch (cron jobs, scripts, custom tooling) | They've already felt the pain and built a worse version of Loop |
| Has experienced a "shipped but never verified" incident | The core trigger event — they know the problem firsthand |
| Uses Lean Startup language (hypotheses, validation, pivots) | Mental model alignment — Loop's concepts will land immediately |
| Evaluates tools by GitHub repo, not marketing site | Matches Loop's distribution strategy (README, docs, CLI — not ads) |

---

## Disqualifying Signals

| Signal | Why It Disqualifies |
|--------|---------------------|
| No AI agents in the workflow | Loop's core dispatch mechanism is useless without agents |
| Enterprise procurement process (RFP, SOC 2 requirement, SSO mandatory) | Loop doesn't have enterprise features and shouldn't build them yet |
| Sprint-based workflow with Jira/Asana at the center | Fundamental paradigm conflict — Loop replaces the PM layer, not augments it |
| Team larger than 20 engineers | Multi-user auth, RBAC, and team features aren't built yet |
| Primary codebase is not on GitHub | GitHub webhook integration is the deepest signal source; no GitHub = limited value |

---

## Where They Hang Out

| Channel | Specifics |
|---------|-----------|
| **Hacker News** | Reads/comments on "Show HN" posts; upvotes developer tools |
| **Indie Hackers** | Active in discussions about building with AI agents |
| **r/ClaudeAI, r/SaaS** | Asks about agent automation, shares build-in-public updates |
| **Claude Code Discord** | Discusses agent workflows, tool integrations, autonomous coding |
| **YC Startup School** | Technical founders in the 0-to-1 phase |
| **X/Twitter** | Follows AI agent builders, shares shipping updates |

---

## Go-to-Market Implications

- **Distribution:** Open source first (GitHub, Hacker News "Show HN"), then community seeding in Claude Code Discord and r/ClaudeAI
- **Activation metric:** First signal ingested OR first issue dispatched to an agent (whichever comes first)
- **Pricing:** Free and open source for self-hosted; future cloud offering for teams who don't want to manage infrastructure
- **Messaging:** Lead with the problem ("you ship but you don't know if it worked"), not the solution category ("autonomous project management")

---

## Research Basis

- **Data sources:** Litepaper v2 competitive analysis, brand foundation target audience, developer onboarding research, codebase analysis of supported integrations
- **Confidence level:** Proto-persona (assumption-based, zero customer data)
- **Key assumptions to validate:**
  1. That the early adopter is a solo/small team founder, not a platform engineer at a larger company
  2. That PostHog + Sentry + GitHub is the right integration trio (vs. Datadog + LaunchDarkly + GitLab)
  3. That open-source distribution is the right GTM for this audience (vs. a managed cloud-first approach)
- **Created:** 2026-02-23
- **Next review:** 2026-08-23
