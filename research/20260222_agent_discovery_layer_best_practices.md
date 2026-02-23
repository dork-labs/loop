# Agent Discovery Layer: Best Practices Research

**Date:** 2026-02-22
**Research Depth:** Deep
**Searches Performed:** 18
**Topic:** Best practices for five agent-discovery artifacts for Loop (looped.me)

---

## Research Summary

Loop needs five discovery artifacts so that AI agents — and the humans configuring them — can find and use Loop automatically. This research covers the authoritative specification for each artifact format, real-world implementation patterns from Stripe, Langfuse, Cloudflare, Anthropic, and OpenAI Codex, and concrete recommendations tailored to Loop's API-first, developer-tool profile.

The five artifacts are related but serve distinct discovery moments: `llms.txt` is for LLMs ingesting documentation en masse; `SKILL.md` is for agents loading Loop capabilities on-demand; `AGENTS.md` is the human-pasted project-level context block; `loop.mdc` is the Cursor auto-attach rule; and the OpenHands microagent is the keyword-triggered knowledge injection. All five can share a core content nucleus but are shaped differently for their consumption context.

---

## Key Findings

1. **llms.txt**: Simple, curated, link-forward — not an exhaustive dump. The spec is deliberately minimal. Winning implementations (Cloudflare, Stripe) use product-area H2 sections with 20-100 links each and `:` descriptions on key entry points. An `llms-full.txt` companion at full doc depth is standard practice.

2. **SKILL.md (agentskills.io)**: Progressive disclosure is the design principle. Only `name` + `description` are always loaded; the body loads on activation; supplementary files in `references/` load on demand. Keep body under 500 lines / 5000 tokens. Langfuse's implementation is the gold standard for API tools.

