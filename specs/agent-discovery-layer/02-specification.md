---
slug: agent-discovery-layer
number: 12
created: 2026-02-22
status: draft
---

# Agent Discovery Layer — llms.txt, SKILL.md, AGENTS.md, Cursor Rules, OpenHands

**Status:** Draft
**Authors:** Claude Code, 2026-02-22
**Related:** specs/agent-integration-strategy.md (Feature 3), specs/agent-discovery-layer/01-ideation.md

---

## 1. Overview

Build five agent discovery artifacts that let any AI agent autonomously find Loop and understand how to use it. The artifacts ship as an npm package (`@dork-labs/loop`) at `packages/loop-skill/` plus a route handler in `apps/web/` for the llms.txt endpoint. Each artifact targets a distinct discovery moment — web browsing, installed skill, repo context, Cursor auto-attach, and OpenHands keyword trigger — so that Loop is reachable from every major agent platform.

## 2. Background / Problem Statement

Loop's REST API exists but agents can't discover it. Today, an agent working in a project that uses Loop has no way to know Loop exists unless a human manually provides API documentation. The industry has converged on a layered discovery stack:

1. **llms.txt** — web-crawlable documentation index (844,000+ sites)
2. **SKILL.md** — cross-agent installable capability (agentskills.io standard, adopted by Claude Code, Codex, Cursor, Amp, Goose)
3. **AGENTS.md** — repo-level context block (Linux Foundation standard, 60,000+ projects)
4. **Cursor rules** — IDE-specific auto-attach rules
5. **OpenHands microagent** — keyword-triggered knowledge injection

Products shipping the full stack (Stripe, Langfuse, DevCycle) see significantly better agent adoption — DevCycle achieved 3x SDK install rates with comprehensive agent-first onboarding.

## 3. Goals

- Ship all 5 discovery artifacts following their respective standards
- Publish `@dork-labs/loop` to npm, installable via `npx openskills install @dork-labs/loop`
- Serve llms.txt at `www.looped.me/llms.txt`
- Keep each artifact within its token budget (see Section 6.7)
- Include template files for setup CLI (Feature 5) to distribute to user repos
- Dogfood all artifacts in Loop's own repository

## 4. Non-Goals

- MCP server implementation (Feature 2, separate spec)
- Setup CLI that auto-writes files into user repos (Feature 5)
- TypeScript SDK (Feature 4)
- Dashboard changes
- Marketing site redesign (Feature 8)
- Documentation site content updates (Feature 7)
- `llms-full.txt` companion file (follow-up work after doc pages exist)
- `.md` suffix support on Fumadocs pages (follow-up, depends on Fumadocs config)
- cursor.directory submission (post-launch manual process)
- OpenHands global skills registry submission (post-launch)

## 5. Technical Dependencies

| Dependency   | Version | Purpose                                |
| ------------ | ------- | -------------------------------------- |
| `next`       | ^16     | Route handler for llms.txt in apps/web |
| `openskills` | latest  | SKILL.md distribution mechanism        |
| `tsup`       | latest  | Build/bundle for npm publishing        |
| `typescript` | ^5      | Type-checking                          |

**No runtime dependencies** for the `@dork-labs/loop` package — it's a pure markdown/content package with no executable code.

## 6. Detailed Design

### 6.1 Architecture

```
packages/loop-skill/
├── package.json                    # npm package config for @dork-labs/loop
├── tsup.config.ts                  # Build config (copies files to dist/)
├── SKILL.md                        # The Agent Skill (agentskills.io format)
├── references/
│   └── api.md                      # Full API reference (loaded on demand)
├── templates/
│   ├── AGENTS.md                   # AGENTS.md snippet for user repos
│   ├── loop.mdc                    # Cursor rule file
│   └── openhands-loop.md           # OpenHands microagent
└── README.md                       # npm package README

apps/web/
└── src/app/llms.txt/
    └── route.ts                    # GET handler → plain text markdown
```

Additionally, Loop's own repo receives dogfood copies:

```
AGENTS.md                           # Copy of templates/AGENTS.md
.cursor/rules/loop.mdc              # Copy of templates/loop.mdc
.openhands/microagents/loop.md      # Copy of templates/openhands-loop.md (legacy path)
```

### 6.2 Artifact 1: llms.txt Endpoint