3. **AGENTS.md**: Format-free Markdown. Agents read it before doing any work. The critical insight for a third-party product distributing a snippet: focus on the integration contract — auth env vars, base URL, SDK invocation patterns, and common task examples — not on project structure (that belongs in the team's own AGENTS.md).

4. **Cursor rules (.mdc)**: Two viable modes — `alwaysApply: true` for always-present context (risky for token budget) or `alwaysApply: false` with a sharp `description` (agent-requested). For Loop, agent-requested is correct: the description acts as the trigger. File goes in `.cursor/rules/loop/RULE.md` with the slug matching the directory name.

5. **OpenHands microagent**: `trigger_type: keyword` with a `triggers:` list. When any trigger word appears in a user message, the full file is injected into context. Keep under ~200 lines. Triggered microagents live in `.agents/skills/<name>/SKILL.md` (current spec) or legacy `.openhands/microagents/<name>.md`.

6. **Cross-cutting**: All five artifacts share a core information nucleus: what Loop is, the API base URL, auth mechanism, and the three or four most common agent tasks. They differ only in rendering context (token budget, formatting, trigger mechanism). A single source-of-truth prose block can be machine-transformed into each format.

---

## Detailed Analysis

### 1. llms.txt Best Practices

#### The Specification

The [llmstxt.org](https://llmstxt.org/) specification is intentionally minimal:

- Served at `/llms.txt`
- Markdown only
- **Required**: One H1 (project/site name)
- **Optional**: Blockquote summary, body paragraphs, H2 sections containing link lists
- No specified length limit
- An `Optional` H2 section signals to LLMs: "skip these if context is tight"

The spec is a convention, not an enforced schema. The winning strategy is to match how agents actually use it: as a navigation layer to find the right `.md` doc page, not as documentation itself.

#### Real-World Implementation Patterns

**Anthropic** uses two files:
- `llms.txt` (~8,000 tokens): curated index of top pages
- `llms-full.txt` (~480,000 tokens): every API doc, full content

This index/full-export pattern is now standard. Slim for real-time assistants; full for IDE integrations and RAG pipelines.

**Cloudflare** (`developers.cloudflare.com/llms.txt`):
- Single H1: "Cloudflare Developer Documentation"
- ~15 H2 sections, one per product (Agents, AI Gateway, Workers, R2, etc.)
- Each section: 20-100 links
- ~30-40% of links include `:` descriptions — selectively on getting-started and tutorial entries, not on every reference page
- Links point directly to `.md` versions of pages (e.g., `https://developers.cloudflare.com/path/to/page/index.md`)

**Stripe** organizes by product vertical:
- H2 sections per product area (Checkout, Payments, Link, Billing)
- Includes a brief product description sentence before the link list
- Uses an `Optional` H2 for specialized/niche tools

**Langfuse** (critical reference for Loop — same developer-tool profile):
- Has both `llms.txt` and supports `.md` suffix on any doc URL for clean markdown output
- Its own SKILL.md references `https://langfuse.com/llms.txt` as the first step in documentation discovery
- This creates a reinforcing loop: agents learn to fetch llms.txt from the skill instructions

#### How Products Link to Markdown Docs

Two strategies observed:
1. **Suffix pattern**: Any doc URL + `.md` returns clean markdown (Langfuse, Mintlify-hosted sites)
2. **Parallel URL tree**: `/llms-full.txt` contains the full text inline; individual pages are referenced by their standard URL

For Loop, the suffix pattern (`/docs/some-page.md`) is the better developer experience — it's discoverable without any special infrastructure.

#### Recommended Structure for Loop

```
# Loop

> Loop is the Autonomous Improvement Engine — an open-source data layer and
> prompt engine that turns signals into prioritized, actionable issues for
> AI agents. REST API at https://app.looped.me/api.

## Getting Started

- [Quick Start](https://www.looped.me/docs/quickstart.md): Install the SDK and create your first issue in 5 minutes
- [Authentication](https://www.looped.me/docs/auth.md): Bearer token setup and API key management
- [Core Concepts](https://www.looped.me/docs/concepts.md): Signals, issues, projects, goals, and the dispatch loop

## Issues API

- [List and Filter Issues](https://www.looped.me/docs/api/issues.md): Pagination, status filters, type filters
- [Create an Issue](https://www.looped.me/docs/api/issues-create.md): Fields, types, label assignment
- [Issue Relations](https://www.looped.me/docs/api/relations.md): Blocking relationships and dependency graphs

## Signal Ingestion

- [Ingest a Signal](https://www.looped.me/docs/api/signals.md): POST /api/signals — creates signal + linked triage issue automatically
- [PostHog Webhook](https://www.looped.me/docs/webhooks/posthog.md)
- [Sentry Webhook](https://www.looped.me/docs/webhooks/sentry.md)
- [GitHub Webhook](https://www.looped.me/docs/webhooks/github.md)

## Agent Dispatch

- [Next Issue Endpoint](https://www.looped.me/docs/api/dispatch.md): How agents poll for the highest-priority work item
- [Reporting Results](https://www.looped.me/docs/api/results.md): Closing issues, adding comments, updating status

## Projects and Goals

- [Projects](https://www.looped.me/docs/api/projects.md)
- [Goals](https://www.looped.me/docs/api/goals.md): Measurable success indicators attached to projects

## Prompt Templates

- [Templates Overview](https://www.looped.me/docs/prompts/overview.md)
- [Versions and Promotion](https://www.looped.me/docs/prompts/versions.md)
- [Prompt Reviews](https://www.looped.me/docs/prompts/reviews.md)

## Optional

- [Dashboard Stats API](https://www.looped.me/docs/api/dashboard.md)
- [SDK Reference](https://www.looped.me/docs/sdk.md)
- [Self-Hosting Guide](https://www.looped.me/docs/self-hosting.md)
```

**Notes:**
- Serve this at `https://www.looped.me/llms.txt`
- Also serve at `https://app.looped.me/llms.txt` for API-first discovery
- Implement `.md` suffix support on all doc pages
- Create a companion `llms-full.txt` with full inline content of all linked pages

---

### 2. Agent Skills (SKILL.md) Best Practices

#### The Specification (agentskills.io)

The spec is well-defined. Key points:

**Frontmatter (required):**
```yaml
---
name: loop                          # max 64 chars, lowercase+hyphens, matches dir name
description: |                      # max 1024 chars — this is the ALWAYS-LOADED part
  Interact with Loop (looped.me), the autonomous improvement engine.
  Use when creating issues, ingesting signals, fetching the next work item
  for an agent, managing projects and goals, or accessing prompt templates.
  Loop's REST API is at https://app.looped.me/api.
license: MIT
compatibility: Requires internet access to reach https://app.looped.me
metadata:
  author: dork-labs
  version: "1.0"
---
```

**Body (loaded on activation):**
- No format restrictions
- Recommended: step-by-step instructions, examples, edge cases
- **Hard limit: keep under 500 lines / 5000 tokens**
- Move detailed reference material to `references/` subdirectory
- Use relative paths: `See [references/api.md](references/api.md)`

**Directory structure:**
```
loop/
├── SKILL.md                  # Required
├── references/
│   ├── api.md                # Full API reference
│   └── dispatch.md           # Dispatch/polling patterns
└── scripts/
    └── check-auth.sh         # Optional: verify env vars are set
```

**Progressive disclosure budget:**
| Layer | What loads | Token budget |
|-------|-----------|--------------|
| `name` + `description` | Always, at agent startup | ~100 tokens |
| `SKILL.md` body | On skill activation | < 5000 tokens |
| `references/*.md` | On demand, when referenced | Unlimited |

#### The Langfuse Reference Implementation

Langfuse's `langfuse/SKILL.md` is the best real-world analog for Loop. Its patterns to copy:

1. **Description targets all three use cases** in one sentence each: "Use when needing to (1)... (2)... (3)..."
2. **Body opens with a two-line summary** of what the skill does before any technical content
3. **Auth section is explicit**: "Set these env vars. If not set, ask the user."
4. **Links to llms.txt** as the first documentation-discovery step
5. **Progressive docs retrieval**: llms.txt index → specific page fetch → search API fallback
6. **CLI/API examples** are copy-paste-ready

#### Auth Configuration Pattern (from Langfuse)

```markdown
## Authentication

Set these environment variables before making API calls:

```bash
export LOOP_API_KEY=loop_...
```

If not set, ask the user for their API key. It is found in the Loop dashboard
under Settings → API Keys, or at https://app.looped.me/settings/api-keys.

The API base URL is https://app.looped.me/api. All protected endpoints require:
```
Authorization: Bearer $LOOP_API_KEY
```
```

#### Recommended SKILL.md Body Structure for Loop

```markdown
# Loop

Loop is an autonomous improvement engine with a REST API at https://app.looped.me/api.
Two core capabilities: **issue management** (create, list, update, dispatch work items)
and **signal ingestion** (webhook-style data that auto-creates triage issues).

## Authentication

Set before making calls:

```bash
export LOOP_API_KEY=loop_...
```

Base URL: `https://app.looped.me/api`. All `/api/*` endpoints require:
`Authorization: Bearer $LOOP_API_KEY`

Get a key at https://app.looped.me/settings/api-keys.

## Common Tasks

### Get the next issue for an agent to work on
```bash
curl -H "Authorization: Bearer $LOOP_API_KEY" \
  https://app.looped.me/api/issues?status=open&limit=1
```

### Create an issue
```bash
curl -X POST -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Fix login redirect","type":"bug","projectId":"proj_..."}' \
  https://app.looped.me/api/issues
```

### Ingest a signal (creates signal + triage issue automatically)
```bash
curl -X POST -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"source":"custom","title":"Error rate spike","data":{...}}' \
  https://app.looped.me/api/signals
```

### Close an issue
```bash
curl -X PATCH -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status":"done"}' \
  https://app.looped.me/api/issues/{id}
```

## Documentation

1. Fetch the index: `curl -s https://www.looped.me/llms.txt`
2. Fetch any doc page as markdown: append `.md` to its URL
3. See [references/api.md](references/api.md) for the full endpoint reference

## Endpoints Reference

For complete API docs, see [references/api.md](references/api.md).
```

**Distribution:**
- Publish to `github.com/dork-labs/loop-skill` (mirrors `agentskills.io` pattern)
- Install via: `npx openskills install loop`
- Registers in `.claude/skills/loop/` by default
- Also works: `npx openskills install loop --universal` (installs to `.agent/skills/`)

---

### 3. AGENTS.md Best Practices

#### The Specification

[AGENTS.md](https://agents.md/) is stewarded by the Agentic AI Foundation (Linux Foundation). Key facts:

- Plain Markdown, no required sections, no enforced schema
- Adopted by 60,000+ GitHub repos
- Read by: OpenAI Codex, Amp, Jules (Google), Cursor, Factory, Windsurf, GitHub Copilot, Devin, and 15+ others
- **Precedence rule**: closest AGENTS.md to the file being edited wins. Root-level files set global context; subdirectory files override for that scope.
- Concatenation model: Codex joins all AGENTS.md files from root to current directory, separated by blank lines. Later (deeper) files override earlier ones.

#### What a Third-Party Product Distributes

Loop is not shipping an AGENTS.md for its own development. It is providing a **snippet that developer teams paste into their own AGENTS.md** so agents working in those repos know how to use Loop.

The snippet should:
- Be a clearly marked section (e.g., `## Loop Integration`) so teams can find and update it
- Include env var names, not values
- Focus on the agent's job-to-be-done (create issues, ingest signals) not on Loop's internal architecture
- Be self-contained — a team might paste only this block, or embed it alongside other tool sections
- Be under 400 tokens — agents read this on every session

#### Recommended AGENTS.md Snippet for Loop

```markdown
## Loop Integration

This repo uses [Loop](https://looped.me) as its autonomous improvement engine.
Loop's REST API manages issues, signals, projects, and prompt templates.

### Auth

The API key is in `LOOP_API_KEY` (environment variable). All protected
endpoints use `Authorization: Bearer $LOOP_API_KEY`.

Base URL: `https://app.looped.me/api`

### When to Create a Loop Issue

- Create an issue for any bug found during work: POST /api/issues
- Ingest an anomaly or external signal: POST /api/signals
- Block/unblock work items: POST /api/issues/:id/relations

### Common Curl Patterns

```bash
# List open issues
curl -H "Authorization: Bearer $LOOP_API_KEY" \
  "https://app.looped.me/api/issues?status=open"

# Create an issue
curl -X POST -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"...","type":"bug"}' \
  https://app.looped.me/api/issues

# Get dashboard stats
curl -H "Authorization: Bearer $LOOP_API_KEY" \
  https://app.looped.me/api/dashboard/stats
```

### Documentation

Full API reference: https://www.looped.me/docs
Machine-readable: https://www.looped.me/llms.txt
```

#### Distribution Mechanism

- Host the canonical snippet at `https://www.looped.me/agents-md-snippet.md`
- Include in Loop's own docs: "Add this to your AGENTS.md"
- Include in the SDK's `README.md` as a fenced code block
- Consider a CLI command: `npx looped agents-md` that prints the snippet to stdout

---

### 4. Cursor Rules (.mdc) Best Practices

#### The Format

Cursor rules live in `.cursor/rules/<rule-name>/RULE.md` (Cursor v2.2+). Older format used `.cursor/rules/<name>.mdc` flat files. Both work; directory format is preferred going forward.

**Frontmatter fields:**

```yaml
---
description: "When to apply this rule — written for the agent to read"
alwaysApply: false
globs: []
---
```

| Field | Type | Effect |
|-------|------|--------|
| `description` | string | Agent reads this to decide if rule is relevant (Agent-Requested mode) |
| `alwaysApply` | boolean | `true` = always injected into context (use sparingly — costs tokens) |
| `globs` | array of strings | Auto-attach when a matching file is mentioned in chat |

**Four modes:**

| Mode | Frontmatter | When it fires |
|------|-------------|---------------|
| Always Apply | `alwaysApply: true` | Every chat session |
| Auto-Attached | `globs: ["*.ts"]` | When a matching file is referenced in chat |
| Agent-Requested | `description: "..."`, no globs, `alwaysApply: false` | Agent reads description, pulls rule if relevant |
| Manual | No frontmatter fields set | Only via `@rule-name` in chat |

#### Loop's Correct Mode: Agent-Requested

Loop's context is valuable when the agent is working on anything that involves calling the Loop API, creating issues, or managing signals. This is not every session, so `alwaysApply: true` would waste tokens. `globs` doesn't help because there is no file extension associated with Loop usage.

**Use Agent-Requested mode.** Write a description that makes the trigger conditions obvious.

#### Recommended loop.mdc Content

```markdown
---
description: >
  Use when working with Loop (looped.me), the autonomous improvement engine.
  Apply when: creating or updating issues via the Loop API, ingesting signals,
  fetching the next work item for an agent to process, managing projects or
  goals, or accessing prompt templates. Loop's API base is https://app.looped.me/api.
alwaysApply: false
---

# Loop — Autonomous Improvement Engine

## Auth

```bash
# Required env var
export LOOP_API_KEY=loop_...
```

All `/api/*` endpoints: `Authorization: Bearer $LOOP_API_KEY`
Get your key: https://app.looped.me/settings/api-keys

## Common Operations

```bash
# List open issues
curl -H "Authorization: Bearer $LOOP_API_KEY" \
  "https://app.looped.me/api/issues?status=open"

# Create issue
curl -X POST -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"<title>","type":"bug|feature|task"}' \
  https://app.looped.me/api/issues

# Ingest a signal
curl -X POST -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"source":"custom","title":"<title>","data":{}}' \
  https://app.looped.me/api/signals

# Get next priority issue
curl -H "Authorization: Bearer $LOOP_API_KEY" \
  "https://app.looped.me/api/issues?status=open&limit=1"
```

## API Reference

Full docs: https://www.looped.me/docs
Machine-readable: https://www.looped.me/llms.txt

## Issue Types

`bug` | `feature` | `task` | `signal` | `hypothesis` | `monitor`

## Status Values

`triage` | `open` | `in_progress` | `done` | `cancelled` | `snoozed`
```

#### Publishing to cursor.directory

- cursor.directory is a community index; submit via a PR to their GitHub repo
- The submission requires a name, description, content, and category tag
- Category for Loop: "API / Developer Tools" or "Project Management"
- The rule content in the submission is the full `.mdc` body (same as the file)

#### Distribution for Teams

Provide a one-line install command:
```bash
mkdir -p .cursor/rules/loop && \
  curl -s https://www.looped.me/cursor-rule > .cursor/rules/loop/RULE.md
```

Or via the Loop CLI:
```bash
npx looped install-cursor-rule
```

---

### 5. OpenHands Microagent Best Practices

#### Current File Format (2025-2026)

OpenHands has evolved through several formats. The current canonical location is:

```
.agents/skills/<skill-name>/SKILL.md    # Current (preferred)
.openhands/microagents/<name>.md        # Legacy (still works)
```

For a publicly distributed knowledge microagent (like Loop providing one for any repo), the file goes in the **global skills registry** (`~/.openhands/microagents/` for user-level, or submitted to `github.com/OpenHands/skills` for global distribution).

#### Frontmatter Variants

**Keyword-triggered knowledge microagent (what Loop needs):**
```yaml
---
name: loop
agent: CodeActAgent
trigger_type: keyword
triggers:
  - loop
  - looped
  - looped.me
  - loop api
  - loop issue
  - ingest signal
---
```

**Always-loaded repository context (alternative):**
```yaml
---
name: loop-context
agent: CodeActAgent
trigger_type: always
---
```

**Legacy format (still widely used in `.openhands/microagents/*.md`):**
```yaml
---
triggers:
  - loop
  - looped
---
```

#### Trigger Keyword Strategy for Loop

The trigger system fires when any listed keyword appears in the **user's message or the agent's own output**. This means keywords should match:
- What developers naturally type: "loop", "looped", "create a loop issue"
- API domain terms: "loop api", "ingest signal"
- The product URL: "looped.me"

Avoid overly generic keywords like "issue" (collision with GitHub Issues, Jira) or "signal" (too broad). "loop" is fine as a primary trigger since it's Loop's brand name.

#### Recommended Content Structure

Keep under ~200 lines. OpenHands injects the full file into context on trigger — every token costs.

```markdown
---
name: loop
agent: CodeActAgent
trigger_type: keyword
triggers:
  - loop
  - looped
  - looped.me
  - loop issue
  - loop api
  - ingest signal
---

# Loop — Autonomous Improvement Engine

Loop is an open-source REST API for managing issues, signals, projects, and
prompt templates in an autonomous development workflow.

## API Base URL

```
https://app.looped.me/api
```

All protected endpoints require: `Authorization: Bearer $LOOP_API_KEY`

## Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/issues | List issues (filter: status, type, projectId) |
| POST | /api/issues | Create an issue |
| PATCH | /api/issues/:id | Update an issue |
| POST | /api/signals | Ingest a signal |
| GET | /api/projects | List projects |
| GET | /api/goals | List goals |
| GET | /api/dashboard/stats | System health metrics |

## Common Workflows

### Create an issue
```bash
curl -X POST \
  -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Fix login flow","type":"bug","projectId":"proj_..."}' \
  https://app.looped.me/api/issues
```

### Ingest a signal
```bash
curl -X POST \
  -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"source":"custom","title":"Error spike detected","data":{"count":47}}' \
  https://app.looped.me/api/signals
```

### List open issues
```bash
curl -H "Authorization: Bearer $LOOP_API_KEY" \
  "https://app.looped.me/api/issues?status=open"
```

## Documentation

Full docs: https://www.looped.me/docs
Machine-readable index: https://www.looped.me/llms.txt
```

#### How to Distribute

1. Submit to the global OpenHands skills registry: open a PR to `github.com/OpenHands/skills`
2. Provide install instructions for repo-level use:
   ```bash
   mkdir -p .agents/skills/loop && \
     curl -s https://www.looped.me/openhands-skill > .agents/skills/loop/SKILL.md
   ```
3. The Loop docs should include a "Use Loop with OpenHands" guide

---

### 6. Cross-Cutting Concerns

#### The Shared Content Nucleus

All five artifacts draw from the same core information. Define this nucleus once in a machine-readable source (e.g., `meta/agent-discovery.yaml`) and generate each artifact from it:

```
Core nucleus:
  - Product name and one-line description
  - API base URL
  - Auth mechanism (Bearer token, env var name)
  - Top 5 endpoints with curl examples
  - Documentation URL
  - llms.txt URL
  - Issue types enum
  - Status values enum
```

| Artifact | Uses nucleus how |
|----------|-----------------|
| `llms.txt` | Links only — minimal prose, navigation structure |
| `SKILL.md` | Full nucleus as imperative instructions + auth flow |
| `AGENTS.md snippet` | Condensed nucleus + copy-paste curl examples |
| `loop.mdc` | Condensed nucleus + frontmatter trigger description |
| `OpenHands microagent` | Table-format endpoint list + curl examples |

#### Token Budget Per Artifact

| Artifact | Target | Hard limit | Notes |
|----------|--------|-----------|-------|
| `llms.txt` | 2,000-5,000 tokens | None | Index only; full content in `llms-full.txt` |
| `SKILL.md` description | ~200 tokens | 1,024 chars | Always loaded — every token costs |
| `SKILL.md` body | ~2,000 tokens | 5,000 tokens | Only loaded when skill is invoked |
| `AGENTS.md snippet` | ~300-400 tokens | ~600 tokens | Loaded every session in integrated repos |
| `loop.mdc` | ~400 tokens | ~1,000 tokens | Loaded when agent determines relevance |
| `OpenHands microagent` | ~500 tokens | ~1,500 tokens | Loaded when trigger keyword fires |

#### Maintenance Strategy

Low-maintenance approach: treat each artifact as a template with a few variable slots, regenerated from `meta/agent-discovery.yaml` when the API changes. The regeneration step can be a script that runs in CI on any change to the API docs.

Expected change frequency:
- `llms.txt`: changes when new doc pages are added (weekly/monthly)
- `SKILL.md`: changes when API surface changes or auth mechanism changes (rare)
- `AGENTS.md snippet`: changes when core auth or base URL changes (very rare)
- `loop.mdc`: changes when new endpoints are added worth calling out (rare)
- `OpenHands microagent`: changes when endpoint table changes (rare)

**Practical recommendation**: Author all five by hand initially. Set up a CI check that validates the API base URL and auth header format match in all five files. Don't over-engineer generation until the maintenance burden is proven.

#### How the Five Artifacts Relate

```
Discovery moment                   Artifact

LLM ingesting docs at scale   -->  llms.txt
Agent needs Loop capabilities -->  SKILL.md (on-demand load)
Agent working in a Loop repo  -->  AGENTS.md snippet (always loaded)
Cursor user asks about Loop   -->  loop.mdc (agent-requested)
OpenHands user mentions Loop  -->  OpenHands microagent (keyword-triggered)
```

They are not redundant — each fires at a different discovery moment. An agent using Cursor with the `.mdc` rule will not have the OpenHands microagent loaded. A developer who only pastes the AGENTS.md snippet gets no Cursor rule. Each artifact is independently valuable.

#### Auto-Discovery via `llms.txt`

A virtuous cycle is available: include the SKILL.md install command in `llms.txt` and in the Loop docs. Langfuse does this — their SKILL.md references `langfuse.com/llms.txt` and their `llms.txt` is listed as the first step in the skill's documentation workflow. This means:
1. An agent fetches `llms.txt` to understand Loop
2. `llms.txt` mentions that a SKILL.md is available via `npx openskills install loop`
3. The agent installs the skill, which itself references `llms.txt` for docs discovery
4. The loop closes

Add to `llms.txt`:

```markdown
## Agent Integration

- [Install Loop Agent Skill](https://www.looped.me/docs/agent-skill.md): `npx openskills install loop` — teaches any AI agent how to use the Loop API
- [AGENTS.md Snippet](https://www.looped.me/agents-md-snippet.md): Paste into your repo's AGENTS.md
- [Cursor Rule](https://www.looped.me/cursor-rule): Auto-activates in Cursor when working with Loop
```

---

## Sources & Evidence

- [llmstxt.org specification](https://llmstxt.org/) — official spec, H1/H2/blockquote structure, Optional section semantics
- [Cloudflare llms.txt](https://developers.cloudflare.com/llms.txt) — real-world example of H2 product sections, selective `:` descriptions, `.md` link pattern
- [Real llms.txt examples from leading tech companies](https://www.mintlify.com/blog/real-llms-txt-examples) — Stripe, Anthropic, Vercel pattern analysis
- [7 Top Companies Using llms.txt](https://llms-txt.io/blog/companies-using-llms-txt-examples) — Zapier, Stripe structural breakdowns
- [agentskills.io specification](https://agentskills.io/specification) — complete SKILL.md format: frontmatter fields, body, directory structure, progressive disclosure, token budgets
- [SKILL.md Format on DeepWiki](https://deepwiki.com/numman-ali/openskills/5.1-skill.md-format-specification) — openskills distribution mechanism
- [Langfuse skills repo](https://github.com/langfuse/skills) — gold-standard SKILL.md implementation for an API tool
- [agents.md specification](https://agents.md/) — official AGENTS.md format, precedence rules, agent compatibility list
- [OpenAI Codex AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md/) — how Codex reads AGENTS.md, concatenation model
- [OpenAI Codex AGENTS.md example](https://github.com/openai/codex/blob/main/AGENTS.md) — real-world reference implementation
- [AGENTS.md GitHub repo](https://github.com/agentsmd/agents.md) — stewardship, adoption numbers
- [awesome-cursor-rules-mdc reference](https://github.com/sanjeed5/awesome-cursor-rules-mdc/blob/main/cursor-rules-reference.md) — MDC frontmatter field definitions, four rule application modes
- [Cursor IDE Rules Deep Dive](https://mer.vin/2025/12/cursor-ide-rules-deep-dive/) — alwaysApply, globs, agent-requested mode behavior
- [OpenHands Docs — Skills Overview](https://docs.openhands.dev/overview/skills) — current `.agents/skills/` path, frontmatter fields
- [OpenHands microagents-repo docs](https://docs.all-hands.dev/modules/usage/prompting/microagents-repo) — repository microagent format
- [OpenHands trigger keywords PR](https://github.com/All-Hands-AI/OpenHands/pull/7516) — `trigger_type: keyword`, `triggers:` field implementation
- [openskills npm package](https://www.npmjs.com/package/openskills) — distribution mechanism
- [OpenHands skills registry](https://github.com/OpenHands/skills) — global skill submission target

---

## Research Gaps and Limitations

- **Stripe's exact llms.txt structure**: Could not fetch the live file at the time of research. Structure was inferred from secondary analysis articles.
- **OpenHands microagent live examples**: The `microagents/` directory path in the All-Hands-AI/OpenHands repo has been reorganized; specific canonical example files (docker.md, github.md) returned 404. The frontmatter format described is based on PR comments, docs, and secondary sources — confirmed consistent across multiple sources.
- **cursor.directory submission process**: The exact PR-based submission process was not fully documented in accessible sources. The general mechanism (community PRs to their GitHub) is confirmed.
- **llms-full.txt implementation effort**: The research confirms this is standard practice and expected, but no tooling spec for auto-generating it was found. Mintlify and similar doc platforms auto-generate it; custom implementations require scripting.
- **openskills registry URL**: The canonical skill registry at `openskills.cc` was found but the submission/publish process was not fully documented. `npx openskills install <name>` appears to pull from GitHub repos directly.

---

## Search Methodology

- Searches performed: 18
- Most productive search terms: "agentskills.io specification", "llms.txt examples Stripe Cloudflare Anthropic", "Cursor rules mdc frontmatter alwaysApply globs", "OpenHands microagent triggers frontmatter", "langfuse skills SKILL.md"
- Primary information sources: Official specification sites (llmstxt.org, agentskills.io, agents.md, docs.openhands.dev), GitHub source files (langfuse/skills, openai/codex, sanjeed5/awesome-cursor-rules-mdc), analysis articles (Mintlify blog, llms-txt.io)
- Direct file fetches that succeeded: Langfuse SKILL.md (raw GitHub), Cloudflare llms.txt, agentskills.io/specification, agents.md, OpenHands docs