**Route:** `apps/web/src/app/llms.txt/route.ts`
**URL:** `https://www.looped.me/llms.txt`
**Format:** Plain markdown following [llmstxt.org](https://llmstxt.org/) spec

```typescript
export async function GET() {
  return new Response(LLMS_TXT_CONTENT, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
```

**Content (inline constant):**

```markdown
# Loop

> Loop is the Autonomous Improvement Engine — an open-source data layer and
> prompt engine that turns signals into prioritized, actionable issues for
> AI agents. REST API at https://app.looped.me/api.

## Getting Started

- [Quick Start](https://www.looped.me/docs/quickstart): Install and create your first issue
- [Authentication](https://www.looped.me/docs/auth): Bearer token setup with `loop_` prefixed keys
- [Core Concepts](https://www.looped.me/docs/concepts): Signals, issues, projects, goals, dispatch

## Issues

- [List Issues](https://www.looped.me/docs/api/issues): GET /api/issues — filter by status, type, project
- [Create Issue](https://www.looped.me/docs/api/issues-create): POST /api/issues
- [Update Issue](https://www.looped.me/docs/api/issues-update): PATCH /api/issues/:id
- [Issue Relations](https://www.looped.me/docs/api/relations): Blocking and dependency graphs

## Signals

- [Ingest Signal](https://www.looped.me/docs/api/signals): POST /api/signals — creates signal + triage issue
- [PostHog Webhook](https://www.looped.me/docs/webhooks/posthog)
- [Sentry Webhook](https://www.looped.me/docs/webhooks/sentry)
- [GitHub Webhook](https://www.looped.me/docs/webhooks/github)

## Agent Dispatch

- [Get Next Task](https://www.looped.me/docs/api/dispatch): Highest-priority unblocked issue with instructions
- [Complete Task](https://www.looped.me/docs/api/complete): Report completion with outcome notes

## Projects and Goals

- [Projects](https://www.looped.me/docs/api/projects): Group issues toward shared objectives
- [Goals](https://www.looped.me/docs/api/goals): Measurable success indicators

## Prompt Templates

- [Templates](https://www.looped.me/docs/prompts/overview): Manage agent instruction templates
- [Versions](https://www.looped.me/docs/prompts/versions): Version control and promotion

## Agent Integration

- [Agent Skill](https://www.looped.me/docs/agent-skill): `npx openskills install @dork-labs/loop`
- [AGENTS.md Snippet](https://www.looped.me/docs/agents-md): Paste into your repo
- [Cursor Rule](https://www.looped.me/docs/cursor-rule): Auto-activates in Cursor
- [MCP Server](https://www.looped.me/docs/mcp): Native tool access via MCP

## Optional

- [Dashboard Stats](https://www.looped.me/docs/api/dashboard): System health metrics
- [OpenAPI Spec](https://app.looped.me/api/openapi.json): Machine-readable API schema
- [Self-Hosting](https://www.looped.me/docs/self-hosting)
```

**Notes:**

- Doc page URLs are forward-references — they point to where docs _will_ live once Feature 7 ships
- The content is an inline string constant, not a file read, for zero-latency serving
- Cache headers: 1h browser cache, 24h CDN cache
- No rewrite needed in `next.config.ts` — Next.js App Router directory-based routing handles `/llms.txt` natively via the `llms.txt/route.ts` path

### 6.3 Artifact 2: Agent Skill (SKILL.md)

**Location:** `packages/loop-skill/SKILL.md`
**Standard:** [agentskills.io](https://agentskills.io/specification)
**Distribution:** `npx openskills install @dork-labs/loop`

````markdown
---
name: loop
description: >
  Interact with Loop (looped.me), the autonomous improvement engine for AI-powered
  development. Use when: (1) creating, listing, or updating issues in Loop, (2) ingesting
  signals or anomalies into the triage queue, (3) fetching the next prioritized work item
  for an agent to execute, (4) managing projects, goals, or prompt templates, or
  (5) checking system health via the dashboard API. Loop's REST API is at
  https://app.looped.me/api with Bearer token auth.
license: MIT
compatibility: Requires internet access to reach https://app.looped.me
metadata:
  author: dork-labs
  version: '1.0'
---

# Loop

Loop is an autonomous improvement engine with a REST API at https://app.looped.me/api.
Two core capabilities: **issue management** (create, list, update, dispatch work items)
and **signal ingestion** (webhook-style data that auto-creates triage issues).

## Authentication

Set before making API calls:

```bash
export LOOP_API_KEY=loop_...
```
````

Base URL: `https://app.looped.me/api`
All `/api/*` endpoints require: `Authorization: Bearer $LOOP_API_KEY`

Get a key at https://app.looped.me/settings/api-keys.
If the env var is not set, ask the user for their API key.

## The Dispatch Loop

The core agent workflow:

1. **Get next task:** Fetch the highest-priority unblocked issue
2. **Do the work:** Execute what the issue describes
3. **Report completion:** Update the issue status and add outcome notes
4. **Create discovered issues:** If you find bugs or tasks during work, create new issues
5. **Repeat:** Get the next task

## Common Operations

### Get the next issue to work on

```bash
curl -H "Authorization: Bearer $LOOP_API_KEY" \
  "https://app.looped.me/api/issues?status=open&limit=1"
```

### Create an issue

```bash
curl -X POST -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Fix login redirect","type":"bug"}' \
  https://app.looped.me/api/issues
```

### Ingest a signal

```bash
curl -X POST -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"source":"agent","title":"Error rate spike","data":{"count":47}}' \
  https://app.looped.me/api/signals
```

### Complete an issue

```bash
curl -X PATCH -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status":"done"}' \
  https://app.looped.me/api/issues/{id}
```

### Add a progress comment

```bash
curl -X POST -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"body":"Investigating root cause...","authorName":"agent"}' \
  https://app.looped.me/api/issues/{id}/comments
```

## Issue Types

`signal` | `hypothesis` | `plan` | `task` | `monitor`

## Status Values

`triage` | `backlog` | `todo` | `in_progress` | `done` | `canceled`

## Error Handling

- **401:** Check `LOOP_API_KEY` is set and valid
- **404:** Issue/project ID doesn't exist — use list endpoints to find valid IDs
- **422:** Validation error — check required fields in request body

## Documentation

1. Fetch the docs index: `curl -s https://www.looped.me/llms.txt`
2. Full endpoint reference: see [references/api.md](references/api.md)

````

### 6.4 Artifact 2b: API Reference (references/api.md)

**Location:** `packages/loop-skill/references/api.md`
**Purpose:** Loaded on-demand when agents need full endpoint detail

This file contains the complete API endpoint reference table (all methods, paths, descriptions, request/response shapes) extracted from CLAUDE.md. It is NOT loaded on skill activation — only when the agent references it.

Content: The full protected API endpoint table from CLAUDE.md, formatted as a markdown reference with request/response examples for each endpoint.

### 6.5 Artifact 3: AGENTS.md Snippet

**Location:** `packages/loop-skill/templates/AGENTS.md`
**Standard:** [agents.md](https://agents.md/) (Linux Foundation)
**Target:** ~300-400 tokens, self-contained

```markdown
## Loop Integration

This project uses [Loop](https://looped.me) as its autonomous improvement engine.
Loop manages issues, signals, projects, and prompt templates via a REST API.

### Auth

API key is in `LOOP_API_KEY` (environment variable). All endpoints use:
`Authorization: Bearer $LOOP_API_KEY`

Base URL: `https://app.looped.me/api`

### When to Create a Loop Issue

- Bug found during work: `POST /api/issues` with `type: "bug"`
- External anomaly detected: `POST /api/signals`
- Task blocked by another: `POST /api/issues/:id/relations`

### Quick Reference

```bash
# List open issues
curl -H "Authorization: Bearer $LOOP_API_KEY" \
  "https://app.looped.me/api/issues?status=open"

# Create an issue
curl -X POST -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"...","type":"bug"}' \
  https://app.looped.me/api/issues

# Dashboard stats
curl -H "Authorization: Bearer $LOOP_API_KEY" \
  https://app.looped.me/api/dashboard/stats
````

### Docs

- Full API: https://www.looped.me/docs
- Machine-readable: https://www.looped.me/llms.txt
- Agent Skill: `npx openskills install @dork-labs/loop`

````

### 6.6 Artifact 4: Cursor Rules (loop.mdc)

**Location:** `packages/loop-skill/templates/loop.mdc`
**Standard:** Cursor MDC format
**Mode:** Agent-Requested (`alwaysApply: false`, no globs — agent reads description and decides)

```markdown
---
description: >
  Use when working with Loop (looped.me), the autonomous improvement engine.
  Apply when: creating or updating issues via the Loop API, ingesting signals,
  fetching the next work item for an agent, managing projects or goals, or
  accessing prompt templates. Loop API base: https://app.looped.me/api.
alwaysApply: false
---

# Loop — Autonomous Improvement Engine

## Auth

```bash
export LOOP_API_KEY=loop_...
````

All `/api/*` endpoints: `Authorization: Bearer $LOOP_API_KEY`

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
```

## Issue Types

`signal` | `hypothesis` | `plan` | `task` | `monitor`

## Status Values

`triage` | `backlog` | `todo` | `in_progress` | `done` | `canceled`

## Docs

Full API: https://www.looped.me/docs
Machine-readable: https://www.looped.me/llms.txt

````

### 6.7 Artifact 5: OpenHands Microagent

**Location:** `packages/loop-skill/templates/openhands-loop.md`
**Standard:** OpenHands knowledge microagent format
**Trigger:** Keyword-based — fires when "loop", "looped", "looped.me", "loop api", "loop issue", or "ingest signal" appear in conversation

```markdown
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

# Loop — Autonomous Improvement Engine

Loop is an open-source REST API for managing issues, signals, projects, and
prompt templates in an autonomous development workflow.

## API Base URL

````

https://app.looped.me/api

````

All protected endpoints require: `Authorization: Bearer $LOOP_API_KEY`

## Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/issues | List issues (filter: status, type, projectId) |
| POST | /api/issues | Create an issue |
| PATCH | /api/issues/:id | Update an issue |
| DELETE | /api/issues/:id | Soft-delete an issue |
| POST | /api/signals | Ingest a signal (creates signal + triage issue) |
| GET | /api/projects | List projects |
| POST | /api/projects | Create a project |
| GET | /api/goals | List goals |
| GET | /api/dashboard/stats | System health metrics |

## Create an Issue

```bash
curl -X POST \
  -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Fix login flow","type":"bug"}' \
  https://app.looped.me/api/issues
````

## Ingest a Signal

```bash
curl -X POST \
  -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"source":"agent","title":"Error spike","data":{"count":47}}' \
  https://app.looped.me/api/signals
```

## Documentation

Full docs: https://www.looped.me/docs
Machine-readable index: https://www.looped.me/llms.txt

````

### 6.8 Token Budgets

| Artifact | Target | Hard Limit | Notes |
|----------|--------|-----------|-------|
| llms.txt | ~800 tokens | None | Navigation index only |
| SKILL.md description | ~150 tokens | 1,024 chars | Always loaded at agent startup |
| SKILL.md body | ~2,500 tokens | 5,000 tokens | Loaded on activation |
| references/api.md | ~3,000 tokens | Unlimited | Loaded on-demand |
| AGENTS.md snippet | ~350 tokens | ~600 tokens | Loaded every session in integrated repos |
| loop.mdc | ~400 tokens | ~1,000 tokens | Loaded when agent decides relevance |
| OpenHands microagent | ~500 tokens | ~1,500 tokens | Loaded on keyword trigger |

### 6.9 Shared Content Nucleus

All five artifacts draw from the same core information:

| Element | Value |
|---------|-------|
| Product name | Loop |
| One-liner | Autonomous Improvement Engine |
| API base URL | `https://app.looped.me/api` |
| Auth mechanism | `Authorization: Bearer $LOOP_API_KEY` |
| Key env var | `LOOP_API_KEY` |
| Key prefix | `loop_` |
| Docs URL | `https://www.looped.me/docs` |
| llms.txt URL | `https://www.looped.me/llms.txt` |
| Issue types | signal, hypothesis, plan, task, monitor |
| Status values | triage, backlog, todo, in_progress, done, canceled |

Each artifact renders this nucleus differently for its consumption context.

### 6.10 Package Configuration

**`packages/loop-skill/package.json`:**

```json
{
  "name": "@dork-labs/loop",
  "version": "0.1.0",
  "description": "Agent skill for Loop — the autonomous improvement engine. Teaches AI agents how to use Loop's REST API.",
  "type": "module",
  "files": [
    "SKILL.md",
    "references/",
    "templates/",
    "README.md"
  ],
  "keywords": [
    "agent-skill",
    "openskills",
    "loop",
    "ai-agent",
    "mcp",
    "claude-code",
    "cursor",
    "codex"
  ],
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/dork-labs/loop",
    "directory": "packages/loop-skill"
  },
  "homepage": "https://looped.me"
}
````

**Notes:**

- No `main`, `bin`, or `exports` — this is a content-only package
- `files` explicitly lists what gets published (no build step needed)
- The `openskills` installer looks for `SKILL.md` at the package root

### 6.11 Dogfooding in Loop's Own Repo

Copy template files to Loop's own repo root for dogfooding:

| Source                                            | Destination                        | Purpose                                       |
| ------------------------------------------------- | ---------------------------------- | --------------------------------------------- |
| `packages/loop-skill/templates/AGENTS.md`         | `./AGENTS.md`                      | Agents working on Loop itself can use the API |
| `packages/loop-skill/templates/loop.mdc`          | `./.cursor/rules/loop.mdc`         | Cursor users working on Loop                  |
| `packages/loop-skill/templates/openhands-loop.md` | `./.openhands/microagents/loop.md` | OpenHands users working on Loop               |

These are maintained copies, not symlinks, since the repo-root files serve as "living examples" and may diverge slightly (e.g., using `localhost:5667` instead of production URLs for local dev context).

### 6.12 Files to Modify in Existing Codebase

1. **`apps/web/src/app/llms.txt/route.ts`** — New file: llms.txt route handler
2. **Root `package.json`** — No changes needed: `packages/*` workspace glob already includes `packages/loop-skill/`
3. **`turbo.json`** — No changes needed: content-only package has no build/test tasks
4. **`.gitignore`** — Add `.openhands/` and `.cursor/rules/loop.mdc` entries if not already present (these are intentionally committed)

## 7. User Experience

### Installing the Agent Skill

```bash
# Via openskills (recommended)
npx openskills install @dork-labs/loop

# Via npm directly
npm install @dork-labs/loop
```

After installation, agents see the Loop skill description at startup and can invoke it when relevant.

### Pasting the AGENTS.md Snippet

Teams add the Loop section to their repo's AGENTS.md:

```bash
# Quick add from hosted snippet
curl -s https://www.looped.me/agents-md-snippet.md >> AGENTS.md
```

Or copy from the docs/npm package.

### Cursor Rule Installation

```bash
# Manual
mkdir -p .cursor/rules
curl -s https://www.looped.me/cursor-rule > .cursor/rules/loop.mdc

# Or via setup CLI (Feature 5, future)
npx @dork-labs/loop-init
```

### OpenHands Microagent Installation

```bash
mkdir -p .openhands/microagents
curl -s https://www.looped.me/openhands-skill > .openhands/microagents/loop.md
```

## 8. Testing Strategy

### llms.txt Route Handler (`apps/web/`)

```typescript
// Purpose: Verify the llms.txt endpoint returns valid markdown with correct headers
test('GET /llms.txt returns markdown with correct content-type', async () => {
  // Call the route handler
  // Assert Content-Type: text/plain; charset=utf-8
  // Assert Cache-Control headers present
  // Assert body starts with "# Loop"
  // Assert body contains "## Getting Started" section
  // Assert body contains "## Agent Integration" section
});

// Purpose: Verify llms.txt contains all required sections
test('llms.txt contains all spec-required sections', async () => {
  // Parse response body
  // Assert H2 sections: Getting Started, Issues, Signals, Agent Dispatch,
  //   Projects and Goals, Prompt Templates, Agent Integration, Optional
});
```

### SKILL.md Validation

```bash
# Validate against agentskills.io spec (if skills-ref is available)
npx skills-ref validate packages/loop-skill/

# Manual validation checklist:
# - YAML frontmatter parses correctly
# - name field: lowercase, max 64 chars
# - description field: max 1024 chars
# - Body under 5000 tokens
# - references/ directory exists with api.md
```

### Token Budget Verification

```typescript
// Purpose: Ensure all artifacts stay within token budgets
test('SKILL.md description is under 1024 characters', async () => {
  // Parse YAML frontmatter from SKILL.md
  // Assert description.length <= 1024
});

test('SKILL.md body is under 5000 tokens', async () => {
  // Read SKILL.md, strip frontmatter
  // Estimate tokens (chars / 4 as rough approximation)
  // Assert < 5000 tokens
});

test('AGENTS.md snippet is under 600 tokens', async () => {
  // Read templates/AGENTS.md
  // Assert < 600 tokens
});
```

### Content Consistency

```typescript
// Purpose: Verify all artifacts reference the same API base URL
test('all artifacts use consistent API base URL', async () => {
  // Read all 5 artifact files
  // Assert each contains 'https://app.looped.me/api'
});

// Purpose: Verify all artifacts reference the same auth mechanism
test('all artifacts use consistent auth pattern', async () => {
  // Read all 5 artifact files
  // Assert each contains 'LOOP_API_KEY'
  // Assert each contains 'Authorization: Bearer'
});
```

## 9. Performance Considerations

- llms.txt is a static string response with aggressive caching (1h browser, 24h CDN) — sub-millisecond response time
- The `@dork-labs/loop` npm package is content-only (~50KB) — installs instantly
- SKILL.md description (~150 tokens) is the only always-loaded cost — minimal context window impact
- Cursor rule uses Agent-Requested mode — zero token cost when not relevant
- OpenHands microagent triggers only on specific keywords — no cost when Loop isn't mentioned

## 10. Security Considerations

- llms.txt is public — contains only information already in public docs
- All artifacts reference `$LOOP_API_KEY` as an env var — never contain actual keys
- AGENTS.md snippet uses env var syntax, not literal values
- curl examples use `$LOOP_API_KEY` variable substitution, not hardcoded tokens
- OpenHands microagent trigger keywords are all Loop-specific to avoid false activation on generic terms like "issue"

## 11. Documentation

Documentation updates deferred to Feature 7 (Documentation Update):

- "Use Loop with Claude Code" guide
- "Use Loop with Cursor" guide
- "Use Loop with OpenHands" guide
- "Use Loop with any agent" guide (AGENTS.md + llms.txt)
- Agent Skill installation reference

For now, the npm package README and the llms.txt Agent Integration section serve as primary docs.

## 12. Implementation Phases

### Phase 1: Package Scaffold + SKILL.md

Set up the `packages/loop-skill/` package and write the primary artifact:

- `packages/loop-skill/package.json`
- `packages/loop-skill/SKILL.md` — full skill with frontmatter and body
- `packages/loop-skill/references/api.md` — complete API endpoint reference
- `packages/loop-skill/README.md` — npm package README

**Milestone:** Package exists, SKILL.md validates against agentskills.io spec.

### Phase 2: Template Files

Write the three template artifacts:

- `packages/loop-skill/templates/AGENTS.md`
- `packages/loop-skill/templates/loop.mdc`
- `packages/loop-skill/templates/openhands-loop.md`

**Milestone:** All template files exist with correct frontmatter and content.

### Phase 3: llms.txt Endpoint

Add the route handler to the marketing site:

- `apps/web/src/app/llms.txt/route.ts` — GET handler returning markdown

**Milestone:** `www.looped.me/llms.txt` returns valid llmstxt.org-format markdown.

### Phase 4: Dogfooding + Tests

Copy templates to Loop's own repo and add tests:

- Copy `AGENTS.md` to repo root
- Copy `loop.mdc` to `.cursor/rules/`
- Copy `openhands-loop.md` to `.openhands/microagents/`
- Add route handler test for llms.txt
- Add token budget validation tests
- Add content consistency tests

**Milestone:** All artifacts tested, Loop repo dogfoods its own discovery layer.

## 13. Open Questions

_All clarifications from ideation have been resolved. No remaining open questions._

## 14. Related ADRs

| #   | Title                               | Relevance                                             |
| --- | ----------------------------------- | ----------------------------------------------------- |
| 23  | Use `loop_` prefix for API keys     | Auth examples in all artifacts use the `loop_` prefix |
| 24  | Use env hints for actionable errors | SKILL.md error handling section follows this pattern  |

## 15. References

- [llmstxt.org specification](https://llmstxt.org/) — llms.txt format standard
- [agentskills.io specification](https://agentskills.io/specification) — SKILL.md format, progressive disclosure
- [agents.md specification](https://agents.md/) — AGENTS.md cross-agent standard
- [Cursor rules deep dive](https://mer.vin/2025/12/cursor-ide-rules-deep-dive/) — MDC frontmatter format
- [OpenHands microagent docs](https://docs.openhands.dev/overview/skills) — Knowledge microagent format
- [Langfuse skills repo](https://github.com/langfuse/skills) — Reference implementation for API tool SKILL.md
- `research/20260222_ai_agent_tool_discovery_onboarding.md` — Primary research source
- `research/20260222_agent_discovery_layer_best_practices.md` — Detailed best practices per artifact
- `specs/agent-discovery-layer/01-ideation.md` — Ideation with codebase map and decisions
- `specs/agent-integration-strategy.md` — Feature 3 scope and dependencies
